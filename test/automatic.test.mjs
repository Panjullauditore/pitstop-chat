import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Room } from '../room.mjs';
import { Brain } from '../brain.mjs';
import { parseReply,visibleReply,AUTO_MARKER } from '../protocol.mjs';

const answer=(text,control={})=>text+'\n<pitlane>'+JSON.stringify({continue:false,needsUser:false,summary:'Usulan layout, belum disetujui user.',next:'',reportedProgress:'',...control})+'</pitlane>';
async function fixture(t,runner){
  const directory=await mkdtemp(join(tmpdir(),'pitlane-auto-'));
  const documentPath=join(directory,'SOUL.md');
  const brain=new Brain(directory,'Keputusan inti user: tiga bay.',{documentPath});await brain.load();
  const room=new Room({directory,brain,agents:{codex:{id:"codex",name:"Codex",installed:true},antigravity:{id:"antigravity",name:"Antigravity",installed:true}},runner});await room.load();
  t.after(async()=>{await room.stop();await room.save();await brain.queue;assert.ok(directory.startsWith(join(tmpdir(),'pitlane-auto-')));await rm(directory,{recursive:true,force:true});});
  return {room,brain,documentPath,directory};
}
test('automatic consensus ends after both agents, without a user round setting',async t=>{
  let calls=0;const {room}=await fixture(t,async()=>{calls++;return answer('Cukup, sepakat.');});
  await room.send({text:'Bahas layout',mode:'discussion'});await room.run?.done;
  assert.equal(calls,2);assert.equal(room.lastRun.reason,'consensus');
});
test('one agent can request further discussion; both must be ready to finish',async t=>{
  let calls=0;const {room}=await fixture(t,async()=>{calls++;return answer('Masukan '+calls,{continue:calls===2});});
  await room.send({text:'Bahas layout',mode:'discussion'});await room.run?.done;
  assert.equal(calls,4);assert.equal(room.lastRun.reason,'consensus');
});
test('a user question stops automatic discussion after the current exchange',async t=>{
  let calls=0;const {room}=await fixture(t,async()=>{calls++;return answer('Pilih warna apa?',{continue:true,needsUser:true});});
  await room.send({text:'Bahas layout',mode:'discussion'});await room.run?.done;
  assert.equal(calls,2);assert.equal(room.lastRun.reason,'needs-user');
});
test('internal token safeguard stops agents that continually ask to continue',async t=>{
  let calls=0;const {room}=await fixture(t,async()=>{calls++;return answer('Tambahan.',{continue:true});});
  await room.send({text:'Bahas layout',mode:'discussion',rounds:999});await room.run?.done;
  assert.equal(calls,8);assert.equal(room.lastRun.reason,'budget');
});
test('missing control cannot cause endless automatic turns',async t=>{
  let calls=0;const {room}=await fixture(t,async()=>{calls++;return 'Jawaban tanpa checkpoint.';});
  await room.send({text:'Bahas layout',mode:'discussion'});await room.run?.done;
  assert.equal(calls,2);assert.equal(room.lastRun.reason,'missing-control');
});
test('Soul markdown auto-updates using existing replies, without any summary calls',async t=>{
  let calls=0;const {room,brain,documentPath,directory}=await fixture(t,async()=>{calls++;return answer('Usulkan cat biru.',{reportedProgress:'Agent mengklaim lift selesai.'});});
  await room.send({text:'Pertahankan tiga bay, bahas warna.',mode:'both'});await room.run?.done;
  assert.equal(calls,2);const soul=await readFile(documentPath,'utf8');
  assert.match(soul,/Keputusan inti user: tiga bay/);assert.match(soul,/Arahan user: Pertahankan tiga bay/);
  assert.match(soul,/Usulan layout, belum disetujui user/);assert.match(soul,/Laporan progres BELUM DIVERIFIKASI/);
  const reloaded=new Brain(directory,'ignored',{documentPath});await reloaded.load();
  assert.equal(reloaded.snapshot().soul.content,brain.snapshot().soul.content);
  assert.equal(reloaded.snapshot().auto.updates.length,2);
});
test('automatic notes stay bounded; editing the core does not promote generated notes',async t=>{
  const {brain}=await fixture(t,async()=>answer('OK'));
  for(let i=0;i<12;i++)await brain.recordUser({id:String(i),text:'Arahan '+i,at:'today'});
  assert.equal(brain.snapshot().auto.userNotes.length,6);
  const state=brain.snapshot();await brain.saveSoul(state.soul.content.replace('tiga bay','TIGA BAY'),state.soul.revision);
  assert.ok(!brain.value.soul.content.includes(AUTO_MARKER));assert.match(brain.snapshot().soul.content,/TIGA BAY/);
  assert.equal(brain.snapshot().soul.content.split(AUTO_MARKER).length,2);
});
test('protocol metadata is hidden during streaming and malformed JSON fails closed',()=>{
  assert.equal(visibleReply('Pendapat.\n<pitlane>{"cont'),'Pendapat.');
  assert.equal(parseReply('Pendapat.\n<pitlane>oops</pitlane>').control,null);
  assert.throws(()=>parseReply('<pitlane>{"continue":false,"needsUser":false}</pitlane>'),/tanpa jawaban/);
});
