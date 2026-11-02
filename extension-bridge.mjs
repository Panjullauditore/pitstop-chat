import {EventEmitter} from 'node:events';
import {randomBytes,randomUUID,createHash,timingSafeEqual} from 'node:crypto';
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {DeepSeekStream} from './deepseek-stream.mjs';

const hash=value=>createHash('sha256').update(value).digest();
const equal=(value,expected)=>typeof value==='string'&&expected&&timingSafeEqual(hash(value),Buffer.from(expected,'hex'));
export function extensionIdentity(key){return createHash('sha256').update(Buffer.from(key,'base64')).digest('hex').slice(0,32).replace(/[0-9a-f]/g,char=>String.fromCharCode(97+parseInt(char,16)));}

export class ExtensionBridge extends EventEmitter {
  constructor({directory,extensionId,timeout=180000,now=Date.now,grantFile='browser-bridge.json'}){
    super();Object.assign(this,{directory,extensionId,timeout,now,grantFile});this.grant=null;this.code=null;this.job=null;this.lastSeen=0;this.ready=false;this.lastStatus='';
    this.timer=setInterval(()=>this.changed(),2000);this.timer.unref();
  }
  async load(){await mkdir(this.directory,{recursive:true});try{const grant=JSON.parse(await readFile(join(this.directory,this.grantFile),'utf8'));if(grant.extensionId===this.extensionId&&/^[a-f0-9]{64}$/.test(grant.tokenHash))this.grant=grant;}catch(error){if(error.code!=='ENOENT')throw error;}}
  async save(){await writeFile(join(this.directory,this.grantFile+'.tmp'),JSON.stringify(this.grant||{},null,2));await rename(join(this.directory,this.grantFile+'.tmp'),join(this.directory,this.grantFile));}
  snapshot(){
    const connected=!!this.grant&&this.ready&&this.now()-this.lastSeen<45000;
    const status=!this.grant?'unpaired':!connected?'disconnected':this.job?'busy':'ready';
    const detail=status==='unpaired'?'Pair Pitlane Bridge with this app.':status==='disconnected'?'Open DeepSeek in your paired Chrome profile.':status==='busy'?'DeepSeek is responding in your Chrome profile.':'DeepSeek is ready in your Chrome profile.';
    return {paired:!!this.grant,connected,status,detail,checkedAt:this.lastSeen?new Date(this.lastSeen).toISOString():null};
  }
  changed(){const state=this.snapshot(),value=JSON.stringify([state.status,state.detail]);if(value!==this.lastStatus){this.lastStatus=value;this.emit('change',state);}if(this.job?.claimed&&this.now()-this.lastSeen>=45000)this.job.reject(new Error('The Chrome bridge disconnected during this response.'));return state;}
  issueCode(){const code=randomBytes(24).toString('base64url');this.code={hash:hash(code).toString('hex'),expiresAt:this.now()+300000};return {code,expiresAt:new Date(this.code.expiresAt).toISOString()};}
  async pair(code){
    if(this.job)throw new Error('Stop DeepSeek before pairing a browser.');
    if(!this.code||this.now()>this.code.expiresAt||!equal(code,this.code.hash))throw new Error('Pairing code is invalid or expired. Generate a new code in Pitlane.');
    this.code=null;const token=randomBytes(32).toString('base64url');this.grant={extensionId:this.extensionId,tokenHash:hash(token).toString('hex')};this.ready=false;this.lastSeen=0;await this.save();this.changed();return {token};
  }
  authorize(token){return !!this.grant&&!!equal(token,this.grant.tokenHash);}
  async revoke(){if(this.job)throw new Error('Stop DeepSeek before disconnecting its browser.');this.grant=null;this.code=null;this.ready=false;this.lastSeen=0;await this.save();this.changed();}
  poll({ready=false,activeJobId=null}={}){
    this.lastSeen=this.now();this.ready=ready===true;
    const job=this.job;
    if(job?.claimed&&activeJobId!==job.id){job.reject(new Error('The Chrome bridge restarted or lost the active request.'));return {cancel:activeJobId,browser:this.changed()};}
    if(activeJobId&&activeJobId!==job?.id)return {cancel:activeJobId,browser:this.changed()};
    let request=null;
    if(job&&!job.claimed&&this.ready){job.claimed=true;request={id:job.id,prompt:job.prompt,images:job.images.map(({id,name})=>({id,name}))};}
    return {job:request,browser:this.changed()};
  }
  event({requestId,kind,chunk,status,type,message}={}){
    const job=this.job;if(!job||!job.claimed||requestId!==job.id)throw new Error('This Chrome request has ended or belongs to another session.');
    this.lastSeen=this.now();
    try{
      if(kind==='start'){if(job.started)throw new Error('Duplicate browser response.');job.started=true;if(status!==200||typeof type!=='string'||!type.includes('text/event-stream'))throw new Error('DeepSeek did not start a response stream. Check its tab for login or verification.');}
      else if(kind==='chunk'){if(!job.started||typeof chunk!=='string'||chunk.length>65536)throw new Error('Invalid browser stream chunk.');job.parser.push(chunk);}
      else if(kind==='done'){if(!job.started)throw new Error('No DeepSeek response was received.');job.resolve(job.parser.finish());}
      else if(kind==='error')throw new Error(typeof message==='string'?message.slice(0,300):'DeepSeek browser request failed.');
      else throw new Error('Unknown browser event.');
    }catch(error){job.reject(error);throw error;}
  }
  image(requestId,id){const job=this.job;if(!job||!job.claimed||job.id!==requestId)throw new Error('This image request has expired.');const image=job.images.find(image=>image.id===id);if(!image)throw new Error('Image does not belong to this request.');return image;}
  async run(prompt,{signal,onDelta=()=>{},images=[]}={}){
    if(signal?.aborted)throw new DOMException('Stopped','AbortError');
    if(this.job)throw new Error('Chrome is already handling a DeepSeek request.');
    if(!this.snapshot().connected)throw new Error(this.snapshot().detail);
    let timer,abort,job;
    const answer=new Promise((resolve,reject)=>{job={id:randomUUID(),prompt,images,resolve,reject,parser:new DeepSeekStream(onDelta),claimed:false,started:false};});
    this.job=job;abort=()=>job.reject(new DOMException('Stopped','AbortError'));signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    timer=setTimeout(()=>job.reject(new Error('DeepSeek browser timed out. Check login, verification, or changed page controls.')),this.timeout);this.changed();
    try{return await answer;}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(this.job===job)this.job=null;this.changed();}
  }
  close(){clearInterval(this.timer);this.job?.reject(new DOMException('Stopped','AbortError'));}
}
