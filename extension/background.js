import './app-worker.js';
const BASE='http://127.0.0.1:4318';
let looping=false,active=null;
chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function api(path,body){
  const {bridgeToken}=await chrome.storage.local.get('bridgeToken');
  const response=await fetch(BASE+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(bridgeToken?{Authorization:'Bearer '+bridgeToken}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Pitlane could not be reached.');return data;
}
async function liveTab(){
  const tabs=await chrome.tabs.query({url:'https://chat.deepseek.com/*'});
  for(const tab of tabs){if(tab.id===active?.tabId)continue;try{if((await chrome.tabs.sendMessage(tab.id,{action:'ping'})).ready)return tab;}catch{}}
  return null;
}
async function finish(){const job=active;active=null;await chrome.storage.session.remove('activeJob');if(job?.tabId)await chrome.tabs.remove(job.tabId).catch(()=>{});}
async function start(job){
  active={id:job.id,tabId:null};await chrome.storage.session.set({activeJob:active});
  try{
    const tab=await chrome.tabs.create({url:'https://chat.deepseek.com/',active:false});active.tabId=tab.id;await chrome.storage.session.set({activeJob:active});
    for(let attempt=0;attempt<30;attempt++){
      if(active?.id!==job.id)return;
      try{if((await chrome.tabs.sendMessage(tab.id,{action:'ping'})).ready){const state=await api('/api/bridge/poll',{ready:true,activeJobId:job.id});if(state.cancel){await finish();return;}const result=await chrome.tabs.sendMessage(tab.id,{action:'run',job});if(result?.accepted)return;}}catch{}
      await delay(500);
    }
    throw new Error('Open DeepSeek in Chrome and complete login or verification.');
  }catch(error){await api('/api/bridge/event',{requestId:job.id,kind:'error',message:error.message}).catch(()=>{});await finish();}
}
async function loop(){
  if(looping)return;looping=true;
  try{
    const previous=(await chrome.storage.session.get('activeJob')).activeJob;
    if(previous&&!active){if(previous.tabId)await chrome.tabs.remove(previous.tabId).catch(()=>{});await chrome.storage.session.remove('activeJob');}
    while((await chrome.storage.local.get('bridgeToken')).bridgeToken){
      try{
        const tab=await liveTab();const data=await api('/api/bridge/poll',{ready:!!tab||!!active,activeJobId:active?.id||null});
        if(data.cancel)await finish();else if(data.job&&!active)await start(data.job);
        await chrome.storage.local.set({bridgeStatus:data.browser.detail});
      }catch{await chrome.storage.local.set({bridgeStatus:'Pitlane is offline or this pairing was revoked.'});}
      await delay(2000);
    }
  }finally{looping=false;}
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message.action?.startsWith('app-'))return false;
  (async()=>{
    if(message.action==='pair'){
      if(sender.tab||sender.url!==chrome.runtime.getURL('popup.html'))throw new Error('Pair from the Pitlane Bridge popup.');
      const data=await api('/api/bridge/pair',{code:message.code});await chrome.storage.local.set({bridgeToken:data.token,bridgeStatus:'Paired. Open DeepSeek in this Chrome profile.'});void loop();return {paired:true};
    }
    if(!sender.tab||sender.tab.id!==active?.tabId||!sender.url?.startsWith('https://chat.deepseek.com/'))throw new Error('This tab does not own the active bridge request.');
    if(message.requestId!==active.id)throw new Error('This bridge request has expired.');
    if(message.action==='event'){
      try{await api('/api/bridge/event',{requestId:message.requestId,kind:message.kind,chunk:message.chunk,status:message.status,type:message.type,message:message.message});}
      catch(error){await finish();throw error;}
      if(['done','error'].includes(message.kind))await finish();return {accepted:true};
    }
    if(message.action==='image'){
      const {bridgeToken}=await chrome.storage.local.get('bridgeToken');const response=await fetch(BASE+'/api/bridge/image/'+encodeURIComponent(message.requestId)+'/'+encodeURIComponent(message.imageId),{headers:{Authorization:'Bearer '+bridgeToken}});if(!response.ok)throw new Error('This image request failed.');
      const bytes=new Uint8Array(await response.arrayBuffer());let binary='';for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.slice(offset,offset+8192));return {base64:btoa(binary)};
    }
    throw new Error('Unknown bridge action.');
  })().then(reply,error=>reply({error:error.message}));return true;
});
chrome.alarms.create('pitlane-bridge',{periodInMinutes:0.5});chrome.alarms.onAlarm.addListener(()=>void loop());chrome.runtime.onStartup.addListener(()=>void loop());void loop();
