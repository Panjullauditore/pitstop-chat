// This narrow bridge exposes only explicit one-time pairing, never saved grants.
(()=>{
  if(window!==window.top||location.origin!=='http://127.0.0.1:4317')return;
  addEventListener('message',event=>{
    const message=event.data;
    if(event.source!==window||event.origin!==location.origin||message?.source!=='pitstop-site-connect'||typeof message.requestId!=='string'||message.requestId.length>80)return;
    const reply=value=>window.postMessage({source:'pitstop-extension-connect',requestId:message.requestId,...value},location.origin);
    if(message.action==='ping'){reply({version:'1.3.0',available:true});return;}
    if(message.action!=='connect'||!['antigravity','deepseek'].includes(message.provider)||typeof message.code!=='string'||!/^[A-Za-z0-9_-]{32}$/.test(message.code))return;
    chrome.runtime.sendMessage({action:message.provider==='antigravity'?'app-site-pair':'site-pair',code:message.code}).then(result=>reply(result?.error?{error:result.error}:{paired:result?.paired===true}),error=>reply({error:error.message}));
  });
})();
