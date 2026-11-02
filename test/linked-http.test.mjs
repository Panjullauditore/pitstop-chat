import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('HTTP project linking sends sibling sessions to the same native chat and emits saved history over SSE',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'pitlane-linked-http-')),script=join(directory,'native.mjs'),log=join(directory,'calls.jsonl'),id='selected-native-1234';let child;
  t.after(async()=>{if(child&&child.exitCode===null){const exited=new Promise(done=>child.once('exit',done));child.kill();await exited;}assert.ok(directory.startsWith(join(tmpdir(),'pitlane-linked-http-')));await rm(directory,{recursive:true,force:true});});
  await writeFile(script,`
    import {createInterface} from 'node:readline';import {appendFileSync} from 'node:fs';
    const id=${JSON.stringify(id)},cwd=${JSON.stringify(directory)},send=m=>console.log(JSON.stringify(m));
    createInterface({input:process.stdin}).on('line',line=>{
      const m=JSON.parse(line);appendFileSync(${JSON.stringify(log)},line+'\\n');const reply=result=>send({id:m.id,result});
      if(m.method==='initialize')reply({});
      if(m.method==='thread/list')reply({data:[{id,name:'Existing App chat',cwd}]});
      if(m.method==='thread/read')reply({thread:{id,name:'Existing App chat',cwd,status:{type:'notLoaded'}}});
      if(m.method==='thread/resume')reply({model:'native-selected-model',thread:{id,cwd}});
      if(m.method==='turn/start'){
        reply({turn:{id:'turn-1'}});
        setTimeout(()=>send({method:'item/agentMessage/delta',params:{threadId:id,turnId:'turn-1',delta:'HTTP_NATIVE_REPLY'}}),40);
        setTimeout(()=>{send({method:'item/completed',params:{threadId:id,turnId:'turn-1',item:{id:'answer',type:'agentMessage',text:'HTTP_NATIVE_REPLY',phase:'final_answer'}}});send({method:'turn/completed',params:{threadId:id,turn:{id:'turn-1',status:'completed'}}});},80);
      }
    });
  `);
  const base=await new Promise((resolve,reject)=>{
    child=spawn(process.execPath,['server.mjs'],{cwd:process.cwd(),windowsHide:true,env:{...process.env,ROOM_DATA_DIR:directory,ROOM_PORT:'0',ROOM_SKIP_CLI_CHECKS:'1',ROOM_CODEX_SCRIPT:script},stdio:['ignore','pipe','pipe']});
    let output='';const timer=setTimeout(()=>reject(new Error(output)),10000);const consume=data=>{output+=data;const match=output.match(/ready: (http:\/\/127.0.0.1:\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}};child.stdout.on('data',consume);child.stderr.on('data',consume);child.once('error',reject);
  });
  const bootstrap=await(await fetch(base+'/api/bootstrap')).json();
  const request=async(path,input,method='POST')=>{const res=await fetch(base+path,{method,headers:{'X-Room-Token':bootstrap.token,'Content-Type':'application/json'},...(input?{body:JSON.stringify(input)}:{})});const data=await res.json();assert.ok(res.ok,JSON.stringify(data));return data;};
  const {state}=await request('/api/projects/new',{name:'Linked project',agentIds:['codex']});const projectId=state.projects[0].id;
  const list=await request('/api/linked-apps/chats?provider=codex',null,'GET');assert.equal(list.items[0].id,id);
  const linked=await request('/api/projects/linked-apps',{projectId,links:{codex:{id}}});assert.equal(linked.state.projects[0].linkedApps.codex.id,id);
  for(let session=0;session<2;session++){
    if(session)await request('/api/sessions/new',{projectId});
    const controller=new AbortController(),stream=await fetch(base+'/api/events?token='+bootstrap.token,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(6000)])}),reader=stream.body.getReader(),decoder=new TextDecoder();await reader.read();
    await request('/api/send',{text:'Native test '+session,mode:'codex',syncMemory:false});
    let saved=null;
    while(!saved){const chunk=await reader.read();assert.equal(chunk.done,false);const text=decoder.decode(chunk.value);for(const line of text.split('\n'))if(line.startsWith('data: ')){try{const snapshot=JSON.parse(line.slice(6));const message=snapshot.messages?.at(-1);if(message?.nativeChat&&message.status==='done')saved=message;}catch{}}}
    assert.equal(saved.nativeChat.id,id);assert.equal(saved.text,'HTTP_NATIVE_REPLY');assert.equal(saved.model,'native-selected-model');controller.abort();await reader.cancel().catch(()=>{});
  }
  const after=await(await fetch(base+'/api/bootstrap')).json();assert.equal(after.state.projects[0].linkedApps.codex.state,'saved');assert.ok(after.state.projects[0].linkedApps.codex.lastSyncedAt);
  const relinked=await request('/api/projects/linked-apps',{projectId,links:{codex:{id}}});
  assert.deepEqual(relinked.state.projects[0].linkedApps.codex,after.state.projects[0].linkedApps.codex);
  const calls=(await readFile(log,'utf8')).trim().split('\n').map(JSON.parse),turns=calls.filter(m=>m.method==='turn/start');assert.equal(turns.length,2);assert.ok(turns.every(m=>m.params.threadId===id));assert.ok(!calls.some(m=>['thread/start','thread/fork'].includes(m.method)));
});
