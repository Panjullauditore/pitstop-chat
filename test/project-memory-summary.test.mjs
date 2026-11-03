import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Brain} from '../brain.mjs';
import {parseReply,AUTO_MARKER} from '../protocol.mjs';

test('summary protocol validates full documents without silently truncating them',()=>{
  const parse=projectMemory=>parseReply('Reply\n<pitlane>'+JSON.stringify({continue:false,needsUser:false,projectMemory})+'</pitlane>').control;
  assert.deepEqual(parse({baseRevision:3,content:'# Concept'}).projectMemory,{baseRevision:3,content:'# Concept'});
  for(const memory of [{baseRevision:0,content:'x'},{baseRevision:2,content:' '},{baseRevision:2,content:'x'.repeat(18001)},{baseRevision:2,content:'x'+AUTO_MARKER}])assert.equal(parse(memory).projectMemory,undefined);
});

test('consolidation keeps source decisions and backups; activity-only checkpoints do not pretend to update the core',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'pitlane-summary-'));
  t.after(async()=>{assert.ok(directory.startsWith(join(tmpdir(),'pitlane-summary-')));await rm(directory,{recursive:true,force:true});});
  const brain=new Brain(directory,'# Placeholder',{communicationPolicy:false,projectMemory:true});await brain.load();
  const at='2026-11-03T10:00:00Z';
  await brain.recordDecision({id:'d1',question:'How many bays?',text:'Three',at});
  await brain.recordCheckpoint({id:'summary',role:'codex',at},{summary:'Three bays',projectMemory:{baseRevision:2,content:'# Garage\n\nThree bays approved.'}});
  assert.equal(brain.value.soul.content,'# Garage\n\nThree bays approved.');
  assert.equal(brain.value.auto.gmDecisions[0].text,'Three');
  assert.match(await readFile(join(directory,'brain-history.jsonl'),'utf8'),/# Placeholder/);
  await brain.recordCheckpoint({id:'activity',role:'codex',at},{summary:'Test connection only'});
  assert.equal(brain.value.soul.content,'# Garage\n\nThree bays approved.');
  await brain.recordCheckpoint({id:'debate',role:'codex',at},{summary:'Disagreement',needsUser:true,projectMemory:{baseRevision:4,content:'UNAPPROVED'}});
  assert.doesNotMatch(brain.value.soul.content,/UNAPPROVED/);
  const soul=new Brain(join(directory,'communication'),'Communication only',{communicationPolicy:false,automaticMemory:false});await soul.load();
  await soul.recordCheckpoint({id:'wrong-target',role:'codex',at},{summary:'x',projectMemory:{baseRevision:1,content:'WRONG PROJECT'}});
  assert.equal(soul.value.soul.content,'Communication only');
});
