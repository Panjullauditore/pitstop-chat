import {randomUUID} from 'node:crypto';
import {parseReply} from './protocol.mjs';

export class ManualWebBridge {
  constructor(){this.pending=new Map();}
  wait(prompt,{signal,sessionId,mode,images=[],onPending}){
    if(signal?.aborted)return Promise.reject(new DOMException('Dihentikan','AbortError'));
    return new Promise((resolve,reject)=>{
      const request={id:randomUUID(),agentId:'deepseek',sessionId,mode,prompt,attachments:images.map(image=>({id:image.id,name:image.name})),createdAt:new Date().toISOString()};
      const finish=(error,text)=>{this.pending.delete(request.id);signal?.removeEventListener('abort',abort);onPending(null);error?reject(error):resolve(text);};
      const abort=()=>finish(new DOMException('Dihentikan','AbortError'));
      this.pending.set(request.id,{request,finish});
      signal?.addEventListener('abort',abort,{once:true});onPending(request);
      if(signal?.aborted)abort();
    });
  }
  submit({requestId,sessionId,text,needsDecision=false}){
    const item=this.pending.get(requestId);
    if(!item || item.request.sessionId!==sessionId)throw new Error('Permintaan DeepSeek sudah berakhir atau berasal dari sesi lain.');
    if(typeof text!=='string'||!text.trim()||text.length>40000)throw new Error('Tempel balasan DeepSeek sepanjang 1–40.000 karakter.');
    if(item.request.mode==='attendance'){item.finish(null,text.trim());return;}
    const parsed=parseReply(text);
    const control=parsed.control || {continue:false,needsUser:false,summary:parsed.text.slice(0,260),next:'',reportedProgress:''};
    if(needsDecision){control.needsUser=true;control.continue=false;control.disagreement=true;}
    item.finish(null,parsed.text+'\n<pitlane>'+JSON.stringify(control)+'</pitlane>');
  }
}
