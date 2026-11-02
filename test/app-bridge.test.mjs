import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {NativeAppBridge,appRemoteUrl} from '../app-bridge.mjs';
import {ExtensionBridge} from '../extension-bridge.mjs';
const chatId='750bdd34-f65f-4726-ba1a-fc28b8873235',device='https://antigravity.google.com/r/9d397d65-3b94-4b82-9da1-0ae1058edc18-v2';
const link={id:chatId,title:'Native App chat',source:'antigravity',transport:'remote-app',remoteUrl:device};
async function setup(t,options={}){
  const directory=await mkdtemp(join(tmpdir(),'pitlane-app-bridge-'));let reads=0;
  const bridge=new NativeAppBridge({directory,extensionId:'extension-fixture',verify:async()=>({stepCount:++reads,lastIndex:reads,hasInput:true}),...options});await bridge.load();
  t.after(async()=>{bridge.close();assert.ok(directory.startsWith(join(tmpdir(),'pitlane-app-bridge-')));await rm(directory,{recursive:true,force:true});});
  const {token}=await bridge.pair(bridge.issueCode().code);bridge.poll({ready:true,targets:[device]});return {bridge,token,directory};
}
async function claim(bridge,prompt='Native task',options={}){const answer=bridge.run(link,prompt,options);await new Promise(done=>setTimeout(done,0));const {job}=bridge.poll({ready:true,targets:[device]});assert.ok(job);return {answer,job};}
test('Remote Control URLs are limited to the selected native conversation and official device host',()=>{
  assert.equal(new URL(appRemoteUrl(device,chatId)).searchParams.get('p'),'c/'+chatId);
  assert.throws(()=>appRemoteUrl('https://evil.example/r/device',chatId),/official/);
  assert.throws(()=>appRemoteUrl(device+'?p=c%2Fother-chat',chatId),/different conversation/);
  assert.throws(()=>appRemoteUrl(device+'#token',chatId),/official/);
});
test('App bridge confirms the exact submitted request, streams and verifies the original native history',async t=>{
  const {bridge}=await setup(t),deltas=[],{answer,job}=await claim(bridge,'Work requested by user',{onDelta:text=>deltas.push(text)});
  assert.equal(job.chatId,chatId);assert.equal(JSON.parse(job.prompt).requestMarker,'[Pitlane request: '+job.id+']');assert.equal(JSON.parse(job.prompt).contextAndTask,'Work requested by user');assert.equal(job.images.length,0);
  bridge.event({requestId:job.id,chatId,kind:'sent'});bridge.event({requestId:job.id,chatId,kind:'text',text:'Streaming'});bridge.event({requestId:job.id,chatId,kind:'done',text:'Native final answer'});
  const result=await answer;assert.equal(result.nativeChat.id,chatId);assert.equal(result.nativeChat.history,'saved');assert.deepEqual(deltas,['Streaming','Native final answer']);assert.equal(bridge.job,null);
});
test('An old answer, wrong conversation, or missing native history cannot masquerade as success',async t=>{
  for(const mode of ['not-sent','wrong-chat','not-written']){
    const {bridge}=await setup(t,mode==='not-written'?{verify:async()=>({stepCount:1,lastIndex:0,hasInput:false})}:{});
    const {answer,job}=await claim(bridge);const rejected=assert.rejects(answer,mode==='not-written'?/original App history/:/conversation|confirmed/);
    if(mode==='not-written'){bridge.event({requestId:job.id,chatId,kind:'sent'});bridge.event({requestId:job.id,chatId,kind:'done',text:'Unverified'});}
    else assert.throws(()=>bridge.event({requestId:job.id,chatId:mode==='wrong-chat'?'wrong':chatId,kind:'done',text:'Old answer'}));
    await rejected;
  }
});
test('App pairing is separate from DeepSeek and cannot authorize the other service',async t=>{
  const {bridge,token,directory}=await setup(t),deepseek=new ExtensionBridge({directory,extensionId:'extension-fixture'});t.after(()=>deepseek.close());await deepseek.load();
  assert.equal(bridge.authorize(token),true);assert.equal(deepseek.authorize(token),false);assert.equal(deepseek.snapshot().paired,false);
  const grant=await readFile(join(directory,'antigravity-app-bridge.json'),'utf8');assert.ok(!grant.includes(token));await assert.rejects(bridge.pair('bad-code'),/invalid or expired/);
});
test('Stop cancels only the claimed App job; lost workers fail instead of replaying it',async t=>{
  const {bridge}=await setup(t),controller=new AbortController(),{answer,job}=await claim(bridge,'Task',{signal:controller.signal});controller.abort();await assert.rejects(answer,{name:'AbortError'});
  assert.equal(bridge.poll({ready:true,targets:[device],activeJobId:job.id}).cancel,job.id);
  const next=await claim(bridge);const rejected=assert.rejects(next.answer,/lost its active request/);bridge.poll({ready:true,targets:[device],activeJobId:null});await rejected;assert.equal(bridge.job,null);
});

test('A disconnected native App view fails within its grace period instead of leaving a loading chat',async t=>{
  let now=1000;const {bridge}=await setup(t,{now:()=>now});const {answer,job}=await claim(bridge);const rejected=assert.rejects(answer,/disconnected during this task/);
  now+=16000;bridge.poll({ready:false,targets:[],activeJobId:job.id});await rejected;assert.equal(bridge.job,null);
});
test('Remote Control must be ready for the selected device, and attachment IDs remain scoped to that job',async t=>{
  const {bridge}=await setup(t);
  await assert.rejects(bridge.run({...link,remoteUrl:device.replace('9d397d65','1d397d65')},'Task'),/selected device/);
  const {answer,job}=await claim(bridge,'Task',{images:[{id:'uploaded-image',name:'Photo',path:'/fixture/photo.jpg'}]});const rejected=assert.rejects(answer,/fixture done/);
  assert.equal(bridge.image(job.id,'uploaded-image').name,'Photo');assert.throws(()=>bridge.image(job.id,'other-image'),/belong/);assert.throws(()=>bridge.image('other-job','uploaded-image'),/expired/);
  assert.throws(()=>bridge.event({requestId:job.id,chatId,kind:'error',message:'fixture done'}));await rejected;
});
