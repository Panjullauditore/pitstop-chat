import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCodexQuota,normalizeAntigravityQuota,createQuotaService,quotaWarnings } from '../quota.mjs';

test('Codex uses provider percentages and reset times, without exposing account or reset-credit identifiers',()=>{
  const quota=normalizeCodexQuota({accountId:'private-account',rateLimitResetCredits:{credits:[{id:'private-reset'}]},rateLimitsByLimitId:{codex:{limitId:'codex',planType:'plus',primary:{usedPercent:45,windowDurationMins:300,resetsAt:1793546079},secondary:{usedPercent:56,windowDurationMins:10080,resetsAt:1793809805}}}});
  assert.equal(quota.groups[0].buckets[0].remainingPercent,55);
  assert.equal(quota.groups[0].buckets[1].remainingPercent,44);
  assert.equal(quota.groups[0].buckets[0].name,'5 jam');assert.equal(quota.groups[0].buckets[1].name,'Mingguan');
  assert.equal(quota.groups[0].buckets[0].resetAt,new Date(1793546079*1000).toISOString());
  assert.ok(!JSON.stringify(quota).includes('private-'));
});
test('Codex legacy response fallback preserves zero remaining and treats absent percentages as unknown',()=>{
  const quota=normalizeCodexQuota({rateLimits:{primary:{usedPercent:100,resetsAt:null},secondary:{usedPercent:null,resetsAt:'invalid'}}});
  assert.equal(quota.groups[0].buckets[0].remainingPercent,0);
  assert.equal(quota.groups[0].buckets[1].remainingPercent,null);assert.equal(quota.groups[0].buckets[1].resetAt,null);
  assert.deepEqual(normalizeCodexQuota({}).groups,[]);
});
test('Antigravity shared model groups preserve fractions; disabled does not falsely display 100% remaining',()=>{
  const quota=normalizeAntigravityQuota({status:'SUCCESS',command:{data:{groups:[{name:'Gemini Models',buckets:[{id:'weekly',window:'weekly',remaining_fraction:.98,reset_time:'2026-11-01T16:39:26Z'}]},{name:'Claude and GPT models',buckets:[{window:'weekly',remaining_fraction:0},{window:'5h',remaining_fraction:1,disabled:true}]}]}}});
  assert.equal(quota.groups[0].buckets[0].remainingPercent,98);
  assert.equal(quota.groups[1].buckets[0].remainingPercent,0);
  assert.equal(quota.groups[1].buckets[1].disabled,true);assert.equal(quota.groups[1].buckets[1].remainingPercent,null);
  assert.throws(()=>normalizeAntigravityQuota({status:'ERROR',error:'Login required'}),/Login/);
  assert.throws(()=>normalizeAntigravityQuota({status:'SUCCESS'}),/belum menyediakan/);
});
test('invalid numeric quota data is not manufactured into a full or empty limit',()=>{
  const quota=normalizeAntigravityQuota({command:{data:{groups:[{buckets:[{remaining_fraction:'0.8'},{remaining_fraction:NaN},{remaining_fraction:1.2}]}]}}});
  assert.equal(quota.groups[0].buckets[0].remainingPercent,null);
  assert.equal(quota.groups[0].buckets[1].remainingPercent,null);
  assert.equal(quota.groups[0].buckets[2].remainingPercent,100);
});
test('on-demand reads are cached briefly, refresh bypasses cache, invalidation handles account changes',async()=>{
  let calls=0,time=0;const service=createQuotaService({now:()=>time,ttlMs:30,readers:{codex:async()=>({groups:[],call:++calls})}});
  assert.equal((await service.get('codex')).call,1);assert.equal((await service.get('codex')).call,1);
  assert.equal((await service.get('codex',{force:true})).call,2);
  time=31;assert.equal((await service.get('codex')).call,3);
  service.invalidate();assert.equal((await service.get('codex')).call,4);
  await assert.rejects(service.get('unknown'),/tidak valid/);
});
test('simultaneous quota reads share a request and account refresh rejects in-flight old data',async()=>{
  let calls=0,release;const gate=new Promise(resolve=>release=resolve);
  const service=createQuotaService({readers:{codex:async()=>{calls++;await gate;return {groups:[]};}}});
  const first=service.get('codex');const second=service.get('codex');
  service.invalidate();release();
  await assert.rejects(first,/berubah/);await assert.rejects(second,/berubah/);assert.equal(calls,1);
});

test('low quota warning triggers at 5% and below, excluding unknown or disabled limits',()=>{
  const quota={agent:'codex',groups:[{name:'Codex',buckets:[{name:'5 jam',remainingPercent:5},{name:'Mingguan',remainingPercent:0},{name:'Disabled',remainingPercent:0,disabled:true},{name:'Unknown',remainingPercent:null},{name:'Enough',remainingPercent:5.01}]}]};
  const warnings=quotaWarnings(quota);
  assert.equal(warnings.length,2);assert.equal(warnings[0].exhausted,false);assert.equal(warnings[1].exhausted,true);
});
test('Antigravity warnings match the selected model instead of an unrelated exhausted group',()=>{
  const quota={agent:'antigravity',groups:[{name:'Gemini Models',buckets:[{name:'Mingguan',remainingPercent:98}]},{name:'Claude and GPT models',buckets:[{name:'Mingguan',remainingPercent:0}]}]};
  assert.deepEqual(quotaWarnings(quota,{model:'gemini-3.8-flash'}),[]);
  assert.equal(quotaWarnings(quota,{cliModel:'claude-sonnet-4-6'}).length,1);
  assert.equal(quotaWarnings(quota,{}).length,1);
});
