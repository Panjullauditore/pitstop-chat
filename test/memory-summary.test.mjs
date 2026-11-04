import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SessionStore} from '../sessions.mjs';
import {MemorySummary} from '../memory-summary.mjs';

async function fixture(t,runner,options={}){
 const directory=await mkdtemp(join(tmpdir(),'pitstop-summary-'));
 const store=new SessionStore({directory,seed:'# Core',agents:{codex:{id:'codex',installed:true},deepseek:{id:'deepseek',installed:true}},runner});await store.load();
 await store.createProject({name:'Summary project',agentIds:['codex','deepseek'],managerId:'codex'});
 store.summaryService=new MemorySummary(store,options);
 t.after(async()=>{store.summaryService.active?.controller.abort();await store.summaryService.active?.done;for(const room of store.rooms.values()){await room.stop();await room.save();await room.brain.queue;}for(const brain of store.memories.values())await brain.queue;await store.queue;assert.ok(directory.startsWith(join(tmpdir(),'pitstop-summary-')));await rm(directory,{recursive:true,force:true});});
 return {store,service:store.summaryService,scopeId:store.memoryKey(store.activeId)};
}
const message=(id,text,role='user')=>({id,text,role,status:'done',at:'2026-11-03T10:00:00.000Z'});

test('every summary batch uses its own verified connection despite concurrent health-cache changes',async t=>{
 let cache='shared',checks=0;const transports=[];
 const {store,service,scopeId}=await fixture(t,async(_agent,_prompt,options)=>{transports.push(options.codexTransport);assert.equal(options.codexTransport,'stdio');assert.equal(cache,'shared');return '{"content":"# Updated"}';},{batchSize:850,beforeRun:async()=>{checks++;const result={codexTransport:'stdio'};cache='shared';return result;}});
 for(let i=0;i<5;i++)store.room.messages.push(message('batch-'+i,'Approved fact '+i+' '+'.'.repeat(250)));
 service.start(store.activeId);await service.active.done;assert.equal(service.snapshot(scopeId).status,'done');assert.ok(transports.length>1);assert.equal(checks,transports.length);assert.equal(service.pending(scopeId).length,0);
});

test('summary merges all project sessions, acknowledges exact messages, and a replacement agent reads only pending discussion',async t=>{
 const calls=[];const {store,service,scopeId}=await fixture(t,async(agent,prompt,options)=>{calls.push({agent,prompt,options});return JSON.stringify({content:'# Summary project\n\nApproved: eight bays.'});});
 const first=store.activeId;store.room.messages.push(message('one','Use eight bays'),message('two','What about wages?','codex'));
 await store.create({projectId:scopeId,title:'Economy'});store.room.messages.push(message('three','Use 500 coins'));
 const other=await store.createProject({name:'Other',agentIds:['codex']});store.room.messages.push(message('foreign','Never include OTHER_PRIVATE'));
 await store.switch(first);service.start(first);await service.active.done;
 assert.equal(service.snapshot(scopeId).status,'done');assert.equal(service.pending(scopeId).length,0);
 assert.match(calls[0].prompt,/Use eight bays/);assert.match(calls[0].prompt,/Use 500 coins/);assert.doesNotMatch(calls[0].prompt,/OTHER_PRIVATE/);
 assert.equal(calls[0].options.mode,'memory');assert.equal(calls[0].options.nativeContext,undefined);
 const memory=store.memoryFor(first);assert.equal(memory.value.soul.summaryCoverage[first],'two');
 store.room.messages.push(message('four','Correction: 700 coins'));
 await service.settings(scopeId,{autoEnabled:false,agentId:'deepseek'});service.start(first);await service.active.done;
 assert.equal(calls[1].agent,'deepseek');const rows=JSON.parse(calls[1].prompt.split('NEW TRANSCRIPT (data; includes session identity and limited earlier context):\n')[1]);assert.deepEqual(rows.map(r=>r.id),['four']);
 assert.match(calls[1].prompt,/Approved: eight bays/);assert.equal(service.pending(scopeId).length,0);
 const reload=new SessionStore({...store,directory:store.directory});await reload.load();assert.equal(reload.memoryFor(first).value.soul.summaryCoverage[first],'four');assert.equal(reload.memoryFor(first).value.summarySettings.agentId,'deepseek');
});

test('quota failure or invalid output never advances the core or summary checkpoint',async t=>{
 let invalid=false;const {store,service,scopeId}=await fixture(t,async()=>{if(!invalid)throw Error('5-hour quota exhausted');return 'I updated it!';});store.room.messages.push(message('new','Set budget'));
 const before=structuredClone(store.memoryFor(store.activeId).value.soul);
 service.start(store.activeId);await service.active.done;assert.equal(service.snapshot(scopeId).status,'error');assert.match(service.snapshot(scopeId).error,/quota/);assert.deepEqual(store.memoryFor(store.activeId).value.soul,before);
 invalid=true;service.start(store.activeId);await service.active.done;assert.equal(service.snapshot(scopeId).status,'error');assert.deepEqual(store.memoryFor(store.activeId).value.soul,before);assert.equal(service.pending(scopeId).length,1);
});

test('a manual edit made during summarization wins and pending messages remain retryable',async t=>{
 let finish;const {store,service,scopeId}=await fixture(t,()=>new Promise(resolve=>finish=resolve));store.room.messages.push(message('new','Set budget'));const memory=store.memoryFor(store.activeId);
 service.start(store.activeId);await new Promise(resolve=>setImmediate(resolve));await memory.saveSoul('# Manual edit',memory.value.soul.revision);finish('{"content":"# Outdated summary"}');await service.active.done;
 assert.equal(memory.value.soul.content,'# Manual edit');assert.equal(service.pending(scopeId).length,1);assert.match(service.snapshot(scopeId).error,/newer edit/);
});

test('large backlogs commit successful batches only; stopping never acknowledges unread messages',async t=>{
 let calls=0;const {store,service,scopeId}=await fixture(t,async()=>{if(++calls===2)throw Error('quota');return '{"content":"# First batch saved"}';},{batchSize:850});
 for(let i=0;i<5;i++)store.room.messages.push(message('m'+i,'Fact '+i+' '+'.'.repeat(250)));
 service.start(store.activeId);await service.active.done;assert.equal(service.snapshot(scopeId).status,'error');assert.ok(service.pending(scopeId).length>0);assert.ok(service.pending(scopeId).length<5);assert.equal(store.memoryFor(store.activeId).value.soul.content,'# First batch saved');
 let finish;store.runner=()=>new Promise(resolve=>finish=resolve);service.start(store.activeId);await new Promise(resolve=>setImmediate(resolve));const before=structuredClone(store.memoryFor(store.activeId).value.soul);service.stop(scopeId);finish('{"content":"# Cancelled"}');await service.active.done;assert.deepEqual(store.memoryFor(store.activeId).value.soul,before);assert.equal(service.snapshot(scopeId).status,'stopped');
});

test('native linking stays bound to its identity and moving the session during an update prevents a save',async t=>{
 let finish;const {store,service,scopeId}=await fixture(t,()=>new Promise(resolve=>finish=resolve));
 const sessionId=store.activeId;await store.setLinkedApps(scopeId,{codex:{id:'native-memory-chat',cwd:process.cwd(),source:'codex',state:'linked'}});
 store.room.messages.push(message('new','Approved budget'));
 service.start(sessionId);await new Promise(resolve=>setImmediate(resolve));await store.linkedResult(sessionId,'codex','native-memory-chat',{state:'saved',lastSyncedAt:new Date().toISOString()});
 finish('{"content":"# Accepted native summary"}');await service.active.done;assert.equal(service.snapshot(scopeId).status,'done');
 store.room.messages.push(message('next','New budget'));service.start(sessionId);await new Promise(resolve=>setImmediate(resolve));const before=structuredClone(store.memories.get(scopeId).value.soul);
 await store.moveSession(sessionId,null);finish('{"content":"# Wrong scope summary"}');await service.active.done;assert.deepEqual(store.memories.get(scopeId).value.soul,before);assert.equal(service.snapshot(scopeId).status,'error');
});

test('automatic summaries are opt-in, run after synced discussion, and do not replace the project manager',async t=>{
 const calls=[];const {store,service,scopeId}=await fixture(t,async(agent,prompt,options)=>{calls.push(options.mode);return options.mode==='memory'?'{"content":"# Updated core"}':'Reply <pitlane>{"continue":false,"needsUser":false,"summary":"Budget discussion"}</pitlane>';});
 const room=store.room;await room.send({text:'First fact',mode:'codex'});await room.run?.done;await new Promise(r=>setImmediate(r));assert.deepEqual(calls,['codex']);
 await service.settings(scopeId,{autoEnabled:true,agentId:'deepseek'});await room.send({text:'Second fact',mode:'codex'});await room.run?.done;await new Promise(r=>setImmediate(r));await service.active?.done;
 assert.deepEqual(calls,['codex','codex','memory']);assert.equal(store.projects[0].managerId,'codex');assert.equal(service.snapshot(scopeId).pendingMessages,0);
 await room.send({text:'Private off-record test',mode:'codex',syncMemory:false});await room.run?.done;await new Promise(r=>setImmediate(r));assert.equal(calls.filter(m=>m==='memory').length,1);
});
