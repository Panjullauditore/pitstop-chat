import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SessionStore} from '../sessions.mjs';
const reply=(text,control={})=>text+'\n<pitlane>'+JSON.stringify({continue:false,needsUser:false,summary:text,next:'',reportedProgress:'',...control})+'</pitlane>';
async function setup(t,runner){
  const directory=await mkdtemp(join(tmpdir(),'pitlane-pm-'));
  const options={directory,seed:'# Seed',agents:Object.fromEntries(['codex','antigravity','claude'].map(id=>[id,{id,name:id,installed:true}])),runner};
  const store=new SessionStore(options);await store.load();
  t.after(async()=>{for(const room of store.rooms.values()){await room.stop();await room.save();}await store.queue;await rm(directory,{recursive:true,force:true});});
  return {store,options};
}
test('PM is unique, automatically included, retained in sessions, and persisted',async t=>{
  const {store,options}=await setup(t,async()=>reply('OK'));
  await store.createProject({name:'Managed project',managerId:'codex',agentIds:['antigravity','codex','codex']});
  const project=store.projects[0];assert.equal(project.managerId,'codex');assert.deepEqual(project.agentIds,['codex','antigravity']);
  await store.setSessionAgents(store.activeId,['antigravity']);assert.deepEqual(store.enabledAgents(store.activeId),['codex','antigravity']);
  await store.updateProject({projectId:project.id,name:project.name,agentIds:['antigravity']});assert.ok(project.agentIds.includes('codex'));
  const restored=new SessionStore(options);await restored.load();assert.equal(restored.projects[0].managerId,'codex');
  await assert.rejects(store.createProject({name:'Invalid',managerId:'not-real',agentIds:[]}),/Project Manager/);
});
test('PM receives team responses last and only PM publishes project checkpoints',async t=>{
  const calls=[];const {store}=await setup(t,async(agent,prompt)=>{calls.push({agent,prompt});return reply(agent==='codex'?'PM project summary':'Team suggestion');});
  await store.createProject({name:'Team planning',managerId:'codex',agentIds:['antigravity']});
  const soulBefore=store.communication.snapshot().soul.content;
  await store.room.send({text:'Plan our milestones.',mode:'discussion'});await store.room.run.done;
  assert.deepEqual(calls.map(c=>c.agent),['antigravity','codex']);assert.match(calls[1].prompt,/Team suggestion/);
  assert.match(calls[1].prompt,/Kamu adalah PROJECT MANAGER/);
  const updates=store.memoryFor(store.activeId).snapshot().auto.updates;
  assert.equal(updates.length,1);assert.equal(updates[0].agent,'codex');assert.match(updates[0].summary,/PM project summary/);
  assert.equal(store.communication.snapshot().soul.content,soulBefore);
  calls.length=0;await store.room.send({text:'Ask the architect.',mode:'antigravity'});await store.room.run.done;
  assert.deepEqual(calls.map(c=>c.agent),['antigravity']);
});
test('routine disagreement continues without waiting for the GM',async t=>{
  const calls=[];
  const {store}=await setup(t,async agent=>{
    calls.push(agent);
    return reply('Compare reversible options.',{disagreement:calls.length===1,continue:calls.length===1});
  });
  await store.createProject({name:'Team review',managerId:'codex',agentIds:['antigravity']});
  await store.room.send({text:'Compare both options.',mode:'discussion'});await store.room.run.done;
  assert.deepEqual(calls,['antigravity','codex','antigravity','codex']);
  assert.equal(store.projects[0].pendingDecision,null);
  assert.equal(store.room.lastRun.reason,'consensus');
});
test('an explicit GM decision request pauses the team and survives restart',async t=>{
  let debate=true;const calls=[];
  const {store,options}=await setup(t,async(agent,prompt)=>{calls.push({agent,prompt});return debate?reply('PM and team disagree about the schedule.',{disagreement:true,needsUser:true,question:'Keep scope or extend the schedule?'}):reply('Follow GM decision.');});
  await store.createProject({name:'Debate project',managerId:'codex',agentIds:['antigravity','claude']});
  const projectId=store.projects[0].id;
  await store.room.send({text:'Review the timeline.',mode:'discussion'});await store.room.run.done;
  assert.deepEqual(calls.map(c=>c.agent),['antigravity']);assert.equal(store.room.lastRun.reason,'needs-user');
  const pending=store.projects[0].pendingDecision;assert.ok(pending?.id);
  assert.equal(store.memoryFor(store.activeId).snapshot().auto.updates.length,0);
  await assert.rejects(store.room.send({text:'Keep going',mode:'discussion'}),/General Manager/);
  await store.create({title:'Sibling',projectId});
  await assert.rejects(store.room.send({text:'Bypass in another session',mode:'codex'}),/General Manager/);
  const restored=new SessionStore(options);await restored.load();assert.equal(restored.projects[0].pendingDecision.id,pending.id);
  await assert.rejects(restored.room.send({text:'Fake resolution',decisionId:'wrong',mode:'discussion'}),/General Manager/);
  debate=false;calls.length=0;
  await restored.room.send({text:'Extend the schedule and preserve scope.',decisionId:pending.id,mode:'discussion'});await restored.room.run.done;
  assert.equal(restored.projects[0].pendingDecision,null);
  assert.equal(restored.projects[0].decisions.at(-1).text,'Extend the schedule and preserve scope.');
  assert.match(restored.memorySnapshot(restored.activeId).content,/Keputusan final user \/ General Manager: Extend the schedule/);
  assert.equal(restored.memorySnapshot(restored.activeId).gmDecisions.at(-1).id,pending.id);
  assert.doesNotMatch(restored.communication.snapshot().soul.content,/Extend the schedule/);
  assert.ok(calls.every(call=>call.prompt.includes('Extend the schedule and preserve scope.')));
  assert.equal(calls.at(-1).agent,'codex');
  for(const room of restored.rooms.values())await room.save();await restored.queue;
});
test('an unavailable PM fails honestly instead of publishing another agent as manager',async t=>{
  let invoked=false;const {store}=await setup(t,async()=>{invoked=true;return reply('No');});
  await store.createProject({name:'Offline PM',managerId:'codex',agentIds:['antigravity']});
  store.room.accounts.codex={connected:false};
  await assert.rejects(store.room.send({text:'Start',mode:'discussion'}),/Project Manager belum tersambung/);
  assert.equal(invoked,false);assert.equal(store.room.messages.length,0);
});

test('a DeepSeek mention routes only to DeepSeek, even with a Codex PM and a broadcast mode',async t=>{
  const calls=[];const {store}=await setup(t,async agent=>{calls.push(agent);return reply('Directed reply');});
  store.agents.deepseek={id:'deepseek',name:'DeepSeek Web',installed:true,transport:'browser-web'};
  await store.createProject({name:'Directed messages',managerId:'codex',agentIds:['deepseek','antigravity']});
  store.room.accounts.codex={connected:false};
  const before=store.memoryFor(store.activeId).snapshot().auto.updates.length;
  await store.room.send({text:'@DeepSeek hello',mode:'discussion'});await store.room.run.done;
  assert.deepEqual(calls,['deepseek']);assert.equal(store.room.messages.at(-1).role,'deepseek');
  assert.equal(store.memoryFor(store.activeId).snapshot().auto.updates.length,before);
  calls.length=0;await store.room.send({text:'@DeepSeek Web review this',mode:'codex'});await store.room.run.done;assert.deepEqual(calls,['deepseek']);
  calls.length=0;
  await store.room.send({text:'Please ask @DeepSeek, then @Antigravity. Thanks @DeepSeek!',mode:'discussion'});
  await store.room.run.done;
  assert.deepEqual(calls,['deepseek','antigravity']);
  calls.length=0;
  await store.setBotEnabled('antigravity',false);
  await assert.rejects(store.room.send({text:'Ask @DeepSeek and @Antigravity',mode:'discussion'}),/sedang Off/);
  assert.deepEqual(calls,[]);
  await assert.rejects(store.room.send({text:'Ask all agents',mode:'discussion'}),/Project Manager belum tersambung/);
});

test('only PM can consolidate the main project document; siblings and replacement accounts read it after restart',async t=>{
  const calls=[];
  const {store,options}=await setup(t,async(agent,prompt)=>{
    calls.push({agent,prompt});
    const revision=store.memoryFor(store.activeId).snapshot().soul.revision;
    return reply('Memory checkpoint',{projectMemory:{baseRevision:revision,content:agent==='codex'?'# Shared concept\n\n## Decisions\nThree bays approved; no Studio implementation verified.':'WRONG TEAM OVERWRITE'}});
  });
  await store.createProject({name:'Shared concept',managerId:'codex',agentIds:['antigravity']});
  assert.equal(store.memoryFor(store.activeId).value.soul.content.split('# Shared concept').length-1,1);
  const projectId=store.projects[0].id,soul=store.communication.snapshot().soul.content;
  await store.room.send({text:'Approve three bays.',mode:'discussion'});await store.room.run.done;
  const memory=store.memoryFor(store.activeId).snapshot();
  assert.match(memory.soul.content,/Three bays approved/);assert.doesNotMatch(memory.soul.content,/WRONG TEAM/);
  assert.match(calls.at(-1).prompt,/PEMBARUAN RANGKUMAN PROJECT MEMORY/);
  assert.equal(memory.soul.summarySource.agent,'codex');
  await store.create({title:'Other session',projectId});
  assert.match(store.memorySnapshot(store.activeId).content,/Three bays approved/);
  const restored=new SessionStore(options);await restored.load();
  assert.match(restored.memorySnapshot(restored.activeId).content,/Three bays approved/);
  assert.equal(restored.communication.snapshot().soul.content,soul);
  const before=restored.memoryFor(restored.activeId).value.soul.content;
  await restored.room.send({text:'Do not save this draft',mode:'codex',syncMemory:false});await restored.room.run?.done;
  assert.equal(restored.memoryFor(restored.activeId).value.soul.content,before);
  for(const room of restored.rooms.values())await room.save();await restored.queue;
});

test('a stale PM document cannot overwrite a concurrent manual concept edit',async t=>{
  let started,release;const entered=new Promise(resolve=>started=resolve),gate=new Promise(resolve=>release=resolve);
  const {store}=await setup(t,async()=>{
    const revision=store.memoryFor(store.activeId).snapshot().soul.revision;started();await gate;
    return reply('Stale summary',{projectMemory:{baseRevision:revision,content:'# OLD AI CONTENT'}});
  });
  await store.createProject({name:'Concurrent concept',managerId:'codex',agentIds:[]});
  await store.room.send({text:'Update concept',mode:'codex'});const run=store.room.run;await entered;
  const memory=store.memoryFor(store.activeId);await memory.saveSoul('# Manual concept\nKeep this important decision.',memory.snapshot().soul.revision);
  release();await run.done;
  assert.match(memory.snapshot().soul.content,/# Manual concept/);assert.doesNotMatch(memory.snapshot().soul.content,/OLD AI CONTENT/);
});
