import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Room } from '../room.mjs';
import { parseAgentEvent } from '../adapters.mjs';

const agents = { codex:{ id:'codex', name:'Codex', installed:true }, antigravity:{ id:'antigravity', name:'Antigravity', installed:true } };
async function fixture(t, runner) {
  const directory = await mkdtemp(join(tmpdir(), 'pitlane-test-'));
  const room = new Room({ directory, agents, runner, context:'Garage tiga bay.' });
  await room.load();
  t.after(async () => { await room.stop(); await room.save(); assert.ok(directory.startsWith(join(tmpdir(), 'pitlane-test-'))); await rm(directory, { recursive:true, force:true }); });
  return room;
}
test('both agents get shared context, and second gets the first response', async t => {
  const calls=[];
  const room = await fixture(t, async (agent,prompt) => { calls.push({agent,prompt}); return agent === 'codex' ? 'Tiga bay sejajar.' : 'Tambahkan halaman antre.'; });
  await room.send({text:'Bahas garage.'}); await room.run?.done;
  assert.equal(calls.length,2); assert.match(calls[0].prompt,/Garage tiga bay/);
  assert.match(calls[1].prompt,/Tiga bay sejajar/); assert.equal(room.messages.length,3);
});

test('native App task policy permits explicit user work while keeping automated follow-ups and attendance as discussion',async t=>{
  const calls=[];
  const room=await fixture(t,async(agent,prompt)=>{calls.push({agent,prompt});return 'Reply\n<pitlane>'+JSON.stringify({continue:calls.length<3,needsUser:false})+'</pitlane>';});
  room.getLinkedApps=()=>({antigravity:{id:'selected-native-chat',transport:'remote-app'}});
  await room.send({text:'Inspect the game using Antigravity',mode:'discussion'});await room.run?.done;
  const native=calls.filter(call=>call.agent==='antigravity');assert.equal(native.length,2);
  assert.match(native[0].prompt,/Gunakan koneksi MCP Roblox Studio milik agent/);assert.doesNotMatch(native[0].prompt,/Jangan menjalankan command, mengedit file, mengakses MCP/);
  assert.match(native[1].prompt,/giliran diskusi lanjutan otomatis/);assert.match(native[1].prompt,/Jangan melakukan perubahan/);
  assert.match(calls.find(call=>call.agent==='codex').prompt,/Jangan menjalankan command, mengedit file, mengakses MCP/);
});

test('linked Codex can use its native MCP for explicit tasks without granting tools to unlinked chats',async t=>{
  let prompt='';const room=await fixture(t,async(_,text)=>{prompt=text;return 'Native reply';});
  room.getLinkedApps=()=>({codex:{id:'native-codex-chat',source:'codex'}});
  await room.send({text:'Read the open Studio',mode:'codex'});await room.run?.done;
  assert.match(prompt,/Gunakan koneksi MCP Roblox Studio milik agent/);assert.doesNotMatch(prompt,/Jangan menjalankan command, mengedit file, mengakses MCP/);assert.doesNotMatch(prompt,/Khusus renderer Antigravity App/);
});

test('a linked native App runs independently of CLI installation and CLI account identity',async t=>{
  let called=false;const room=await fixture(t,async()=>{called=true;return 'Native reply';});
  room.agents={...room.agents,antigravity:{...room.agents.antigravity,installed:false}};
  room.getLinkedApps=()=>({antigravity:{id:'selected-native-chat',transport:'remote-app'}});
  room.accounts.antigravity={connected:false,email:'cli-account@example.test'};
  room.getAppConnection=id=>id==='antigravity'?{app:true,connected:true,email:null,error:'Native App ready'}:null;
  const agent=room.snapshot().agents.find(item=>item.id==='antigravity');assert.equal(agent.installed,true);assert.equal(agent.transport,'native-app');assert.equal(agent.connection,'connected');assert.equal(agent.accountEmail,null);
  await room.send({text:'Native App question',mode:'antigravity'});await room.run?.done;assert.equal(called,true);
});
test('AI controls discussion length and each turn includes latest response', async t => {
  const calls=[];
  const room=await fixture(t,async(agent,prompt)=>{calls.push(prompt);return 'Jawaban '+calls.length+'\n<pitlane>'+JSON.stringify({continue:calls.length<3,needsUser:false,summary:'Usulan.'})+'</pitlane>';});
  await room.send({text:'Diskusikan',mode:'discussion'}); await room.run?.done;
  assert.equal(calls.length,4); assert.match(calls[3],/Jawaban 3/); assert.match(calls[3],/Ikuti preferensi komunikasi dalam Soul Memory/);
  assert.equal(room.lastRun.reason,'consensus');assert.ok(!room.messages.at(-1).text.includes('<pitlane>'));
});
test('single participant mode does not invoke the other agent',async t=>{
  const calls=[]; const room=await fixture(t,async agent=>{calls.push(agent);return 'OK';});
  await room.send({text:'Halo',mode:'antigravity'}); await room.run?.done;
  assert.deepEqual(calls,['antigravity']);
});
test('stop cancels active work and prevents another participant starting',async t=>{
  const calls=[];
  const room=await fixture(t,async(agent,prompt,{signal})=>{
    calls.push(agent); await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Stop','AbortError')),{once:true}));
  });
  await room.send({text:'Bahas panjang',mode:'discussion',rounds:3}); await room.stop();
  assert.equal(room.run,null); assert.deepEqual(calls,['codex']); assert.equal(room.messages[1].status,'stopped');
});
test('new user input interrupts and waits for previous runner to finish',async t=>{
  let stopped=false; let calls=0;
  const room=await fixture(t,async(agent,prompt,{signal})=>{
    calls++; if(calls===1) { await new Promise(resolve=>signal.addEventListener('abort',()=>setTimeout(()=>{stopped=true;resolve();},20),{once:true})); return 'obsolete'; }
    assert.ok(stopped); return 'New answer';
  });
  await room.send({text:'First',mode:'codex'});
  await room.send({text:'Second',mode:'codex'}); await room.run?.done;
  assert.equal(room.messages[1].status,'stopped'); assert.equal(room.messages.at(-1).text,'New answer');
});
test('errors are visible and do not fabricate a successful discussion',async t=>{
  const room=await fixture(t,async()=>{throw new Error('authentication required');});
  await room.send({text:'Halo',mode:'discussion',rounds:3}); await room.run?.done;
  assert.equal(room.messages.length,2); assert.equal(room.messages[1].status,'error'); assert.match(room.messages[1].text,/authentication/);
});
test('input validation prevents oversized and empty requests',async t=>{
  const room=await fixture(t,async()=> 'OK');
  await assert.rejects(room.send({text:''})); await assert.rejects(room.send({text:'a'.repeat(8001)}));
  await assert.rejects(room.send({text:'a',mode:'unknown'})); assert.equal(room.messages.length,0);
});
test('history survives a restart and truncated prompt declares omissions',async t=>{
  const room=await fixture(t,async()=> 'OK');
  for(let i=0;i<10;i++)room.messages.push({id:String(i),role:'user',text:'X'.repeat(10000),status:'done'});
  await room.save(); const copy=new Room({directory:room.directory,agents,runner:async()=>''}); await copy.load();
  assert.equal(copy.messages.length,10); assert.match(room.prompt('codex',{mode:'both',round:1,rounds:1}),/Riwayat lama dipotong/);
});
test('provider events parse final text without exposing tool output',()=>{
  assert.deepEqual(parseAgentEvent('codex',{type:'item.completed',item:{type:'agent_message',text:'Hello'}}),{final:'Hello'});
  assert.deepEqual(parseAgentEvent('codex',{type:'item.completed',item:{type:'command_execution',aggregated_output:'private'}}),{});
  assert.deepEqual(parseAgentEvent('antigravity',{event:'result',result:{status:'SUCCESS',response:'Hai'}}),{final:'Hai'});
  assert.match(parseAgentEvent('antigravity',{event:'result',result:{status:'ERROR',error:'login'}}).error,/login/);
  assert.equal(parseAgentEvent('codex',{type:'error',message:JSON.stringify({error:{message:'Model tidak didukung'}})}).error,'Model tidak didukung');
});
