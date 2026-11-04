import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('the local page channel is top-level only, validates messages, and never exposes the saved grant',async()=>{
 const source=await readFile(new URL('../extension/site-connect.js',import.meta.url),'utf8');
 const requests=[],replies=[];let listener;
 const sandbox={location:{origin:'http://127.0.0.1:4317'},addEventListener:(_event,fn)=>listener=fn,chrome:{runtime:{sendMessage:async message=>{requests.push(message);return {paired:true,token:'must-stay-private'};}}}};
 const page={postMessage:value=>replies.push(value)};page.top=page;sandbox.window=page;vm.runInContext(source,vm.createContext(sandbox));
 const message={source:'pitstop-site-connect',requestId:'one',action:'connect',provider:'antigravity',code:'a'.repeat(32)};
 listener({source:page,origin:sandbox.location.origin,data:message});await new Promise(r=>setImmediate(r));
 assert.equal(requests[0].action,'app-site-pair');assert.equal(replies[0].paired,true);assert.equal(JSON.stringify(replies).includes('must-stay-private'),false);
 const count=requests.length;
 for(const event of [{source:{},origin:sandbox.location.origin,data:message},{source:page,origin:'https://evil.example',data:message},{source:page,origin:sandbox.location.origin,data:{...message,provider:'other'}},{source:page,origin:sandbox.location.origin,data:{...message,action:'read-token'}}])listener(event);
 assert.equal(requests.length,count);
 for(const origin of ['http://127.0.0.1:4318','https://evil.example']){let registered=false;vm.runInContext(source,vm.createContext({...sandbox,location:{origin},addEventListener:()=>registered=true}));assert.equal(registered,false);}
});

for(const provider of ['antigravity','deepseek'])test(`${provider} one-click pairing checks the current profile and keeps the other service separate`,async()=>{
 let listener,ready=true;const calls=[],saved=[];
 const context=vm.createContext({URL,Map,Promise,setTimeout,clearTimeout,AbortSignal,Uint8Array,btoa,
  fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({token:'scoped-grant'})};},
  chrome:{storage:{local:{setAccessLevel:()=>{},get:async()=>({}),set:async value=>saved.push(value)},session:{get:async()=>({}),set:async()=>{},remove:async()=>{}}},
   runtime:{onMessage:{addListener:fn=>listener=fn},onStartup:{addListener:()=>{}},getURL:file=>'chrome-extension://fixture/'+file},alarms:{create:()=>{},onAlarm:{addListener:()=>{}}},
   tabs:{query:async()=>ready?[{id:5,url:provider==='antigravity'?'https://antigravity.google.com/r/9d397d65-3b94-4b82-9da1-0ae1058edc18-v2':'https://chat.deepseek.com/'}]:[],sendMessage:async()=>({ready:true})},
   scripting:{executeScript:async args=>args.files?[]:[{frameId:2,result:{native:true,ready:true}}]}}});
 const file=provider==='antigravity'?'app-worker.js':'background.js';const code=(await readFile(new URL('../extension/'+file,import.meta.url),'utf8')).replace("import './app-worker.js';",'');vm.runInContext(code,context);await new Promise(r=>setImmediate(r));
 const sender={tab:{id:1},frameId:0,url:'http://127.0.0.1:4317/'},action=provider==='antigravity'?'app-site-pair':'site-pair';
 const send=from=>new Promise(resolve=>listener({action,code:'a'.repeat(32)},from,resolve));
 for(const invalid of [{...sender,url:'https://evil.example/'},{...sender,url:'http://127.0.0.1:4318/'},{...sender,frameId:1}])assert.ok((await send(invalid)).error);
 assert.equal(calls.length,0);ready=false;assert.match((await send(sender)).error,/Existing pairing was kept/);assert.equal(calls.length,0);
 ready=true;assert.equal((await send(sender)).paired,true);assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith(provider==='antigravity'?'/api/bridge/app/pair':'/api/bridge/pair'));
 assert.equal(saved[0][provider==='antigravity'?'appBridgeToken':'bridgeToken'],'scoped-grant');assert.equal(saved[0][provider==='antigravity'?'bridgeToken':'appBridgeToken'],undefined);
});
