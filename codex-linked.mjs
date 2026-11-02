import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {terminateTree} from './adapters.mjs';

// One connection owns one turn. It never creates/forks a thread or rewrites its
// native configuration; missing/busy chats fail instead of starting a new chat.
export function runLinkedCodex(definition,link,prompt,{signal,onDelta=()=>{},images=[],timeoutMs=240000,onChild=()=>{}}={}){
  if(!definition?.installed)return Promise.reject(new Error('Codex CLI is unavailable. Reconnect Codex before using Linked App Chat.'));
  if(signal?.aborted)return Promise.reject(new DOMException('Stopped','AbortError'));
  return new Promise((resolve,reject)=>{
    const child=spawn(definition.command,[...(definition.script?[definition.script]:[]),'app-server','--stdio'],{cwd:link.cwd,windowsHide:true,stdio:['pipe','pipe','pipe']});onChild(child);
    let settled=false,turnId=null,final='',partial='',model='',seq=10;
    const pending=new Map(),items=new Map();
    const send=value=>{if(!child.stdin.destroyed)child.stdin.write(JSON.stringify(value)+'\n');};
    const request=(method,params)=>new Promise((yes,no)=>{if(settled){no(new Error('Connection closed.'));return;}const id=seq++;pending.set(id,{yes,no});send({id,method,params});});
    const stop=()=>void finish(new DOMException('Stopped','AbortError'));
    const timer=setTimeout(()=>{void finish(new Error('Linked Codex turn timed out. Inspect the native chat before retrying.'));},timeoutMs);
    async function finish(error,value){if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',stop);for(const entry of pending.values())entry.no(error||new Error('Connection closed.'));pending.clear();if(error&&turnId){send({id:seq++,method:'turn/interrupt',params:{threadId:link.id,turnId}});await new Promise(done=>setTimeout(done,150));}child.stdin.end();await terminateTree(child);error?reject(error):resolve(value);}
    signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted)stop();
    child.stdin.on('error',()=>{});child.stderr.resume();child.once('error',error=>void finish(error));child.once('close',()=>{if(!settled)void finish(new Error('Codex disconnected before its linked turn completed.'));});
    createInterface({input:child.stdout}).on('line',line=>{
      let message;try{message=JSON.parse(line);}catch{return;}if(settled)return;
      if(message.id!==undefined&&pending.has(message.id)){const entry=pending.get(message.id);pending.delete(message.id);message.error?entry.no(new Error(message.error.message||'Codex request failed.')):entry.yes(message.result);return;}
      // No blind approval of native commands, file edits, elicitation, or auth.
      if(message.id!==undefined&&message.method){send({id:message.id,error:{code:-32000,message:'This action requires approval in the native app. Pitlane did not approve it.'}});void finish(new Error('Codex requested a tool approval or interactive input. Continue in its native chat; Pitlane did not approve the action.'));return;}
      const p=message.params||{};if(p.threadId&&p.threadId!==link.id)return;if(p.turnId&&turnId&&p.turnId!==turnId)return;
      if(message.method==='turn/started'){turnId=p.turn?.id||turnId;}
      if(message.method==='item/agentMessage/delta'){partial+=p.delta||'';onDelta(partial);}
      if(message.method==='item/completed'&&p.item?.type==='agentMessage'){items.set(p.item.id,p.item);if(p.item.phase==='final_answer'||!p.item.phase){final=p.item.text||final;onDelta(final);}}
      if(message.method==='turn/completed'){
        if(p.turn?.id&&turnId&&p.turn.id!==turnId)return;
        if(p.turn?.status!=='completed')return void finish(new Error(p.turn?.error?.message||'The linked Codex turn did not finish.'));
        const text=final||[...items.values()].filter(item=>item.phase!=='commentary').map(item=>item.text||'').join('\n');
        if(!text.trim())return void finish(new Error('Linked Codex finished without a final answer.'));
        void finish(null,{text,model,nativeChat:{provider:'codex',id:link.id,title:link.title,history:'saved'}});
      }
    });
    (async()=>{
      await request('initialize',{clientInfo:{name:'pitlane_linked_chat',version:'1.0.0'},capabilities:{experimentalApi:true}});send({method:'initialized'});
      const read=await request('thread/read',{threadId:link.id,includeTurns:false});
      if(read.thread?.id!==link.id)throw new Error('The selected native Codex chat was not found. Re-link it before sending.');
      if(read.thread?.ephemeral)throw new Error('Ephemeral chats cannot be linked.');
      if(read.thread?.status?.type==='active')throw new Error('This native Codex chat is busy. Wait for it to finish.');
      if(read.thread?.cwd&&read.thread.cwd.replaceAll('\\','/').toLowerCase()!==link.cwd.replaceAll('\\','/').toLowerCase())throw new Error('The native chat project folder changed. Re-link it before sending.');
      const resumed=await request('thread/resume',{threadId:link.id,excludeTurns:true});
      if(resumed.thread?.id!==link.id)throw new Error('Codex resumed a different chat. Nothing was sent.');
      model=resumed.model||resumed.thread.model||read.thread?.model||'';
      const result=await request('turn/start',{threadId:link.id,input:[{type:'text',text:prompt},...images.map(image=>({type:'localImage',path:image.path}))]});
      turnId=result.turn?.id||turnId;
    })().catch(error=>{
      if(/already has an active writer/i.test(error.message))error=new Error('This chat is still owned by another Codex App or CLI connection. Pitlane cannot send through its separate connection while that owner holds the chat. No message was sent. Use the native app for now; simultaneous monitoring requires a shared app-server connection.');
      void finish(error);
    });
  });
}
