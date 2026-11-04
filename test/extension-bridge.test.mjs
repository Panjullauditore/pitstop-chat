import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vm from 'node:vm';
import {ExtensionBridge} from '../extension-bridge.mjs';

async function fixture(t,options={}){
  const directory=await mkdtemp(join(tmpdir(),'pitlane-extension-'));
  const bridge=new ExtensionBridge({directory,extensionId:'fixture',timeout:1000,...options});await bridge.load();
  t.after(async()=>{bridge.close();assert.ok(directory.startsWith(join(tmpdir(),'pitlane-extension-')));await rm(directory,{recursive:true,force:true});});
  return {bridge,directory};
}
async function connected(bridge){const code=bridge.issueCode().code;const {token}=await bridge.pair(code);bridge.poll({ready:true,capabilities:{persistentChat:true}});return token;}
const frame=event=>'data: '+JSON.stringify(event)+'\n\n';
const response=text=>frame({v:{response:{fragments:[{type:'THINK',content:'Private thought'},{type:'RESPONSE',content:text}],status:'FINISHED'}}});

test('pair codes expire, work once, and persist only a scoped credential hash',async t=>{
  let now=1000;const {bridge,directory}=await fixture(t,{now:()=>now});
  assert.equal(bridge.snapshot().status,'unpaired');
  const expired=bridge.issueCode().code;now+=300001;await assert.rejects(bridge.pair(expired),/expired/);
  const code=bridge.issueCode().code;await assert.rejects(bridge.pair('wrong'),/invalid/);
  const {token}=await bridge.pair(code);await assert.rejects(bridge.pair(code),/invalid/);
  assert.equal(bridge.authorize(token),true);assert.equal(bridge.authorize('wrong'),false);
  const stored=await readFile(join(directory,'browser-bridge.json'),'utf8');assert.ok(!stored.includes(token));assert.ok(!stored.includes(code));
  const copy=new ExtensionBridge({directory,extensionId:'fixture'});await copy.load();t.after(()=>copy.close());assert.equal(copy.authorize(token),true);assert.equal(copy.snapshot().connected,false);
  await bridge.revoke();assert.equal(bridge.authorize(token),false);
});
test('jobs are claimed once; streams and images stay scoped to the current request',async t=>{
  const {bridge}=await fixture(t);await connected(bridge);const deltas=[],images=[{id:'one',name:'photo.jpg',path:'private-path'}];
  const run=bridge.run('Soul + Project Memory + latest prompt',{images,onDelta:text=>deltas.push(text)});
  assert.equal(bridge.snapshot().request.phase,'queued');
  assert.ok(bridge.snapshot().request.startedAt);
  const job=bridge.poll({ready:true}).job;assert.equal(job.prompt,'Soul + Project Memory + latest prompt');assert.deepEqual(job.images,[{id:'one',name:'photo.jpg'}]);
  assert.equal(bridge.snapshot().request.phase,'waiting-stream');
  assert.ok(!JSON.stringify(bridge.snapshot()).includes('Soul + Project Memory'));
  assert.equal(bridge.poll({ready:true,activeJobId:job.id}).job,null);
  assert.throws(()=>bridge.image('old','one'),/expired/);assert.throws(()=>bridge.image(job.id,'other'),/belong/);assert.equal(bridge.image(job.id,'one').path,'private-path');
  assert.throws(()=>bridge.event({requestId:'old',kind:'done'}),/ended/);
  bridge.event({requestId:job.id,kind:'start',status:200,type:'text/event-stream'});
  assert.equal(bridge.snapshot().request.phase,'waiting-answer');
  bridge.event({requestId:job.id,kind:'chunk',chunk:response('Browser answer')});
  assert.equal(bridge.snapshot().request.phase,'receiving-answer');
  assert.ok(bridge.snapshot().request.receivedBytes>0);
  bridge.event({requestId:job.id,kind:'done'});
  assert.equal(await run,'Browser answer');assert.deepEqual(deltas,['Browser answer']);assert.throws(()=>bridge.event({requestId:job.id,kind:'done'}),/ended/);
  assert.equal(bridge.snapshot().request,null);
});
test('Stop, worker restart and stale heartbeat fail closed instead of reviving a request',async t=>{
  let now=1000;const {bridge}=await fixture(t,{now:()=>now});await connected(bridge);
  const controller=new AbortController(),run=bridge.run('Stop this',{signal:controller.signal}),job=bridge.poll({ready:true}).job;
  controller.abort();await assert.rejects(run,{name:'AbortError'});assert.equal(bridge.poll({ready:true,activeJobId:job.id}).cancel,job.id);
  const restarted=bridge.run('Worker lost');bridge.poll({ready:true});bridge.poll({ready:true,activeJobId:null});await assert.rejects(restarted,/restarted/);
  now+=45001;assert.equal(bridge.snapshot().connected,false);await assert.rejects(bridge.run('Offline'),/Open DeepSeek/);
});

test('a live browser heartbeat does not hide a missing reply stream',async t=>{
  const {bridge}=await fixture(t,{timeout:20});await connected(bridge);
  const run=bridge.run('No duplicate retry');const job=bridge.poll({ready:true}).job;
  assert.equal(bridge.poll({ready:true,activeJobId:job.id}).browser.connected,true);
  await assert.rejects(run,/no response stream arrived/);
  assert.equal(bridge.snapshot().request,null);
});

test('an older worker cannot silently turn a persistent request into a new chat',async t=>{
  const {bridge}=await fixture(t);await connected(bridge);
  const chatUrl='https://chat.deepseek.com/a/chat/s/7854bf2d-6b2d-47e7-b186-d531702e179c';
  bridge.poll({ready:true});
  await assert.rejects(bridge.run('Do not create another chat',{chatUrl}),/1\.2\.0/);assert.equal(bridge.job,null);
  bridge.poll({ready:true,capabilities:{persistentChat:true}});
  const pending=bridge.run('Do not claim with an old worker',{chatUrl});
  assert.equal(bridge.poll({ready:true}).job,null);await assert.rejects(pending,/1\.2\.0/);
});

test('DeepSeek disconnect immediately overrides busy and expires without another browser poll',async t=>{
  let now=1000;const {bridge}=await fixture(t,{now:()=>now});await connected(bridge);
  const run=bridge.run('Disconnect me');const job=bridge.poll({ready:true}).job;
  bridge.poll({ready:false,activeJobId:job.id});
  assert.equal(bridge.snapshot().connected,false);assert.equal(bridge.snapshot().status,'disconnected');
  await assert.rejects(run,/disconnected/);
  bridge.poll({ready:true});assert.equal(bridge.snapshot().connected,true);
  now+=12000;assert.equal(bridge.snapshot().connected,false);assert.equal(bridge.snapshot().status,'disconnected');
  let emitted;bridge.once('change',state=>{emitted=state;});bridge.changed();assert.equal(emitted.connected,false);
  assert.equal(bridge.snapshot().paired,true);
});

test('DeepSeek worker requires a responsive page, not merely an active job object',async()=>{
  let reply={ready:false,readerReady:false,activeJobId:null},closed=false;
  const context=vm.createContext({Promise,setTimeout,clearTimeout,AbortSignal,
    chrome:{storage:{local:{setAccessLevel:()=>{},get:async()=>({})},session:{get:async()=>({})}},
      runtime:{onMessage:{addListener:()=>{}},onStartup:{addListener:()=>{}}},
      alarms:{create:()=>{},onAlarm:{addListener:()=>{}}},
      tabs:{sendMessage:async()=>{if(closed)throw Error('Closed tab');return reply;}}}
  });
  const source=(await readFile(new URL('../extension/background.js',import.meta.url),'utf8')).replace("import './app-worker.js';",'');
  vm.runInContext(source,context);await new Promise(resolve=>setTimeout(resolve,0));
  vm.runInContext("active={id:'request-1',tabId:7}",context);
  assert.equal(await vm.runInContext('activeTabReady()',context),false);
  reply={ready:false,readerReady:true,activeJobId:'request-1'};
  assert.equal(await vm.runInContext('activeTabReady()',context),true);
  reply={ready:false,readerReady:true,activeJobId:'old-request'};
  assert.equal(await vm.runInContext('activeTabReady()',context),false);
  closed=true;assert.equal(await vm.runInContext('activeTabReady()',context),false);
});

test('rendered replies stay scoped to the claimed job and cannot mix with network streams',async t=>{
  const {bridge}=await fixture(t);await connected(bridge);const deltas=[];
  const run=bridge.run('Owned prompt',{onDelta:text=>deltas.push(text)}),job=bridge.poll({ready:true}).job;
  assert.throws(()=>bridge.event({requestId:'old',kind:'rendered',text:'Old reply',final:true}),/ended/);
  bridge.event({requestId:job.id,kind:'rendered',text:'First words',final:false});
  assert.equal(bridge.snapshot().request.delivery,'page');assert.equal(bridge.snapshot().request.phase,'receiving-answer');
  bridge.event({requestId:job.id,kind:'rendered',text:'Complete reply',final:true});
  assert.equal(await run,'Complete reply');assert.deepEqual(deltas,['First words','Complete reply']);
  const network=bridge.run('Stream only'),next=bridge.poll({ready:true}).job;
  bridge.event({requestId:next.id,kind:'start',status:200,type:'text/event-stream'});
  assert.throws(()=>bridge.event({requestId:next.id,kind:'rendered',text:'Mixed reply',final:true}),/Cannot mix/);
  await assert.rejects(network,/Cannot mix/);
});

test('packaged DOM fallback streams the exact owned answer, excluding thoughts, and waits for completion',async t=>{
  const {bridge}=await fixture(t);await connected(bridge);const deltas=[];
  const run=bridge.run('Exact job prompt',{onDelta:text=>deltas.push(text)}),job=bridge.poll({ready:true}).job;
  const listeners=[],runtimeListeners=[];let sent=false,clock=1000;
  const answerText='Visible reply\n<pitlane>{"continue":false}</pitlane>';
  class Textarea {getClientRects(){return [{}];}get value(){return this._value||'';}set value(value){this._value=value;}dispatchEvent(){}}
  const field=new Textarea();
  const answer={innerText:answerText,getClientRects:()=>[{}],closest:()=>null};
  const user={textContent:job.prompt,querySelector:()=>null};
  const assistant={querySelector:selector=>selector==='.ds-assistant-message-main-content'?answer:null,parentElement:{querySelector:()=>sent?{}:null}};
  const send={classList:{contains:()=>sent},click:()=>{sent=true;field.value='';}};
  field.parentElement={parentElement:{querySelector:()=>send}};
  const doc={querySelectorAll:selector=>selector==='textarea'?[field]:sent?[user,assistant]:[],querySelector:()=>null};
  const sandbox={URL,Event,HTMLTextAreaElement:Textarea,Date:class extends Date{static now(){return clock;}},
    location:{origin:'https://chat.deepseek.com',pathname:'/'},document:doc,clearTimeout,clearInterval,
    setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,50)),setInterval:fn=>setInterval(()=>{clock+=500;fn();},2),
    addEventListener:(_,fn)=>listeners.push(fn),chrome:{runtime:{onMessage:{addListener:fn=>runtimeListeners.push(fn)},sendMessage:async event=>{bridge.event(event);return {accepted:true};}}}};
  sandbox.window=sandbox;const context=vm.createContext(sandbox);sandbox._listeners=listeners;sandbox.queueMicrotask=queueMicrotask;
  vm.runInContext("window.postMessage=data=>queueMicrotask(()=>_listeners.forEach(fn=>fn({source:window,origin:location.origin,data:data.kind==='ping'?{source:'pitlane-page',kind:'ready',version:2}:{source:'pitlane-page',kind:'armed',version:2,id:data.id}})))",context);
  vm.runInContext(await readFile(new URL('../extension/deepseek-dom.js',import.meta.url),'utf8'),context);
  vm.runInContext(await readFile(new URL('../extension/content.js',import.meta.url),'utf8'),context);
  await new Promise(resolve=>setTimeout(resolve,0));
  runtimeListeners[0]({action:'run',job},{},()=>{});
  assert.equal(await run,answerText);assert.deepEqual(deltas,[answerText,answerText]);
  const read=()=>vm.runInContext('PitlaneDeepSeekDOM.read(_job,new Set())',context);sandbox._job=job;
  user.textContent='Different prompt';assert.equal(read(),null);
  user.textContent=job.prompt;answer.closest=()=>({});assert.equal(read(),null);
});

for(const persistent of [false,true])for(const transport of ['fetch','xhr'])test('packaged page hook and content script stream via '+transport+(persistent?' in an existing chat':''),async t=>{
  const {bridge}=await fixture(t);await connected(bridge);
  const chatId='7854bf2d-6b2d-47e7-b186-d531702e179c',path='/a/chat/s/'+chatId;
  const run=bridge.run('Shared Soul + project concept + Unicode 🏁',persistent?{chatUrl:'https://chat.deepseek.com'+path}:{}),job=bridge.poll({ready:true,capabilities:{persistentChat:true}}).job;
  const sent=[],listeners=[],runtimeListeners=[];
  class Textarea {getClientRects(){return [{}];}get value(){return this._value||'';}set value(value){this._value=value;}dispatchEvent(){} }
  class FakeXHR {
    constructor(){this.listeners={};this.readyState=0;this.status=0;this.responseText='';}
    addEventListener(name,fn){(this.listeners[name]||=[]).push(fn);}
    dispatch(name){for(const fn of this.listeners[name]||[])fn.call(this);}
    open(){}
    getResponseHeader(){return 'text/event-stream';}
    send(body){sent.push(JSON.parse(body).prompt);queueMicrotask(()=>{this.status=200;this.readyState=2;this.dispatch('readystatechange');this.responseText=response('Actual fixture answer 🏁');this.readyState=3;this.dispatch('progress');this.readyState=4;this.dispatch('load');});}
  }
  const field=new Textarea(),send={classList:{contains:()=>!field.value},click:()=>{const body=JSON.stringify({prompt:field.value,parent_message_id:persistent?'parent-message':null});if(transport==='xhr'){const xhr=new sandbox.XMLHttpRequest();xhr.open('POST','https://chat.deepseek.com/api/v0/chat/completion');xhr.send(body);}else void sandbox.fetch('https://chat.deepseek.com/api/v0/chat/completion',{method:'POST',body});}};
  field.parentElement={parentElement:{querySelector:()=>send}};
  const sandbox={URL,Request,Response,TextDecoder,Event,XMLHttpRequest:FakeXHR,HTMLTextAreaElement:Textarea,location:{origin:'https://chat.deepseek.com',href:'https://chat.deepseek.com'+(persistent?path:'/'),pathname:persistent?path:'/'},setInterval,clearInterval,setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,1)),clearTimeout,document:{querySelectorAll:()=>[field],querySelector:()=>null},addEventListener:(_,fn)=>listeners.push(fn),chrome:{runtime:{onMessage:{addListener:fn=>runtimeListeners.push(fn)},sendMessage:async event=>{bridge.event(event);return {accepted:true};}}},fetch:async(_url,options)=>{sent.push(JSON.parse(options.body).prompt);return new Response(response('Actual fixture answer 🏁'),{headers:{'content-type':'text/event-stream'}});}};
  sandbox.window=sandbox;sandbox.postMessage=data=>queueMicrotask(()=>listeners.forEach(fn=>fn({source:sandbox.window,origin:sandbox.location.origin,data})));
  const context=vm.createContext(sandbox);
  sandbox._listeners=listeners;sandbox.queueMicrotask=queueMicrotask;
  vm.runInContext("window.postMessage=data=>queueMicrotask(()=>_listeners.forEach(fn=>fn({source:window,origin:location.origin,data})))",context);
  vm.runInContext(await readFile(new URL('../extension/page-hook.js',import.meta.url),'utf8'),context);
  vm.runInContext(await readFile(new URL('../extension/content.js',import.meta.url),'utf8'),context);
  runtimeListeners[0]({action:'run',job},{},()=>{});
  assert.equal(await run,'Actual fixture answer 🏁');assert.deepEqual(sent,['Shared Soul + project concept + Unicode 🏁']);
});

test('persistent capability stays distinct from page readiness and expires with heartbeat',async t=>{
 let now=1000;const{bridge}=await fixture(t,{now:()=>now});await connected(bridge);bridge.poll({ready:false,capabilities:{persistentChat:true}});assert.equal(bridge.snapshot().connected,false);assert.equal(bridge.snapshot().persistentChatSupported,true);now+=12001;assert.equal(bridge.snapshot().persistentChatSupported,false);
});
