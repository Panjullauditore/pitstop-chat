import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('HTTP Chrome pairing authenticates the extension, streams into Room, persists and revokes',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'pitlane-extension-http-'));let child;
  const start=()=>new Promise((resolve,reject)=>{
    child=spawn(process.execPath,['server.mjs'],{cwd:process.cwd(),windowsHide:true,env:{...process.env,ROOM_DATA_DIR:directory,ROOM_PORT:'0',ROOM_SKIP_CLI_CHECKS:'1'},stdio:['ignore','pipe','pipe']});
    let output='',errors='';const timer=setTimeout(()=>reject(new Error('Server startup timeout: '+errors)),10000);
    child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/ready: (http:\/\/127.0.0.1:\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}});child.stderr.on('data',chunk=>errors+=chunk);child.once('error',reject);
  });
  const stop=async()=>{if(child?.exitCode===null){const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited;}};
  t.after(async()=>{await stop();assert.ok(directory.startsWith(join(tmpdir(),'pitlane-extension-http-')));await rm(directory,{recursive:true,force:true});});
  let base=await start(),bootstrap=await(await fetch(base+'/api/bootstrap')).json();
  const call=async(path,input,headers={})=>{const response=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...headers},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:response.status,data:await response.json()};};
  const appHeaders=()=>({'X-Room-Token':bootstrap.token});
  assert.equal((await call('/api/web-agent/extension/pair-code',{})).status,403);
  const setup=(await call('/api/web-agent/extension/setup',undefined,appHeaders())).data;
  const origin='chrome-extension://'+setup.extensionId;
  await call('/api/web-agent/connect',{name:'DeepSeek Web'},appHeaders());
  const {code}=(await call('/api/web-agent/extension/pair-code',{},appHeaders())).data;
  assert.equal((await call('/api/bridge/pair',{code},{Origin:'https://evil.example'})).status,403);
  const paired=await call('/api/bridge/pair',{code},{Origin:origin});assert.equal(paired.status,200);const secret=paired.data.token;
  assert.equal((await call('/api/bridge/pair',{code},{Origin:origin})).status,400);
  const bridgeHeaders={Origin:origin,Authorization:'Bearer '+secret};
  const appCode=(await call('/api/linked-apps/antigravity/bridge/pair-code',{},appHeaders())).data.code;
  const appPair=await call('/api/bridge/app/pair',{code:appCode},{Origin:origin});assert.equal(appPair.status,200);
  const nativeHeaders={Origin:origin,Authorization:'Bearer '+appPair.data.token};
  assert.equal((await call('/api/bridge/app/poll',{ready:true},bridgeHeaders)).status,403);
  assert.equal((await call('/api/bridge/poll',{ready:true},nativeHeaders)).status,403);
  assert.equal((await call('/api/bridge/app/poll',{ready:true,targets:['https://antigravity.google.com/r/9d397d65-3b94-4b82-9da1-0ae1058edc18-v2']},nativeHeaders)).data.browser.connected,true);
  assert.equal((await call('/api/linked-apps/antigravity/bridge/revoke',{},appHeaders())).status,200);
  assert.equal((await call('/api/bridge/app/poll',{ready:true},nativeHeaders)).status,403);

  assert.equal((await call('/api/bridge/poll',{ready:true},{Authorization:'Bearer '+bootstrap.token})).status,403);
  assert.equal((await call('/api/bridge/poll?token='+secret,{ready:true})).status,403);
  assert.equal((await call('/api/web-agent/extension/revoke',{},bridgeHeaders)).status,403);
  assert.equal((await call('/api/bridge/poll',{ready:true},bridgeHeaders)).data.browser.connected,true);
  let state=(await(await fetch(base+'/api/bootstrap')).json()).state;assert.equal(state.agents.find(a=>a.id==='deepseek').connection,'connected');assert.ok(!JSON.stringify(state).includes(secret));
  assert.equal((await call('/api/send',{text:'Fixture project review',mode:'deepseek',syncMemory:false},appHeaders())).status,202);
  let job;for(let attempt=0;attempt<40&&!job;attempt++){job=(await call('/api/bridge/poll',{ready:true},bridgeHeaders)).data.job;if(!job)await new Promise(resolve=>setTimeout(resolve,10));}
  assert.ok(job);assert.match(job.prompt,/SOUL MEMORY/);assert.match(job.prompt,/PROJECT MEMORY/);
  assert.equal((await call('/api/bridge/event',{requestId:'old',kind:'done'},bridgeHeaders)).status,400);
  await call('/api/bridge/event',{requestId:job.id,kind:'start',status:200,type:'text/event-stream'},bridgeHeaders);
  const chunk='data: '+JSON.stringify({v:{response:{status:'FINISHED',fragments:[{type:'RESPONSE',content:'HTTP browser reply'}]}}})+'\n\n';
  await call('/api/bridge/event',{requestId:job.id,kind:'chunk',chunk},bridgeHeaders);await call('/api/bridge/event',{requestId:job.id,kind:'done'},bridgeHeaders);
  for(let attempt=0;attempt<40;attempt++){state=(await(await fetch(base+'/api/bootstrap')).json()).state;if(!state.run)break;await new Promise(resolve=>setTimeout(resolve,10));}
  assert.equal(state.messages.at(-1).text,'HTTP browser reply');assert.equal(state.messages.at(-1).manualImport,undefined);assert.equal(state.webRequest,null);
  assert.equal((await call('/api/bridge/event',{requestId:job.id,kind:'done'},bridgeHeaders)).status,400);
  await stop();base=await start();bootstrap=await(await fetch(base+'/api/bootstrap')).json();
  assert.equal((await call('/api/bridge/poll',{ready:true},bridgeHeaders)).status,200);
  await call('/api/web-agent/extension/revoke',{},appHeaders());assert.equal((await call('/api/bridge/poll',{ready:true},bridgeHeaders)).status,403);
});
