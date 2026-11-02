import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ManualWebBridge} from '../manual-web.mjs';
import {SessionStore} from '../sessions.mjs';
import {parseReply} from '../protocol.mjs';

test('manual web requests accept actual pasted replies once and enforce session scope',async()=>{
  const bridge=new ManualWebBridge();let request;
  const result=bridge.wait('Soul and project context',{sessionId:'one',onPending:value=>request=value});
  const id=request.id;assert.equal(request.prompt,'Soul and project context');
  assert.throws(()=>bridge.submit({requestId:id,sessionId:'two',text:'Wrong session'}),/sesi lain/);
  assert.throws(()=>bridge.submit({requestId:id,sessionId:'one',text:''}),/Tempel balasan/);
  bridge.submit({requestId:id,sessionId:'one',text:'The pasted answer.'});
  assert.equal(parseReply(await result).text,'The pasted answer.');assert.equal(request,null);
  assert.throws(()=>bridge.submit({requestId:id,sessionId:'one',text:'Duplicate'}),/berakhir/);
});
test('Stop cancels a pending import and stale replies cannot revive the run',async()=>{
  const bridge=new ManualWebBridge(),controller=new AbortController();let request;
  const result=bridge.wait('test',{sessionId:'one',signal:controller.signal,onPending:value=>request=value});
  const id=request.id;controller.abort();await assert.rejects(result,{name:'AbortError'});assert.equal(request,null);
  assert.throws(()=>bridge.submit({requestId:id,sessionId:'one',text:'Too late'}),/berakhir/);
});
test('manual attendance retains the required one-line format',async()=>{
  const bridge=new ManualWebBridge();let request;
  const result=bridge.wait('Attendance',{sessionId:'one',mode:'attendance',onPending:value=>request=value});
  bridge.submit({requestId:request.id,sessionId:'one',text:'Hadir, Siap Melanjutkan Project Pitlane'});
  assert.equal(await result,'Hadir, Siap Melanjutkan Project Pitlane');
});
test('DeepSeek receives shared memories, waits for import, then PM resumes and records only the PM checkpoint',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'pitlane-manual-web-'));
  const bridge=new ManualWebBridge(),calls=[];let store;
  const options={directory,seed:'# Seed',agents:{codex:{id:'codex',name:'Codex',installed:true},deepseek:{id:'deepseek',name:'DeepSeek Web',installed:true,transport:'manual-web'}},runner:async(agent,prompt,input)=>{
    calls.push(agent);
    if(agent==='deepseek')return bridge.wait(prompt,{...input,onPending:request=>{store.rooms.get(input.sessionId).webRequest=request;}});
    return 'PM reviewed the imported answer.\n<pitlane>{"continue":false,"needsUser":false,"summary":"PM checkpoint"}</pitlane>';
  }};
  store=new SessionStore(options);await store.load();
  t.after(async()=>{for(const room of store.rooms.values()){await room.stop();await room.save();}await store.queue;await rm(directory,{recursive:true,force:true});});
  await store.communication.saveSoul('Use my casual Indonesian writing style.',store.communication.snapshot().soul.revision);
  await store.createProject({name:'Web Team',managerId:'codex',agentIds:['deepseek']});
  const memory=store.memoryFor(store.activeId);await memory.saveSoul('Project concept: three garage bays.',memory.snapshot().soul.revision);
  const pendingEvent=new Promise(resolve=>{const original=options.runner;store.room.runner=async(...args)=>{const value=original(...args);if(args[0]==='deepseek')resolve();return value;};});
  await store.room.send({text:'Review this concept.',mode:'discussion'});await pendingEvent;
  const request=store.room.webRequest;assert.match(request.prompt,/casual Indonesian/);assert.match(request.prompt,/three garage bays/);
  assert.deepEqual(calls,['deepseek']);
  assert.equal(store.room.snapshot().webRequest.id,request.id);
  bridge.submit({requestId:request.id,sessionId:store.activeId,text:'DeepSeek suggests a separate entrance.'});
  await store.room.run.done;
  assert.deepEqual(calls,['deepseek','codex']);
  const imported=store.room.messages.find(message=>message.role==='deepseek');
  assert.equal(imported.text,'DeepSeek suggests a separate entrance.');assert.equal(imported.manualImport,true);
  assert.equal(store.room.webRequest,null);assert.equal(memory.snapshot().auto.updates.at(-1).agent,'codex');
  // A human can explicitly escalate an imported debate to the GM gate.
  const next=new Promise(resolve=>{store.room.runner=async(agent,prompt,input)=>agent==='deepseek'?bridge.wait(prompt,{...input,onPending:request=>{store.room.webRequest=request;if(request)resolve(request);}}):options.runner(agent,prompt,input);});
  await store.room.send({text:'Review tradeoffs.',mode:'discussion'});const nextRequest=await next;
  bridge.submit({requestId:nextRequest.id,sessionId:store.activeId,text:'Two options need a decision.',needsDecision:true});await store.room.run.done;
  assert.ok(store.projects[0].pendingDecision);assert.equal(store.room.lastRun.reason,'needs-user');
});
