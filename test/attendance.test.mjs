import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Room } from '../room.mjs';
import { Brain } from '../brain.mjs';
import { parseAttendanceReply } from '../protocol.mjs';

async function fixture(t,runner){
  const directory=await mkdtemp(join(tmpdir(),'pitlane-attendance-'));
  const brain=new Brain(directory,'# Project Aurora Rally\nKonsep game balap modular.');await brain.load();
  const room=new Room({directory,brain,agents:{codex:{id:"codex",name:"Codex",installed:true},antigravity:{id:"antigravity",name:"Antigravity",installed:true}},runner});await room.load();
  t.after(async()=>{await room.stop();await room.save();await brain.queue;assert.ok(directory.startsWith(join(tmpdir(),'pitlane-attendance-')));await rm(directory,{recursive:true,force:true});});
  return {room,brain,directory};
}
test('attendance calls both agents once, independently from their own Soul context',async t=>{
  const calls=[];const {room,brain}=await fixture(t,async(agent,prompt)=>{
    calls.push({agent,prompt});return 'Hadir, Siap Melanjutkan Project Aurora Rally';
  });
  const revision=brain.snapshot().soul.revision;
  await room.send({text:'Absen',mode:'attendance'});await room.run?.done;await room.save();
  assert.deepEqual(calls.map(c=>c.agent),['codex','antigravity']);
  assert.ok(calls.every(c=>c.prompt.includes('Project Aurora Rally')));
  assert.ok(!calls[1].prompt.includes('RIWAYAT ROOM'));assert.ok(!calls[1].prompt.includes('Hadir, Siap Melanjutkan Project Aurora Rally'));
  assert.equal(room.messages.length,2);assert.ok(room.messages.every(m=>m.kind==='attendance'));
  assert.equal(brain.snapshot().soul.revision,revision);assert.equal(brain.snapshot().auto.updates.length,0);
  assert.equal(room.attendance.agents.codex.text,'Hadir, Siap Melanjutkan Project Aurora Rally');
});
test('attendance rejects verbose replies and never replaces them with a fabricated project name',async t=>{
  const {room}=await fixture(t,async agent=>agent==='codex'?'Hadir, Siap Melanjutkan Project Aurora Rally\nLangkah berikutnya...':'Hadir, Siap Melanjutkan Project Nama Salah');
  await room.send({text:'Absen',mode:'attendance'});await room.run?.done;
  assert.equal(room.attendance.agents.codex.status,'error');
  assert.equal(room.attendance.agents.antigravity.text,'Hadir, Siap Melanjutkan Project Nama Salah');
});
test('attendance cannot interrupt an active discussion',async t=>{
  const {room}=await fixture(t,async(agent,prompt,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Stop','AbortError')),{once:true})));
  await room.send({text:'Mulai diskusi',mode:'both'});const active=room.run;
  await assert.rejects(room.send({text:'Absen',mode:'attendance'}),/percakapan aktif/);
  assert.equal(room.run,active);assert.ok(!active.controller.signal.aborted);await room.stop();
});
test('attendance results persist and can be marked stale after account/model refresh',async t=>{
  const {room,brain,directory}=await fixture(t,async()=> 'Hadir, Siap Melanjutkan Project Aurora Rally');
  await room.send({text:'Absen',mode:'attendance'});await room.run?.done;
  room.invalidateAttendance();await room.save();
  const copy=new Room({directory,brain,agents:{codex:{id:"codex",name:"Codex",installed:true},antigravity:{id:"antigravity",name:"Antigravity",installed:true}},runner:async()=>''});await copy.load();
  assert.equal(copy.attendance.stale,true);assert.equal(copy.attendance.agents.codex.status,'done');
});
test('attendance format requires a genuine single-line response and an actual Soul',async t=>{
  assert.equal(parseAttendanceReply('Hadir, Siap Melanjutkan Project Aurora Rally'),'Hadir, Siap Melanjutkan Project Aurora Rally');
  assert.throws(()=>parseAttendanceReply('Siap melanjutkan.'),/Format absen/);
  const {room}=await fixture(t,async()=> 'Hadir, Siap Melanjutkan Project Aurora Rally');room.brain=undefined;
  await assert.rejects(room.send({text:'Absen',mode:'attendance'}),/Soul proyek belum/);
});
