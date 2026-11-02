import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SessionStore } from '../sessions.mjs';
import { accountIdentity } from '../accounts.mjs';
import { buildAgentArgs, parseAgentEvent } from '../adapters.mjs';
import { createQuotaService } from '../quota.mjs';

async function setup(t, runner = async () => 'Jawaban sesi.') {
  const directory = await mkdtemp(join(tmpdir(), 'pitlane-sessions-'));
  const options = {directory,seed:'# Proyek Lama',agents:{codex:{id:'codex',name:'Codex',installed:true}},runner};
  const store = new SessionStore(options); await store.load();
  t.after(async () => {
    for (const room of store.rooms.values()) {await room.stop();await room.save();await room.brain.queue;}
    await store.queue;
    assert.ok(directory.startsWith(join(tmpdir(),'pitlane-sessions-')));
    await rm(directory,{recursive:true,force:true});
  });
  return {store,options};
}

test('linked app chats persist per project, cannot be shared across projects or changed mid-turn',async t=>{
  const seen=[];
  const {store,options}=await setup(t,async(agent,prompt,run)=>{seen.push(run.nativeLink);await assert.rejects(store.setLinkedApps(store.projects[0].id,{}),/active discussion/);return {text:'Native answer',model:'native-model',nativeChat:{provider:agent,id:run.nativeLink.id,title:'App chat',history:'saved'}};});
  await store.createProject({name:'Linked',agentIds:['codex']});const first=store.projects[0].id;
  const link={id:'native-chat-123456',title:'App chat',cwd:process.cwd(),source:'codex',state:'linked'};
  await store.setLinkedApps(first,{codex:link});
  await store.room.send({text:'Directed question',mode:'codex',syncMemory:false});await store.room.run?.done;
  assert.equal(seen[0].id,link.id);assert.equal(store.room.messages.at(-1).nativeChat.id,link.id);assert.equal(store.room.messages.at(-1).model,'native-model');
  await store.create({title:'Sibling',projectId:first});assert.equal(store.room.getLinkedApps().codex.id,link.id);
  await store.linkedResult(store.activeId,'codex','wrong-id',{state:'saved'});assert.equal(store.projects[0].linkedApps.codex.state,'linked');
  await store.linkedResult(store.activeId,'codex',link.id,{state:'saved'});
  await store.createProject({name:'Other',agentIds:['codex']});const other=store.projects[1].id;
  assert.deepEqual(store.room.getLinkedApps(),{});await assert.rejects(store.setLinkedApps(other,{codex:link}),/another Pitlane project/);
  const reloaded=new SessionStore(options);await reloaded.load();assert.equal(reloaded.projects[0].linkedApps.codex.state,'saved');
  await store.setLinkedApps(first,{});assert.deepEqual(store.projects[0].linkedApps,{});await store.setLinkedApps(other,{codex:link});
  for(const room of reloaded.rooms.values()){await room.save();await room.brain.queue;}
});
test('server sessions isolate transcripts, prompts and Soul across switches and restart', async t => {
  const prompts=[];const {store,options}=await setup(t,async (_,prompt)=>{prompts.push(prompt);return 'OK';});
  await store.room.send({text:'Rahasia sesi lama',mode:'codex'});await store.room.run?.done;
  await store.create({title:'Baru',soulContent:'# Proyek Baru'});
  const newId=store.activeId;
  assert.equal(store.room.messages.length,0);
  await store.room.send({text:'Pesan baru',mode:'codex'});await store.room.run?.done;
  assert.doesNotMatch(prompts.at(-1),/Rahasia sesi lama/);
  assert.match(prompts.at(-1),/Proyek Baru/);
  await store.switch('session-default');
  assert.equal(store.room.messages[0].text,'Rahasia sesi lama');
  assert.match(store.room.brain.snapshot().soul.content,/Proyek Lama/);
  await store.rename(newId,'Nama Baru');await store.room.save();await store.persist();
  const reloaded=new SessionStore(options);await reloaded.load();
  assert.equal(reloaded.list().find(s=>s.id===newId).title,'Nama Baru');
  await reloaded.switch(newId);
  assert.equal(reloaded.room.messages[0].text,'Pesan baru');
  for(const room of reloaded.rooms.values()){await room.save();await room.brain.queue;}
});
test('switch stops the old process before opening another session', async t => {
  let aborted=false;
  const {store}=await setup(t,(_,__,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(new DOMException('Stop','AbortError'));},{once:true})));
  await store.room.send({text:'Tunggu',mode:'codex'});
  const old=store.room;
  // Let the runner start before interrupting it.
  while(!old.run.speaker)await new Promise(r=>setTimeout(r,5));
  await store.create({title:'Berikutnya'});
  assert.ok(aborted);assert.equal(old.run,null);assert.equal(old.messages.at(-1).status,'stopped');
  assert.equal(store.room.messages.length,0);
});
test('legacy browser import is idempotent and deleted sessions do not reappear', async t => {
  const {store}=await setup(t);
  const legacy=[{id:'session_123',title:'Sesi Browser',messages:[{id:'m',role:'user',text:'Riwayat lama',status:'done'}],soul:{content:'# Browser'}}];
  await store.importLegacy(legacy);await store.importLegacy(legacy);
  assert.equal(store.entries.length,2);
  const imported=store.entries.find(e=>e.legacyId);
  await store.delete(imported.id);await store.importLegacy(legacy);
  assert.equal(store.entries.length,1);
  const deletedId=store.activeId;await store.delete(deletedId);
  assert.equal(store.entries.length,1);assert.notEqual(store.activeId,deletedId);assert.equal(store.room.messages.length,0);
  await assert.rejects(store.switch('../outside'),/tidak ditemukan/);
});
test('memory sync off preserves Soul while still saving the transcript', async t => {
  const {store}=await setup(t);
  const before=store.room.brain.snapshot();
  await store.room.send({text:'Jangan ingat',mode:'codex',syncMemory:false});await store.room.run?.done;await store.room.save();
  assert.deepEqual(store.room.brain.snapshot(),before);
  const saved=JSON.parse(await readFile(join(store.directory,'room.json'),'utf8'));
  assert.equal(saved.messages[0].text,'Jangan ingat');
  await assert.rejects(store.room.send({text:'Salah sesi',mode:'codex',sessionId:'old'}),/Sesi aktif berubah/);
});
test('account payload exports only a valid email, without credentials', () => {
  assert.deepEqual(accountIdentity({account:{email:'user@gmail.com'},access_token:'secret',tokens:{id_token:'secret'}}),{email:'user@gmail.com'});
  assert.deepEqual(accountIdentity({email:'bad value',refreshToken:'secret'}),{email:null});
});
test('Claude adapter handles streaming, final replies and provider errors', () => {
  assert.deepEqual(parseAgentEvent('claude',{type:'stream_event',event:{delta:{type:'text_delta',text:'Halo'}}}),{delta:'Halo'});
  assert.deepEqual(parseAgentEvent('claude',{type:'result',result:'Selesai'}),{final:'Selesai'});
  assert.deepEqual(parseAgentEvent('claude',{type:'result',is_error:true,result:'Login gagal'}),{error:'Login gagal'});
  const args=buildAgentArgs('claude',{}, {model:'sonnet',effort:'high'});
  assert.ok(args.includes('--no-session-persistence'));assert.ok(args.includes('--strict-mcp-config'));
  assert.equal(args[args.indexOf('--tools')+1],'');
});

test('reconnecting one provider does not invalidate another provider account check', async () => {
  let release;
  const service=createQuotaService({readers:{antigravity:()=>new Promise(resolve=>{release=resolve;}),codex:async()=>({agent:'codex',groups:[]})}});
  const pending=service.get('antigravity');
  service.invalidate('codex');
  release({agent:'antigravity',groups:[]});
  assert.equal((await pending).agent,'antigravity');
});

test('projects share sibling context only within their project and persist moves across restart', async t => {
  const delivered=[];
  const {store,options}=await setup(t,async(agent,prompt)=>{delivered.push(prompt);return 'OK';});
  await store.createProject({name:'Alpha',agentIds:['codex']});
  const alpha=store.projects[0].id,first=store.activeId;
  await store.room.send({text:'Alpha secret: deployment uses river-42',mode:'codex'});await store.room.run?.done;
  await store.create({title:'Second',projectId:alpha});const second=store.activeId;
  assert.match(store.projectContext(second,'deployment'),/river-42/);
  await store.room.send({text:'Check deployment from the first chat',mode:'codex'});await store.room.run?.done;
  assert.match(delivered.at(-1),/river-42/);
  assert.match(delivered.at(-1),/KONTEKS LINTAS SESI PROYEK/);
  await store.createProject({name:'Beta',agentIds:['codex']});const beta=store.projects[1].id,third=store.activeId;
  assert.doesNotMatch(store.projectContext(third),/river-42/);
  await store.moveSession(first,beta);
  assert.match(store.projectContext(third),/river-42/);
  assert.doesNotMatch(store.projectContext(second),/river-42/);
  await store.persist();
  const loaded=new SessionStore(options);await loaded.load();
  assert.equal(loaded.projects.length,2);assert.equal(loaded.entries.find(e=>e.id===first).projectId,beta);
  assert.match(loaded.projectContext(third),/river-42/);
  for(const room of loaded.rooms.values()){await room.stop();await room.save();await room.brain.queue;}
});

test('project and session agent choices are enforced before any provider is invoked', async t => {
  const {store}=await setup(t);
  store.agents.antigravity={id:'antigravity',name:'Antigravity',installed:true};
  await store.createProject({name:'Team',agentIds:['codex','antigravity']});const projectId=store.projects[0].id;
  await store.setSessionAgents(store.activeId,['codex']);
  await assert.rejects(store.room.send({text:'No',mode:'antigravity'}),/tidak diikutkan/);
  assert.deepEqual(store.enabledAgents(store.activeId),['codex']);
  await store.setSessionAgents(store.activeId,null);
  assert.deepEqual(store.enabledAgents(store.activeId),['codex','antigravity']);
  await store.updateProject({projectId,name:'Team',agentIds:['antigravity']});
  await assert.rejects(store.setSessionAgents(store.activeId,['codex']),/harus termasuk/);
  await assert.rejects(store.moveSession(store.activeId,'unknown'),/tidak ditemukan/);
  await assert.rejects(store.createProject({name:'Invalid',agentIds:[]}),/minimal/);
});

test('deleting a project keeps its chats, Soul and participants after restart',async t=>{
  const {store,options}=await setup(t);
  store.agents.antigravity={id:'antigravity',name:'Antigravity',installed:true};
  await store.createProject({name:'Keep chats',agentIds:['codex']});
  const projectId=store.projects[0].id,first=store.activeId;
  await store.room.send({text:'Important decision',mode:'codex'});await store.room.run?.done;
  const before=store.room.brain.snapshot();
  await store.create({title:'Another chat',projectId});const active=store.activeId;
  await store.deleteProject(projectId);
  assert.equal(store.projects.length,0);assert.equal(store.activeId,active);
  assert.equal(store.entries.find(entry=>entry.id===first).projectId,null);
  assert.deepEqual(store.enabledAgents(first),['codex']);
  assert.deepEqual(store.rooms.get(first).brain.snapshot(),before);
  assert.equal(store.rooms.get(first).messages[0].text,'Important decision');
  assert.equal(store.projectContext(active),'');
  await assert.rejects(store.deleteProject(projectId),/tidak ditemukan/);
  const loaded=new SessionStore(options);await loaded.load();
  assert.equal(loaded.projects.length,0);assert.equal(loaded.entries.find(entry=>entry.id===active).projectId,null);
  assert.deepEqual(loaded.enabledAgents(first),['codex']);
  for(const room of loaded.rooms.values()){await room.save();await room.brain.queue;}
});

test('last-session deletion creates a fresh chat and survives restart without restoring old memory',async t=>{
  const {store,options}=await setup(t);
  await store.room.send({text:'Old private decision',mode:'codex'});await store.room.run?.done;
  const oldId=store.activeId;await store.delete(oldId);
  assert.notEqual(store.activeId,oldId);assert.equal(store.room.messages.length,0);
  assert.doesNotMatch(store.room.brain.snapshot().soul.content,/Old private decision/);
  assert.ok(!store.entries.some(entry=>entry.id===oldId));
  const loaded=new SessionStore(options);await loaded.load();
  assert.equal(loaded.activeId,store.activeId);assert.equal(loaded.room.messages.length,0);
  for(const room of loaded.rooms.values()){await room.save();await room.brain.queue;}
});

test('communication Soul is global, stable during discussion and separate from shared project concepts',async t=>{
  const prompts=[];
  const {store,options}=await setup(t,async(agent,prompt)=>{prompts.push(prompt);return 'Proposed checkpoint';});
  await store.communication.saveSoul('Respond in English with detailed explanations.',store.communication.snapshot().soul.revision);
  await store.createProject({name:'Memory One',agentIds:['codex']});
  const project=store.projects[0].id,first=store.activeId;
  let memory=store.memoryFor(first);
  await memory.saveSoul('# Memory One\n\nUser decision: use SQLite, not Redis.',memory.snapshot().soul.revision);
  const communication=store.communication.snapshot();
  await store.room.send({text:'Remember the database decision',mode:'codex'});await store.room.run?.done;
  assert.deepEqual(store.communication.snapshot(),communication);
  assert.ok(memory.snapshot().auto.updates.length);
  assert.match(prompts.at(-1),/Respond in English with detailed explanations/);
  assert.match(prompts.at(-1),/use SQLite, not Redis/);
  await store.create({title:'Another account',projectId:project});
  assert.equal(store.memoryFor(store.activeId),memory);
  assert.match(store.snapshot().projectMemory.content,/use SQLite/);
  assert.doesNotMatch(store.snapshot().brain.soul.content,/SQLite|Remember the database/);
  await store.createProject({name:'Memory Two',agentIds:['codex']});
  assert.doesNotMatch(store.snapshot().projectMemory.content,/SQLite/);
  assert.equal(store.snapshot().brain.soul.content,'Respond in English with detailed explanations.');
  await assert.rejects(memory.saveSoul('stale edit',1),/sudah berubah/);
  const loaded=new SessionStore(options);await loaded.load();
  assert.equal(loaded.communication.snapshot().soul.content,communication.soul.content);
  await loaded.switch(first);assert.match(loaded.snapshot().projectMemory.content,/use SQLite/);
  for(const room of loaded.rooms.values()){await room.save();await room.brain.queue;}
});

test('legacy migration keeps pinned project notes without putting concepts into communication Soul',async t=>{
  const {store,options}=await setup(t);
  await store.room.brain.pin({id:'legacy-pin',status:'done',role:'user',text:'Pinned concept: deploy to blue cluster.'});
  // Recreate a missing memory as on a first upgrade; legacy files remain the migration source.
  const legacy=new SessionStore({...options,directory:await mkdtemp(join(tmpdir(),'pitlane-migration-'))});
  const directory=legacy.directory;
  t.after(async()=>{assert.ok(directory.startsWith(join(tmpdir(),'pitlane-migration-')));await rm(directory,{recursive:true,force:true});});
  const original=new (await import('../brain.mjs')).Brain(directory,'# Old Concept\n\n## Gaya diskusi dan memori otomatis\n- Speak briefly.');await original.load();
  await original.pin({id:'p',status:'done',role:'user',text:'Pinned concept: blue cluster.'});
  await legacy.load();
  assert.match(legacy.snapshot().projectMemory.content,/blue cluster/);
  assert.match(legacy.snapshot().brain.soul.content,/Speak briefly/);
  assert.doesNotMatch(legacy.snapshot().brain.soul.content,/Old Concept|blue cluster/);
});

test('profile photo follows the user across sessions and restart without entering memory', async t => {
  const {store,options}=await setup(t);
  const {default:sharp}=await import('sharp');
  const photo='data:image/jpeg;base64,'+(await sharp({create:{width:8,height:8,channels:3,background:'#06b6d4'}}).jpeg().toBuffer()).toString('base64');
  await store.room.brain.saveDisplayName('Photo User',photo);
  const first=store.activeId;
  await store.create({title:'Photo session'});
  assert.equal(store.snapshot().brain.preferences.avatar,photo);
  await store.switch(first);
  const restored=new SessionStore(options);await restored.load();
  assert.equal(restored.snapshot().brain.preferences.avatar,photo);
  assert.doesNotMatch(restored.communication.snapshot().soul.content,/data:image/);
  await assert.rejects(restored.room.brain.saveDisplayName('Photo User','https://untrusted.example/photo'),/Foto profil/);
  await restored.room.brain.saveDisplayName('Photo User','');
  assert.equal(restored.snapshot().brain.preferences.avatar,'');
});
