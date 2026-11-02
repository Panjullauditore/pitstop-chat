import { accountIdentity } from './accounts.mjs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { detectAgents, terminateTree } from './adapters.mjs';

const clamp=value=>Math.max(0,Math.min(100,value));
export function quotaWarnings(quota,selection={}){
  let groups=quota.groups || [];
  const model=selection.cliModel || selection.model || '';
  if(quota.agent==='antigravity'){
    if(/^gemini/i.test(model))groups=groups.filter(group=>/gemini/i.test(group.name));
    else if(/^(claude|gpt)/i.test(model))groups=groups.filter(group=>/claude|gpt/i.test(group.name));
  }
  return groups.flatMap(group=>(group.buckets || []).filter(bucket=>!bucket.disabled && typeof bucket.remainingPercent==='number' && Number.isFinite(bucket.remainingPercent) && bucket.remainingPercent<=5).map(bucket=>({agent:quota.agent,group:group.name,bucket:bucket.name,remainingPercent:bucket.remainingPercent,resetAt:bucket.resetAt,exhausted:bucket.remainingPercent<=0})));
}
function resetIso(value){
  if(value===null || value===undefined || value==='')return null;
  const date=new Date(typeof value==='number' ? value*1000 : value);
  return Number.isNaN(date.getTime())?null:date.toISOString();
}
function durationLabel(minutes,fallback){
  if(minutes===10080)return 'Mingguan';
  if(minutes===300)return '5 jam';
  if(Number.isFinite(minutes) && minutes>0)return minutes%60===0 ? (minutes/60)+' jam' : minutes+' menit';
  return fallback;
}
export function normalizeCodexQuota(data){
  const entries=Object.values(data.rateLimitsByLimitId || {});
  const limits=entries.length?entries:data.rateLimits?[data.rateLimits]:[];
  return {agent:'codex',source:'Codex App Server',groups:limits.map(limit=>({
    name:String(limit.limitName || limit.limitId || 'Codex').slice(0,100),plan:typeof limit.planType==='string'?limit.planType.slice(0,50):null,
    buckets:['primary','secondary'].filter(key=>limit[key]).map(key=>{
      const bucket=limit[key], used=typeof bucket.usedPercent==='number' && Number.isFinite(bucket.usedPercent)?clamp(bucket.usedPercent):null;
      return {id:key,name:durationLabel(bucket.windowDurationMins,key==='primary'?'Batas utama':'Batas tambahan'),remainingPercent:used===null?null:100-used,usedPercent:used,resetAt:resetIso(bucket.resetsAt),disabled:false};
    })
  })).filter(group=>group.buckets.length),checkedAt:new Date().toISOString()};
}
export function normalizeAntigravityQuota(data){
  if(data.status && data.status!=='SUCCESS')throw new Error(data.error || 'Kuota Antigravity belum tersedia.');
  const groups=data.command?.data?.groups;
  if(!Array.isArray(groups))throw new Error('CLI belum menyediakan data kuota yang bisa dibaca.');
  return {accountEmail:accountIdentity(data).email,agent:'antigravity',source:'Antigravity /usage',groups:groups.map(group=>({name:String(group.name || 'Antigravity').slice(0,100),
    buckets:(Array.isArray(group.buckets)?group.buckets:[]).map(bucket=>{
      const remaining=typeof bucket.remaining_fraction==='number' && Number.isFinite(bucket.remaining_fraction)?clamp(bucket.remaining_fraction*100):null;
      const disabled=Boolean(bucket.disabled);
      return {id:String(bucket.id || bucket.window || ''),name:bucket.window==='weekly'?'Mingguan':bucket.window==='5h'?'5 jam':String(bucket.name || 'Kuota').slice(0,80),
        remainingPercent:disabled?null:remaining,usedPercent:disabled || remaining===null?null:100-remaining,resetAt:resetIso(bucket.reset_time),disabled};
    })
  })).filter(group=>group.buckets.length),checkedAt:new Date().toISOString()};
}

export async function readAntigravityQuota(definition=detectAgents().antigravity){
  if(!definition.installed)throw new Error('Antigravity CLI belum ditemukan.');
  return new Promise((resolve,reject)=>{
    const child=spawn(definition.command,['--output-format','json','-p','/usage'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
    let done=false,output='',stderr='';
    const timer=setTimeout(()=>{void terminateTree(child);finish(new Error('Pembacaan kuota Antigravity melewati batas waktu.'));},20000);
    function finish(error,data){if(done)return;done=true;clearTimeout(timer);if(error)reject(error);else resolve(data);}
    child.once('error',error=>finish(error));child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
    child.stdout.on('data',chunk=>{output+=chunk;if(output.length>1_000_000){void terminateTree(child);finish(new Error('Respons kuota terlalu besar.'));}});
    child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-1200);});
    child.once('close',code=>{
      if(done)return;
      if(code!==0)return finish(new Error(stderr.trim() || 'Kuota Antigravity gagal dibaca.'));
      try{const data=JSON.parse(output);finish(null,normalizeAntigravityQuota(data));}catch(error){finish(new Error(error instanceof SyntaxError?'Format kuota CLI belum dikenali.':error.message));}
    });
  });
}

export function createQuotaService({readers,now=Date.now,ttlMs=30000}={}){
  const read=readers || {codex:async()=>normalizeCodexQuota(await readCodexQuota()),antigravity:readAntigravityQuota};
  const cache=new Map(),pending=new Map(),versions=new Map();let generation=0;
  return {
    invalidate(agent){if(agent){versions.set(agent,(versions.get(agent)||0)+1);cache.delete(agent);pending.delete(agent);}else{generation++;cache.clear();pending.clear();}},
    async get(agent,{force=false}={}){
      if(!['codex','antigravity'].includes(agent))throw new Error('Agent kuota tidak valid.');
      if(pending.has(agent))return pending.get(agent);
      const saved=cache.get(agent);
      if(!force && saved && now()-saved.time<ttlMs)return structuredClone(saved.data);
      const epoch=generation,version=versions.get(agent)||0;
      const operation=(async()=>{
        const data=await read[agent]();
        if(generation!==epoch || (versions.get(agent)||0)!==version)throw new Error('Daftar akun/model berubah saat kuota dibaca. Klik Refresh untuk status terbaru.');
        cache.set(agent,{time:now(),data});
        return structuredClone(data);
      })().finally(()=>{if(pending.get(agent)===operation)pending.delete(agent);});
      pending.set(agent,operation);return operation;
    }
  };
}

export async function readCodexQuota(definition=detectAgents().codex){
  if(!definition.installed)throw new Error('Codex CLI belum ditemukan.');
  return new Promise((resolve,reject)=>{
    const child=spawn(definition.command,[definition.script,'app-server','--stdio'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    let done=false;
    const timer=setTimeout(()=>void finish(new Error('Pembacaan kuota Codex melewati batas waktu.')),20000);
    async function finish(error,data){if(done)return;done=true;clearTimeout(timer);child.stdin.end();await terminateTree(child);if(error)reject(error);else resolve(data);}
    const send=message=>child.stdin.write(JSON.stringify(message)+'\n');
    child.stdin.on('error',()=>{});child.stderr.resume();
    child.once('error',error=>void finish(error));
    child.once('close',()=>{if(!done)void finish(new Error('Codex berhenti sebelum kuota diterima.'));});
    createInterface({input:child.stdout}).on('line',line=>{
      if(done)return;let message;try{message=JSON.parse(line);}catch{return;}
      if(message.error)return void finish(new Error(message.error.message || 'Status kuota belum tersedia.'));
      if(message.id===1){send({method:'initialized'});send({id:2,method:'account/rateLimits/read'});}
      if(message.id===2)void finish(null,message.result);
    });
    send({id:1,method:'initialize',params:{clientInfo:{name:'pitlane_quota',version:'1.0.0'},capabilities:{experimentalApi:true}}});
  });
}
