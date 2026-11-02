import {EventEmitter} from 'node:events';
import {join} from 'node:path';
import {mkdir,readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {DeepSeekStream} from './deepseek-stream.mjs';

const HOME='https://chat.deepseek.com/';
const abortError=()=>new DOMException('Stopped','AbortError');

export class DeepSeekBrowserBridge extends EventEmitter {
  constructor({directory,launch,timeout=180000}={}){
    super();this.directory=directory;this.launch=launch;this.timeout=timeout;this.context=null;this.page=null;this.opening=null;this.job=null;this.timer=null;
    this.state={status:'closed',connected:false,detail:'Open the DeepSeek browser and sign in.',checkedAt:null};
  }
  snapshot(){return {...this.state};}
  update(status,detail){const changed=this.state.status!==status||this.state.detail!==detail;this.state={status,connected:['ready','busy'].includes(status),detail,checkedAt:new Date().toISOString()};if(changed)this.emit('change',this.snapshot());return this.snapshot();}
  async open(){
    if(this.opening)return this.opening;
    this.opening=(async()=>{try{await this.ensureOpen();await this.page.bringToFront();return await this.check();}catch(error){this.update('error',error.message);throw error;}})().finally(()=>{this.opening=null;});
    return this.opening;
  }
  async ensureOpen(){
    if(this.context&&this.page&&!this.page.isClosed())return this.context;
    const profile=join(this.directory,'deepseek-browser-profile');await mkdir(profile,{recursive:true});
    const {chromium}=await import('playwright-core');
    const launch=this.launch||chromium.launchPersistentContext.bind(chromium);
    let context;
    try{context=await launch(profile,{channel:process.env.PITLANE_BROWSER_CHANNEL||'chrome',headless:false,viewport:{width:1100,height:850},acceptDownloads:false,chromiumSandbox:true});}
    catch{throw new Error('Could not open the dedicated DeepSeek browser. Close its previous window, or install Chrome.');}
    this.context=context;
    const binding='pitlane_'+randomUUID().replaceAll('-','');
    await context.exposeBinding(binding,({page},event)=>this.receive(page,event));
    await context.addInitScript(({binding,home})=>{
      const original=window.fetch;
      window.fetch=async function(...args){
        const request=args[0],url=new URL(typeof request==='string'?request:request.url,location.href);
        let prompt='';
        if(url.origin===home&&url.pathname==='/api/v0/chat/completion'){
          try{prompt=JSON.parse(args[1]?.body||(request instanceof Request?await request.clone().text():'{}')).prompt||'';}catch{}
        }
        const response=await original.apply(this,args);
        if(url.origin===home&&url.pathname==='/api/v0/chat/completion'){
          const copy=response.clone();
          (async()=>{
            try{
              await window[binding]({kind:'start',prompt,status:response.status,type:response.headers.get('content-type')||''});
              const reader=copy.body.getReader(),decoder=new TextDecoder();
              for(;;){const {done,value}=await reader.read();if(done)break;await window[binding]({kind:'data',prompt,chunk:decoder.decode(value,{stream:true})});}
              const tail=decoder.decode();if(tail)await window[binding]({kind:'data',prompt,chunk:tail});
              await window[binding]({kind:'end',prompt});
            }catch{await window[binding]({kind:'error',prompt}).catch(()=>{});}
          })();
        }
        return response;
      };
    },{binding,home:new URL(HOME).origin});
    this.page=context.pages()[0]||await context.newPage();
    context.on('close',()=>{if(this.context===context){this.context=null;this.page=null;clearInterval(this.timer);this.job?.reject(new Error('The DeepSeek browser was closed.'));this.update('closed','Open the DeepSeek browser and sign in.');}});
    await this.page.goto(HOME,{waitUntil:'domcontentloaded',timeout:30000});
    this.timer=setInterval(()=>{if(!this.job)void this.check();},4000);this.timer.unref();
    return context;
  }
  async check(){
    if(this.job)return this.snapshot();
    if(!this.page||this.page.isClosed())return this.update('closed','Open the DeepSeek browser and sign in.');
    try{
      const loggedIn=await this.page.evaluate(()=>Boolean(localStorage.getItem('userToken')));
      const editor=await this.page.locator('textarea:visible').count();
      return loggedIn&&editor?this.update('ready','DeepSeek browser is ready.'):this.update('login-required','Sign in or finish verification in the DeepSeek browser.');
    }catch{return this.update('login-required','Sign in or finish verification in the DeepSeek browser.');}
  }
  receive(page,event){
    const job=this.job;if(!job||page!==this.page||event.prompt!==job.prompt)return;
    try{
      if(event.kind==='start'){
        job.started=true;if(event.status!==200||!event.type.includes('text/event-stream'))throw new Error('DeepSeek did not start an answer stream. Check login or verification in its browser.');
      }else if(event.kind==='data'&&job.started)job.parser.push(event.chunk);
      else if(event.kind==='end'&&job.started)job.resolve(job.parser.finish());
      else if(event.kind==='error')throw new Error('The DeepSeek browser connection was interrupted.');
    }catch(error){job.reject(error);}
  }
  async run(prompt,{signal,onDelta=()=>{},images=[]}={}){
    if(this.job||this.preparing)throw new Error('The DeepSeek browser is already handling another message.');
    if(signal?.aborted)throw abortError();
    this.preparing=true;
    let timer,abort,job;
    try{
      abort=()=>{job?.reject(abortError());void this.close();};signal?.addEventListener('abort',abort,{once:true});
      await this.open();
      if(signal?.aborted)throw abortError();
      if(this.state.status!=='ready')throw new Error(this.state.detail);
      // A fresh web chat for each turn prevents hidden cross-project history.
      await this.page.goto(HOME,{waitUntil:'domcontentloaded',timeout:30000});
      const editor=this.page.locator('textarea:visible').first();await editor.waitFor({state:'visible',timeout:15000});
      if(signal?.aborted)throw abortError();
      for(const image of images){
        const input=this.page.locator('input[type="file"]').first();
        if(!await input.count())throw new Error('DeepSeek image upload is unavailable in this browser. No image was sent.');
        const uploaded=this.page.waitForResponse(response=>new URL(response.url()).origin===new URL(HOME).origin&&/\/file\/upload/.test(new URL(response.url()).pathname),{timeout:60000});
        uploaded.catch(()=>{});
        await input.setInputFiles({name:image.id+'.jpg',mimeType:'image/jpeg',buffer:await readFile(image.path)});
        const response=await uploaded;const result=await response.json();
        if(!response.ok()||result.code!==0||result.data?.biz_code!==0)throw new Error('DeepSeek could not process the image. The message was not sent.');
        if(signal?.aborted)throw abortError();
      }
      await editor.fill(prompt);
      let resolve,reject;const answer=new Promise((yes,no)=>{resolve=yes;reject=no;});answer.catch(()=>{});
      job={prompt,parser:new DeepSeekStream(onDelta),resolve,reject,started:false};this.job=job;
      if(signal?.aborted){abort();throw abortError();}
      timer=setTimeout(()=>job.reject(new Error(job.started?'DeepSeek response timed out. Check its browser.':'DeepSeek did not send the message. Check login, verification, or changed page controls.')),this.timeout);
      this.update('busy','DeepSeek is responding through its browser.');
      await editor.press('Enter');
      return await answer;
    }catch(error){
      if(signal?.aborted){await this.close();throw abortError();}
      if(error.name==='AbortError')await this.close();
      else {this.update('error',error.message);if(job)await this.close(false);}
      throw error;
    }finally{
      clearTimeout(timer);signal?.removeEventListener('abort',abort);if(this.job===job)this.job=null;this.preparing=false;
      if(this.context)await this.check();
    }
  }
  async close(reset=true){const context=this.context;this.context=null;this.page=null;clearInterval(this.timer);if(context)await context.close().catch(()=>{});if(reset)this.update('closed','Open the DeepSeek browser and sign in.');}
}
