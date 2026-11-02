import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SessionStore} from '../sessions.mjs';
import {soulWithLanguage} from '../src/lib/language.mjs';
import {parseAttendanceReply} from '../protocol.mjs';

test('global language persists across sessions and restart without rewriting either memory',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'pitlane-language-'));
  const prompts=[];
  const options={directory,seed:'# Project Aurora',agents:{codex:{id:'codex',name:'Codex',installed:true}},runner:async(_,prompt)=>{prompts.push(prompt);return 'Present, Ready to Continue Project Aurora';}};
  const store=new SessionStore(options);await store.load();
  t.after(async()=>{for(const room of store.rooms.values()){await room.stop();await room.save();await room.brain.queue;}await store.communication.queue;await store.queue;await rm(directory,{recursive:true,force:true});});
  assert.equal(store.snapshot().language,'en');
  await store.communication.saveSoul('Ikuti gaya tulisan gw. Jangan bertele-tele.',store.communication.snapshot().soul.revision);
  const raw=store.communication.snapshot().soul;
  const project=store.snapshot().projectMemory;
  await store.room.send({text:'Check in',mode:'attendance'});await store.room.run?.done;
  assert.match(prompts.at(-1),/ONE line in English: Present/);
  assert.equal(store.room.attendance.agents.codex.status,'done');
  await store.communication.saveLanguage('id');
  assert.equal(store.snapshot().language,'id');
  assert.deepEqual(store.communication.snapshot().soul,raw);
  assert.deepEqual(store.snapshot().projectMemory,project);
  assert.match(store.room.getCommunicationSoul().content,/Use Indonesian/);
  const mirror=await readFile(join(directory,'communication','SOUL.md'),'utf8');
  assert.match(mirror,/Ikuti gaya tulisan gw/);assert.match(mirror,/Use Indonesian/);
  await store.create({title:'New Chat'});assert.equal(store.snapshot().language,'id');
  const restored=new SessionStore(options);await restored.load();assert.equal(restored.snapshot().language,'id');
  await assert.rejects(store.communication.saveLanguage('fr'),/English or Indonesian/);
  assert.equal(store.snapshot().language,'id');
  await store.communication.saveLanguage('en');
  await store.room.send({text:'Hello',mode:'codex',syncMemory:false});await store.room.run?.done;
  assert.match(prompts.at(-1),/Use English by default/);assert.match(prompts.at(-1),/Ikuti gaya tulisan gw/);
});

test('downloaded Soul replaces its managed language rule while keeping style and explicit overrides',()=>{
  const english=soulWithLanguage('# Style\nUse short paragraphs.','en');
  const indonesian=soulWithLanguage(english,'id');
  assert.equal((indonesian.match(/## Default response language/g)||[]).length,1);
  assert.match(indonesian,/Use short paragraphs/);assert.match(indonesian,/Use Indonesian/);
  assert.doesNotMatch(indonesian,/Use English by default/);
  assert.match(indonesian,/explicit language request in the latest user message takes priority/);
  assert.equal(parseAttendanceReply('Present, Ready to Continue Project Aurora'),'Present, Ready to Continue Project Aurora');
});
