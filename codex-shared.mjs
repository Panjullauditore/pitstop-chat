import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {terminateTree} from './adapters.mjs';

export function codexSharedArgs(definition){return [...(definition.script?[definition.script]:[]),'app-server','proxy'];}
export const CODEX_SHARED_UNAVAILABLE='Codex App shared connection is unavailable. A CLI login is not a connection to the App chat. The App must expose its shared app-server control socket before Pitstop can attach. No message was sent.';
export function codexConnectionSnapshot(previous,checked,{allowExclusive=false,now=Date.now()}={}){
  // A shared-only health probe cannot invalidate a recently verified exclusive path.
  // Keep its original timestamp so the observation still expires normally.
  return !allowExclusive&&!checked.connected&&previous?.connected&&previous.transport==='stdio'&&now-Date.parse(previous.checkedAt)<30000?previous:checked;
}

// Read-only: verify the selected chat belongs to this live server, without resume,
// new threads, messages, model overrides, or changes to the native App.
export function probeSharedCodex(definition,link,{timeoutMs=5000}={}){
  return probeCodexTransport(definition,link,{timeoutMs,shared:true});
}
export async function probeCodexConnection(definition,link,{allowExclusive=false,...options}={}){
  const shared=await probeSharedCodex(definition,link,options);
  if(shared.connected||!allowExclusive)return shared;
  return probeCodexTransport(definition,link,{timeoutMs:8000,...options,shared:false});
}
function probeCodexTransport(definition,link,{timeoutMs,shared}){
  const checkedAt=new Date().toISOString();
  if(!definition?.installed)return Promise.resolve({connected:false,status:'unavailable',checkedAt,error:CODEX_SHARED_UNAVAILABLE});
  return new Promise(resolve=>{
    const child=spawn(definition.command,shared?codexSharedArgs(definition):[...(definition.script?[definition.script]:[]),'app-server','--stdio'],{cwd:link.cwd,windowsHide:true,stdio:['pipe','pipe','pipe']});
    let settled=false;
    const finish=async(status,error)=>{if(settled)return;settled=true;clearTimeout(timer);child.stdin.end();await terminateTree(child);resolve({connected:['ready','busy'].includes(status),status,checkedAt,error,transport:shared?'shared':'stdio'});};
    const timer=setTimeout(()=>void finish('unavailable',CODEX_SHARED_UNAVAILABLE),timeoutMs);
    const send=value=>{if(!settled)child.stdin.write(JSON.stringify(value)+'\n');};
    child.stdin.on('error',()=>{});child.stderr.resume();
    child.once('error',()=>void finish('unavailable',CODEX_SHARED_UNAVAILABLE));
    child.once('close',()=>void finish('unavailable',CODEX_SHARED_UNAVAILABLE));
    createInterface({input:child.stdout}).on('line',line=>{
      let message;try{message=JSON.parse(line);}catch{return;}if(settled)return;
      if(message.method)return;
      if(message.error)return void finish('unavailable',shared?CODEX_SHARED_UNAVAILABLE:/already has an active writer/i.test(message.error.message)?'The native Codex chat is held by Codex App or another connection. An idle App can still hold the session. Wait for that connection to release it; Pitstop did not take its lock or send a message.':message.error.message||'Could not attach to the existing native chat. No message was sent.');
      if(message.id===1){send({method:'initialized'});send(shared?{id:2,method:'thread/loaded/list'}:{id:3,method:'thread/read',params:{threadId:link.id,includeTurns:false}});}
      if(message.id===2){if(!message.result?.data?.includes(link.id))return void finish('wrong-server','The selected chat is not loaded in this shared Codex server. Open it in an App connected to this same server. No message was sent.');send({id:3,method:'thread/read',params:{threadId:link.id,includeTurns:false}});}
      if(message.id===3){const thread=message.result?.thread;if(thread?.id!==link.id||thread.ephemeral)return void finish('wrong-server','The selected persistent App chat was not verified. No message was sent.');if(!shared){if(thread.status?.type==='active')return void finish('unavailable','The native chat is busy. No message was sent.');if(thread.cwd?.replaceAll('\\','/').toLowerCase()!==link.cwd.replaceAll('\\','/').toLowerCase())return void finish('wrong-server','The native chat workspace changed. Re-link the chat.');send({id:4,method:'thread/resume',params:{threadId:link.id,excludeTurns:true}});return;}void finish(thread.status?.type==='active'?'busy':'ready',thread.status?.type==='active'?'The native Codex chat is busy. Wait for its current turn.':'Shared Codex App chat connected.');}
      if(message.id===4){if(message.result?.thread?.id!==link.id)return void finish('wrong-server','A different chat was resumed. No message was sent.');void finish('ready','The same native chat is available for exclusive access. History is shared; simultaneous App access can block it again.');}
    });
    send({id:1,method:'initialize',params:{clientInfo:{name:'pitstop_shared_check',version:'1.0.0'},capabilities:{experimentalApi:true}}});
  });
}
