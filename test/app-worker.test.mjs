import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const base='https://antigravity.google.com/r/9d397d65-3b94-4b82-9da1-0ae1058edc18-v2',chatId='750bdd34-f65f-4726-ba1a-fc28b8873235';
async function worker(){
  const calls=[],probes=[];let listener,currentUrl=base+'?p='+encodeURIComponent('c/'+chatId+'?section=default-cli-project');
  const context=vm.createContext({URL,Map,Promise,setTimeout,clearTimeout,AbortSignal,Uint8Array,btoa,
    fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({accepted:true})};},
    chrome:{
      storage:{local:{get:async()=>({}),set:async()=>{}},session:{get:async()=>({}),set:async()=>{},remove:async()=>{}}},
      runtime:{onMessage:{addListener:fn=>{listener=fn;}},onStartup:{addListener:()=>{}},getURL:file=>'chrome-extension://fixture/'+file},
      alarms:{create:()=>{},onAlarm:{addListener:()=>{}}},
      tabs:{get:async()=>({id:10,url:currentUrl}),query:async()=>[{id:1,url:base,lastAccessed:1},{id:10,url:base,lastAccessed:10}],sendMessage:async()=>({ready:true,version:'1.1.2'})},
      scripting:{executeScript:async args=>{probes.push(args.target.tabId);return args.files?[]:[{frameId:3,result:{native:true,ready:true}}];}}
    }
  });
  vm.runInContext(await readFile(new URL('../extension/app-worker.js',import.meta.url),'utf8'),context);
  await new Promise(done=>setTimeout(done,0));
  vm.runInContext('active='+JSON.stringify({id:'request-123',tabId:10,frameId:3,chatId,base}),context);
  const sender={tab:{id:10},frameId:3,url:'https://antigravity.static.usercontent.goog/web/2.28.2/?iframe=true'};
  return {calls,probes,context,sender,setUrl:value=>{currentUrl=value;},message:(message,from=sender)=>new Promise(done=>listener({action:'app-event',requestId:'request-123',kind:'sent',...message},from,done))};
}
test('App worker accepts a native SPA conversation using the visible parent route, not the initial iframe URL',async()=>{
  const f=await worker();assert.equal((await f.message({})).accepted,true);assert.equal(f.calls.length,1);assert.equal(f.calls[0].url,'http://127.0.0.1:4318/api/bridge/app/event');assert.equal(JSON.parse(f.calls[0].options.body).chatId,chatId);
});
test('App worker rejects another frame, tab, or visible parent conversation before relaying data',async()=>{
  const f=await worker();assert.match((await f.message({}, {...f.sender,frameId:4})).error,/does not own/);
  assert.match((await f.message({}, {...f.sender,tab:{id:11}})).error,/does not own/);
  f.setUrl(base+'?p=c%2Fanother-native-chat');assert.match((await f.message({})).error,/different conversation/);assert.equal(f.calls.length,0);
});
test('A newly opened ready App tab takes priority over an older stuck tab on the same device',async()=>{
  const f=await worker(),tabs=await vm.runInContext('tabs()',f.context);assert.equal(tabs.length,1);assert.equal(tabs[0].tab.id,10);assert.ok(f.probes.every(id=>id===10));
});
