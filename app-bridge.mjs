import {randomUUID} from 'node:crypto';
import {ExtensionBridge} from './extension-bridge.mjs';
import {nativeAntigravityFile,validChatId} from './linked-apps.mjs';

export function appRemoteUrl(value,chatId){
  let url;try{url=new URL(value);}catch{throw new Error('Paste the Antigravity Remote Control chat URL.');}
  if(!validChatId(chatId)||url.origin!=='https://antigravity.google.com'||!/^\/r\/[a-f0-9-]{36}-v2\/?$/.test(url.pathname)||url.username||url.password||url.hash)throw new Error('Choose an official Antigravity App Remote Control URL.');
  const page=url.searchParams.get('p');
  if(page&&page.split('?')[0]!=='c/'+chatId)throw new Error('This Remote Control link opens a different conversation. Select the linked App chat first.');
  url.search='';url.searchParams.set('p','c/'+chatId);return url.href;
}
const baseUrl=value=>{const url=new URL(value);return url.origin+url.pathname.replace(/\/$/,'');};
export class NativeAppBridge extends ExtensionBridge{
  constructor(options){super({...options,heartbeatTimeout:45000,grantFile:'antigravity-app-bridge.json',timeout:options.timeout||600000});this.targets=[];this.verify=options.verify||nativeAntigravityFile;}
  snapshot(){const state=super.snapshot();return {...state,detail:state.status==='unpaired'?'Pair Pitlane Bridge in the Chrome profile signed in to Antigravity App.':state.status==='disconnected'?'Keep Antigravity Remote Control open in the paired Chrome profile. '+(this.diagnostic||''):state.status==='busy'?'Antigravity App is handling the Pitlane task.':'Antigravity App Remote Control is ready.',targets:this.targets||[]};}
  poll({ready=false,targets=[],activeJobId=null,diagnostic=''}={}){
    this.diagnostic=typeof diagnostic==='string'?diagnostic.slice(0,300):'';
    this.targets=Array.isArray(targets)?targets.filter(value=>typeof value==='string'&&/^https:\/\/antigravity\.google\.com\/r\/[a-f0-9-]{36}-v2\/?$/.test(value)).slice(0,20):[];
    this.lastSeen=this.now();this.ready=ready===true&&this.targets.length>0;
    const job=this.job;
    if(job?.claimed){
      if(this.ready&&this.targets.includes(baseUrl(job.remoteUrl)))job.lastReady=this.now();
      else if(this.now()-job.lastReady>15000){job.reject(new Error('Antigravity Remote Control disconnected during this task. Inspect the original App chat before retrying; the task was not resent.'));return {cancel:activeJobId,browser:this.changed()};}
    }
    if(job?.claimed&&activeJobId!==job.id){job.reject(new Error('The Antigravity bridge lost its active request. Inspect the App chat before retrying.'));return {cancel:activeJobId,browser:this.changed()};}
    if(activeJobId&&activeJobId!==job?.id)return {cancel:activeJobId,browser:this.changed()};
    let request=null;
    if(job&&!job.claimed&&this.ready&&this.targets.includes(baseUrl(job.remoteUrl))){job.claimed=true;request={id:job.id,prompt:job.prompt,chatId:job.chatId,remoteUrl:job.remoteUrl,images:job.images.map(({id,name})=>({id,name}))};}
    return {job:request,browser:this.changed()};
  }
  event({requestId,kind,chatId,text,message}={}){
    const job=this.job;if(!job||!job.claimed||job.id!==requestId)throw new Error('This Antigravity request has expired.');
    this.lastSeen=this.now();
    try{
      if(kind==='error')throw new Error(typeof message==='string'?message.slice(0,600):'Antigravity App request failed.');
      if(chatId!==job.chatId)throw new Error('Antigravity navigated to another conversation. Nothing was accepted.');
      if(kind==='sent'){if(job.started)throw new Error('Duplicate App submission.');job.started=true;return;}
      if(!job.started)throw new Error('No matching Pitlane message was confirmed in the native App history.');
      if(!['text','done'].includes(kind)||typeof text!=='string'||text.length>500000)throw new Error('Invalid Antigravity App response.');
      job.text=text;job.onDelta(text);
      if(kind==='done'){if(!text.trim())throw new Error('Antigravity finished without an answer.');job.resolve(text);}
    }catch(error){job.reject(error);throw error;}
  }
  async run(link,prompt,{signal,onDelta=()=>{},images=[]}={}){
    if(signal?.aborted)throw new DOMException('Stopped','AbortError');
    const remoteUrl=appRemoteUrl(link.remoteUrl,link.id);
    if(this.job)throw new Error('Antigravity App is already handling a Pitlane task.');
    if(!this.snapshot().connected||!this.targets.includes(baseUrl(remoteUrl)))throw new Error(this.snapshot().detail+' Open the selected device first.');
    const before=await this.verify(link);if(signal?.aborted)throw new DOMException('Stopped','AbortError');if(this.job)throw new Error('Antigravity App is already handling a Pitlane task.');
    // Lexical's insertText strips raw line breaks in this App version. A JSON
    // envelope preserves every context boundary without touching editor internals.
    let job,abort,timer;const answer=new Promise((resolve,reject)=>{const id=randomUUID();job={id,chatId:link.id,remoteUrl,prompt:JSON.stringify({source:'Pitlane',requestMarker:'[Pitlane request: '+id+']',contextAndTask:prompt}),images,onDelta,resolve,reject,started:false,claimed:false,lastReady:this.now()};});
    this.job=job;abort=()=>job.reject(new DOMException('Stopped','AbortError'));signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    timer=setTimeout(()=>job.reject(new Error('Antigravity App timed out. Check the native chat for a tool approval, question, or connection error before retrying.')),this.timeout);this.changed();
    try{
      const text=await answer;
      const after=await this.verify(link,{input:'[Pitlane request: '+job.id+']',reply:text,afterIndex:before.lastIndex});
      if(after.stepCount<=before.stepCount||!after.hasInput)throw new Error('The reply appeared in Remote Control but its request was not verified in the original App history. Inspect the App before retrying.');
      return {text,model:'',nativeChat:{provider:'antigravity',id:link.id,title:link.title,history:'saved'}};
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(this.job===job)this.job=null;this.changed();}
  }
}
