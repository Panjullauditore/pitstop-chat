"use client";
import {useI18n} from "@/lib/i18n";
import {useState} from 'react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {AgentDefinition,CatalogData,ProviderId} from '@/lib/types';
import {toast} from 'sonner';

export function AgentConnectorDialog({open,onOpenChange,catalog,agents,onAgentAdded}:{open:boolean;onOpenChange:(open:boolean)=>void;catalog:Record<string,CatalogData>;agents:AgentDefinition[];onAgentAdded:(agent:AgentDefinition)=>Promise<void>}){
  const {t}=useI18n();
  const [provider,setProvider]=useState<ProviderId>('deepseek'),[name,setName]=useState('DeepSeek Web'),[role,setRole]=useState(t("Rekan diskusi")),[model,setModel]=useState(''),[manual,setManual]=useState(''),[effort,setEffort]=useState(''),[busy,setBusy]=useState(false);
  const web=provider==='deepseek',models=catalog[provider]?.models||[];
  const efforts=model==='__manual__'?['low','medium','high','xhigh','max',...(provider==='codex'?['ultra']:[])]:models.find(item=>item.id===model)?.efforts||[];
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();if(model==='__manual__'&&!manual.trim()){toast.error(t("Isi Model ID manual."));return;}setBusy(true);
    try{await onAgentAdded({id:provider,provider,name,role,model:web?'':model==='__manual__'?manual.trim():model,effort:web?'':effort,transport:web?'browser-web':'cli',installed:false,connection:'disconnected'});toast.success(web?t("DeepSeek Web ditambahkan"):t("Konfigurasi agent tersimpan"));onOpenChange(false);}catch(error:any){toast.error(t("Gagal menambahkan agent"),{description:error.message});}finally{setBusy(false);}
  };
  return <Dialog open={open} onOpenChange={value=>{if(!busy)onOpenChange(value);}}><DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
    <DialogHeader><DialogTitle>{t("Tambahkan agent")}</DialogTitle><DialogDescription>{t("Pilih CLI lokal atau DeepSeek Web melalui browser lokal.")}</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm" htmlFor="agent-provider">Provider<select id="agent-provider" value={provider} disabled={busy} onChange={e=>{const id=e.target.value as ProviderId;setProvider(id);setName(id==='deepseek'?'DeepSeek Web':agents.find(agent=>agent.id===id)?.name||id);setModel('');setEffort('');}} className="mt-2 w-full rounded-lg border border-border bg-input p-2.5"><option value="deepseek">{t("DeepSeek Web · browser lokal")}</option><option value="codex">Codex CLI</option><option value="antigravity">Antigravity CLI</option><option value="claude">Claude CLI</option></select></label>
      {web&&<p className="text-sm leading-6 text-muted-foreground border-l border-brand-cyan pl-3">{t("Gunakan Pitlane Bridge untuk menyambungkan DeepSeek yang sudah login di Chrome aktif. Pasangkan extension dari pengaturan bot setelah ditambahkan. Tidak perlu API key.")}</p>}
      <label className="block text-sm" htmlFor="agent-display-name">{t("Nama agent")}<input id="agent-display-name" value={name} disabled={busy} onChange={e=>setName(e.target.value)} maxLength={64} required className="mt-2 w-full rounded-lg border border-border bg-input p-2.5"/></label>
      <label className="block text-sm" htmlFor="agent-team-role">{t("Peran")}<input id="agent-team-role" value={role} disabled={busy} onChange={e=>setRole(e.target.value)} maxLength={120} className="mt-2 w-full rounded-lg border border-border bg-input p-2.5"/></label>
      {!web&&<>
        <label className="block text-sm" htmlFor="agent-cli-model">Model<select id="agent-cli-model" value={model} disabled={busy} onChange={e=>{setModel(e.target.value);setEffort('');}} className="mt-2 w-full rounded-lg border border-border bg-input p-2.5"><option value="">Default CLI</option>{models.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}<option value="__manual__">{t("Model ID manual…")}</option></select></label>
        {model==='__manual__'&&<input aria-label={t("Model ID manual")} value={manual} disabled={busy} onChange={e=>setManual(e.target.value)} maxLength={120} required className="w-full rounded-lg border border-border bg-input p-2.5"/>}
        <label className="block text-sm" htmlFor="agent-cli-effort">Effort<select id="agent-cli-effort" value={effort} disabled={busy||!efforts.length} onChange={e=>setEffort(e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-input p-2.5 disabled:opacity-50"><option value="">Default provider</option>{efforts.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      </>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={()=>onOpenChange(false)}>{t("Batal")}</Button><Button type="submit" disabled={busy||!name.trim()}>{busy?t("Menyimpan…"):t("Tambahkan agent")}</Button></div>
    </form>
  </DialogContent></Dialog>;
}
