import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { detectAgents, terminateTree } from './adapters.mjs';

export function normalizeCodexModels(data) {
  return (data.data || []).map(model => ({ id:model.model || model.id, name:model.displayName || model.model || model.id,
    efforts:(model.supportedReasoningEfforts || []).map(e => typeof e === 'string' ? e : e.reasoningEffort).filter(Boolean),
    defaultEffort:model.defaultReasoningEffort || '', isDefault:Boolean(model.isDefault) }));
}

export function normalizeAntigravityModels(data) {
  if(data.status && data.status!=='SUCCESS')throw new Error(data.error || 'Daftar model Antigravity gagal.');
  const rows=data.command?.data?.models || data.models || [];
  if(!Array.isArray(rows))throw new Error('Daftar model Antigravity tidak valid.');
  const output=[]; const families=new Map();
  for(const item of rows){
    const match=String(item.id).match(/^(.*)-(low|medium|high|xhigh|max)$/);
    if(match){
      let family=families.get(match[1]);
      if(!family){family={id:match[1],name:(item.label || item.id).replace(/\s*\((?:Low|Medium|High|Xhigh|Max)\)$/i,''),efforts:[],variants:{},defaultEffort:match[2]};families.set(match[1],family);output.push(family);}
      family.efforts.push(match[2]); family.variants[match[2]]=item.id;
    }else output.push({id:item.id,name:item.label || item.id,efforts:[],defaultEffort:''});
  }
  for(const m of output)m.efforts.sort((a,b)=>['low','medium','high','xhigh','max'].indexOf(a)-['low','medium','high','xhigh','max'].indexOf(b));
  return output;
}

export function validateSelections(input,catalog) {
  const output={};
  for(const agent of ['codex','antigravity',...(input?.claude ? ['claude'] : [])]){
    const value=input?.[agent];
    if(!value || typeof value.model!=='string' || typeof value.effort!=='string')throw new Error('Pilihan model tidak valid.');
    if(value.model && !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,119}$/.test(value.model))throw new Error('Model ID tidak valid.');
    if(!['','minimal','low','medium','high','xhigh','max','ultra'].includes(value.effort))throw new Error('Reasoning effort tidak dikenal.');
    const model=catalog[agent]?.models?.find(m=>m.id===value.model);
    if(value.model && !model && !value.custom)throw new Error('Model tidak ada di daftar terbaru. Refresh atau gunakan model ID manual.');
    if(!value.model && value.effort)throw new Error('Pilih model dulu sebelum menentukan effort.');
    if(model && value.effort && !model.efforts.includes(value.effort))throw new Error('Effort tidak didukung oleh '+model.name+'.');
    if(agent==='antigravity' && value.effort==='ultra')throw new Error('Antigravity CLI tidak menawarkan effort ultra.');
    const effort=model?.variants ? value.effort || model.defaultEffort : value.effort;
    output[agent]={model:value.model,effort,custom:Boolean(value.custom && !model),name:model?.name || value.model || 'Default CLI',
      cliModel:model?.variants ? model.variants[effort] : value.model,
      cliEffort:model?.variants ? '' : effort};
  }
  return output;
}

export async function codexModels(definition = detectAgents().codex) {
  if (!definition.installed) throw new Error('Codex CLI belum tersedia.');
  return new Promise((resolve,reject) => {
    const child=spawn(definition.command,[definition.script,'app-server','--stdio'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    let finished=false, rows=[];
    const timer=setTimeout(()=>finish(new Error('Daftar model Codex belum merespons. Coba refresh lagi.')),25000);
    async function finish(error,data) {
      if(finished)return; finished=true; clearTimeout(timer); child.stdin.end(); await terminateTree(child);
      if(error)reject(error);else resolve(data);
    }
    const send=message=>child.stdin.write(JSON.stringify(message)+'\n');
    child.stdin.on('error',()=>{}); child.stderr.resume();
    child.once('error',error=>void finish(error));
    child.once('close',()=>{if(!finished)void finish(new Error('Codex App Server berhenti sebelum daftar model diterima.'));});
    createInterface({input:child.stdout}).on('line',line=>{
      let message;try{message=JSON.parse(line);}catch{return;}
      if(message.error)return void finish(new Error(message.error.message || 'Daftar model Codex gagal.'));
      if(message.id===1){send({method:'initialized'});send({id:2,method:'model/list',params:{limit:100,includeHidden:false}});}
      if(message.id===2){
        rows.push(...normalizeCodexModels(message.result || {}));
        if(message.result?.nextCursor)send({id:2,method:'model/list',params:{limit:100,includeHidden:false,cursor:message.result.nextCursor}});
        else void finish(null,rows);
      }
    });
    send({id:1,method:'initialize',params:{clientInfo:{name:'pitlane_room',title:'Pitlane AI Room',version:'1.1.0'},capabilities:{experimentalApi:true}}});
  });
}

export async function antigravityModels(definition = detectAgents().antigravity) {
  if(!definition.installed)throw new Error('Antigravity CLI belum tersedia.');
  return new Promise((resolve,reject)=>{
    const child=spawn(definition.command,['--output-format','json','models'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
    let output='',stderr='',done=false;
    const timer=setTimeout(()=>{void terminateTree(child);finish(new Error('Daftar model Antigravity belum merespons. Coba refresh lagi.'));},25000);
    function finish(error,data){if(done)return;done=true;clearTimeout(timer);if(error)reject(error);else resolve(data);}
    child.once('error',error=>finish(error));
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data',chunk=>{output+=chunk;if(output.length>2_000_000){void terminateTree(child);finish(new Error('Daftar model terlalu besar.'));}});
    child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-1000);});
    child.once('close',code=>{
      if(done)return;
      if(code!==0)return finish(new Error(stderr.trim() || 'Daftar model Antigravity gagal.'));
      try{finish(null,normalizeAntigravityModels(JSON.parse(output)));}catch{finish(new Error('Format daftar model Antigravity belum dikenali: '+output.slice(0,250)));}
    });
  });
}
