import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Brain } from '../brain.mjs';
import { Room } from '../room.mjs';
import { normalizeCodexModels, normalizeAntigravityModels, validateSelections } from '../models.mjs';
import { buildAgentArgs } from '../adapters.mjs';

async function setup(t){
  const directory=await mkdtemp(join(tmpdir(),'pitlane-brain-'));
  const brain=new Brain(directory,'Konsep tetap: satu garage dengan TIGA service bay.'); await brain.load();
  t.after(async()=>{await brain.queue;assert.ok(directory.startsWith(join(tmpdir(),'pitlane-brain-')));await rm(directory,{recursive:true,force:true});});
  return {brain,directory};
}
test('Soul and model choices survive restart and are independent from CLI accounts',async t=>{
  const {brain,directory}=await setup(t);
  await brain.saveSoul('Garage tiga bay. Keputusan user: jalur antre di depan.',1);
  await brain.saveSelections({codex:{model:'gpt-6-astra',effort:'ultra'},antigravity:{model:'gemini-3.8-flash',effort:'low'}});
  const reloaded=new Brain(directory,'different seed');await reloaded.load();
  assert.match(reloaded.snapshot().soul.content,/jalur antre/);assert.equal(reloaded.snapshot().soul.revision,2);
  assert.equal(reloaded.snapshot().selections.codex.effort,'ultra');
});
test('Soul rejects stale revisions, duplicate pins, unfinished messages, and oversized content',async t=>{
  const {brain}=await setup(t);
  await brain.saveSoul('Tiga bay, konsep user.',1);
  await assert.rejects(brain.saveSoul('stale edit',1),/sudah berubah/);
  const message={id:'one',role:'user',status:'done',text:'Tetapkan tiga bay.'};await brain.pin(message);
  await assert.rejects(brain.pin(message),/sudah tersimpan/);
  await assert.rejects(brain.pin({...message,id:'two',status:'streaming'}),/sudah selesai/);
  await assert.rejects(brain.saveSoul('X'.repeat(18001),3),/18000/);
});
test('a replacement agent receives the same Soul and shared history without old account session ids',async t=>{
  const {brain,directory}=await setup(t);let delivered='';
  const room=new Room({directory,brain,agents:{antigravity:{id:'antigravity',name:'Antigravity',installed:true}},runner:async(agent,prompt)=>{delivered=prompt;return 'Lanjut konsep tiga bay.';}});
  await room.load();room.messages.push({id:'brief',role:'user',status:'done',text:'Mobil antre dari depan.'});
  await room.send({text:'Akun baru, lanjutkan.',mode:'antigravity'});await room.run?.done;await room.save();
  assert.match(delivered,/TIGA service bay/);assert.match(delivered,/Mobil antre dari depan/);
  assert.equal(room.messages.at(-1).soulRevision,2);
});
test('model and Soul are fixed throughout an active discussion; changes apply on the next request',async t=>{
  const {brain,directory}=await setup(t);let release;const gate=new Promise(resolve=>release=resolve);const calls=[];
  await brain.saveSelections({codex:{model:'old-c',effort:'low'},antigravity:{model:'old-a',effort:'low'}});
  const room=new Room({directory,brain,agents:{codex:{id:"codex",name:"Codex",installed:true},antigravity:{id:"antigravity",name:"Antigravity",installed:true}},runner:async(agent,prompt,options)=>{calls.push({agent,prompt,selection:options.selection});if(calls.length===1)await gate;return 'response';}});
  await room.load();await room.send({text:'Diskusi',mode:'discussion',rounds:1});const active=room.run;
  await brain.saveSelections({codex:{model:'new-c',effort:'high'},antigravity:{model:'new-a',effort:'high'}});
  await brain.saveSoul('Konsep baru dari user.',brain.snapshot().soul.revision);release();await active.done;await room.save();
  assert.equal(calls[1].selection.model,'old-a');assert.match(calls[1].prompt,/TIGA service bay/);
  await room.send({text:'Giliran baru',mode:'codex'});await room.run?.done;await room.save();
  assert.equal(calls[2].selection.model,'new-c');assert.match(calls[2].prompt,/Konsep baru dari user/);
});
test('model discovery preserves supported Codex efforts and maps Antigravity variants exactly',()=>{
  const c=normalizeCodexModels({data:[{model:'gpt-6-astra',displayName:'GPT-6-Astra',supportedReasoningEfforts:[{reasoningEffort:'low'},{reasoningEffort:'ultra'}]}]});
  const a=normalizeAntigravityModels({command:{data:{models:[{id:'gemini-3.8-flash-high',label:'Gemini 3.8 Flash (High)'},{id:'gemini-3.8-flash-low',label:'Gemini 3.8 Flash (Low)'},{id:'claude-sonnet-4-6',label:'Claude Sonnet 4.6'}]}}});
  const result=validateSelections({codex:{model:'gpt-6-astra',effort:'ultra'},antigravity:{model:'gemini-3.8-flash',effort:'low'}},{codex:{models:c},antigravity:{models:a}});
  assert.equal(result.antigravity.cliModel,'gemini-3.8-flash-low');assert.equal(result.antigravity.cliEffort,'');
  const codexArgs=buildAgentArgs('codex',{script:'codex.js'},result.codex);
  assert.ok(codexArgs.includes('model_reasoning_effort="ultra"'));assert.ok(codexArgs.includes('gpt-6-astra'));
  const agyArgs=buildAgentArgs('antigravity',{},result.antigravity);assert.ok(agyArgs.includes('gemini-3.8-flash-low'));assert.ok(!agyArgs.includes('--effort'));
  assert.throws(()=>validateSelections({codex:{model:'gpt-6-astra',effort:'medium'},antigravity:{model:'',effort:''}},{codex:{models:c}}),/tidak didukung/);
});
test('manual model IDs are explicit and never silently downgraded',()=>{
  const selections={codex:{model:'gpt-6.1-sol',effort:'ultra',custom:true},antigravity:{model:'',effort:''}};
  const result=validateSelections(selections,{});assert.equal(result.codex.cliModel,'gpt-6.1-sol');assert.equal(result.codex.custom,true);
  assert.throws(()=>validateSelections({...selections,codex:{model:'x; shutdown',effort:'low',custom:true}},{}),/ID tidak valid/);
});

test('custom display name survives restart without changing Soul decisions or revision',async t=>{
  const {brain,directory}=await setup(t);const before=brain.snapshot().soul;
  await brain.saveDisplayName('  Willy   Garage  ');
  const copy=new Brain(directory,'ignored');await copy.load();
  assert.equal(copy.snapshot().preferences.displayName,'Willy Garage');
  assert.equal(copy.snapshot().soul.content,before.content);assert.equal(copy.snapshot().soul.revision,before.revision);
});
test('profile validation rejects empty, oversized, and control-character names',async t=>{
  const {brain}=await setup(t);
  for(const name of ['', '  ', 'a'.repeat(33), 'Willy\nAgent', null])await assert.rejects(brain.saveDisplayName(name));
  assert.equal(brain.snapshot().preferences.displayName,'Username');
});
