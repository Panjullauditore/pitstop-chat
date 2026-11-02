import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { AttachmentStore, MAX_FILE_BYTES } from '../attachments.mjs';
import { SessionStore } from '../sessions.mjs';
import { buildAgentArgs, buildAgentInput } from '../adapters.mjs';

async function fixture(t) {
  const directory=await mkdtemp(join(tmpdir(),'pitlane-attachments-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  return {directory,store:new AttachmentStore(directory)};
}
async function image() { return sharp({create:{width:120,height:80,channels:3,background:'#06b6d4'}}).png().toBuffer(); }

test('uploads verify image bytes, retain original, normalize vision and persist across restart',async t=>{
  const {store,directory}=await fixture(t),bytes=await image();
  const photo=await store.create({name:'foto.png',bytes,sessionId:'session-default'});
  assert.equal(photo.kind,'image');assert.equal(photo.mimeType,'image/png');
  assert.equal(photo.path,undefined);assert.equal(photo.text,undefined);
  const restored=new AttachmentStore(directory);
  assert.deepEqual((await restored.original(photo.id)).bytes,bytes);
  const input=await restored.input([photo],'session-default');
  assert.equal(input.images[0].mimeType,'image/jpeg');
  assert.equal((await sharp(await readFile(input.images[0].path)).metadata()).format,'jpeg');
  await assert.rejects(store.create({name:'fake.png',bytes:Buffer.from('not an image'),sessionId:'session-default'}));
});

test('upload validation rejects path traversal, binary content, oversized files and cross-session IDs',async t=>{
  const {store}=await fixture(t);
  for(const name of ['../secret.txt','C:\\private.txt','bad\u0000.txt'])await assert.rejects(store.create({name,bytes:Buffer.from('test'),sessionId:'one'}),/Nama file/);
  await assert.rejects(store.create({name:'huge.txt',bytes:Buffer.alloc(MAX_FILE_BYTES+1),sessionId:'one'}),/10 MB/);
  await assert.rejects(store.create({name:'binary.txt',bytes:Buffer.from([0,1,2]),sessionId:'one'}),/biner/);
  await assert.rejects(store.create({name:'run.exe',bytes:Buffer.from('MZ'),sessionId:'one'}),/belum didukung/);
  await assert.rejects(store.get('../../outside'),/ID lampiran/);
  const file=await store.create({name:'brief.md',bytes:Buffer.from('private brief'),sessionId:'one'});
  await assert.rejects(store.resolve([file.id],'two'),/sesi lain/);
  await assert.rejects(store.resolve([file.id,file.id],'one'),/berbeda/);
  await assert.rejects(store.resolve(Array(6).fill(file.id),'one'),/5 lampiran/);
});

test('document text is actually extracted, bounded and marked when shortened',async t=>{
  const {store}=await fixture(t);
  const text=await store.create({name:'large.txt',bytes:Buffer.from('decision-'.repeat(4000)),sessionId:'one'});
  assert.equal(text.truncated,true);assert.match(text.notice,/24.000/);
  const input=await store.input([text],'one');
  assert.equal(input.documents[0].text.length,24000);
  // Minimal one-page PDF with embedded text; no network fixtures.
  const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n5 0 obj\n<< /Length 54 >>\nstream\nBT /F1 12 Tf 10 150 Td (PITLANE PDF DECISION) Tj ET\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
  const file=await store.create({name:'brief.pdf',bytes:pdf,sessionId:'one'});
  assert.match((await store.input([file],'one')).documents[0].text,/PITLANE PDF DECISION/);
  const {default:JSZip}=await import('jszip');
  const zip=new JSZip();
  zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>PITLANE WORD DECISION</w:t></w:r></w:p></w:body></w:document>');
  const word=await store.create({name:'brief.docx',bytes:await zip.generateAsync({type:'nodebuffer'}),sessionId:'one'});
  assert.match((await store.input([word],'one')).documents[0].text,/PITLANE WORD DECISION/);
});

test('each participant receives actual image files and document content, including follow-ups and reload',async t=>{
  const {store,directory}=await fixture(t),calls=[];
  const options={directory,attachments:store,seed:'# Project',agents:{codex:{id:'codex',name:'Codex',installed:true},antigravity:{id:'antigravity',name:'Antigravity',installed:true}},runner:async(agent,prompt,input)=>{calls.push({agent,prompt,input});return 'Image received.';}};
  const sessions=new SessionStore(options);await sessions.load();
  const photo=await store.create({name:'foto.png',bytes:await image(),sessionId:sessions.activeId});
  const file=await store.create({name:'brief.md',bytes:Buffer.from('Use three service bays.'),sessionId:sessions.activeId});
  await sessions.room.send({text:'',attachmentIds:[photo.id,file.id],mode:'both'});await sessions.room.run.done;
  assert.equal(calls.length,2);
  for(const call of calls){assert.equal(call.input.images.length,1);assert.match(call.prompt,/Use three service bays/);await readFile(call.input.images[0].path);}
  const copy=new SessionStore(options);await copy.load();
  assert.equal(copy.room.messages[0].attachments[0].id,photo.id);
  await copy.room.send({text:'What color was the image?',mode:'codex'});await copy.room.run.done;
  assert.equal(calls.at(-1).input.images[0].id,photo.id);
  const other=await copy.create({title:'Another chat'});
  await assert.rejects(copy.room.send({text:'cross scope',attachmentIds:[photo.id],mode:'codex'}),/sesi lain/);
  assert.equal(copy.room.messages.length,0);
});

test('CLI image transports send pixels or explicit view_file paths instead of filenames alone',async t=>{
  const {directory}=await fixture(t),path=join(directory,'photo.jpg'),bytes=await image();await writeFile(path,bytes);
  const images=[{name:'original photo.png',path,mimeType:'image/png'}];
  const codex=buildAgentArgs('codex',{script:'codex.js'},{},images);
  assert.equal(codex[codex.indexOf('--image')+1],path);assert.equal(codex.at(-1),'-');
  const claudeArgs=buildAgentArgs('claude',{}, {},images);assert.ok(claudeArgs.includes('--input-format'));
  const claude=JSON.parse(await buildAgentInput('claude','Review',images));
  assert.equal(claude.message.content.at(-1).source.data,bytes.toString('base64'));
  assert.equal(claude.message.content.at(-1).source.media_type,'image/png');
  const agy=JSON.parse(await buildAgentInput('antigravity','Review',images));
  assert.match(agy.message.content,/WAJIB gunakan tool view_file/);assert.ok(agy.message.content.includes(JSON.stringify(path)));
});
