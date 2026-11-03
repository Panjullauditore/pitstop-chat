import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectAgents, runAgent } from './adapters.mjs';
import { ManualWebBridge } from './manual-web.mjs';
import {DeepSeekBrowserBridge} from './deepseek-browser.mjs';
import {ExtensionBridge,extensionIdentity} from './extension-bridge.mjs';
import {listCodexChats,antigravityChats,resolveAppLink} from './linked-apps.mjs';
import {runLinkedApp} from './run-linked-app.mjs';
import {NativeAppBridge,appRemoteUrl} from './app-bridge.mjs';
import { SessionStore } from './sessions.mjs';
import { AttachmentStore, MAX_FILE_BYTES } from './attachments.mjs';
import { accountIdentity, codexRequest, readClaudeAccount } from './accounts.mjs';
import { codexModels, antigravityModels, validateSelections } from './models.mjs';
import { createQuotaService,quotaWarnings } from './quota.mjs';
import {changeSoulLanguage,cliSoulTranslator} from './soul-language.mjs';

const base = dirname(fileURLToPath(import.meta.url));
const project = dirname(base);
const port = Number(process.env.ROOM_PORT || 4318);
const token = randomBytes(32).toString('hex');
const definitions = detectAgents();
const webBridge=new ManualWebBridge();
const dataDirectory = process.env.ROOM_DATA_DIR || join(base, 'data');
const deepseekBrowser=new DeepSeekBrowserBridge({directory:dataDirectory});
const extensionManifest=JSON.parse(await readFile(join(base,'extension','manifest.json'),'utf8'));
const extensionId=extensionIdentity(extensionManifest.key);
const extensionOrigin='chrome-extension://'+extensionId;
const chromeBridge=new ExtensionBridge({directory:dataDirectory,extensionId});
const appBridge=new NativeAppBridge({directory:dataDirectory,extensionId});
const attachments = new AttachmentStore(dataDirectory);
await mkdir(dataDirectory, { recursive: true });
await chromeBridge.load();await appBridge.load();
let context = '';
try { context = await readFile(join(project, 'COORDINATION.md'), 'utf8'); } catch {}
let soulSeed;
try{soulSeed=await readFile(join(base,'SOUL.md'),'utf8');}
catch(error){if(error.code!=='ENOENT')throw error;soulSeed=await readFile(join(base,'SOUL.example.md'),'utf8');}
let brain, room;
const accounts = {};
const agentProfiles = {};
try { Object.assign(agentProfiles, JSON.parse(await readFile(join(dataDirectory,'agents.json'),'utf8'))); } catch(error) { if(error.code !== 'ENOENT') throw error; }
definitions.deepseek={id:'deepseek',name:'DeepSeek Web',transport:'browser-web',installed:Boolean(agentProfiles.deepseek?.enabled)};
accounts.deepseek={connected:false,email:null,error:chromeBridge.snapshot().detail};
let catalog = {};
try { catalog = JSON.parse(await readFile(join(dataDirectory,'models.json'),'utf8')); } catch(error) { if(error.code!=='ENOENT') console.error('Model cache:',error.message); }
let refreshing = null;
const quotas=createQuotaService();
async function refreshModels() {
  if(refreshing)return refreshing;
  Object.assign(definitions,detectAgents());
  refreshing = (async()=>{
    const results = await Promise.allSettled([codexModels(definitions.codex),antigravityModels(definitions.antigravity)]);
    for(let i=0;i<2;i++){
      const id=i===0?'codex':'antigravity', result=results[i];
      catalog[id]=result.status==='fulfilled' ? {models:result.value,fetchedAt:new Date().toISOString(),error:null} : {...catalog[id],models:catalog[id]?.models || [],error:result.reason.message};
    }
    await writeFile(join(dataDirectory,'models.json.tmp'),JSON.stringify(catalog,null,2),'utf8');
    await rename(join(dataDirectory,'models.json.tmp'),join(dataDirectory,'models.json'));
    room.invalidateAttendance();room.changed(false);return catalog;
  })().finally(()=>{refreshing=null;});
  return refreshing;
}
const sessions = new SessionStore({ directory:dataDirectory, seed:soulSeed, context, agents:definitions, attachments,
  runner:async(agent,prompt,options)=>{
    if(options.nativeLink&&['codex','antigravity'].includes(agent)){
      const link=options.nativeLink;
      try{const result=await runLinkedApp(agent,link,prompt,options,{definitions,runNativeApp:(target,input,run)=>appBridge.run(target,input,run)});await sessions.linkedResult(options.sessionId,agent,link.id,{state:'saved',lastSyncedAt:new Date().toISOString(),error:null});return result;}
      catch(error){await sessions.linkedResult(options.sessionId,agent,link.id,{state:'error',error:error.message.slice(0,600)});throw error;}
    }
    if(agent==='deepseek'){
      return chromeBridge.run(prompt,options);
    }
    try{return await runAgent(agent,prompt,{...options,cwd:base,definitions});}
    finally{void checkAccount(agent).then(()=>checkQuota(agent,{force:true})).catch(()=>{});}
  }
});
await sessions.load();
function activate(){room=sessions.room;room.getAppConnection=id=>{const link=room.getLinkedApps?.()[id];if(link?.transport!=='remote-app')return null;const state=appBridge.snapshot();let matches=false;try{matches=state.targets.includes(new URL(link.remoteUrl).origin+new URL(link.remoteUrl).pathname.replace(/\/$/,''));}catch{}return {connected:state.connected&&matches,email:null,checkedAt:state.checkedAt,error:state.detail,app:true};};brain=room.brain;room.accounts=accounts;room.agentProfiles=agentProfiles;}
activate();
appBridge.on('change',()=>room.changed(false));
chromeBridge.on('change',state=>{accounts.deepseek={connected:state.connected,email:null,checkedAt:state.checkedAt,error:state.detail};room.changed(false);});
async function checkAccount(agent){
  if(agent==='deepseek'){const state=chromeBridge.snapshot();accounts.deepseek={connected:state.connected,email:null,checkedAt:state.checkedAt,error:state.detail};return accounts.deepseek;}
  const checkedAt=new Date().toISOString();
  try {
    let identity;
    if(agent==='codex'){
      const result=await codexRequest(definitions.codex,'account/read',{refreshToken:true});
      if(!result.account)throw new Error('Codex belum login. Jalankan codex login.');
      identity=accountIdentity(result.account);
    }else if(agent==='claude')identity=await readClaudeAccount(definitions.claude);
    else {
      const data=await quotas.get(agent,{force:true});
      identity={email:data.accountEmail || null};
    }
    accounts[agent]={...identity,connected:true,checkedAt};
  }catch(error){accounts[agent]={email:null,connected:false,checkedAt,error:error.message};}
  room.changed(false);return accounts[agent];
}
async function checkQuota(agent,{force=false}={}){
  if(!Object.hasOwn(definitions,agent))throw new Error('Agent kuota tidak valid.');
  try{
    const data=['claude','deepseek'].includes(agent) ? {agent,groups:[],checkedAt:new Date().toISOString()} : await quotas.get(agent,{force});
    room.quota[agent]={status:'ok',data,warnings:quotaWarnings(data,brain.snapshot().selections[agent])};
    room.changed(false);return data;
  }catch(error){room.quota[agent]={status:'error',error:error.message,warnings:[]};room.changed(false);throw error;}
}
const clients = new Set();
sessions.on('change', state => { for (const client of clients) client.write(`data: ${JSON.stringify(state)}\n\n`); });
sessions.on('storageError', error => {
  console.error('Room storage:', error.message);
  for (const client of clients) client.write(`event: warning\ndata: ${JSON.stringify({ error: 'Riwayat gagal disimpan. Periksa ruang disk dan izin folder data.' })}\n\n`);
});

function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}
async function readBytes(request, limit) {
  const chunks = []; let size = 0;
  for await (const chunk of request) { size += chunk.length; if (size > limit) throw new Error('Upload atau pesan terlalu besar. Ukuran file maksimal 10 MB.'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
async function body(request) { return JSON.parse((await readBytes(request,request.url.startsWith('/api/sessions/import') ? 8000000 : request.url.startsWith('/api/web-agent/reply')?250000:120000)).toString('utf8') || '{}'); }
let mutation = Promise.resolve();
function exclusive(action) { const result = mutation.then(action); mutation = result.catch(() => {}); return result; }
const server = http.createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  const frontendPort = Number(process.env.FRONTEND_PORT || 4317);
  const listeningPort=server.address()?.port || port;
  const hosts = [`127.0.0.1:${listeningPort}`, `localhost:${listeningPort}`, `127.0.0.1:${frontendPort}`, `localhost:${frontendPort}`];
  if (!hosts.includes(request.headers.host)) return json(response, 403, { error: 'Host tidak diizinkan.' });
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  const origin = request.headers.origin;
  const extensionRequest=url.pathname.startsWith('/api/bridge/');
  if (origin && !hosts.some(host => origin === `http://${host}`) && !(extensionRequest&&origin===extensionOrigin)) return json(response, 403, { error: 'Origin tidak diizinkan.' });
  if(extensionRequest&&origin===extensionOrigin){response.setHeader('Access-Control-Allow-Origin',extensionOrigin);response.setHeader('Vary','Origin');}
  const expectedSession=request.headers['x-room-session'];
  const mutate=action=>exclusive(()=>{
    if(expectedSession && expectedSession!==sessions.activeId)throw new Error('Sesi aktif berubah. Muat ulang sebelum menyimpan.');
    activate();return action();
  });
  try {
    if(extensionRequest){
      if(request.method==='OPTIONS'&&origin===extensionOrigin){response.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'});response.end();return;}
      if(request.method==='POST'&&url.pathname==='/api/bridge/pair')return json(response,200,await chromeBridge.pair((await body(request)).code));
      const activeBridge=url.pathname.startsWith('/api/bridge/app/')?appBridge:chromeBridge;
      const route=url.pathname.replace('/api/bridge/app/','/api/bridge/');
      if(request.method==='POST'&&url.pathname==='/api/bridge/app/pair')return json(response,200,await appBridge.pair((await body(request)).code));
      const bearer=request.headers.authorization?.startsWith('Bearer ')?request.headers.authorization.slice(7):'';
      if(!activeBridge.authorize(bearer))return json(response,403,{error:'Pair Pitlane Bridge again from DeepSeek settings.'});
      if(request.method==='POST'&&route==='/api/bridge/poll')return json(response,200,activeBridge.poll(await body(request)));
      if(request.method==='POST'&&route==='/api/bridge/event'){activeBridge.event(await body(request));return json(response,200,{accepted:true});}
      if(request.method==='GET'&&route.startsWith('/api/bridge/image/')){
        const [requestId,imageId]=route.slice('/api/bridge/image/'.length).split('/').map(decodeURIComponent);
        const image=activeBridge.image(requestId,imageId),bytes=await readFile(image.path);
        response.writeHead(200,{'Content-Type':'image/jpeg','Content-Length':bytes.length,'Cache-Control':'no-store'});response.end(bytes);return;
      }
      return json(response,404,{error:'Unknown bridge route.'});
    }
    if (request.method === 'GET' && url.pathname === '/api/bootstrap') return json(response, 200, { token, state: sessions.snapshot(), catalog });
    if (url.pathname.startsWith('/api/')) {
      if ((request.headers['x-room-token'] || url.searchParams.get('token')) !== token) return json(response, 403, { error: 'Muat ulang room untuk menyambungkan ulang sesi lokal.' });
      if(request.method==='GET'&&url.pathname==='/api/linked-apps/chats'){
        const provider=url.searchParams.get('provider'),query=(url.searchParams.get('query')||'').slice(0,120);
        if(!['codex','antigravity'].includes(provider))throw new Error('Choose Codex or Antigravity.');
        const data=provider==='codex'?await listCodexChats(definitions.codex,{query,cursor:url.searchParams.get('cursor')}):await antigravityChats({query});
        return json(response,200,data);
      }
      if(request.method==='POST'&&url.pathname==='/api/projects/linked-apps'){
        const input=await body(request);if(!input.links||typeof input.links!=='object'||Array.isArray(input.links)||Object.keys(input.links).some(key=>!['codex','antigravity'].includes(key)))throw new Error('Invalid linked app settings.');
        const state=await mutate(async()=>{
          const project=sessions.projects.find(project=>project.id===input.projectId);if(!project)throw new Error('Project was not found.');
          const workspaceFallback=join(dataDirectory,'agent-workspaces',project.id);
          if(input.links.antigravity)await mkdir(workspaceFallback,{recursive:true});
          const links={};for(const provider of ['codex','antigravity'])if(input.links[provider])links[provider]=await resolveAppLink(provider,input.links[provider],{definitions,workspaceFallback});
          if(links.antigravity&&input.links.antigravity.remoteUrl)links.antigravity.remoteUrl=appRemoteUrl(input.links.antigravity.remoteUrl,links.antigravity.id);
          for(const [provider,link] of Object.entries(links)){
            const previous=project.linkedApps?.[provider];
            if(previous&&['id','cwd','source','transport','remoteUrl'].every(key=>previous[key]===link[key])){
              for(const key of ['state','linkedAt','lastSyncedAt','error'])if(Object.hasOwn(previous,key))link[key]=previous[key];
            }
          }
          return sessions.setLinkedApps(input.projectId,links);
        });return json(response,200,{state});
      }
      if(request.method==='GET'&&url.pathname==='/api/linked-apps/antigravity/bridge/setup')return json(response,200,{...appBridge.snapshot(),extensionId,folder:join(base,'extension')});
      if(request.method==='POST'&&url.pathname==='/api/linked-apps/antigravity/bridge/pair-code')return json(response,200,appBridge.issueCode());
      if(request.method==='POST'&&url.pathname==='/api/linked-apps/antigravity/bridge/revoke'){await appBridge.revoke();return json(response,200,{state:sessions.snapshot()});}
      if(request.method==='GET'&&url.pathname==='/api/web-agent/extension/setup')return json(response,200,{...chromeBridge.snapshot(),extensionId,folder:join(base,'extension')});
      if(request.method==='POST'&&url.pathname==='/api/web-agent/extension/pair-code'){
        if(room.run)throw new Error('Stop the current discussion before pairing Chrome.');
        return json(response,200,chromeBridge.issueCode());
      }
      if(request.method==='POST'&&url.pathname==='/api/web-agent/extension/revoke'){
        await chromeBridge.revoke();await checkAccount('deepseek');room.changed(false);return json(response,200,{state:sessions.snapshot()});
      }
      if (request.method === 'POST' && url.pathname === '/api/attachments') {
        if (!expectedSession) throw new Error('Pilih sesi sebelum mengunggah file.');
        const name = decodeURIComponent(request.headers['x-file-name'] || '');
        const bytes = await readBytes(request, MAX_FILE_BYTES);
        const attachment = await mutate(()=>attachments.create({name,bytes,sessionId:sessions.activeId}));
        return json(response,201,{attachment});
      }
      if (request.method === 'GET' && url.pathname.startsWith('/api/attachments/')) {
        const {record,bytes} = await attachments.original(url.pathname.slice('/api/attachments/'.length));
        if (!sessions.entries.some(entry=>entry.id===record.sessionId)) return json(response,404,{error:'Sesi lampiran sudah dihapus.'});
        response.writeHead(200,{'Content-Type':record.mimeType,'Content-Length':bytes.length,'Content-Disposition':`${record.kind==='image' && url.searchParams.get('download')!=='1'?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(record.name)}`,'Cache-Control':'no-store'});
        response.end(bytes);return;
      }
      if (request.method === 'GET' && url.pathname === '/api/events') {
        response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-store, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        response.flushHeaders();
        response.socket?.setNoDelay(true);
        response.write(`data: ${JSON.stringify(sessions.snapshot())}\n\n`); clients.add(response);
        const timer = setInterval(() => response.write(': heartbeat\n\n'), 15000);
        response.on('close', () => { clearInterval(timer); clients.delete(response); }); return;
      }
      if(request.method==='POST' && url.pathname.startsWith('/api/projects/')){
        const input=await body(request);
        const state=await exclusive(async()=>{
          if(url.pathname==='/api/projects/new')await sessions.createProject(input);
          else if(url.pathname==='/api/projects/update')await sessions.updateProject(input);
          else if(url.pathname==='/api/projects/move')await sessions.moveSession(input.sessionId,input.projectId);
          else if(url.pathname==='/api/projects/session-agents')await sessions.setSessionAgents(input.sessionId,input.agentIds);
          else if(url.pathname==='/api/projects/open')await sessions.openProject(input.projectId);
          else if(url.pathname==='/api/projects/delete'){
            if(input.confirmation!=='DELETE')throw new Error('Ketik DELETE untuk mengonfirmasi hapus proyek.');
            await sessions.deleteProject(input.projectId);
          }
          else throw new Error('Endpoint proyek tidak ditemukan.');
          activate();return sessions.snapshot();
        });
        return json(response,200,{state});
      }
      if(request.method==='GET' && url.pathname==='/api/sessions')return json(response,200,{activeSessionId:sessions.activeId,sessions:sessions.list()});
      if(request.method==='POST' && url.pathname.startsWith('/api/sessions/')){
        const input=await body(request);
        const state=await exclusive(async()=>{
          let result;
          if(url.pathname==='/api/sessions/new')result=await sessions.create(input);
          else if(url.pathname==='/api/sessions/switch')result=await sessions.switch(input.sessionId);
          else if(url.pathname==='/api/sessions/rename')result=await sessions.rename(input.sessionId,input.title);
          else if(url.pathname==='/api/sessions/import')result=await sessions.importLegacy(input.sessions);
          else throw new Error('Endpoint sesi tidak ditemukan.');
          activate(); return sessions.snapshot();
        });
        return json(response,200,{state});
      }
      if(request.method==='DELETE' && url.pathname.startsWith('/api/sessions/')){
        const state=await exclusive(async()=>{await sessions.delete(decodeURIComponent(url.pathname.slice('/api/sessions/'.length)));activate();return sessions.snapshot();});
        return json(response,200,{state});
      }
      if(request.method==='POST' && url.pathname==='/api/agents/profile'){
        const input=await body(request),id=input.provider;
        if(!Object.hasOwn(definitions,id))throw new Error('Provider tidak dikenal.');
        if(typeof input.name!=='string'||!input.name.trim()||input.name.length>64||/[\x00-\x1f]/.test(input.name))throw new Error('Nama bot harus berisi 1–64 karakter.');
        if(typeof input.role!=='string'||input.role.length>120)throw new Error('Peran maksimal 120 karakter.');
        if(typeof input.bio!=='string'||input.bio.length>2000)throw new Error('Profil maksimal 2000 karakter.');
        if(typeof input.avatar!=='string'||input.avatar.length>100000||(input.avatar&&!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(input.avatar)))throw new Error('Foto profil tidak valid.');
        await exclusive(async()=>{
          const selections=input.selection ? validateSelections({...brain.snapshot().selections,[id]:input.selection},catalog) : null;
          const profile={...agentProfiles[id],name:input.name.trim(),role:input.role.trim(),bio:input.bio.trim(),avatar:input.avatar};
          if(selections)await brain.saveSelections({...brain.snapshot().selections,[id]:selections[id]});
          await writeFile(join(dataDirectory,'agents.json.tmp'),JSON.stringify({...agentProfiles,[id]:profile},null,2));
          await rename(join(dataDirectory,'agents.json.tmp'),join(dataDirectory,'agents.json'));
          agentProfiles[id]=profile;room.changed(false);
        });
        return json(response,200,{state:sessions.snapshot()});
      }
      if(request.method==='POST' && url.pathname==='/api/web-agent/reply'){
        const input=await body(request);
        await mutate(()=>webBridge.submit({...input,sessionId:sessions.activeId}));
        return json(response,200,{accepted:true});
      }
      if(request.method==='GET' && url.pathname==='/api/web-agent/browser')return json(response,200,{browser:await deepseekBrowser.check()});
      if(request.method==='POST' && url.pathname==='/api/web-agent/browser/test'){
        if(!agentProfiles.deepseek?.enabled)throw new Error('Add DeepSeek to your team first.');
        if(room.run)throw new Error('Finish or stop the current discussion before testing the browser.');
        const controller=new AbortController();
        const cancel=()=>{if(!response.writableEnded)controller.abort();};response.on('close',cancel);
        try{
          const reply=await chromeBridge.run('Connection test. Reply with exactly: PITLANE_BROWSER_OK',{signal:controller.signal});
          return json(response,200,{success:reply.trim()==='PITLANE_BROWSER_OK',browser:chromeBridge.snapshot()});
        }finally{response.off('close',cancel);}
      }
      if(request.method==='POST' && url.pathname==='/api/web-agent/browser/close'){
        if(deepseekBrowser.job||deepseekBrowser.preparing)throw new Error('Stop the current DeepSeek message first.');
        await deepseekBrowser.close();return json(response,200,{browser:deepseekBrowser.snapshot()});
      }
      if(request.method==='POST' && url.pathname==='/api/web-agent/browser/open'){
        if(!agentProfiles.deepseek?.enabled)throw new Error('Add DeepSeek to your team first.');
        if(deepseekBrowser.job||deepseekBrowser.preparing)throw new Error('DeepSeek is handling a message. Stop it before opening its browser.');
        const browser=await deepseekBrowser.open();await checkAccount('deepseek');room.changed(false);
        return json(response,200,{browser,state:sessions.snapshot()});
      }
      if(request.method==='POST' && url.pathname==='/api/web-agent/connect'){
        const input=await body(request);
        if(typeof input.name!=='string'||!input.name.trim()||input.name.length>64)throw new Error('Nama agent maksimal 64 karakter.');
        if(input.role!==undefined&&(typeof input.role!=='string'||input.role.length>120))throw new Error('Peran maksimal 120 karakter.');
        await mutate(async()=>{
          const profile={...agentProfiles.deepseek,name:input.name.trim(),role:input.role?.trim()||'Rekan diskusi',enabled:true};
          await writeFile(join(dataDirectory,'agents.json.tmp'),JSON.stringify({...agentProfiles,deepseek:profile},null,2));
          await rename(join(dataDirectory,'agents.json.tmp'),join(dataDirectory,'agents.json'));
          agentProfiles.deepseek=profile;definitions.deepseek.installed=true;await checkAccount('deepseek');
          const project=sessions.projects.find(p=>p.id===sessions.entries.find(e=>e.id===sessions.activeId)?.projectId);
          if(project)project.agentIds=[...new Set([...project.agentIds,'deepseek'])];
          const entry=sessions.entries.find(e=>e.id===sessions.activeId);
          if(entry.agentIds)entry.agentIds=[...new Set([...entry.agentIds,'deepseek'])];
          await sessions.persist();room.changed(false);
        });
        return json(response,200,{state:sessions.snapshot()});
      }
      if(request.method==='POST' && url.pathname==='/api/agents'){
        const input=await body(request), id=input.provider;
        if(!Object.hasOwn(definitions,id))throw new Error('Provider tidak dikenal.');
        if(typeof input.name!=='string' || !input.name.trim() || input.name.length>64)throw new Error('Nama agent harus berisi 1–64 karakter.');
          if(input.role !== undefined && (typeof input.role !== 'string' || input.role.length>120))throw new Error('Peran agent maksimal 120 karakter.');
        const selections=validateSelections({...brain.snapshot().selections,[id]:{model:input.model || '',effort:input.effort || '',custom:true}},catalog);
        await exclusive(async()=>{
          await brain.saveSelections({...brain.snapshot().selections,...selections});
          agentProfiles[id]={...agentProfiles[id],name:input.name.trim(),role:input.role?.trim() || ''};
          await writeFile(join(dataDirectory,'agents.json.tmp'),JSON.stringify(agentProfiles,null,2));
          await rename(join(dataDirectory,'agents.json.tmp'),join(dataDirectory,'agents.json'));
          room.changed(false);
        });
        Object.assign(definitions,detectAgents());await checkAccount(id);
        return json(response,200,{state:sessions.snapshot()});
      }
      if (request.method === 'POST' && url.pathname === '/api/send') {
        const input = await body(request);
        const result = await mutate(() => room.send(input)); return json(response, 202, result);
      }
      if (request.method === 'POST' && url.pathname === '/api/stop') {
        await mutate(() => room.stop()); return json(response, 200, { stopped: true });
      }
      if(request.method==='POST' && url.pathname==='/api/reconnect'){
        const input=await body(request);
        if(!['codex','antigravity','claude'].includes(input.agent))return json(response,400,{error:'Provider tidak dikenal.'});
        Object.assign(definitions,detectAgents());
        quotas.invalidate(input.agent); room.invalidateAttendance();
        const account=await checkAccount(input.agent);
        if(account.connected)void checkQuota(input.agent,{force:true}).catch(()=>{});
        return json(response,200,{connected:account.connected,message:account.connected?'Akun CLI berhasil diperiksa.':account.error,state:sessions.snapshot()});
      }
      if(request.method==='POST' && url.pathname==='/api/models')return json(response,200,{catalog:await refreshModels()});
      if(request.method==='POST' && url.pathname==='/api/attendance'){
        const result=await mutate(()=>room.send({text:'Absen agent dan cek ingatan proyek dari Soul.',mode:'attendance'}));
        void Promise.allSettled(['codex','antigravity'].map(agent=>checkQuota(agent)));
        return json(response,202,result);
      }
      if(request.method==='POST' && url.pathname==='/api/quota'){
        const input=await body(request);
        return json(response,200,{quota:await checkQuota(input.agent,{force:input.force===true})});
      }
      if(request.method==='POST' && url.pathname==='/api/settings'){
        const input=await body(request);
        const saved=await mutate(()=>brain.saveSelections({...brain.snapshot().selections,...validateSelections(input.selections,catalog)}));room.invalidateAttendance();
        return json(response,200,{brain:saved});
      }
      if(request.method==='POST' && url.pathname==='/api/profile'){
        const input=await body(request);return json(response,200,{brain:await mutate(()=>brain.saveDisplayName(input.displayName,input.avatar))});
      }
      if(request.method==='POST' && url.pathname==='/api/project-memory'){
        const input=await body(request);
        const projectMemory=await mutate(async()=>{if(input.scopeId && input.scopeId!==sessions.memoryKey(sessions.activeId))throw new Error('Proyek sesi sudah berubah. Buka ulang editor Project Memory.');await sessions.memoryFor(sessions.activeId).saveSoul(input.content,input.revision);return sessions.memorySnapshot(sessions.activeId);});
        return json(response,200,{projectMemory});
      }
      if(request.method==='POST' && url.pathname==='/api/language'){
        const input=await body(request);
        await changeSoulLanguage(sessions.communication,input.language,{revision:input.revision,translate:cliSoulTranslator({definitions,cwd:base,accounts})});
        return json(response,200,{state:sessions.snapshot()});
      }
      if(request.method==='POST' && url.pathname==='/api/soul'){
        const input=await body(request);
        return json(response,200,{brain:await mutate(async()=>{await sessions.communication.saveSoul(input.content,input.revision);return sessions.snapshot().brain;})});
      }
      if(request.method==='POST' && url.pathname==='/api/pin'){
        const input=await body(request);
        return json(response,200,{projectMemory:await mutate(async()=>{await sessions.memoryFor(sessions.activeId).pin(room.messages.find(m=>m.id===input.messageId));return sessions.memorySnapshot(sessions.activeId);})});
      }
      if(request.method==='GET' && url.pathname==='/api/brain/export'){
        response.setHeader('Content-Disposition','attachment; filename="pitlane-memories.json"');
        return json(response,200,{soul:sessions.communication.snapshot().soul,projectMemory:sessions.memorySnapshot(sessions.activeId)});
      }
      if (request.method === 'GET' && url.pathname === '/api/export') {
        response.setHeader('Content-Disposition', 'attachment; filename="pitlane-chat.json"');
        return json(response, 200, { exportedAt: new Date().toISOString(), messages: room.messages, brain:sessions.snapshot().brain, projectMemory:sessions.memorySnapshot(sessions.activeId) });
      }
      return json(response, 404, { error: 'Endpoint tidak ditemukan.' });
    }
    if (['GET','HEAD'].includes(request.method) && ['/', '/index.html'].includes(url.pathname)) {
      response.writeHead(302, { Location: `http://127.0.0.1:${frontendPort}/`, 'Cache-Control':'no-store' });
      response.end(); return;
    }
    json(response, 404, { error: 'Tidak ditemukan.' });
  } catch (error) { if (!response.headersSent) json(response, 400, { error: error.message }); else response.end(); }
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} sedang dipakai. Room mungkin sudah berjalan: http://127.0.0.1:${port}` : error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => {
  console.log(`PITLANE ready: http://127.0.0.1:${server.address().port}`);
  if(process.env.ROOM_SKIP_CLI_CHECKS !== '1'){
    void Promise.allSettled(Object.keys(definitions).map(checkAccount));
    void refreshModels().catch(error=>console.error('Model refresh:',error.message));
  }
});
async function shutdown() { await room.stop(); chromeBridge.close(); appBridge.close(); await deepseekBrowser.close(); await room.save(); await sessions.persist(); for (const client of clients) client.end(); server.close(() => process.exit(0)); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
