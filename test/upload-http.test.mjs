import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

test('HTTP upload, authenticated preview and file-only send survive reload without cross-session reuse',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'pitlane-upload-http-'));
  const script=join(directory,'codex-fixture.mjs');
  // Fixture only: real visual recognition is covered separately by vision-smoke.mjs.
  await writeFile(script,"let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>input+=chunk);process.stdin.on('end',()=>console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:process.argv.includes('--image')?'Image bytes attached.':'Text only.'}})));\n");
  let child;
  const start=()=>new Promise((resolve,reject)=>{
    child=spawn(process.execPath,['server.mjs'],{cwd:process.cwd(),windowsHide:true,env:{...process.env,ROOM_DATA_DIR:directory,ROOM_PORT:'0',ROOM_SKIP_CLI_CHECKS:'1',ROOM_CODEX_SCRIPT:script},stdio:['ignore','pipe','pipe']});
    let output='',errors='';const timer=setTimeout(()=>reject(new Error('Startup timeout: '+errors)),10000);
    child.stderr.on('data',chunk=>errors+=chunk);
    child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/ready: (http:\/\/127.0.0.1:\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
    child.once('error',reject);
  });
  const stop=async()=>{if(!child||child.exitCode!==null)return;const done=new Promise(resolve=>child.once('exit',resolve));child.kill();await done;};
  t.after(async()=>{await stop();await rm(directory,{recursive:true,force:true});});
  let base=await start(),bootstrap=await(await fetch(base+'/api/bootstrap')).json();
  const headers=()=>({'X-Room-Token':bootstrap.token,'X-Room-Session':bootstrap.state.sessionId});
  const bytes=await sharp({create:{width:90,height:60,channels:3,background:'#ff4f28'}}).png().toBuffer();
  assert.equal((await fetch(base+'/api/attachments',{method:'POST',body:bytes})).status,403);
  let response=await fetch(base+'/api/attachments',{method:'POST',headers:{...headers(),'X-File-Name':'photo.png'},body:bytes});
  assert.equal(response.status,201);const {attachment}=await response.json();
  assert.equal(attachment.kind,'image');assert.equal(attachment.path,undefined);
  assert.equal((await fetch(base+'/api/attachments/'+attachment.id)).status,403);
  response=await fetch(base+'/api/attachments/'+attachment.id+'?token='+bootstrap.token);
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
  const send=()=>fetch(base+'/api/send',{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({text:'',attachmentIds:[attachment.id],mode:'codex',syncMemory:false})});
  response=await send();assert.equal(response.status,202);
  for(let i=0;i<50;i++){
    bootstrap=await(await fetch(base+'/api/bootstrap')).json();
    if(!bootstrap.state.run)break;
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert.equal(bootstrap.state.messages[0].attachments[0].id,attachment.id);
  assert.equal(bootstrap.state.messages.at(-1).text,'Image bytes attached.');
  await stop();base=await start();bootstrap=await(await fetch(base+'/api/bootstrap')).json();
  assert.equal(bootstrap.state.messages[0].attachments[0].id,attachment.id);
  assert.equal((await fetch(base+'/api/attachments/'+attachment.id+'?token='+bootstrap.token)).status,200);
  response=await fetch(base+'/api/sessions/new',{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({title:'Another session'})});
  const other=await response.json();bootstrap.state=other.state;
  response=await send();assert.equal(response.status,400);assert.match((await response.json()).error,/sesi lain/);
  response=await fetch(base+'/api/attachments',{method:'POST',headers:{...headers(),'X-Room-Session':'stale-session','X-File-Name':'photo.png'},body:bytes});
  assert.equal(response.status,400);assert.match((await response.json()).error,/Sesi aktif berubah/);
  response=await fetch(base+'/api/attachments',{method:'POST',headers:{...headers(),'X-File-Name':encodeURIComponent('../outside.txt')},body:'test'});
  assert.equal(response.status,400);
  response=await fetch(base+'/api/attachments',{method:'POST',headers:{...headers(),'X-File-Name':'fake.png'},body:'not a picture'});
  assert.equal(response.status,400);
  response=await fetch(base+'/api/web-agent/connect',{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({name:'DeepSeek Web',role:'Reviewer'})});
  assert.equal(response.status,200);
  const enabled=await response.json();const webAgent=enabled.state.agents.find(a=>a.id==='deepseek');
  assert.equal(webAgent.transport,'browser-web');assert.equal(webAgent.connection,'disconnected');
  assert.equal(enabled.state.webRequest,null);
  assert.equal((await fetch(base+'/api/web-agent/browser')).status,403);
  assert.equal((await fetch(base+'/api/web-agent/browser/open',{method:'POST'})).status,403);
  assert.equal((await fetch(base+'/api/web-agent/browser/test',{method:'POST'})).status,403);
  assert.equal((await fetch(base+'/api/web-agent/browser/close',{method:'POST'})).status,403);
  response=await fetch(base+'/api/web-agent/browser',{headers:headers()});assert.equal(response.status,200);
  const browser=(await response.json()).browser;assert.equal(browser.status,'closed');assert.equal(browser.connected,false);
  assert.deepEqual(Object.keys(browser).sort(),['checkedAt','connected','detail','status']);
  response=await fetch(base+'/api/web-agent/reply',{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({requestId:'stale-manual-request',text:'Cannot inject a browser reply'})});assert.equal(response.status,400);
  await stop();base=await start();bootstrap=await(await fetch(base+'/api/bootstrap')).json();
  assert.equal(bootstrap.state.agents.find(a=>a.id==='deepseek').name,'DeepSeek Web');

});
