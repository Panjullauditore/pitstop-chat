(()=>{
  if(globalThis.__pitlaneAppBridgeLoaded)return;
  globalThis.__pitlaneAppBridgeLoaded=true;
  document.documentElement.setAttribute('data-pitlane-app-bridge','1.1.4');
  let active=null;
  const sleep=ms=>new Promise(done=>setTimeout(done,ms));
  const editor=()=>document.querySelector('[role="combobox"][aria-label="Message input"][contenteditable="true"]');
  const button=name=>Array.from(document.querySelectorAll('button')).find(node=>node.getAttribute('aria-label')===name);
  const cancelButton=()=>Array.from(document.querySelectorAll('button')).find(node=>/^Cancel \(Ctrl\+D\)$/.test(node.getAttribute('aria-label')||''));
  const chatId=()=>location.pathname.match(/\/c\/([a-zA-Z0-9_-]+)$/)?.[1]||null;
  const userText=node=>node.querySelector('[data-testid="user-message-bubble"] [data-quotable="true"]')?.textContent||'';
  const send=async(data)=>{const result=await chrome.runtime.sendMessage({action:'app-event',requestId:active?.id,...data});if(result?.error)throw new Error(result.error);};
  async function stop(id,target){
    const last=Array.from(document.querySelectorAll('[role="article"][aria-label="User message"]')).at(-1);
    if(chatId()===target&&last&&userText(last).includes('[Pitlane request: '+id+']'))cancelButton()?.click();
    if(active?.id===id)active.cancelled=true;
  }
  async function run(job){
    active={id:job.id,chatId:job.chatId,cancelled:false};
    try{
      if(cancelButton())throw new Error('This Antigravity chat is working. Wait for the native task to finish first.');
      if(chatId()!==job.chatId){const target=Array.from(document.querySelectorAll('a[href]')).find(node=>{try{return new URL(node.href).pathname.endsWith('/c/'+job.chatId);}catch{return false;}});if(!target)throw new Error('Open the selected App conversation first. No new chat was created.');target.click();for(let i=0;i<100&&chatId()!==job.chatId;i++)await sleep(100);}
      if(chatId()!==job.chatId||!editor())throw new Error('The selected native App conversation is unavailable.');
      if(editor().textContent.trim())throw new Error('The App composer contains a draft. Send or clear it yourself before using Pitlane.');
      const marker='[Pitlane request: '+job.id+']';
      if(Array.from(document.querySelectorAll('[role="article"][aria-label="User message"]')).some(node=>userText(node).includes(marker)))throw new Error('This Pitlane request is already in the App chat. It was not submitted twice.');
      for(const image of job.images||[]){
        if(active.cancelled)return;const field=document.querySelector('input[type="file"]');if(!field)throw new Error('App image upload is unavailable. No message was sent.');
        const result=await chrome.runtime.sendMessage({action:'app-image',requestId:job.id,imageId:image.id});if(result.error)throw new Error(result.error);
        const bytes=Uint8Array.from(atob(result.base64),char=>char.charCodeAt(0)),name=image.id+'.jpg',file=new File([bytes],name,{type:'image/jpeg'}),transfer=new DataTransfer();transfer.items.add(file);field.files=transfer.files;field.dispatchEvent(new Event('change',{bubbles:true}));
        // The uploaded filename must be rendered by the native attachment UI.
        let attached=false;for(let i=0;i<300;i++){if(active.cancelled)return;const labels=Array.from(document.querySelectorAll('[title],[aria-label],img')).map(node=>(node.getAttribute('title')||'')+' '+(node.getAttribute('aria-label')||'')+' '+(node.getAttribute('alt')||''));attached=labels.some(text=>text.includes(name))||document.body.innerText.includes(name);if(attached)break;await sleep(100);}if(!attached)throw new Error('The native App did not confirm the image upload. Nothing was sent.');
      }
      if(active.cancelled)return;
      const field=editor();field.focus();document.execCommand('insertText',false,job.prompt);
      let complete=false;
      for(let i=0;i<30;i++){const current=editor();complete=!!current&&[current.textContent,current.innerText].some(value=>value.replace(/\r/g,'')===job.prompt.replace(/\r/g,''));if(complete)break;await sleep(50);}
      if(!complete)throw new Error('The App editor did not accept the complete message ('+job.prompt.length+' expected, '+(editor()?.textContent.length||0)+' accepted). Nothing was sent.');
      let sendButton;for(let i=0;i<300;i++){if(active.cancelled)return;sendButton=button('Send message');if(sendButton&&!sendButton.disabled)break;await sleep(100);}if(!sendButton||sendButton.disabled)throw new Error('The native App send control is unavailable.');
      sendButton.click();let confirmed=false,last='',stableSince=0,seenBusy=false;
      for(let i=0;i<2400;i++){
        if(active.cancelled)return;if(chatId()!==job.chatId)throw new Error('The Remote Control conversation changed during this task.');
        const articles=Array.from(document.querySelectorAll('[role="article"]')),users=articles.filter(node=>node.getAttribute('aria-label')==='User message'),user=users.at(-1);
        if(user&&userText(user).includes(marker)){
          if(!confirmed){await send({kind:'sent'});confirmed=true;}
          const response=articles.slice(articles.indexOf(user)+1).find(node=>node.getAttribute('aria-label')==='Agent response');
          const text=response?Array.from(response.querySelectorAll('div.leading-relaxed.select-text')).filter(node=>!node.closest('[data-testid="turn-cards-container"]')&&node.getClientRects().length).map(node=>node.innerText).join('\n\n').trim().replace(/\n(?:plaintext|text|json)\s*\n(?=\s*<pitlane>)/i,'\n'):'';
          const busy=!!cancelButton();seenBusy=seenBusy||busy;
          if(text!==last){last=text;stableSince=Date.now();if(text)await send({kind:'text',text});}
          if(text&&!busy&&Date.now()-stableSince>=2000){await send({kind:'done',text});return;}
        }else if(confirmed&&user)throw new Error('Another message was sent to the native App chat. Inspect it before retrying.');
        else if(i>100&&!confirmed)throw new Error('The native App did not confirm the Pitlane message. It will not be resent automatically.');
        await sleep(250);
      }
      throw new Error('The App is still working or waiting for approval. Check the original Antigravity chat.');
    }catch(error){try{await send({kind:'error',message:error.message});}catch{}await stop(job.id,job.chatId);}
    finally{active=null;}
  }
  chrome.runtime.onMessage.addListener((message,_sender,reply)=>{
    if(message.action==='app-ping'){reply({ready:!!editor(),chatId:chatId(),version:'1.1.4'});return;}
    if(message.action==='app-run'){if(active){reply({error:'This App tab is busy.'});return;}reply({accepted:true});void run(message.job);return;}
    if(message.action==='app-cancel'){void stop(message.requestId,message.chatId);reply({accepted:true});}
  });
})();
