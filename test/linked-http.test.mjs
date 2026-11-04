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
    import {createInterface} from 'node:readline';import {appendFileSync,existsSync} from 'node:fs';
    const id=${JSON.stringify(id)},cwd=${JSON.stringify(directory)},send=m=>console.log(JSON.stringify(m));
    createInterface({input:process.stdin}).on('line',line=>{
      const m=JSON.parse(line);appendFileSync(${JSON.stringify(log)},line+'\\n');const reply=result=>send({id:m.id,result});
      if(m.method==='initialize')reply({});
      if(m.method==='thread/loaded/list')reply({data:existsSync(${JSON.stringify(join(directory,'wrong-server'))})?[]:[id]});
      if(m.method==='thread/list')reply({data:[{id,name:'Existing App chat',cwd}]});
      if(m.method==='thread/read')reply({thread:{id,name:'Existing App chat',cwd,status:{type:'notLoaded'}}});
      if(m.method==='thread/resume'){if(existsSync(${JSON.stringify(join(directory,'wrong-server'))}))send({id:m.id,error:{message:'thread already has an active writer'}});else reply({model:'native-selected-model',thread:{id,cwd}});}
      if(m.method==='turn/start'){
        reply({turn:{id:'turn-1'}});
        if(existsSync(${JSON.stringify(join(directory,'fail-turn'))})){setTimeout(()=>send({method:'turn/completed',params:{threadId:id,turn:{id:'turn-1',status:'failed',error:{message:'Simulated native failure'}}}}),20);return;}
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
  await request('/api/soul',{content:'# TOKEN_TEST_SOUL\n'+('Communication rule.\n'.repeat(150)),revision:linked.state.brain.soul.revision});
  await request('/api/project-memory',{content:'# TOKEN_TEST_CORE\n'+('Approved project detail.\n'.repeat(180)),revision:linked.state.projectMemory.revision});
  for(let session=0;session<3;session++){
    if(session===1)await request('/api/sessions/new',{projectId});
    const controller=new AbortController(),stream=await fetch(base+'/api/events?token='+bootstrap.token,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(6000)])}),reader=stream.body.getReader(),decoder=new TextDecoder();await reader.read();
    const sent=await request('/api/send',{text:'Native test '+session,mode:'codex',syncMemory:false});
    let saved=null,finished=false,buffer="";
    while(!saved||!finished){const chunk=await reader.read();assert.equal(chunk.done,false);buffer+=decoder.decode(chunk.value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines)if(line.startsWith('data: ')){try{const snapshot=JSON.parse(line.slice(6));const message=snapshot.messages?.at(-1);if(message?.nativeChat&&message.status==='done'&&message.runId===sent.runId)saved=message;if(saved&&!snapshot.run&&snapshot.lastRun?.id===sent.runId)finished=true;}catch{}}}
    assert.equal(saved.nativeChat.id,id);assert.equal(saved.text,'HTTP_NATIVE_REPLY');assert.equal(saved.model,'native-selected-model');controller.abort();await reader.cancel().catch(()=>{});
  }
  const after=await(await fetch(base+'/api/bootstrap')).json();assert.equal(after.state.projects[0].linkedApps.codex.state,'saved');assert.ok(after.state.projects[0].linkedApps.codex.lastSyncedAt);
  const relinked=await request('/api/projects/linked-apps',{projectId,links:{codex:{id}}});
  assert.deepEqual(relinked.state.projects[0].linkedApps.codex,after.state.projects[0].linkedApps.codex);
  await writeFile(join(directory,'fail-turn'),'Fail without confirming native history');
  const failed=await request('/api/send',{text:'Failed delivery must not advance context',mode:'codex',syncMemory:false});
  let failureState;
  for(let attempt=0;attempt<100;attempt++){const current=(await(await fetch(base+'/api/bootstrap')).json()).state;if(current.lastRun?.id===failed.runId&&!current.run){failureState=current;break;}await new Promise(done=>setTimeout(done,10));}
  assert.ok(failureState);assert.equal(failureState.messages.at(-1).status,'error');
  assert.deepEqual(failureState.projects[0].linkedApps.codex.contextSync,after.state.projects[0].linkedApps.codex.contextSync);
  const ready=await request('/api/agents/check',{agent:'codex'});assert.equal(ready.agents.find(a=>a.id==='codex').connection,'connected');
  await writeFile(join(directory,'wrong-server'),'no selected native chat');
  const disconnected=await request('/api/agents/check',{agent:'codex'});assert.equal(disconnected.agents.find(a=>a.id==='codex').connection,'disconnected');
  assert.match(disconnected.agents.find(a=>a.id==='codex').connectionDetail,/held by Codex App/);
  const calls=(await readFile(log,'utf8')).trim().split('\n').map(JSON.parse),turns=calls.filter(m=>m.method==='turn/start');assert.equal(turns.length,4);assert.ok(turns.every(m=>m.params.threadId===id));assert.ok(!calls.some(m=>['thread/start','thread/fork'].includes(m.method)));
  const prompts=turns.map(turn=>turn.params.input.find(item=>item.type==='text').text);
  assert.match(prompts[0],/TOKEN_TEST_SOUL/);assert.match(prompts[0],/TOKEN_TEST_CORE/);
  assert.doesNotMatch(prompts[1],/TOKEN_TEST_SOUL|TOKEN_TEST_CORE/);assert.doesNotMatch(prompts[2],/TOKEN_TEST_SOUL|TOKEN_TEST_CORE|Native test 0|Native test 1|HTTP_NATIVE_REPLY/);
  assert.match(prompts[2],/Native test 2/);assert.ok(prompts[2].length<prompts[0].length/2);
  assert.equal(after.state.projects[0].linkedApps.codex.contextSync.lastDelivery.mode,'incremental');
  const saved=JSON.parse(await readFile(join(directory,'sessions.json'),'utf8'));
  assert.equal(saved.projects[0].linkedApps.codex.contextSync.lastDelivery.mode,'incremental');
  assert.ok(!JSON.stringify(saved.projects[0].linkedApps.codex.contextSync).includes('TOKEN_TEST_SOUL'));
});
