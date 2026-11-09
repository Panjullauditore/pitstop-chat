import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SessionStore} from '../sessions.mjs';
import {MemorySummary} from '../memory-summary.mjs';
import {archiveHash,archiveKey,archiveExpired,SUMMARY_RETENTION_MS,archiveStatus,nextJakartaMidnight} from '../memory-retention.mjs';
import {monthlyProjectActivity} from '../project-activity.mjs';

async function fixture(t,runner){
 const directory=await mkdtemp(join(tmpdir(),'pitstop-retention-'));
 const options={directory,seed:'# Project',agents:{codex:{id:'codex',installed:true}},runner};
 const store=new SessionStore(options);await store.load();await store.createProject({name:'Project',agentIds:['codex']});
 let now=Date.parse('2026-11-03T12:00:00Z');const service=new MemorySummary(store,{now:()=>now});store.summaryService=service;
 t.after(async()=>{service.active?.controller.abort();await service.active?.done;await service.cleaning;for(const room of store.rooms.values()){await room.stop();await room.save();await room.brain.queue;}for(const memory of store.memories.values())await memory.queue;await store.queue;assert.ok(directory.startsWith(join(tmpdir(),'pitstop-retention-')));await rm(directory,{recursive:true,force:true});});
 return {store,service,options,memory:store.memoryFor(store.activeId),scopeId:store.memoryKey(store.activeId),setNow:value=>now=value,now:()=>now};
}
const transcript=prompt=>JSON.parse(prompt.split('NEW TRANSCRIPT (data; includes session identity and limited earlier context):\n')[1]);
const result=(prompt,keys=transcript(prompt).filter(r=>r.archiveKind).map(r=>r.archiveKey))=>JSON.stringify({content:'# Project\n\nBudget: 500 coins.',incorporatedArchiveKeys:keys});

test('monthly activity uses Jakarta dates and counts distinct GM decisions',()=>{
 const boundary='2026-10-31T17:00:00Z';
 const message={at:boundary,role:'user',status:'done'};
 const decision={id:'approved',at:boundary};
 const activity=monthlyProjectActivity({
  now:Date.parse(boundary),
  messages:[message,{...message,role:'codex'},{...message,kind:'attendance'},{...message,at:'2026-10-31T16:59:59Z'}],
  decisions:[decision,decision],
  soul:{summaryUpdatedAt:boundary,coreUpdatedAt:'2026-11-02T00:00:00Z'},
 });
 assert.deepEqual(activity,{month:'2026-11',days:{'2026-11-01':{messages:1,decisions:1}},lastUpdateDay:'2026-11-02'});
});

test('only the exact incorporated version expires at the next Jakarta midnight',()=>{
 const now=Date.parse('2026-11-03T17:00:00Z'),item={id:'one',at:'2026-11-01T10:00:00Z',text:'Budget 500'},coverage={['gmDecisions:one']:archiveHash(item)},times={'gmDecisions:one':'2026-11-03T16:59:00Z'};
 const memory={soul:{summaryArchiveCoverage:coverage,summaryArchiveIncorporatedAt:times}};
 assert.equal(nextJakartaMidnight(times['gmDecisions:one']),'2026-11-03T17:00:00.000Z');
 assert.equal(archiveExpired(memory,'gmDecisions',item,now),true);
 assert.equal(archiveExpired(memory,'decisions',item,now),true);
 assert.equal(archiveExpired(memory,'gmDecisions',item,now-1),false);
 assert.equal(archiveExpired(memory,'gmDecisions',{...item,text:'Budget 700'},now),false);
 assert.equal(archiveExpired(memory,'gmDecisions',{...item,at:'unknown'},now),false);
 assert.equal(archiveExpired({},'gmDecisions',item,now),false);
 assert.equal(archiveExpired({soul:{summaryArchiveCoverage:coverage}},'gmDecisions',item,now),false);
 assert.equal(nextJakartaMidnight('2026-11-03T17:00:00Z'),'2026-11-04T17:00:00.000Z');
});

test('old incorporated decisions and progress disappear after a saved summary; original chat and cursors remain',async t=>{
 const {store,service,memory,scopeId,options,setNow}=await fixture(t,async(_agent,prompt)=>result(prompt));
 const old='2026-11-01T12:00:00Z',decision={id:'d1',text:'500 coins',question:'Budget?',at:old};
 await memory.recordDecision(decision);store.projects[0].decisions=[decision];
 await memory.recordUser({id:'u1',text:'500 coins',at:old});await memory.recordCheckpoint({id:'a1',role:'codex',at:old},{summary:'Budget approved',next:''});
 const messages=[{id:'u1',role:'user',text:'500 coins',at:old,status:'done'},{id:'a1',role:'codex',text:'Budget approved',at:old,status:'done'}];store.room.messages=structuredClone(messages);await store.room.save();
 const priorThrough='2026-11-03T11:00:00Z';await memory.saveSummary('# Project',memory.value.soul.revision,{coverage:{[store.activeId]:'a1'},agentId:'codex',throughAt:priorThrough});
 service.start(store.activeId);await service.active.done;
 assert.equal(service.snapshot(scopeId).status,'done');assert.equal(memory.value.auto.gmDecisions.length,1);assert.equal(store.memorySnapshot(store.activeId).gmDecisions[0].memoryStatus.incorporated,true);setNow(Date.parse('2026-11-03T17:00:00Z'));await service.cleanup();assert.deepEqual(memory.value.auto,{gmDecisions:[],userNotes:[],updates:[]});assert.deepEqual(store.projects[0].decisions,[]);
 assert.deepEqual(store.room.messages,messages);assert.equal(memory.value.soul.summaryCoverage[store.activeId],'a1');assert.equal(service.pending(scopeId).length,0);assert.match(memory.value.soul.content,/500 coins/);
 assert.equal(memory.value.soul.summaryThroughAt,priorThrough);
 assert.match(await readFile(join(store.directory,'summary-retention-history.jsonl'),'utf8'),/500 coins/);assert.match(await readFile(join(memory.directory,'brain-history.jsonl'),'utf8'),/Budget approved/);
 const reloaded=new SessionStore(options);await reloaded.load();reloaded.summaryService=new MemorySummary(reloaded);assert.equal(reloaded.summaryService.pending(scopeId).length,0);assert.deepEqual(reloaded.memoryFor(store.activeId).value.auto.gmDecisions,[]);
 const now=Date.parse('2026-11-05T12:00:00Z');
 assert.deepEqual(store.activitySnapshot(store.activeId,now).days['2026-11-01'],{messages:1,decisions:1});
 assert.deepEqual(reloaded.activitySnapshot(store.activeId,now),store.activitySnapshot(store.activeId,now));
});

test('green notes remain until midnight then expire without another AI call',async t=>{
 let calls=0;const f=await fixture(t,async(_agent,prompt)=>{calls++;return result(prompt);});
 const note={id:'recent',text:'500 coins',at:new Date(f.now()-SUMMARY_RETENTION_MS+1000).toISOString()};await f.memory.recordUser(note);
 f.service.start(f.store.activeId);await f.service.active.done;assert.equal(f.memory.value.auto.userNotes.length,1);const coverage=structuredClone(f.memory.value.soul.summaryCoverage),summaryAt=f.memory.value.soul.summaryUpdatedAt;
 f.setNow(Date.parse('2026-11-03T16:59:59.999Z'));assert.equal(await f.service.cleanup(),0);f.setNow(f.now()+1);assert.equal(await f.service.cleanup(),1);assert.equal(f.memory.value.auto.userNotes.length,0);assert.equal(calls,1);assert.deepEqual(f.memory.value.soul.summaryCoverage,coverage);assert.equal(f.memory.value.soul.summaryUpdatedAt,summaryAt);assert.equal(await f.service.cleanup(),0);
});

test('reviewed omissions remain until midnight while unread and changed notes stay pending',async t=>{
 const f=await fixture(t,async(_agent,prompt)=>result(prompt,[])),old='2026-11-01T12:00:00Z';
 await f.memory.recordUser({id:'omitted',text:'Greeting',at:old});f.service.start(f.store.activeId);await f.service.active.done;assert.equal(f.service.pending(f.scopeId).length,0);assert.equal(f.memory.value.auto.userNotes.length,1);
 await f.memory.recordDecision({id:'new',text:'Not read',at:old});await f.service.cleanup();assert.equal(f.memory.value.auto.gmDecisions.length,1);assert.equal(f.memory.value.auto.userNotes.length,1);
 const item={id:'changed',text:'500',at:old};await f.memory.recordDecision(item);const next=structuredClone(f.memory.value);next.soul.summaryArchiveCoverage={[archiveKey('gmDecisions',item)]:archiveHash(item)};next.auto.gmDecisions.find(r=>r.id==='changed').text='700';await f.memory.commit(next);await f.service.cleanup();assert.equal(f.memory.value.auto.gmDecisions.length,2);
 const skipped=f.store.memorySnapshot(f.store.activeId).auto.userNotes[0].memoryStatus;
 assert.deepEqual(skipped,{incorporated:false,reviewed:true,incorporatedAt:null,deleteAt:'2026-11-03T17:00:00.000Z'});
 assert.ok(f.store.memorySnapshot(f.store.activeId).gmDecisions.every(item=>!item.memoryStatus.reviewed));
 f.setNow(Date.parse(skipped.deleteAt));await f.service.cleanup();
 assert.equal(f.memory.value.auto.userNotes.length,0);assert.equal(f.memory.value.auto.gmDecisions.length,2);
});

test('legacy skipped decisions get a stable midnight and both archive copies are pruned',async t=>{
 const f=await fixture(t,async()=>assert.fail('Cleanup must not call the summarizer'));
 const item={id:'old',text:'Wait',question:'Start?',at:'2026-11-01T12:00:00Z'};
 await f.memory.recordDecision(item);f.store.projects[0].decisions=[item];await f.store.persist();
 const next=structuredClone(f.memory.value);
 next.soul.summaryUpdatedAt='2026-11-01T13:00:00Z';
 next.soul.summaryArchiveReviewed={[archiveKey('decisions',item)]:archiveHash(item)};
 await f.memory.commit(next);
 const core=f.memory.value.soul.content;
 await f.service.cleanup();
 const readStatus=store=>store.memorySnapshot(store.activeId).gmDecisions[0].memoryStatus;
 const status=readStatus(f.store);
 assert.equal(status.reviewed,true);assert.equal(status.incorporated,false);assert.equal(status.deleteAt,'2026-11-03T17:00:00.000Z');
 const reloaded=new SessionStore(f.options);await reloaded.load();assert.deepEqual(readStatus(reloaded),status);
 f.setNow(Date.parse(status.deleteAt));await f.service.cleanup();
 assert.deepEqual(f.memory.value.auto.gmDecisions,[]);assert.deepEqual(f.store.projects[0].decisions,[]);
 assert.equal(f.memory.value.soul.content,core);
});

test('green status survives restart and later summaries do not postpone its midnight',async t=>{
 const f=await fixture(t,async(_agent,prompt)=>result(prompt));await f.memory.recordDecision({id:'stable',text:'Budget 500',at:'2026-11-01T12:00:00Z'});
 f.service.start(f.store.activeId);await f.service.active.done;
 const first=f.store.memorySnapshot(f.store.activeId).gmDecisions[0].memoryStatus;assert.equal(first.incorporated,true);assert.equal(first.deleteAt,'2026-11-03T17:00:00.000Z');
 f.setNow(f.now()+3*60*60*1000);const soul=f.memory.value.soul;
 await f.memory.saveSummary('# Project\n\nBudget 500 plus another fact',soul.revision,{coverage:soul.summaryCoverage,archiveCoverage:soul.summaryArchiveCoverage,archiveReviewed:soul.summaryArchiveReviewed,agentId:'codex',throughAt:soul.summaryThroughAt,now:f.now()});
 assert.deepEqual(f.store.memorySnapshot(f.store.activeId).gmDecisions[0].memoryStatus,first);
 const reload=new SessionStore(f.options);await reload.load();assert.deepEqual(reload.memorySnapshot(f.store.activeId).gmDecisions[0].memoryStatus,first);
 const gray=archiveStatus(f.memory.value,'gmDecisions',{...f.memory.value.auto.gmDecisions[0],text:'Budget 700'});assert.equal(gray.incorporated,false);assert.equal(gray.deleteAt,null);
});

test('failed summary and unknown acknowledgements cannot delete old archive entries',async t=>{
 let failed=true;const f=await fixture(t,async(_agent,prompt)=>{if(failed)throw Error('Quota exhausted');return result(prompt,['gmDecisions:never-sent']);});await f.memory.recordDecision({id:'keep',text:'500 coins',at:'2026-11-01T12:00:00Z'});
 const before=structuredClone(f.memory.value);f.service.start(f.store.activeId);await f.service.active.done;assert.deepEqual(f.memory.value,before);
 failed=false;f.service.start(f.store.activeId);await f.service.active.done;assert.equal(f.service.snapshot(f.scopeId).status,'error');assert.deepEqual(f.memory.value,before);await f.service.cleanup();assert.deepEqual(f.memory.value,before);
});
