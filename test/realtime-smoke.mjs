// Run after npm run build. Exercises the real Next.js production streaming route.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const directory=await mkdtemp(join(tmpdir(),'pitlane-realtime-'));
const children=[];
async function start(args,env,pattern){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,args,{cwd:process.cwd(),windowsHide:true,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});children.push(child);
    let output='';const timer=setTimeout(()=>reject(new Error('Startup timeout: '+output)),15000);
    const consume=chunk=>{output+=chunk;const match=output.match(pattern);if(match){clearTimeout(timer);resolve(match[1]);}};
    child.stdout.on('data',consume);child.stderr.on('data',consume);child.once('error',reject);
  });
}
const controller=new AbortController();
try{
  const fixture=join(directory,'reply.mjs');
  await writeFile(fixture,"process.stdin.resume();process.stdin.on('end',()=>setTimeout(()=>console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'REALTIME_REPLY_OK'}})),800));");
  const backend=await start(['server.mjs'],{ROOM_PORT:'0',ROOM_DATA_DIR:directory,ROOM_CODEX_SCRIPT:fixture,ROOM_SKIP_CLI_CHECKS:'1'},/ready: (http:\/\/127.0.0.1:\d+)/);
  const frontend=await start(['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','0'],{ROOM_BACKEND_PORT:new URL(backend).port},/Local:\s+(http:\/\/127.0.0.1:\d+)/);
  const bootstrap=await(await fetch(backend+'/api/bootstrap')).json();
  const started=Date.now();
  const stream=await fetch(frontend+'/api/events?token='+bootstrap.token,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(8000)])});
  assert.match(stream.headers.get('content-type'),/text\/event-stream/);
  assert.equal(stream.headers.get('content-encoding'),null);
  const reader=stream.body.getReader();const decoder=new TextDecoder();
  const initial=decoder.decode((await reader.read()).value);assert.match(initial,/session-default/);
  console.log('Initial event through Next.js in '+(Date.now()-started)+' ms');
  const sent=await fetch(backend+'/api/send',{method:'POST',headers:{'Content-Type':'application/json','X-Room-Token':bootstrap.token},body:JSON.stringify({text:'Test stream',mode:'codex',syncMemory:false})});
  assert.equal(sent.status,202);
  let received='',working=false;
  while(!received.includes('REALTIME_REPLY_OK')){
    const chunk=await reader.read();assert.equal(chunk.done,false);
    received+=decoder.decode(chunk.value,{stream:true});
    if(received.includes('"status":"streaming"'))working=true;
  }
  assert.ok(working,'Working status must arrive before final reply');
  console.log('PASS: working status and final reply arrived on the same open stream without refresh');
  controller.abort();await reader.cancel().catch(()=>{});
}finally{
  controller.abort();
  for(const child of children.reverse())if(child.exitCode===null){const done=new Promise(resolve=>child.once('exit',resolve));child.kill();await done;}
  await rm(directory,{recursive:true,force:true});
}
