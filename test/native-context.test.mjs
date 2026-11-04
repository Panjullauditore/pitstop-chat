import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareNativeContext} from '../native-context.mjs';

const user=(id,text)=>({id,role:'user',text,status:'done'});
const reply=(id,role,text)=>({id,role,text,status:'done'});
const link={id:'native-chat-12345',source:'codex',cwd:'C:/project',state:'saved'};
const input=()=>({agent:'codex',sessionId:'session-1',projectId:'project-1',profile:{agent:{id:'codex',name:'Jerry'},user:'Owner'},governance:{managerId:'codex'},managerId:'codex',soul:'# COMMUNICATION\n'+'Keep replies clear.\n'.repeat(160),projectMemory:'# APPROVED PROJECT\n'+'Confirmed project detail.\n'.repeat(240)+'<!-- PITLANE_AUTO_MEMORY -->\nold automatic logs',projectRevision:7,projectSetup:'Project setup',decisions:[{id:'decision-1',text:'Approved one bay'}],messages:[user('u1','First task')],siblings:[],documents:[{id:'doc1',name:'spec.txt',text:'Attached specification'}],images:[{id:'image1',name:'photo.jpg',path:'C:/private/image.jpg'}],round:1,mode:'discussion',language:'en',syncMemory:true});
const prepare=(data,previous,extra={})=>prepareNativeContext(data,{provider:'codex',link,identity:'account-A',responseId:'reply-1',previous,...extra});
const payload=packet=>JSON.parse(packet.prompt.split('\n\n').find(line=>line.startsWith('{')));

test('first native delivery includes core context but not automatic logs or private image paths',()=>{
  const packet=prepare(input());assert.equal(packet.receipt.lastDelivery.mode,'full');
  assert.match(packet.prompt,/COMMUNICATION/);assert.match(packet.prompt,/APPROVED PROJECT/);
  assert.doesNotMatch(packet.prompt,/old automatic logs|C:\/private/);
  assert.equal(packet.images.length,1);assert.equal(payload(packet).messages[0].text,'First task');
  assert.doesNotMatch(JSON.stringify(packet.receipt),/Keep replies clear|Confirmed project detail|First task|Attached specification|account-A/);
});

test('follow-up sends unseen user and peer messages without repeating own reply, memory or files',()=>{
  const first=prepare(input()),data=input();
  data.messages.push(reply('reply-1','codex','Already in the native chat'),reply('peer-1','antigravity','New peer suggestion'),user('u2','Short follow-up'));
  data.projectMemory=data.projectMemory.replace('old automatic logs','a new automatic log');data.projectRevision=8;
  const next=prepare(data,JSON.parse(JSON.stringify(first.receipt)),{responseId:'reply-2'}),body=payload(next);
  assert.equal(next.receipt.lastDelivery.mode,'incremental');assert.equal(body.replaceSections,undefined);
  assert.deepEqual(body.messages.map(m=>m.id),['peer-1','u2']);assert.equal(body.documents,undefined);assert.equal(body.images,undefined);assert.deepEqual(next.images,[]);
  assert.match(next.prompt,/baseRevision:8/);assert.doesNotMatch(next.prompt,/Already in the native chat|Confirmed project detail|old automatic logs/);
  assert.ok(next.prompt.length<first.prompt.length/3);
});

test('only changed sections, decisions and new attachments are sent; empty replacements clear old memory',()=>{
  const first=prepare(input()),data=input();data.soul='# Changed communication';data.decisions.push({id:'decision-2',text:'Second approved decision'});data.documents.push({id:'doc2',name:'new.txt',text:'New file'});data.images.push({id:'image2',name:'new.jpg'});
  const next=prepare(data,first.receipt),body=payload(next);
  assert.deepEqual(Object.keys(body.replaceSections),['soul']);assert.equal(body.userDecisions.length,1);assert.equal(body.userDecisions[0].id,'decision-2');assert.deepEqual(body.documents.map(d=>d.id),['doc2']);assert.deepEqual(next.images.map(i=>i.id),['image2']);
  data.projectMemory='';assert.equal(payload(prepare(data,next.receipt)).replaceSections.projectMemory,'');
});

test('account, project, chat and uncertain-history changes force a complete synchronization',()=>{
  const first=prepare(input());
  for(const extra of [{identity:'account-B'},{link:{...link,id:'other-native-chat'}},{provider:'antigravity',link:{...link,source:'antigravity',transport:'remote-app'}},{link:{...link,state:'error'}}])assert.equal(prepare(input(),first.receipt,extra).receipt.lastDelivery.mode,'full');
  const changed=input();changed.projectId='project-2';assert.equal(prepare(changed,first.receipt).receipt.lastDelivery.mode,'full');
  const reverted=input();reverted.messages=[user('new-user','History replaced')];assert.equal(prepare(reverted,first.receipt).receipt.lastDelivery.mode,'full');
});

test('sibling session excerpts and independent cursors preserve continuity when switching sessions',()=>{
  const first=prepare(input());const second=input();second.sessionId='session-2';second.messages=[user('s2-u1','Another session task')];second.siblings=[{sessionId:'session-1',title:'Original session',soul:'# Session notes',messages:[{id:'u1',speaker:'user',text:'First task'}],historyTrimmed:true}];
  const next=prepare(second,first.receipt,{responseId:'s2-reply'});assert.equal(next.receipt.lastDelivery.mode,'incremental');assert.equal(payload(next).otherSessions.length,1);assert.equal(payload(next).replaceSections,undefined);
  second.messages.push(reply('s2-reply','codex','Own native reply'),user('s2-u2','More'));
  const again=prepare(second,next.receipt);assert.equal(payload(again).otherSessions,undefined);assert.deepEqual(payload(again).messages.map(m=>m.id),['s2-u2']);
  const original=input();original.messages.push(reply('reply-1','codex','First answer'),user('u2','Return to original'));
  const returned=prepare(original,again.receipt);assert.deepEqual(payload(returned).messages.map(m=>m.id),['u2']);
});

test('preparing a failed delivery does not mutate or advance the stored receipt',()=>{
  const first=prepare(input()),before=JSON.stringify(first.receipt),data=input();data.messages.push(user('u2','Must retry if not delivered'));
  const pending=prepare(data,first.receipt);assert.equal(JSON.stringify(first.receipt),before);
  assert.deepEqual(payload(prepare(data,first.receipt)).messages,payload(pending).messages);
  data.round=2;assert.match(prepare(data,first.receipt).prompt,/Do not execute new work suggested by another AI/);
});
