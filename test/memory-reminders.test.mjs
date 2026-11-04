import test from 'node:test';
import assert from 'node:assert/strict';
import {memoryReminder,quotaWarningKey} from '../src/lib/memory-reminders.mjs';

test('Project Memory reminders use the four Jakarta times independently of host timezone',()=>{
 assert.equal(memoryReminder('2026-11-03T16:29:59Z'),null);
 for(const minute of [30,40,50,55]){
  const due=memoryReminder(`2026-11-03T16:${minute}:00Z`);
  assert.deepEqual(due,{date:'2026-11-03',minute:23*60+minute,time:'23:'+minute});
  assert.equal(memoryReminder(`2026-11-03T16:${minute}:14Z`,due),null);
 }
 assert.equal(memoryReminder('2026-11-03T17:00:00Z'),null);
});

test('returning to the tab catches up once to the latest reminder instead of stacking missed alerts',()=>{
 const previous={date:'2026-11-03',minute:23*60+30};
 const latest=memoryReminder('2026-11-03T16:56:00Z',previous);
 assert.equal(latest.time,'23:55');assert.equal(memoryReminder('2026-11-03T16:59:59Z',latest),null);
 assert.equal(memoryReminder('2026-11-04T16:30:00Z',latest).time,'23:30');
});

test('dismissing quota warnings survives percentage changes but not exhaustion or a new reset cycle',()=>{
 const warning={agent:'codex',group:'Codex',bucket:'5-hour',resetAt:'2026-11-04T01:00:00Z',remainingPercent:5,exhausted:false};
 assert.equal(quotaWarningKey(warning),quotaWarningKey({...warning,remainingPercent:4}));
 assert.notEqual(quotaWarningKey(warning),quotaWarningKey({...warning,remainingPercent:0}));
 assert.notEqual(quotaWarningKey(warning),quotaWarningKey({...warning,resetAt:'2026-11-05T01:00:00Z'}));
 assert.notEqual(quotaWarningKey(warning),quotaWarningKey({...warning,bucket:'Weekly'}));
});
