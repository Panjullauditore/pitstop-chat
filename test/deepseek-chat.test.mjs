import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import vm from 'node:vm';
import {deepseekChat} from '../deepseek-chat.mjs';

const chatId='7854bf2d-6b2d-47e7-b186-d531702e179c',url='https://chat.deepseek.com/a/chat/s/'+chatId;

test('DeepSeek links accept conversation URLs only, not another origin or ambiguous paths',()=>{
  assert.deepEqual(deepseekChat(url),{id:chatId,url});
  assert.equal(deepseekChat(url.replace('/a/chat/','/chat/')).id,chatId);
  for(const value of ['https://example.com/a/chat/s/'+chatId,'https://chat.deepseek.com/','https://chat.deepseek.com@evil.test/a/chat/s/'+chatId,url+'?token=secret',url+'#other','file:///tmp/chat'])assert.throws(()=>deepseekChat(value));
});

test('worker reuses the selected tab and leaves it open after its own task',async()=>{
  const calls=[],listeners=[];let created=0,removed=0;
  const sandbox={URL,Promise,setTimeout,clearTimeout,AbortSignal,
    fetch:async(path,options)=>{calls.push({path,body:JSON.parse(options.body)});return {ok:true,json:async()=>({accepted:true})};},
    chrome:{storage:{local:{setAccessLevel:()=>{},get:async()=>({}),set:async()=>{}},session:{get:async()=>({}),set:async()=>{},remove:async()=>{}}},
      runtime:{onMessage:{addListener:fn=>listeners.push(fn)},onStartup:{addListener:()=>{}}},alarms:{create:()=>{},onAlarm:{addListener:()=>{}}},
      tabs:{query:async()=>[{id:77,url}],get:async()=>({id:77,url}),create:async()=>{created++;throw Error('Should reuse existing chat tab');},remove:async()=>{removed++;},sendMessage:async(_id,message)=>({ready:true,accepted:true})}}};
  const context=vm.createContext(sandbox);
  vm.runInContext((await readFile(new URL('../extension/background.js',import.meta.url),'utf8')).replace("import './app-worker.js';",''),context);await new Promise(done=>setTimeout(done,0));
  sandbox._job={id:'request-1',chatUrl:url,chatId,prompt:'Next message',images:[]};
  await vm.runInContext('start(_job)',context);
  assert.equal(created,0);assert.equal(vm.runInContext('active.tabId',context),77);
  const result=await new Promise(done=>listeners[0]({action:'event',requestId:'request-1',kind:'rendered',text:'Answer',final:true,chatId},{tab:{id:77},url},done));
  assert.equal(result.accepted,true);assert.equal(removed,0);assert.equal(vm.runInContext('active',context),null);
  assert.equal(calls.at(-1).body.chatId,chatId);
});

test('persistent content reader refuses to overwrite a human draft',async()=>{
  const listeners=[],runtime=[];let writes=0,clicks=0,resolveEvent;
  const eventReceived=new Promise(resolve=>{resolveEvent=resolve;});
  class Textarea{getClientRects(){return [{}];}get value(){return 'Human draft';}set value(_value){writes++;}dispatchEvent(){}}
  const field=new Textarea();field.parentElement={parentElement:{querySelector:()=>({classList:{contains:()=>false},click:()=>{clicks++;}})}};
  const sandbox={URL,Event,HTMLTextAreaElement:Textarea,setTimeout,clearTimeout,setInterval,clearInterval,
    location:{origin:'https://chat.deepseek.com',pathname:'/a/chat/s/'+chatId},
    document:{querySelectorAll:()=>[field],querySelector:()=>({}),documentElement:{setAttribute:()=>{}}},
    addEventListener:(_name,fn)=>listeners.push(fn),chrome:{runtime:{onMessage:{addListener:fn=>runtime.push(fn)},sendMessage:async value=>{resolveEvent(value);return {accepted:true};}}}};
  sandbox.window=sandbox;sandbox._listeners=listeners;sandbox.queueMicrotask=queueMicrotask;const context=vm.createContext(sandbox);
  vm.runInContext("window.postMessage=data=>queueMicrotask(()=>_listeners.forEach(fn=>fn({source:window,origin:location.origin,data:data.kind==='ping'?{source:'pitlane-page',kind:'ready',version:2}:{source:'pitlane-page',kind:'armed',version:2,id:data.id}})))",context);
  vm.runInContext(await readFile(new URL('../extension/content.js',import.meta.url),'utf8'),context);await new Promise(done=>setTimeout(done,0));
  runtime[0]({action:'run',job:{id:'job1',chatId,prompt:'Do not replace the draft',images:[]}},{},()=>{});
  const result=await eventReceived;assert.equal(result.kind,'error');assert.match(result.message,/draft or active response/);assert.equal(writes,0);assert.equal(clicks,0);
});

test('HTTP linked DeepSeek keeps one chat ID, sends incremental context and rejects another-chat reply',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'pitstop-deepseek-'));let child;
  t.after(async()=>{if(child&&child.exitCode===null){const closed=new Promise(done=>child.once('exit',done));child.kill();await closed;}assert.ok(directory.startsWith(join(tmpdir(),'pitstop-deepseek-')));await rm(directory,{recursive:true,force:true});});
  const base=await new Promise((resolve,reject)=>{child=spawn(process.execPath,['server.mjs'],{windowsHide:true,env:{...process.env,ROOM_PORT:'0',ROOM_DATA_DIR:directory,ROOM_SKIP_CLI_CHECKS:'1'},stdio:['ignore','pipe','pipe']});let output='';const timer=setTimeout(()=>reject(Error(output||'Server timeout')),10000);const consume=chunk=>{output+=chunk;const match=output.match(/ready: (http:\/\/127.0.0.1:\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}};child.stdout.on('data',consume);child.stderr.on('data',consume);child.once('error',reject);});
  const bootstrap=await(await fetch(base+'/api/bootstrap')).json();
  const api=async(path,input,headers={})=>{const response=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{'X-Room-Token':bootstrap.token,'Content-Type':'application/json',...headers},...(input!==undefined?{body:JSON.stringify(input)}:{})});return {status:response.status,data:await response.json()};};
  assert.equal((await api('/api/web-agent/connect',{name:'DeepSeek'})).status,200);
  const project=await api('/api/projects/new',{name:'One DeepSeek chat',agentIds:['deepseek']});const projectId=project.data.state.projects[0].id;
  const linked=await api('/api/projects/linked-apps',{projectId,links:{deepseek:{id:chatId,remoteUrl:url}}});assert.equal(linked.status,200);assert.equal(linked.data.state.projects[0].linkedApps.deepseek.id,chatId);
  assert.equal((await api('/api/projects/linked-apps',{projectId,links:{deepseek:{remoteUrl:'https://evil.test/'+chatId}}})).status,400);
  const code=(await api('/api/web-agent/extension/pair-code',{})).data.code;
  const token=(await api('/api/bridge/pair',{code})).data.token;
  const headers={Authorization:'Bearer '+token};
  await api('/api/bridge/poll',{ready:true,capabilities:{persistentChat:true}},headers);
  const waitDone=async id=>{for(let attempt=0;attempt<100;attempt++){const state=(await api('/api/bootstrap')).data.state;if(!state.run&&state.lastRun?.id===id)return state;await new Promise(done=>setTimeout(done,10));}throw Error('Run did not settle');};
  const jobs=[];let state;
  for(let turn=0;turn<2;turn++){
    const sent=await api('/api/send',{text:'Short message '+turn,mode:'deepseek',syncMemory:false});assert.equal(sent.status,202);
    const job=(await api('/api/bridge/poll',{ready:true,capabilities:{persistentChat:true}},headers)).data.job;jobs.push(job);assert.equal(job.chatUrl,url);assert.equal(job.chatId,chatId);
    assert.equal((await api('/api/bridge/event',{requestId:job.id,kind:'rendered',chatId,text:'DeepSeek answer '+turn,final:true},headers)).status,200);
    state=await waitDone(sent.data.runId);assert.equal(state.messages.at(-1).nativeChat.id,chatId);assert.equal(state.messages.at(-1).status,'done');
  }
  assert.match(jobs[0].prompt,/full context/);assert.match(jobs[1].prompt,/incremental context/);assert.doesNotMatch(jobs[1].prompt,/Short message 0|DeepSeek answer 0/);
  const receipt=state.projects[0].linkedApps.deepseek.contextSync;
  const sent=await api('/api/send',{text:'Wrong chat must fail',mode:'deepseek',syncMemory:false});
  const job=(await api('/api/bridge/poll',{ready:true,capabilities:{persistentChat:true}},headers)).data.job;
  assert.equal((await api('/api/bridge/event',{requestId:job.id,kind:'rendered',chatId:'00000000-0000-0000-0000-000000000000',text:'Wrong reply',final:true},headers)).status,400);
  state=await waitDone(sent.data.runId);assert.equal(state.messages.at(-1).status,'error');assert.deepEqual(state.projects[0].linkedApps.deepseek.contextSync,receipt);
});
