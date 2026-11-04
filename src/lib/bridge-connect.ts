export function connectExtension(message:{action:'ping'}|{action:'connect';provider:'antigravity'|'deepseek';code:string}):Promise<{paired?:boolean;available?:boolean;version?:string}>{
 return new Promise((resolve,reject)=>{
  const requestId=crypto.randomUUID();
  const cleanup=()=>{clearTimeout(timer);window.removeEventListener('message',receive);};
  const receive=(event:MessageEvent)=>{const data=event.data;if(event.source!==window||event.origin!==window.location.origin||data?.source!=='pitstop-extension-connect'||data.requestId!==requestId)return;cleanup();if(data.error)reject(new Error(String(data.error)));else resolve(data);};
  const timer=setTimeout(()=>{cleanup();reject(new Error('Reload Pitlane Bridge v1.3.0 or newer, then refresh Pitstop in the Chrome profile where your agent tab is open.'))},message.action==='ping'?2000:30000);
  window.addEventListener('message',receive);window.postMessage({source:'pitstop-site-connect',requestId,...message},window.location.origin);
 });
}
