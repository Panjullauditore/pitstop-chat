const BASE='http://127.0.0.1:4318/api/bridge/app';
let running=false,active=null,diagnostic='';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
async function bounded(promise,ms=2000){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('The frame is still connecting.')),ms);})]);}finally{clearTimeout(timer);}}
const frames=new Map();
const remoteBase=value=>{try{const url=new URL(value);return url.origin==='https://antigravity.google.com'&&/^\/r\/[a-f0-9-]{36}-v2\/?$/.test(url.pathname)?url.origin+url.pathname.replace(/\/$/,''):null;}catch{return null;}};
async function api(path,body){const {appBridgeToken}=await chrome.storage.local.get('appBridgeToken');const response=await fetch(BASE+path,{method:'POST',headers:{'Content-Type':'application/json',...(appBridgeToken?{Authorization:'Bearer '+appBridgeToken}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Pitlane App bridge is unavailable.');return data;}
async function tabs(){
  const result=[],found=await chrome.tabs.query({url:'https://antigravity.google.com/r/*'});found.sort((a,b)=>(b.lastAccessed||b.id)-(a.lastAccessed||a.id));diagnostic=found.length?'':'No Antigravity Remote Control tab is open in this extension profile.';
  for(const tab of found.slice(0,10)){const base=remoteBase(tab.url);if(!base||result.some(item=>item.base===base))continue;
    try{
      let frameId=frames.get(tab.id),state=null;
      if(frameId!==undefined)try{state=await bounded(chrome.tabs.sendMessage(tab.id,{action:'app-ping'},{frameId}));}catch{frames.delete(tab.id);}
      if(!state){
        // Inspect only the rendered editor in the permitted Remote Control frames.
        const candidates=await bounded(chrome.scripting.executeScript({target:{tabId:tab.id,allFrames:true},func:()=>({native:location.origin==='https://antigravity.static.usercontent.goog',ready:!!document.querySelector('[role="combobox"][aria-label="Message input"]')})}));
        const candidate=candidates.find(item=>item.result?.native&&item.result?.ready);if(!candidate){diagnostic='The native App editor is still loading.';continue;}frameId=candidate.frameId;
        await bounded(chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[frameId]},files:['app-content.js']}));
        state=await bounded(chrome.tabs.sendMessage(tab.id,{action:'app-ping'},{frameId}));frames.set(tab.id,frameId);
      }
      if(state?.ready)result.push({tab,base,state,frameId});else diagnostic='The App frame answered but its message editor is unavailable.';
    }catch(error){diagnostic='Refresh the Remote Control tab. Frame reader: '+error.message;}
  }return result;
}
async function cancel(job=active){if(!job)return;await chrome.tabs.sendMessage(job.tabId,{action:'app-cancel',requestId:job.id,chatId:job.chatId},job.frameId===undefined?{}:{frameId:job.frameId}).catch(()=>{});}
async function finish(){active=null;await chrome.storage.session.remove('activeAppJob');}
async function start(job,available){
  const target=available.find(item=>item.base===remoteBase(job.remoteUrl));if(!target)throw new Error('Open the selected Antigravity device in this Chrome profile.');
  active={id:job.id,tabId:target.tab.id,frameId:target.frameId,chatId:job.chatId,base:target.base};await chrome.storage.session.set({activeAppJob:active});
  try{const result=await chrome.tabs.sendMessage(active.tabId,{action:'app-run',job},{frameId:active.frameId});if(result?.error)throw new Error(result.error);if(!result?.accepted)throw new Error('Refresh the Antigravity Remote Control tab to load Pitlane Bridge.');}
  catch(error){await api('/event',{requestId:job.id,kind:'error',message:error.message}).catch(()=>{});await finish();}
}
async function loop(){
  if(running)return;running=true;
  try{
    const previous=(await chrome.storage.session.get('activeAppJob')).activeAppJob;
    if(previous&&!active){await cancel(previous);await chrome.storage.session.remove('activeAppJob');}
    while((await chrome.storage.local.get('appBridgeToken')).appBridgeToken){
      try{const available=await tabs(),data=await api('/poll',{ready:!!available.length,targets:[...new Set(available.map(item=>item.base))],diagnostic:diagnostic.slice(0,300),activeJobId:active?.id||null});
        if(data.cancel){await cancel();await finish();}else if(data.job&&!active)await start(data.job,available);
        await chrome.storage.local.set({appBridgeStatus:data.browser.detail});
      }catch{await chrome.storage.local.set({appBridgeStatus:'Pitlane App bridge is offline or its pairing was revoked.'});}
      await sleep(1000);
    }
  }finally{running=false;}
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(!message.action?.startsWith('app-'))return false;
  (async()=>{
    if(message.action==='app-pair'||message.action==='app-site-pair'){
      if(message.action==='app-site-pair'){
        let origin;try{origin=new URL(sender.url).origin;}catch{}
        if(origin!=='http://127.0.0.1:4317'||!sender.tab||sender.frameId!==0)throw new Error('Connect from the local Pitstop page.');
        if(active)throw new Error('Stop the Antigravity response before changing its connection.');
        if(!(await tabs()).length)throw new Error('Open Antigravity Remote Control in this Chrome profile and wait for its chat editor. Existing pairing was kept.');
      }else if(sender.tab||sender.url!==chrome.runtime.getURL('popup.html'))throw new Error('Pair from the Pitlane Bridge popup.');
      const data=await api('/pair',{code:message.code});await chrome.storage.local.set({appBridgeToken:data.token,appBridgeStatus:'Paired. Keep Antigravity Remote Control open.'});void loop();return {paired:true};
    }
    if(!active||sender.tab?.id!==active.tabId||sender.frameId!==active.frameId||message.requestId!==active.id)throw new Error('This tab does not own the App request.');
    const url=new URL(sender.url);if(url.origin!=='https://antigravity.static.usercontent.goog')throw new Error('This frame is not the Antigravity App.');
    if(message.kind!=='error'){
      // MessageSender.url is the iframe's initial document URL. SPA navigation
      // updates the visible parent tab's p route; use that authoritative route.
      const current=await chrome.tabs.get(active.tabId),route=new URL(current.url).searchParams.get('p');
      if(remoteBase(current.url)!==active.base||route?.split('?')[0]!=='c/'+active.chatId)throw new Error('Remote Control is now showing a different conversation.');
    }
    if(message.action==='app-event'){
      try{await api('/event',{requestId:active.id,chatId:active.chatId,kind:message.kind,text:message.text,message:message.message});}catch(error){await cancel();await finish();throw error;}
      if(['done','error'].includes(message.kind))await finish();return {accepted:true};
    }
    if(message.action==='app-image'){
      const {appBridgeToken}=await chrome.storage.local.get('appBridgeToken');const response=await fetch(BASE+'/image/'+encodeURIComponent(active.id)+'/'+encodeURIComponent(message.imageId),{headers:{Authorization:'Bearer '+appBridgeToken}});if(!response.ok)throw new Error('This attachment does not belong to the active App request.');
      const bytes=new Uint8Array(await response.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.slice(i,i+8192));return {base64:btoa(binary)};
    }
    throw new Error('Unknown App bridge action.');
  })().then(reply,error=>reply({error:error.message}));return true;
});
chrome.alarms.create('pitlane-app-bridge',{periodInMinutes:0.5});chrome.alarms.onAlarm.addListener(()=>void loop());chrome.runtime.onStartup.addListener(()=>void loop());void loop();
