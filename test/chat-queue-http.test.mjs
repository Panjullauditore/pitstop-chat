import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

test('chat queue holds five messages and dispatches edited entries in order after the current turn',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'pitstop-queue-http-'));
  const script=join(directory,'agent.mjs'),release=join(directory,'release');
  await writeFile(script,[
    "import {existsSync} from 'node:fs';",
    "import {setTimeout as delay} from 'node:timers/promises';",
    "process.stdin.resume();",
    "process.stdin.on('end',async()=>{",
    "  while(!existsSync(process.env.QUEUE_TEST_RELEASE))await delay(10);",
    "  console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Ready'}}));",
    "});",
  ].join('\n'));
  const child=spawn(process.execPath,['server.mjs'],{
    windowsHide:true,stdio:['ignore','pipe','pipe'],
    env:{...process.env,ROOM_DATA_DIR:directory,ROOM_PORT:'0',ROOM_SKIP_CLI_CHECKS:'1',ROOM_CODEX_SCRIPT:script,QUEUE_TEST_RELEASE:release},
  });
  t.after(async()=>{
    await writeFile(release,'ready');
    if(child.exitCode===null&&child.signalCode===null){const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited;}
    assert.ok(directory.startsWith(join(tmpdir(),'pitstop-queue-http-')));
    await rm(directory,{recursive:true,force:true});
  });
  const base=await new Promise((resolve,reject)=>{
    let output='';
    const timeout=setTimeout(()=>reject(new Error(output)),10000);
    const collect=chunk=>{
      output+=chunk;
      const ready=output.match(/ready: (http:\/\/127\.0\.0\.1:\d+)/);
      if(ready){clearTimeout(timeout);resolve(ready[1]);}
    };
    child.stdout.on('data',collect);child.stderr.on('data',collect);child.once('error',reject);
  });
  const bootstrap=()=>fetch(base+'/api/bootstrap').then(res=>res.json());
  const {token,state:{sessionId}}=await bootstrap();
  const request=async(path,input)=>{
    const res=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','X-Room-Token':token,'X-Room-Session':sessionId},body:JSON.stringify({sessionId,...input})});
    return {status:res.status,data:await res.json()};
  };
  const waitFor=async predicate=>{
    for(let attempt=0;attempt<160;attempt++){
      const {state}=await bootstrap();
      if(predicate(state))return state;
      await delay(25);
    }
    assert.fail('Queue did not reach the expected state');
  };
  const send=text=>request('/api/send',{text,mode:'codex',syncMemory:false});
  const first=await send('Active turn');
  assert.ok(first.data.runId);
  const queued=[];
  for(let i=1;i<=5;i++){
    const {status,data}=await send('Queue '+i);
    assert.equal(status,202);assert.ok(data.queuedId);queued.push(data.queuedId);
  }
  assert.equal((await send('Sixth waiting message')).status,400);
  assert.equal((await bootstrap()).state.run.id,first.data.runId);
  assert.equal((await request('/api/chat-queue',{id:queued[0],action:'hold'})).status,200);
  assert.equal((await request('/api/chat-queue',{id:queued[1],action:'cancel'})).status,200);
  await writeFile(release,'ready');
  const paused=await waitFor(state=>!state.run&&state.chatQueue[0]?.held);
  assert.deepEqual(paused.messages.filter(m=>m.role==='user').map(m=>m.text),['Active turn']);
  assert.equal((await request('/api/chat-queue',{id:queued[0],action:'edit',text:'Edited first'})).status,200);
  const finished=await waitFor(state=>!state.run&&!state.chatQueue.length);
  assert.deepEqual(finished.messages.filter(m=>m.role==='user').map(m=>m.text),['Active turn','Edited first','Queue 3','Queue 4','Queue 5']);
});
