import { EventEmitter } from 'node:events';
import { readFile, writeFile, rename, mkdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { composeSoul, stripAutomaticMemory, COMMUNICATION_POLICY, POLICY_MARKER } from './protocol.mjs';
import {soulWithLanguage} from './src/lib/language.mjs';

export class Brain extends EventEmitter {
  constructor(directory,seed,{documentPath,communicationPolicy=true,automaticMemory=true,languageDocument=false}={}) {
    super(); this.directory=directory; this.seed=seed; this.documentPath=documentPath; this.languageDocument=languageDocument; this.communicationPolicy=communicationPolicy; this.automaticMemory=automaticMemory; this.queue=Promise.resolve();
    const core=stripAutomaticMemory(seed);
    this.value={schema:1,preferences:{displayName:'Username'},soul:{content:core+(!communicationPolicy || core.includes(POLICY_MARKER)?'':'\n\n'+COMMUNICATION_POLICY),revision:1,updatedAt:new Date().toISOString()},auto:{userNotes:[],updates:[]},selections:{codex:{model:'',effort:''},antigravity:{model:'',effort:''}}};
  }
  async load() {
    await mkdir(this.directory,{recursive:true});
    try {
      const data=JSON.parse(await readFile(join(this.directory,'brain.json'),'utf8'));
      if(data.schema!==1 || typeof data.soul?.content!=='string' || !Number.isInteger(data.soul.revision) || !data.selections)throw new Error('Format Soul tidak valid; data asli tidak ditimpa.');
      this.value=data;
    }catch(error){if(error.code!=='ENOENT')throw error;await this.commit(this.value,false);}
    if(!this.value.auto)this.value.auto={userNotes:[],updates:[]};
    if(!this.value.preferences)this.value.preferences={displayName:'Username'};
    if(this.communicationPolicy && !this.value.soul.content.includes(POLICY_MARKER)){
      const next=structuredClone(this.value);next.soul.content+='\n\n'+COMMUNICATION_POLICY;
      next.soul.revision++;next.soul.updatedAt=new Date().toISOString();await this.commit(next);
    }else await this.mirror();
  }
  snapshot(){const state=structuredClone(this.value);state.soul.content=this.automaticMemory ? composeSoul(state) : state.soul.content;return state;}
  enqueue(action){const op=this.queue.then(action);this.queue=op.catch(()=>{});return op;}
  async commit(next,backup=true){
    if(backup)await appendFile(join(this.directory,'brain-history.jsonl'),JSON.stringify(this.value)+'\n','utf8');
    await writeFile(join(this.directory,'brain.json.tmp'),JSON.stringify(next,null,2),'utf8');
    await rename(join(this.directory,'brain.json.tmp'),join(this.directory,'brain.json'));
    this.value=next;
    await this.mirror();
    this.emit('change',this.snapshot());return this.snapshot();
  }
  async mirror(){
    if(!this.documentPath)return;
    const content=this.automaticMemory?composeSoul(this.value):this.value.soul.content;
    await writeFile(this.documentPath+'.tmp',this.languageDocument?soulWithLanguage(content,this.value.preferences?.language || 'en'):content,'utf8');await rename(this.documentPath+'.tmp',this.documentPath);
  }
  saveSoul(content,revision){return this.enqueue(async()=>{
    if(typeof content!=='string')throw new Error('Soul harus berupa teks.');
    content=stripAutomaticMemory(content);
    if(this.communicationPolicy && content && !content.includes(POLICY_MARKER))content+='\n\n'+COMMUNICATION_POLICY;
    if(!content.trim() || content.length>18000)throw new Error('Bagian inti Soul harus berisi 1–18000 karakter.');
    if(revision!==this.value.soul.revision)throw new Error('Soul sudah berubah di jendela lain. Tutup lalu buka editor untuk memuat versi terbaru.');
    const next=structuredClone(this.value);next.soul={...next.soul,content:content.trim(),revision:revision+1,updatedAt:new Date().toISOString()};
    return this.commit(next);
  });}
  pin(message){return this.enqueue(async()=>{
    if(!message || message.status!=='done' || !message.text?.trim())throw new Error('Hanya pesan yang sudah selesai bisa disimpan ke Soul.');
    const next=structuredClone(this.value);
    if(next.soul.pinnedIds?.includes(message.id))throw new Error('Pesan ini sudah tersimpan ke Soul.');
    const content=next.soul.content+'\n\n### Catatan dipilih user — '+new Date().toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta'})+'\nSumber: '+message.role+'; disimpan user dari room.\n'+message.text;
    if(content.length>18000)throw new Error('Soul penuh. Ringkas catatan lewat editor sebelum menambahkan keputusan.');
    next.soul={...next.soul,content,revision:next.soul.revision+1,updatedAt:new Date().toISOString(),pinnedIds:[...(next.soul.pinnedIds || []),message.id]};
    return this.commit(next);
  });}
  saveSelections(selections){return this.enqueue(async()=>{const next=structuredClone(this.value);next.selections=structuredClone(selections);return this.commit(next);});}
  saveLanguage(language){return this.enqueue(async()=>{
    if(!['en','id'].includes(language))throw new Error('Choose English or Indonesian.');
    const next=structuredClone(this.value);next.preferences={...next.preferences,language};return this.commit(next);
  });}
  saveDisplayName(displayName, avatar){return this.enqueue(async()=>{
    if(typeof displayName!=='string' || /[\u0000-\u001f\u007f]/.test(displayName))throw new Error('Nama tidak valid.');
    const name=displayName.trim().replace(/\s+/g,' ');
    if(!name || Array.from(name).length>32)throw new Error('Nama harus berisi 1–32 karakter.');
    if(avatar!==undefined && (typeof avatar!=='string' || avatar.length>100000 || (avatar && !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(avatar))))throw new Error('Foto profil tidak valid.');
    const next=structuredClone(this.value);next.preferences={...next.preferences,displayName:name,...(avatar!==undefined?{avatar}: {})};return this.commit(next);
  });}
  recordDecision(decision){return this.enqueue(async()=>{
    if(this.value.auto?.gmDecisions?.some(item=>item.id===decision.id))return this.snapshot();
    const next=structuredClone(this.value);next.auto ||= {userNotes:[],updates:[]};
    next.auto.gmDecisions=[...(next.auto.gmDecisions || []),structuredClone(decision)];
    next.soul.revision++;next.soul.updatedAt=new Date().toISOString();return this.commit(next);
  });}
  recordUser(message){return this.enqueue(async()=>{
    if(this.value.auto?.userNotes?.some(note=>note.id===message.id))return this.snapshot();
    const next=structuredClone(this.value);next.auto ||= {userNotes:[],updates:[]};
    next.auto.userNotes=[...(next.auto.userNotes || []),{id:message.id,text:message.text.slice(0,600),at:message.at}].slice(-6);
    next.soul.revision++;next.soul.updatedAt=new Date().toISOString();return this.commit(next);
  });}
  recordCheckpoint(message,control){return this.enqueue(async()=>{
    if(!control || (!control.summary && !control.next && !control.reportedProgress))return this.snapshot();
    if(this.value.auto?.updates?.some(item=>item.id===message.id))return this.snapshot();
    const next=structuredClone(this.value);next.auto ||= {userNotes:[],updates:[]};
    next.auto.updates=[...(next.auto.updates || []),{id:message.id,agent:message.role,at:message.at,summary:control.summary,next:control.next,reportedProgress:control.reportedProgress}].slice(-6);
    next.soul.revision++;next.soul.updatedAt=new Date().toISOString();return this.commit(next);
  });}
}
