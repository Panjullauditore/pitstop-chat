"use client";
import {useI18n} from "@/lib/i18n";
import {useEffect,useState} from 'react';
import {ArrowLeft,ArrowRight,Check} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {AgentDefinition} from '@/lib/types';

export function CreateProjectDialog({open,onClose,agents,onCreate}:{open:boolean;onClose:()=>void;agents:AgentDefinition[];onCreate:(input:Record<string,unknown>)=>Promise<void>}){
  const {t}=useI18n();
  const [step,setStep]=useState(0),[name,setName]=useState(''),[manager,setManager]=useState(''),[members,setMembers]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{if(open){setStep(0);setName('');setManager('');setMembers([]);setError('');}},[open]);
  const pm=agents.find(agent=>agent.id===manager);
  const titles=[t("Nama proyek"),t("Pilih Project Manager"),t("Tambahkan tim diskusi")];
  const create=async()=>{setBusy(true);setError('');try{await onCreate({name:name.trim(),managerId:manager,agentIds:[manager,...members.filter(id=>id!==manager)]});onClose();}catch(e:any){setError(e.message);}finally{setBusy(false);}};
  return <Dialog open={open} onOpenChange={value=>{if(!value&&!busy)onClose();}}><DialogContent className="max-w-lg max-h-[90dvh] flex flex-col">
    <DialogHeader><DialogTitle>{titles[step]}</DialogTitle><DialogDescription>{step===0?t("Beri nama ruang kerja proyekmu."):step===1?t("Pilih satu bot yang memimpin koordinasi tim dan merangkum perkembangan ke Project Memory."):t("Pilih agent tambahan yang ingin diajak berdiskusi. PM sudah otomatis masuk tim.")}</DialogDescription></DialogHeader>
    <ol aria-label={t("Langkah pembuatan proyek")} className="flex gap-2 text-xs text-muted-foreground">{[t("Nama"),'Project Manager',t("Tim diskusi")].map((label,index)=><li key={label} aria-current={step===index?'step':undefined} className={`flex-1 border-b pb-2 ${step===index?'border-brand-cyan text-foreground':'border-border'}`}>{index<step&&<Check className="inline h-3 w-3 mr-1"/>}{label}</li>)}</ol>
    <div className="min-h-0 overflow-y-auto space-y-3 py-2">
      {step===0?<label className="block text-sm" htmlFor="new-project-name">{t("Nama proyek")}<input id="new-project-name" autoFocus value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing&&name.trim()){e.preventDefault();setStep(1);}}} maxLength={120} placeholder={t("Contoh: Pitstop")} className="mt-2 w-full rounded-lg border border-border bg-input p-3 outline-none focus:ring-2 focus:ring-ring"/></label>:step===1?<fieldset className="space-y-2"><legend className="sr-only">Project Manager</legend>{agents.map(agent=><label key={agent.id} className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer ${manager===agent.id?'border-brand-cyan bg-brand-cyan/5':'border-border hover:bg-secondary/50'}`}><input type="radio" name="project-manager" value={agent.id} checked={manager===agent.id} onChange={()=>{setManager(agent.id);setMembers(old=>old.filter(id=>id!==agent.id));}} className="accent-brand-cyan"/><span className="h-9 w-9 rounded-lg bg-secondary shrink-0 flex items-center justify-center text-xs font-semibold overflow-hidden">{agent.avatar?<img src={agent.avatar} alt="" className="w-full h-full object-cover"/>:agent.name.slice(0,2).toUpperCase()}</span><span className="min-w-0"><span className="block font-semibold text-sm truncate">{agent.name}</span><span className="block text-xs text-muted-foreground mt-1">{agent.transport==='manual-web'?t("Web manual"):agent.connection==='connected'?t("Terhubung"):t("Perlu dihubungkan sebelum diskusi")}</span></span></label>)}</fieldset>:<>
        <div className="rounded-lg bg-secondary/60 px-3 py-2 text-sm"><span className="font-semibold">{pm?.name}</span><span className="text-brand-cyan text-xs ml-2">{t("Project Manager · sudah dalam tim")}</span></div>
        {agents.filter(agent=>agent.id!==manager).map(agent=><label key={agent.id} className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-secondary/50"><input type="checkbox" checked={members.includes(agent.id)} onChange={e=>setMembers(old=>e.target.checked?[...old,agent.id]:old.filter(id=>id!==agent.id))} className="accent-brand-cyan"/><span className="text-sm flex-1">{agent.name}</span><span className="text-xs text-muted-foreground">{agent.transport==='manual-web'?t("Web manual"):agent.connection==='connected'?t("Terhubung"):t("Belum terhubung")}</span></label>)}
        <p className="text-xs leading-5 text-muted-foreground">{t("Tidak ada batas jumlah anggota tambahan dari agent yang tersedia. Bisa mulai hanya dengan PM. Keputusan akhir tetap milikmu sebagai General Manager; tim menunggu keputusanmu saat terjadi perdebatan.")}</p>
      </>}
      {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
    <div className="flex justify-between gap-2 border-t border-border pt-4"><Button variant="outline" disabled={busy} onClick={()=>step?setStep(step-1):onClose()} className="gap-2">{step>0&&<ArrowLeft className="h-4 w-4"/>}{step?t("Kembali"):t("Batal")}</Button><Button disabled={busy||(step===0&&!name.trim())||(step>0&&!manager)} onClick={()=>step<2?setStep(step+1):void create()} className="gap-2">{busy?t("Membuat…"):step===2?t("Buat proyek"):'Next'}{step<2&&<ArrowRight className="h-4 w-4"/>}</Button></div>
  </DialogContent></Dialog>;
}
