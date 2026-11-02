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
async function connected(bridge){const code=bridge.issueCode().code;const {token}=await bridge.pair(code);bridge.poll({ready:true});return token;}
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
  const job=bridge.poll({ready:true}).job;assert.equal(job.prompt,'Soul + Project Memory + latest prompt');assert.deepEqual(job.images,[{id:'one',name:'photo.jpg'}]);
  assert.equal(bridge.poll({ready:true,activeJobId:job.id}).job,null);
  assert.throws(()=>bridge.image('old','one'),/expired/);assert.throws(()=>bridge.image(job.id,'other'),/belong/);assert.equal(bridge.image(job.id,'one').path,'private-path');
  assert.throws(()=>bridge.event({requestId:'old',kind:'done'}),/ended/);
  bridge.event({requestId:job.id,kind:'start',status:200,type:'text/event-stream'});bridge.event({requestId:job.id,kind:'chunk',chunk:response('Browser answer')});bridge.event({requestId:job.id,kind:'done'});
  assert.equal(await run,'Browser answer');assert.deepEqual(deltas,['Browser answer']);assert.throws(()=>bridge.event({requestId:job.id,kind:'done'}),/ended/);
});
test('Stop, worker restart and stale heartbeat fail closed instead of reviving a request',async t=>{
  let now=1000;const {bridge}=await fixture(t,{now:()=>now});await connected(bridge);
  const controller=new AbortController(),run=bridge.run('Stop this',{signal:controller.signal}),job=bridge.poll({ready:true}).job;
  controller.abort();await assert.rejects(run,{name:'AbortError'});assert.equal(bridge.poll({ready:true,activeJobId:job.id}).cancel,job.id);
  const restarted=bridge.run('Worker lost');bridge.poll({ready:true});bridge.poll({ready:true,activeJobId:null});await assert.rejects(restarted,/restarted/);
  now+=45001;assert.equal(bridge.snapshot().connected,false);await assert.rejects(bridge.run('Offline'),/Open DeepSeek/);
});

for(const transport of ['fetch','xhr'])test('packaged page hook and content script stream via '+transport,async t=>{
  const {bridge}=await fixture(t);await connected(bridge);
  const run=bridge.run('Shared Soul + project concept + Unicode 🏁'),job=bridge.poll({ready:true}).job;
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
  const field=new Textarea(),send={classList:{contains:()=>false},click:()=>{const body=JSON.stringify({prompt:field.value,parent_message_id:null});if(transport==='xhr'){const xhr=new sandbox.XMLHttpRequest();xhr.open('POST','https://chat.deepseek.com/api/v0/chat/completion');xhr.send(body);}else void sandbox.fetch('https://chat.deepseek.com/api/v0/chat/completion',{method:'POST',body});}};
  field.parentElement={parentElement:{querySelector:()=>send}};
  const sandbox={URL,Request,Response,TextDecoder,Event,XMLHttpRequest:FakeXHR,HTMLTextAreaElement:Textarea,location:{origin:'https://chat.deepseek.com',href:'https://chat.deepseek.com/',pathname:'/'},setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,1)),clearTimeout,document:{querySelectorAll:()=>[field],querySelector:()=>null},addEventListener:(_,fn)=>listeners.push(fn),chrome:{runtime:{onMessage:{addListener:fn=>runtimeListeners.push(fn)},sendMessage:async event=>{bridge.event(event);return {accepted:true};}}},fetch:async(_url,options)=>{sent.push(JSON.parse(options.body).prompt);return new Response(response('Actual fixture answer 🏁'),{headers:{'content-type':'text/event-stream'}});}};
  sandbox.window=sandbox;sandbox.postMessage=data=>queueMicrotask(()=>listeners.forEach(fn=>fn({source:sandbox.window,origin:sandbox.location.origin,data})));
  const context=vm.createContext(sandbox);
  sandbox._listeners=listeners;sandbox.queueMicrotask=queueMicrotask;
  vm.runInContext("window.postMessage=data=>queueMicrotask(()=>_listeners.forEach(fn=>fn({source:window,origin:location.origin,data})))",context);
  vm.runInContext(await readFile(new URL('../extension/page-hook.js',import.meta.url),'utf8'),context);
  vm.runInContext(await readFile(new URL('../extension/content.js',import.meta.url),'utf8'),context);
  runtimeListeners[0]({action:'run',job},{},()=>{});
  assert.equal(await run,'Actual fixture answer 🏁');assert.deepEqual(sent,['Shared Soul + project concept + Unicode 🏁']);
});
