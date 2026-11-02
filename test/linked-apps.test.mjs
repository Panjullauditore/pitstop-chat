import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,mkdir,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runLinkedCodex} from '../codex-linked.mjs';
import {runLinkedApp} from '../run-linked-app.mjs';
import {antigravityChats,listCodexChats,resolveAppLink,validChatId,validateWorkspace,nativeAntigravityFile} from '../linked-apps.mjs';
import {buildAgentArgs} from '../adapters.mjs';

const id='native-chat-123456';
async function fixture(t,mode='success'){
  const cwd=await mkdtemp(join(tmpdir(),'pitlane-linked-'));
  t.after(async()=>{assert.ok(cwd.startsWith(join(tmpdir(),'pitlane-linked-')));await rm(cwd,{recursive:true,force:true});});
  const script=join(cwd,'fake-app-server.mjs'),log=join(cwd,'calls.jsonl');
  await writeFile(script,`
    import {createInterface} from 'node:readline';
    import {appendFileSync} from 'node:fs';
    const mode=${JSON.stringify(mode)},chatId=${JSON.stringify(id)},cwd=${JSON.stringify(cwd)};
    const send=value=>process.stdout.write(JSON.stringify(value)+'\\n');
    createInterface({input:process.stdin}).on('line',line=>{
      const m=JSON.parse(line);appendFileSync(${JSON.stringify(log)},line+'\\n');
      const reply=result=>send({id:m.id,result});
      if(m.method==='initialize')reply({});
      if(m.method==='thread/list')reply({data:[{id:chatId,name:'Native project chat',cwd,status:{type:'notLoaded'}},{id:'temp',ephemeral:true}],nextCursor:'page-two'});
      if(m.method==='thread/read')reply({thread:{id:chatId,cwd,ephemeral:mode==='ephemeral',status:{type:mode==='busy'?'active':'notLoaded'}}});
      if(m.method==='thread/resume'){
        if(mode==='owned')return send({id:m.id,error:{code:-32600,message:'thread '+chatId+' already has an active writer'}});
        reply({model:'native-model',thread:{id:mode==='wrong-thread'?'different':chatId,cwd}});
      }
      if(m.method==='turn/start'){
        reply({turn:{id:'turn-1'}});send({method:'turn/started',params:{threadId:chatId,turn:{id:'turn-1'}}});
        if(mode==='approval')return send({id:999,method:'item/commandExecution/requestApproval',params:{threadId:chatId,turnId:'turn-1'}});
        send({method:'item/agentMessage/delta',params:{threadId:chatId,turnId:'turn-1',delta:'streamed answer'}});
        if(mode==='stop'||mode==='timeout')return;
        send({method:'item/completed',params:{threadId:chatId,turnId:'turn-1',item:{id:'answer-1',type:'agentMessage',phase:'final_answer',text:'Final native answer'}}});
        send({method:'turn/completed',params:{threadId:chatId,turn:{id:'turn-1',status:mode==='failed'?'failed':'completed',error:mode==='failed'?{message:'Native failed'}:null}}});
      }
      if(m.method==='turn/interrupt')reply({});
    });
  `);
  return {cwd,definition:{installed:true,command:process.execPath,script},link:{id,title:'Native project chat',cwd,source:'codex'},calls:async()=>JSON.parse('['+(await readFile(log,'utf8')).trim().split('\n').join(',')+']')};
}

test('Codex discovers persistent app chats and resumes exactly the selected native ID',async t=>{
  const f=await fixture(t),deltas=[];
  const chats=await listCodexChats(f.definition,{query:'Native'});assert.equal(chats.items.length,1);assert.equal(chats.nextCursor,'page-two');
  const link=await resolveAppLink('codex',{id},{definitions:{codex:f.definition}});assert.equal(link.cwd,f.cwd);assert.equal(link.id,id);
  const result=await runLinkedCodex(f.definition,link,'User request with context',{images:[{path:join(f.cwd,'photo.png')}],onDelta:text=>deltas.push(text)});
  assert.equal(result.text,'Final native answer');assert.equal(result.model,'native-model');assert.equal(result.nativeChat.id,id);assert.equal(result.nativeChat.history,'saved');assert.ok(deltas.includes('streamed answer'));
  const calls=await f.calls();assert.ok(!calls.some(m=>['thread/start','thread/fork'].includes(m.method)));
  const resume=calls.find(m=>m.method==='thread/resume');assert.deepEqual(resume.params,{threadId:id,excludeTurns:true});
  const start=calls.find(m=>m.method==='turn/start');assert.equal(start.params.threadId,id);assert.equal(start.params.input[1].type,'localImage');assert.equal(start.params.model,undefined);assert.equal(start.params.approvalPolicy,undefined);
});

for(const [mode,pattern] of [['busy',/busy/],['owned',/No message was sent.*shared app-server/],['ephemeral',/Ephemeral/],['wrong-thread',/different chat/],['failed',/Native failed/],['approval',/approval or interactive input/]])test('Linked Codex fails without a new-chat fallback: '+mode,async t=>{
  const f=await fixture(t,mode);
  await assert.rejects(runLinkedCodex(f.definition,f.link,'request'),pattern);
  const calls=await f.calls();assert.ok(!calls.some(m=>['thread/start','thread/fork'].includes(m.method)));
  if(['busy','owned','ephemeral','wrong-thread'].includes(mode))assert.ok(!calls.some(m=>m.method==='turn/start'));
  if(mode==='approval'){assert.ok(calls.some(m=>m.id===999&&m.error));assert.ok(!calls.some(m=>m.id===999&&m.result));assert.ok(calls.some(m=>m.method==='turn/interrupt'));}
});

test('Stop interrupts the same native turn; pre-aborted runs never spawn',async t=>{
  const f=await fixture(t,'stop'),controller=new AbortController();
  await assert.rejects(runLinkedCodex(f.definition,f.link,'request',{signal:controller.signal,onDelta:()=>controller.abort()}),{name:'AbortError'});
  const calls=await f.calls();assert.ok(calls.some(m=>m.method==='turn/interrupt'&&m.params.threadId===id&&m.params.turnId==='turn-1'));
  let spawned=false;await assert.rejects(runLinkedCodex(f.definition,f.link,'request',{signal:controller.signal,onChild:()=>{spawned=true;}}),{name:'AbortError'});assert.equal(spawned,false);
});

test('Codex timeout interrupts its turn instead of leaving it running',async t=>{
  const f=await fixture(t,'timeout');
  await assert.rejects(runLinkedCodex(f.definition,f.link,'request',{timeoutMs:700}),/timed out/);
  assert.ok((await f.calls()).some(m=>m.method==='turn/interrupt'&&m.params.threadId===id));
});

test('Antigravity verification requires appended matching payloads rather than changed timestamps',async t=>{
  const f=await fixture(t),root=join(f.cwd,'gemini'),folder=join(root,'antigravity','conversations');await mkdir(folder,{recursive:true});
  const {DatabaseSync}=await import('node:sqlite'),db=new DatabaseSync(join(folder,id+'.db'));
  db.exec('CREATE TABLE steps(idx INTEGER PRIMARY KEY,step_payload BLOB)');const insert=db.prepare('INSERT INTO steps VALUES(?,?)');
  insert.run(0,Buffer.from('Old prompt / old answer'));
  const link={...f.link,source:'antigravity'},before=await nativeAntigravityFile(link,{root});assert.equal(before.stepCount,1);
  insert.run(1,Buffer.from('protobuf-prefix exact request'));insert.run(2,Buffer.from('protobuf-prefix exact reply'));
  const after=await nativeAntigravityFile(link,{root,input:'exact request',reply:'exact reply',afterIndex:before.lastIndex});assert.equal(after.stepCount,3);assert.equal(after.hasInput,true);assert.equal(after.hasReply,true);
  const absent=await nativeAntigravityFile(link,{root,input:'Old prompt',reply:'old answer',afterIndex:before.lastIndex});assert.equal(absent.hasInput,false);assert.equal(absent.hasReply,false);db.close();
});

test('Antigravity App links require the native bridge and never start a CLI copy',async t=>{
  const f=await fixture(t),link={...f.link,source:'antigravity',transport:'remote-app'},definitions={antigravity:{installed:true,command:'fake'}};
  await assert.rejects(runLinkedApp('antigravity',link,'request',{}, {definitions}),/bridge is not connected/);
  let received;
  const result=await runLinkedApp('antigravity',link,'request',{images:[]},{definitions,runNativeApp:async(target,prompt,options)=>{received={target,prompt,options};return {text:'Native App reply',nativeChat:{id:target.id,history:'saved'}};}});
  assert.equal(received.target.id,id);assert.match(received.prompt,/Pitlane/);assert.equal(result.nativeChat.id,id);
  await assert.rejects(runLinkedApp('antigravity',{...link,transport:undefined},'request',{}, {definitions}),/no CLI copy was started/);
  await assert.rejects(runLinkedApp('antigravity',{...link,source:'antigravity-cli'},'request',{}, {definitions}),/unsupported/);
});

test('Antigravity discovery reads metadata only, excludes cached CLI copies and validates folders',async t=>{
  const f=await fixture(t),{DatabaseSync}=await import('node:sqlite');
  const root=join(f.cwd,'gemini'),scope=join(root,'antigravity');await mkdir(scope,{recursive:true});
  const path=join(scope,'conversation_summaries.db'),db=new DatabaseSync(path);
  db.exec('CREATE TABLE conversation_summaries(conversation_id TEXT,title TEXT,workspace_uris TEXT,status TEXT,app_data_dir TEXT,source TEXT,step_count INTEGER,last_modified_time INTEGER)');
  const insert=db.prepare('INSERT INTO conversation_summaries VALUES(?,?,?,?,?,?,?,?)');
  insert.run(id,'App chat',JSON.stringify([pathToFileURL(f.cwd).href]),'idle','antigravity','APP',3,1);
  insert.run('cached-cli-chat','CLI copy','[]','idle','antigravity-cli','CORTEX_TRAJECTORY_SOURCE_CLI',1,1);db.close();
  const before=await stat(path),result=await antigravityChats({root});assert.equal(result.items.length,1);assert.equal(result.items[0].id,id);assert.equal(result.items[0].cwd,f.cwd);
  const link=await resolveAppLink('antigravity',{id,source:'antigravity'},{geminiRoot:root});assert.equal(link.state,'needs-bridge');assert.equal((await stat(path)).mtimeMs,before.mtimeMs);
  const edit=new DatabaseSync(path);edit.prepare('UPDATE conversation_summaries SET workspace_uris = ? WHERE conversation_id = ?').run('[]',id);edit.close();
  const automatic=await resolveAppLink('antigravity',{id,source:'antigravity'},{geminiRoot:root,workspaceFallback:f.cwd});assert.equal(automatic.cwd,f.cwd);assert.equal(automatic.transport,'remote-app');
  await assert.rejects(resolveAppLink('antigravity',{id:'../outside',source:'antigravity'},{geminiRoot:root}),/valid native chat/);
  assert.equal(validChatId('../outside'),false);await assert.rejects(validateWorkspace('relative/path'),/absolute/);
});
