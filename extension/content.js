(()=>{
  let active=null,queue=Promise.resolve(),uploadWaiter=null,armWaiter=null,hookReady=false;
  const editor=()=>Array.from(document.querySelectorAll('textarea')).find(node=>node.getClientRects().length&&!node.disabled);
  const ready=()=>hookReady&&!location.pathname.startsWith('/sign_in')&&!!editor();
  const emit=event=>{queue=queue.then(()=>chrome.runtime.sendMessage({action:'event',...event})).then(result=>{if(result?.error)throw new Error(result.error);});return queue;};
  const pageMessage=data=>window.postMessage({source:'pitlane-content',...data},location.origin);
  addEventListener('message',event=>{
    const value=event.data;if(event.source!==window||event.origin!==location.origin||value?.source!=='pitlane-page')return;
    if(value.kind==='ready'&&value.version===2){hookReady=true;document.documentElement?.setAttribute('data-pitlane-bridge','2');return;}
    if(value.id!==active)return;
    if(value.kind==='armed'&&value.version===2){hookReady=true;armWaiter?.();return;}
    if(value.kind==='upload'){uploadWaiter?.(value.success);return;}
    if(['start','chunk','done','error'].includes(value.kind))void emit({requestId:active,kind:value.kind,chunk:value.chunk,status:value.status,type:value.type,message:value.message}).catch(()=>{active=null;});
  });
  async function run(job){
    active=job.id;queue=Promise.resolve();
    try{
      let timer;try{await new Promise((resolve,reject)=>{armWaiter=resolve;timer=setTimeout(()=>reject(new Error('Reload Pitlane Bridge in chrome://extensions, then refresh DeepSeek. Its response reader is not loaded.')),2000);pageMessage({kind:'arm',id:job.id,prompt:job.prompt});});}finally{clearTimeout(timer);armWaiter=null;}
      if(!ready()||document.querySelector('.ds-markdown'))throw new Error('DeepSeek needs a signed-in, fresh chat. Complete login or verification in Chrome.');
      for(const image of job.images||[]){
        const input=document.querySelector('input[type="file"]');if(!input)throw new Error('DeepSeek image upload is unavailable. No image was sent.');
        const data=await chrome.runtime.sendMessage({action:'image',requestId:job.id,imageId:image.id});if(data.error)throw new Error(data.error);
        const bytes=Uint8Array.from(atob(data.base64),char=>char.charCodeAt(0)),file=new File([bytes],image.id+'.jpg',{type:'image/jpeg'}),transfer=new DataTransfer();transfer.items.add(file);
        let timer;const uploaded=new Promise((resolve,reject)=>{uploadWaiter=success=>success?resolve():reject(new Error('DeepSeek rejected the image upload.'));timer=setTimeout(()=>reject(new Error('DeepSeek image upload timed out. Nothing was sent.')),60000);});uploaded.catch(()=>{});
        try{input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));await uploaded;}finally{clearTimeout(timer);uploadWaiter=null;}
      }
      if(active!==job.id)return;
      const field=editor();Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(field,job.prompt);field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));
      let send;const deadline=Date.now()+60000;
      do{if(active!==job.id)return;send=field.parentElement.parentElement.querySelector('[role="button"].ds-button--primary.ds-button--circle');if(send&&!send.classList.contains('ds-button--disabled'))break;await new Promise(resolve=>setTimeout(resolve,100));}while(Date.now()<deadline);
      if(!send||send.classList.contains('ds-button--disabled'))throw new Error('DeepSeek send control is unavailable. The page may have changed.');
      send.click();
    }catch(error){await emit({requestId:job.id,kind:'error',message:error.message}).catch(()=>{});active=null;}
  }
  chrome.runtime.onMessage.addListener((message,_sender,reply)=>{
    if(message.action==='ping'){pageMessage({kind:'ping'});reply({ready:ready(),version:2});return;}
    if(message.action==='run'){if(active){reply({error:'This tab is busy.'});return;}reply({accepted:true});void run(message.job);return;}
    if(message.action==='cancel'){active=null;pageMessage({kind:'disarm'});reply({accepted:true});}
  });
  pageMessage({kind:'ping'});
})();
