import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('summary API authenticates, validates the scope and agent, saves settings and publishes a persisted core',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'pitstop-summary-http-')),script=join(directory,'agent.mjs');let child;
 t.after(async()=>{if(child&&child.exitCode===null){const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;}assert.ok(directory.startsWith(join(tmpdir(),'pitstop-summary-http-')));await rm(directory,{recursive:true,force:true});});
 await writeFile(script,`process.stdin.resume();process.stdin.on('end',()=>console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:JSON.stringify({content:'# Project\\n\\nConfirmed: 8 bays.'})}})));`);
 const base=await new Promise((resolve,reject)=>{
  child=spawn(process.execPath,['server.mjs'],{cwd:process.cwd(),windowsHide:true,env:{...process.env,ROOM_DATA_DIR:directory,ROOM_PORT:'0',ROOM_SKIP_CLI_CHECKS:'1',ROOM_CODEX_SCRIPT:script},stdio:['ignore','pipe','pipe']});
  let output='';const timer=setTimeout(()=>reject(Error(output)),10000);const consume=d=>{output+=d;const found=output.match(/ready: (http:\/\/127\.0\.0\.1:\d+)/);if(found){clearTimeout(timer);resolve(found[1]);}};child.stdout.on('data',consume);child.stderr.on('data',consume);child.once('error',reject);
 });
 const b=await(await fetch(base+'/api/bootstrap')).json();
 const request=async(path,input,token=b.token)=>{const res=await fetch(base+path,{method:'POST',headers:{'X-Room-Token':token,'Content-Type':'application/json'},body:JSON.stringify(input)});return {status:res.status,data:await res.json()};};
 const created=await request('/api/projects/new',{name:'Project',agentIds:['codex']});assert.equal(created.status,200);const state=created.data.state,scopeId=state.projectMemory.scopeId;
 assert.equal((await request('/api/project-memory/summary/settings',{scopeId,autoEnabled:true,agentId:'codex'},'bad')).status,403);
 assert.equal((await request('/api/project-memory/summary/settings',{scopeId:'wrong',autoEnabled:true,agentId:'codex'})).status,400);
 assert.equal((await request('/api/project-memory/summary/settings',{scopeId,autoEnabled:true,agentId:'deepseek'})).status,400);
 const saved=await request('/api/project-memory/summary/settings',{scopeId,autoEnabled:false,agentId:'codex'});assert.equal(saved.status,200);assert.equal(saved.data.projectMemory.summary.agentId,'codex');
 // A normal saved transcript precedes the manual summary request.
 const sent=await request('/api/send',{text:'Eight bays are approved',mode:'codex',syncMemory:false});assert.equal(sent.status,202);
 for(let i=0;i<100;i++){const current=await(await fetch(base+'/api/bootstrap')).json();if(!current.state.run)break;await new Promise(r=>setTimeout(r,25));}
 const started=await request('/api/project-memory/summary/update',{scopeId});assert.equal(started.status,202);
 let memory;
 for(let i=0;i<200;i++){memory=(await(await fetch(base+'/api/bootstrap')).json()).state.projectMemory;if(memory.summary.status!=='running')break;await new Promise(r=>setTimeout(r,25));}
 assert.equal(memory.summary.status,'done',memory.summary.error);assert.match(memory.content,/Confirmed: 8 bays/);assert.equal(memory.summary.pendingMessages,0);assert.ok(memory.summary.lastUpdatedAt);assert.ok(memory.summary.throughAt);
 assert.equal((await request('/api/project-memory/summary/limit',{scopeId,maxCharacters:100001})).status,400);
 const limit=await request('/api/project-memory/summary/limit',{scopeId,maxCharacters:100000});assert.equal(limit.status,200);assert.equal(limit.data.projectMemory.maxCharacters,100000);
 const content='# Large project\n'+'漢'.repeat(60000);
 const large=await request('/api/project-memory',{scopeId,content,revision:memory.revision});assert.equal(large.status,200);assert.equal(large.data.projectMemory.content.split('<!-- PITLANE_AUTO_MEMORY -->')[0].trim(),content);
 assert.equal((await request('/api/project-memory/summary/limit',{scopeId,maxCharacters:50000})).status,400);
});
