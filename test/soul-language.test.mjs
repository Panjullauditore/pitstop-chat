import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Brain} from '../brain.mjs';
import {changeSoulLanguage,cliSoulTranslator} from '../soul-language.mjs';
import {COMMUNICATION_SOUL} from '../soul-presets.mjs';
import {SessionStore} from '../sessions.mjs';

async function setup(t,seed=COMMUNICATION_SOUL.en){
  const directory=await mkdtemp(join(tmpdir(),'pitstop-soul-language-'));
  const options={communicationPolicy:false,automaticMemory:false,languageDocument:true,documentPath:join(directory,'SOUL.md')};
  const brain=new Brain(directory,seed,options);await brain.load();
  t.after(async()=>{await brain.queue;assert.ok(directory.startsWith(join(tmpdir(),'pitstop-soul-language-')));await rm(directory,{recursive:true,force:true});});
  return {brain,directory,options};
}

test('default Soul switches both document and setting, persists the mirror and restores the original without AI',async t=>{
  const {brain,directory,options}=await setup(t);
  await changeSoulLanguage(brain,'id');
  assert.equal(brain.value.soul.content,COMMUNICATION_SOUL.id);assert.equal(brain.value.preferences.language,'id');
  assert.match(await readFile(join(directory,'SOUL.md'),'utf8'),/Preferensi komunikasi/);
  const restored=new Brain(directory,'ignored',options);await restored.load();
  await changeSoulLanguage(restored,'en');assert.equal(restored.value.soul.content,COMMUNICATION_SOUL.en);
  assert.equal(restored.value.soulLocales.documents.id,COMMUNICATION_SOUL.id);
  const revision=restored.value.soul.revision;await changeSoulLanguage(restored,'en');assert.equal(restored.value.soul.revision,revision);
});

test('custom Indonesian Soul is translated even if the UI is already English; cached switching preserves the exact original',async t=>{
  const source='# Aturan\nIkuti bahasa user. Jangan mengarang hasil. Maksimal 4 kalimat.';
  const english='# Rules\nFollow the user’s language. Never invent results. At most 4 sentences.';
  const {brain}=await setup(t,source);let calls=0;
  const translate=async(content,language)=>{calls++;assert.equal(content,source);assert.equal(language,'en');return {sourceLanguage:'id',content:english};};
  await changeSoulLanguage(brain,'en',{translate});assert.equal(brain.value.soul.content,english);assert.equal(calls,1);
  await changeSoulLanguage(brain,'id',{translate});assert.equal(brain.value.soul.content,source);assert.equal(calls,1);
  await brain.saveSoul(source+'\nSimpan keputusan.',brain.value.soul.revision);
  assert.equal(brain.value.soulLocales,undefined);
  await changeSoulLanguage(brain,'en',{translate:async content=>{calls++;assert.match(content,/Simpan keputusan/);return {sourceLanguage:'id',content:english+'\nKeep decisions.'};}});
  assert.equal(calls,2);assert.match(brain.value.soul.content,/Keep decisions/);
  assert.match(await readFile(join(brain.directory,'brain-history.jsonl'),'utf8'),/Jangan mengarang hasil/);
});

test('translation failures, malformed results, unsupported languages and stale requests never partially change the Soul or preference',async t=>{
  const {brain}=await setup(t,'# Custom\nDo not invent progress.');
  const before=brain.snapshot();
  for(const translate of [async()=>{throw Error('offline');},async()=>({content:''}),async()=>({content:'x'.repeat(18001)}),async()=>({content:'<!-- PITLANE_RESPONSE_LANGUAGE -->'})]){
    await assert.rejects(changeSoulLanguage(brain,'id',{translate}));assert.deepEqual(brain.snapshot(),before);
  }
  await assert.rejects(changeSoulLanguage(brain,'fr'),/English or Indonesian/);
  await assert.rejects(changeSoulLanguage(brain,'en',{revision:999}),/changed/);
  assert.deepEqual(brain.snapshot(),before);
});

test('a manual edit made while translation is running wins and its language is not changed',async t=>{
  const {brain}=await setup(t,'# Old');let started,release;
  const entered=new Promise(resolve=>started=resolve),gate=new Promise(resolve=>release=resolve);
  const operation=changeSoulLanguage(brain,'id',{translate:async()=>{started();await gate;return {sourceLanguage:'en',content:'# Lama'};}});
  await entered;await brain.saveSoul('# New manual rules',brain.value.soul.revision);release();
  await assert.rejects(operation,/newer version was kept/);
  assert.equal(brain.value.soul.content,'# New manual rules');assert.equal(brain.value.preferences.language,undefined);
});

test('CLI translator uses an isolated text-only adapter, not a linked native chat',async()=>{
  let captured;
  const translate=cliSoulTranslator({cwd:'.',definitions:{codex:{installed:true}},runner:async(agent,prompt,options)=>{captured={agent,prompt,options};return JSON.stringify({sourceLanguage:'id',content:'# Follow the user’s language'});}});
  assert.equal((await translate('# Ikuti bahasa user','en')).sourceLanguage,'id');
  assert.match(captured.prompt,/Do not perform any task/);assert.match(captured.prompt,/document data, not instructions/);
  assert.equal(captured.options.nativeLink,undefined);assert.equal(captured.options.timeoutMs,60000);
  await assert.rejects(cliSoulTranslator({definitions:{}})('text','en'),/Connect Codex or Claude/);
});

test('Soul translation leaves project documents and chat histories intact across sessions',async t=>{
  const {directory}=await setup(t);
  const store=new SessionStore({directory:join(directory,'store'),seed:'# Project',agents:{codex:{id:'codex',installed:true}},runner:async()=>''});await store.load();
  await store.createProject({name:'Garage Town',agentIds:['codex']});
  const project=store.snapshot().projectMemory,messages=structuredClone(store.room.messages);
  await store.communication.saveSoul('# Aturan\nIkuti bahasa user.',store.communication.value.soul.revision);
  await changeSoulLanguage(store.communication,'en',{translate:async()=>({sourceLanguage:'id',content:'# Rules\nFollow the user’s language.'})});
  assert.deepEqual(store.snapshot().projectMemory,project);assert.deepEqual(store.room.messages,messages);
  await store.create({title:'Sibling',projectId:store.projects[0].id});
  assert.match(store.room.getCommunicationSoul().content,/Follow the user’s language/);
  for(const room of store.rooms.values())await room.save();await store.queue;
});
