import { EventEmitter } from 'node:events';
import { readFile, writeFile, rename, mkdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { composeSoul, stripAutomaticMemory, COMMUNICATION_POLICY, POLICY_MARKER } from './protocol.mjs';
import {soulWithLanguage} from './src/lib/language.mjs';
import {archiveExpired} from './memory-retention.mjs';
import {DEFAULT_MEMORY_CHARACTERS,memoryCharacterLimit,validMemoryLimit} from './src/lib/memory-limits.mjs';

export class Brain extends EventEmitter {
  constructor(directory,seed,{documentPath,communicationPolicy=true,automaticMemory=true,languageDocument=false,projectMemory=false}={}) {
    super(); this.directory=directory; this.seed=seed; this.documentPath=documentPath; this.languageDocument=languageDocument; this.communicationPolicy=communicationPolicy; this.automaticMemory=automaticMemory; this.projectMemory=projectMemory; this.queue=Promise.resolve();
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
  characterLimit(){return this.projectMemory?memoryCharacterLimit(this.value.summarySettings):DEFAULT_MEMORY_CHARACTERS;}
  snapshot(){const state=structuredClone(this.value);if(this.projectMemory)state.soul.maxCharacters=this.characterLimit();state.soul.content=this.automaticMemory ? composeSoul(state) : state.soul.content;return state;}
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
    if(!content.trim() || content.length>this.characterLimit())throw new Error(`Memory must contain 1–${this.characterLimit()} characters.`);
    if(revision!==this.value.soul.revision)throw new Error('Soul sudah berubah di jendela lain. Tutup lalu buka editor untuk memuat versi terbaru.');
    const next=structuredClone(this.value),at=new Date().toISOString();next.soul={...next.soul,content:content.trim(),revision:revision+1,updatedAt:at,coreUpdatedAt:at};
    delete next.soulLocales;
    return this.commit(next);
  });}
  pin(message){return this.enqueue(async()=>{
    if(!message || message.status!=='done' || !message.text?.trim())throw new Error('Hanya pesan yang sudah selesai bisa disimpan ke Soul.');
    const next=structuredClone(this.value);
    if(next.soul.pinnedIds?.includes(message.id))throw new Error('Pesan ini sudah tersimpan ke Soul.');
    const content=next.soul.content+'\n\n### Catatan dipilih user — '+new Date().toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta'})+'\nSumber: '+message.role+'; disimpan user dari room.\n'+message.text;
    if(content.length>this.characterLimit())throw new Error('Memory is full. Increase its character limit or shorten the core first.');
    next.soul={...next.soul,content,revision:next.soul.revision+1,updatedAt:new Date().toISOString(),coreUpdatedAt:new Date().toISOString(),pinnedIds:[...(next.soul.pinnedIds || []),message.id]};
    return this.commit(next);
  });}
  saveSelections(selections){return this.enqueue(async()=>{const next=structuredClone(this.value);next.selections=structuredClone(selections);return this.commit(next);});}
  saveSummarySettings(settings){return this.enqueue(async()=>{
    if(Object.hasOwn(settings,'maxCharacters')&&(!validMemoryLimit(settings.maxCharacters)||settings.maxCharacters<this.value.soul.content.length))throw new Error('Choose 1,000–100,000 characters, at least as many as the current core. Existing content was kept.');
    const next=structuredClone(this.value);next.summarySettings={...next.summarySettings,...structuredClone(settings)};return this.commit(next);
  });}
  saveSummary(content,revision,{coverage,archiveCoverage,archiveReviewed,agentId,throughAt,now=Date.now()}){return this.enqueue(async()=>{
    if(typeof content!=='string'||!content.trim()||content.length>this.characterLimit()||content.includes('<!-- PITLANE_AUTO_MEMORY -->'))throw new Error('Invalid Project Memory summary or selected character limit exceeded.');
    if(revision!==this.value.soul.revision)throw new Error('Project Memory changed while summarizing. Your newer edit was kept; retry the update.');
    const next=structuredClone(this.value),at=new Date(now).toISOString();
    const incorporationTimes={...(next.soul.summaryArchiveIncorporatedAt||{})};
    for(const [key,hash] of Object.entries(archiveCoverage||{}))if(!incorporationTimes[key]||next.soul.summaryArchiveCoverage?.[key]!==hash)incorporationTimes[key]=at;
    const reviewTimes={...next.soul.summaryArchiveReviewedAt};
    for(const [key,hash] of Object.entries(archiveReviewed||{}))if(next.soul.summaryArchiveReviewed?.[key]!==hash)reviewTimes[key]=at;
    next.soul={...next.soul,content:content.trim(),revision:revision+1,updatedAt:at,coreUpdatedAt:at,summaryUpdatedAt:at,summaryThroughAt:throughAt,summaryCoverage:coverage,summaryArchiveCoverage:archiveCoverage||next.soul.summaryArchiveCoverage||{},summaryArchiveReviewed:archiveReviewed||next.soul.summaryArchiveReviewed||{},summaryArchiveReviewedAt:reviewTimes,summaryArchiveIncorporatedAt:incorporationTimes,summarySource:{agent:agentId,kind:'summary'}};
    return this.commit(next);
  });}
  pruneSummaryArchive(now=Date.now()){return this.enqueue(async()=>{
    const next=structuredClone(this.value);let removed=0;
    // Give older omitted rows one midnight of visibility under the new policy.
    const migrate=!next.soul.legacyArchiveReviewAt&&Object.keys(next.soul.summaryArchiveReviewed||{}).some(key=>!next.soul.summaryArchiveReviewedAt?.[key]&&next.soul.summaryArchiveReviewed[key]!==next.soul.summaryArchiveCoverage?.[key]);
    if(migrate)next.soul.legacyArchiveReviewAt=new Date(now).toISOString();
    for(const kind of ['gmDecisions','userNotes','updates'])if(next.auto?.[kind]){
      const kept=next.auto[kind].filter(item=>!archiveExpired(next,kind,item,now));removed+=next.auto[kind].length-kept.length;next.auto[kind]=kept;
    }
    if(!removed&&!migrate)return 0;
    // Activity revision changes; core edit time and message coverage stay untouched.
    next.soul.revision++;await this.commit(next);return removed;
  });}
  saveLanguage(language){return this.enqueue(async()=>{
    if(!['en','id'].includes(language))throw new Error('Choose English or Indonesian.');
    const next=structuredClone(this.value);next.preferences={...next.preferences,language};return this.commit(next);
  });}
  saveTranslatedLanguage(language,{content,revision,previousLanguage,sourceLanguage}){return this.enqueue(async()=>{
    if(!['en','id'].includes(language)||typeof content!=='string'||!content.trim()||content.length>18000)throw new Error('Invalid Soul language or translation.');
    if(revision!==this.value.soul.revision||previousLanguage!==(this.value.preferences.language||'en'))throw new Error('Soul Memory or its language changed while translating. The newer version was kept. Reopen Settings and try again.');
    const next=structuredClone(this.value),locales=next.soulLocales;
    const documents=locales?.documents?.[locales.documentLanguage]===next.soul.content?{...locales.documents}:{};
    if(['en','id'].includes(sourceLanguage))documents[sourceLanguage]=next.soul.content;
    documents[language]=content;
    next.soulLocales={documentLanguage:language,documents};
    next.preferences={...next.preferences,language};
    if(content!==next.soul.content)next.soul={...next.soul,content,revision:revision+1,updatedAt:new Date().toISOString()};
    return this.commit(next);
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
    if(!control || (!control.summary && !control.next && !control.reportedProgress && !control.projectMemory))return this.snapshot();
    if(this.value.auto?.updates?.some(item=>item.id===message.id))return this.snapshot();
    const next=structuredClone(this.value);next.auto ||= {userNotes:[],updates:[]};
    next.auto.updates=[...(next.auto.updates || []),{id:message.id,agent:message.role,at:message.at,summary:control.summary,next:control.next,reportedProgress:control.reportedProgress}].slice(-6);
    const memory=control.projectMemory;
    if(this.projectMemory&&memory&&!control.needsUser&&!control.disagreement&&memory.baseRevision===this.value.soul.revision&&typeof memory.content==='string'&&memory.content.trim()&&memory.content.length<=this.characterLimit()&&!memory.content.includes('<!-- PITLANE_AUTO_MEMORY -->')){
      next.soul.content=memory.content.trim();
      next.soul.summaryUpdatedAt=message.at;
      next.soul.summarySource={messageId:message.id,agent:message.role};
    }
    next.soul.revision++;next.soul.updatedAt=new Date().toISOString();return this.commit(next);
  });}
}
