"use client";
import {useI18n} from "@/lib/i18n";
import {useEffect,useState} from 'react';
import {Brain,Building2,X,Save,Download} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {saveSoulDocument,saveProjectMemory} from '@/lib/api';
import {ProjectMemoryData} from '@/lib/types';
import {formatJakartaDate} from '@/lib/utils';
import {toast} from 'sonner';

type Kind='project'|'soul';
interface Props {
 open:boolean;onClose:()=>void;token:string;initialContent:string;revision:number;updatedAt?:string;
 projectMemory?:ProjectMemoryData|null;initialKind?:Kind;onSaved:()=>void;
}
const core=(text:string)=>text.split('<!-- PITLANE_AUTO_MEMORY -->')[0].trim();
export function SoulMemoryDrawer({open,onClose,token,initialContent,revision,updatedAt,projectMemory,initialKind='project',onSaved}:Props){
  const {t}=useI18n();
 const [tab,setTab]=useState<Kind>(initialKind),[saving,setSaving]=useState(false);
 const [drafts,setDrafts]=useState({soul:{content:initialContent,revision,scopeId:'communication',dirty:false},project:{content:core(projectMemory?.content||''),revision:projectMemory?.revision||1,scopeId:projectMemory?.scopeId||'',dirty:false}});
 useEffect(()=>{if(open){setTab(initialKind);setDrafts({soul:{content:initialContent,revision,scopeId:'communication',dirty:false},project:{content:core(projectMemory?.content||''),revision:projectMemory?.revision||1,scopeId:projectMemory?.scopeId||'',dirty:false}});}},[open,initialKind]);
 useEffect(()=>{setDrafts(previous=>({soul:previous.soul.dirty?previous.soul:{content:initialContent,revision,scopeId:'communication',dirty:false},project:previous.project.dirty?previous.project:{content:core(projectMemory?.content||''),revision:projectMemory?.revision||1,scopeId:projectMemory?.scopeId||'',dirty:false}}));},[initialContent,revision,projectMemory?.content,projectMemory?.revision,projectMemory?.scopeId]);
 const draft=drafts[tab],label=tab==='soul'?'Soul Memory':'Project Memory';
 const save=async()=>{
  if(!draft.content.trim()){toast.error(t("Isi memori tidak boleh kosong."));return;}
  setSaving(true);
  try{
   const result=tab==='soul'?await saveSoulDocument(draft.content,draft.revision,token):await saveProjectMemory(draft.content,draft.revision,token,draft.scopeId);
   const memory=tab==='soul'?result.soul:result;
   setDrafts(old=>({...old,[tab]:{content:tab==='project'?core(memory.content):memory.content,revision:memory.revision,scopeId:draft.scopeId,dirty:false}}));onSaved();toast.success(t('{0} tersimpan',[label]));
  }catch(error:any){toast.error(t('Gagal menyimpan {0}',[label]),{description:error.message});}finally{setSaving(false);}
 };
 if(!open)return null;
 return <Dialog open={open} onOpenChange={value=>{if(!value&&!saving)onClose();}}>
  <DialogContent showCloseButton={false} className="inset-y-0 right-0 left-auto top-0 translate-x-0 translate-y-0 w-[460px] max-w-full h-dvh rounded-none sm:rounded-none border-0 border-l border-border p-0 gap-0 flex flex-col duration-0">
   <DialogDescription className="sr-only">{t("Konsep, keputusan, dan catatan perkembangan proyek.")}</DialogDescription>
   <div className="flex items-center justify-between p-4 border-b border-border bg-rail"><DialogTitle className="font-mono font-semibold text-xs uppercase flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded border border-brand-cyan/30 bg-brand-cyan/5 text-brand-cyan">{tab==='project'?<Building2 className="h-4 w-4"/>:<Brain className="h-4 w-4"/>}</span>{label}</DialogTitle><div className="flex gap-1"><button title={t("Unduh cadangan memori")} aria-label={t("Unduh cadangan memori")} className="p-2 hover:bg-secondary rounded-lg" onClick={()=>{const blob=new Blob([projectMemory?.content || draft.content],{type:'text/markdown;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='project-memory.md';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}><Download className="w-4 h-4"/></button><button aria-label={t("Tutup Memory")} className="p-2 hover:bg-secondary rounded-lg" onClick={onClose}><X className="w-4 h-4"/></button></div></div>

   <div className="flex-1 overflow-y-auto p-5 space-y-4"><div className="rounded-md border border-border bg-background p-3"><div className="flex items-center justify-between font-mono text-[10px] uppercase text-muted-foreground"><span>{t("Konsep dan keputusan utama")}</span><span className="text-primary">{Math.round(draft.content.length/18000*100)}%</span></div><div className="mt-2.5 h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{width:`${Math.min(100,draft.content.length/18000*100)}%`}}/></div></div>
    <div className="space-y-2"><h3 className="font-display font-semibold text-base">{tab==='project'?projectMemory?.scopeName||label:label} <span className="text-xs text-muted-foreground">v{draft.revision}</span></h3><p className="text-xs text-muted-foreground leading-relaxed">{tab==='soul'?t("Atur cara AI berkomunikasi: bahasa, nada, panjang jawaban, dan kebiasaan respons. Berlaku untuk semua proyek dan akun CLI. Tidak diubah oleh checkpoint diskusi."):projectMemory?.shared?t("Konsep, keputusan, dan perkembangan proyek “{0}”. Dipakai bersama oleh semua sesi proyek dan tetap tersedia saat akun CLI diganti.", [projectMemory.scopeName]):t("Chat ini belum berada dalam proyek. Konsep dan catatan disimpan khusus untuk chat ini. Pindahkan chat ke proyek untuk memakai Project Memory bersama.")}</p></div>
    <label className="block text-xs font-medium" htmlFor="memory-content">{tab==='soul'?t("Cara berkomunikasi dengan AI"):t("Konsep dan keputusan utama")}</label>
    <textarea id="memory-content" value={draft.content} disabled={saving} maxLength={18000} onChange={event=>setDrafts(old=>({...old,[tab]:{...old[tab],content:event.target.value,dirty:true}}))} rows={13} className="w-full rounded-md bg-background border border-border p-3 text-xs leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring" spellCheck={false}/>
    <div className="flex justify-between text-xs text-muted-foreground"><span>{draft.content.length.toLocaleString('id-ID')} {t(" / 18.000 karakter")}</span><span>{draft.dirty?t("Belum disimpan"):t("Tersimpan")}</span></div>
    <p className="text-xs text-muted-foreground">{t("Diperbarui: ")}{formatJakartaDate(tab==='soul'?updatedAt:projectMemory?.updatedAt)}</p>
    {tab==='project'&&!!projectMemory?.gmDecisions?.length&&<section className="space-y-3 border-t border-border pt-4"><h4 className="text-xs font-semibold">{t("Keputusan final General Manager")}</h4>{projectMemory.gmDecisions.map(item=><div key={item.id} className="text-xs space-y-1 border-l border-brand-cyan pl-3"><p className="text-muted-foreground">{formatJakartaDate(item.at)}</p><p className="whitespace-pre-wrap leading-5">{item.text}</p></div>)}</section>}
    {tab==='project'&&<section className="space-y-3 border-t border-border pt-4"><h4 className="text-xs font-semibold">{t("Perkembangan otomatis")}</h4><p className="text-xs text-muted-foreground">{projectMemory?.managerId?t("Rangkuman resmi dibuat Project Manager setelah membaca diskusi tim. "):t("Arahan user dan checkpoint dicatat tanpa menimpa konsep utama. ")}{t("Usulan AI dan laporan progres belum dianggap keputusan atau hasil terverifikasi.")}</p>
      {!(projectMemory?.auto?.userNotes?.length||projectMemory?.auto?.updates?.length)&&<p className="text-xs text-muted-foreground">{t("Belum ada catatan perkembangan.")}</p>}
      {projectMemory?.auto?.userNotes?.map(note=><div key={note.id} className="text-xs border-l border-brand-cyan pl-3"><span className="text-brand-cyan">{t("Arahan user")}</span><p className="whitespace-pre-wrap mt-1">{note.text}</p></div>)}
      {projectMemory?.auto?.updates?.map(item=><div key={item.id} className="text-xs border-l border-border pl-3 space-y-1"><span className="text-muted-foreground">{item.agent} · checkpoint</span><p>{item.summary}</p>{item.next&&<p className="text-muted-foreground">{t("Usulan berikutnya: ")}{item.next}</p>}{item.reportedProgress&&<p className="text-amber-400">{t("Laporan belum diverifikasi: ")}{item.reportedProgress}</p>}</div>)}
    </section>}
   </div>
   <div className="p-4 border-t border-border flex gap-2"><Button variant="outline" className="flex-1" onClick={onClose}>{t("Tutup")}</Button><Button disabled={saving||!draft.dirty} className="flex-1 gap-2" onClick={()=>void save()}><Save className="w-4 h-4"/>{saving?t("Menyimpan…"):t("Simpan")}</Button></div>
  </DialogContent>
 </Dialog>;
}
