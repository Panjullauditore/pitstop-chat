import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DeepSeekStream} from '../deepseek-stream.mjs';
import {DeepSeekBrowserBridge} from '../deepseek-browser.mjs';

const frame=value=>'data: '+JSON.stringify(value)+'\n\n';
const full=text=>frame({v:{response:{status:'FINISHED',fragments:[{type:'THINK',content:'Private reasoning'},{type:'RESPONSE',content:text}]}}});

test('web stream handles split frames, patch updates and ignores reasoning',()=>{
  const updates=[],stream=new DeepSeekStream(text=>updates.push(text));
  const input=full('Hello')+frame({p:'response/fragments/-1/content',o:'APPEND',v:' world'})+'data: [DONE]\n\n';
  for(let offset=0;offset<input.length;offset+=7)stream.push(input.slice(offset,offset+7));
  assert.equal(stream.finish(),'Hello world');assert.deepEqual(updates,['Hello','Hello world']);
});
test('unsupported, failed, reasoning-only and oversized streams cannot fabricate successful replies',()=>{
  for(const data of [frame({v:{response:{fragments:[{type:'THINK',content:'Not an answer'}]}}}),frame({code:40300}),frame({v:{response:{status:'STOPPED'}}}),'data: invalid\n\n']){
    const stream=new DeepSeekStream();assert.throws(()=>{stream.push(data);stream.finish();});
  }
  assert.throws(()=>new DeepSeekStream().push('x'.repeat(2_000_001)),/limit/);
  const partial=new DeepSeekStream();partial.push(frame({v:{response:{fragments:[{type:'RESPONSE',content:'Partial'}]}}}));assert.throws(()=>partial.finish(),/before.*complete/);
  assert.throws(()=>new DeepSeekStream().push(frame({p:'__proto__/polluted',v:true})),/unsupported patch/);assert.equal({}.polluted,undefined);
});

test('batch completion patches and CRLF split across chunks preserve the final answer',()=>{
  const stream=new DeepSeekStream();
  const input=(full('Browser answer')+frame({p:'response',o:'BATCH',v:[{p:'accumulated_token_usage',v:42},{p:'quasi_status',v:'FINISHED'}]})).replaceAll('\n','\r\n');
  for(const char of input)stream.push(char);
  assert.equal(stream.finish(),'Browser answer');assert.equal(stream.state.response.accumulated_token_usage,42);
  assert.throws(()=>new DeepSeekStream().push(frame({p:'response',o:'BATCH',v:[{p:'__proto__/polluted',v:true}]})),/unsupported/);
});

async function fixture(t,{loggedIn=true,complete=true}={}){
  const directory=await mkdtemp(join(tmpdir(),'pitlane-browser-'));
  let bridge,closed=false,launches=0,submitted='';
  const page={isClosed:()=>closed,bringToFront:async()=>{},goto:async()=>{},evaluate:async()=>loggedIn,locator:()=>({first(){return this;},count:async()=>1,waitFor:async()=>{},fill:async text=>{submitted=text;},press:async()=>{
    if(complete){bridge.receive(page,{kind:'start',prompt:submitted,status:200,type:'text/event-stream'});bridge.receive(page,{kind:'data',prompt:submitted,chunk:full('Actual web reply')});bridge.receive(page,{kind:'end',prompt:submitted});}
  }})};
  const context={exposeBinding:async()=>{},addInitScript:async()=>{},pages:()=>[page],on:()=>{},close:async()=>{closed=true;}};
  bridge=new DeepSeekBrowserBridge({directory,launch:async(profile,options)=>{launches++;assert.equal(options.headless,false);assert.ok(profile.startsWith(directory));return context;},timeout:1000});
  t.after(async()=>{await bridge.close();await rm(directory,{recursive:true,force:true});});
  return {bridge,page,launches:()=>launches,closed:()=>closed};
}
test('browser startup is serialized and actual stream output reaches the caller',async t=>{
  const {bridge,launches}=await fixture(t);await Promise.all([bridge.open(),bridge.open()]);assert.equal(launches(),1);assert.equal(bridge.snapshot().connected,true);
  const updates=[];assert.equal(await bridge.run('Soul + project + user prompt',{onDelta:text=>updates.push(text)}),'Actual web reply');assert.deepEqual(updates,['Actual web reply']);
  assert.equal(bridge.snapshot().status,'ready');
});
test('login is required before sending and credentials never appear in status',async t=>{
  const {bridge}=await fixture(t,{loggedIn:false});await assert.rejects(bridge.run('Do not send'),/Sign in/);assert.equal(bridge.snapshot().connected,false);assert.equal(bridge.snapshot().status,'login-required');
  assert.deepEqual(Object.keys(bridge.snapshot()).sort(),['checkedAt','connected','detail','status']);
});
test('Stop closes the managed browser, rejects its run and ignores late/wrong-page chunks',async t=>{
  const {bridge,page,closed}=await fixture(t,{complete:false});const controller=new AbortController();
  const run=bridge.run('Current prompt',{signal:controller.signal});
  while(!bridge.job)await new Promise(resolve=>setTimeout(resolve,1));
  await assert.rejects(bridge.run('Second request'),/another message/);
  bridge.receive({}, {kind:'end',prompt:'Current prompt'});bridge.receive(page,{kind:'end',prompt:'Other prompt'});
  controller.abort();await assert.rejects(run,{name:'AbortError'});assert.equal(closed(),true);assert.equal(bridge.job,null);
  bridge.receive(page,{kind:'data',prompt:'Current prompt',chunk:full('Late')});assert.equal(bridge.snapshot().connected,false);
});
