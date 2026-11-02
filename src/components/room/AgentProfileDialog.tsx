"use client";
import {useI18n} from "@/lib/i18n";
import {useEffect,useState} from 'react';
import {Save,RefreshCw} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {AgentDefinition,RoomSnapshot,CatalogData,LinkedAppChat} from '@/lib/types';
import {refreshCatalogModels} from '@/lib/api';
import {toast} from 'sonner';
import {AvatarPicker} from './AvatarPicker';
import {BrowserBridgeSetup} from './BrowserBridgeSetup';

export function AgentProfileDialog({linkedApp,agent,token,catalog,onCatalogRefreshed,onClose,onSaved}:{linkedApp?:LinkedAppChat;agent:AgentDefinition|null;token:string;catalog:Record<string,CatalogData>;onCatalogRefreshed:(catalog:Record<string,CatalogData>)=>void;onClose:()=>void;onSaved:(state:RoomSnapshot)=>void}){
  const {t}=useI18n();
  const [name,setName]=useState(''),[role,setRole]=useState(''),[bio,setBio]=useState(''),[avatar,setAvatar]=useState(''),[busy,setBusy]=useState(false),[processing,setProcessing]=useState(false);
  const [model,setModel]=useState(''),[effort,setEffort]=useState(''),[manual,setManual]=useState(false),[refreshing,setRefreshing]=useState(false);
  const models=catalog[agent?.provider||agent?.id||'']?.models || [];
  const selected=models.find(item=>item.id===model);
  const efforts=!model?[]:manual?['minimal','low','medium','high','xhigh','max',...(agent?.id==='codex'?['ultra']:[])]:selected?.efforts||[];
  useEffect(()=>{if(agent){setName(agent.name);setRole(agent.role||'');setBio(agent.bio||'');setAvatar(agent.avatar||'');setModel(agent.model||'');setEffort(agent.effort||'');setManual(!!agent.model&&!models.some(item=>item.id===agent.model));}},[agent?.id]);
  const refresh=async()=>{setRefreshing(true);try{onCatalogRefreshed(await refreshCatalogModels(token));}catch(error:any){toast.error(t("Gagal membaca daftar model"),{description:error.message});}finally{setRefreshing(false);}};
  const save=async(event:React.FormEvent)=>{
    event.preventDefault();if(!agent)return;setBusy(true);
    try{
      if(!linkedApp&&manual&&!model.trim())throw new Error(t("Isi Model ID manual."));
      const response=await fetch('/api/agents/profile',{method:'POST',headers:{'Content-Type':'application/json','X-Room-Token':token},body:JSON.stringify({provider:agent.provider||agent.id,name,role,bio,avatar,...(linkedApp||agent.transport==='manual-web'||agent.transport==='browser-web'?{}:{selection:{model:model.trim(),effort,custom:manual}})})});
      const data=await response.json();if(!response.ok)throw new Error(data.error || t("Profil gagal disimpan."));
      onSaved(data.state);toast.success(t("Pengaturan bot tersimpan"));onClose();
    }catch(error:any){toast.error(t("Gagal menyimpan profil bot"),{description:error.message});}finally{setBusy(false);}
  };
  return <Dialog open={!!agent} onOpenChange={open=>{if(!open&&!busy&&!processing)onClose();}}><DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
    <DialogHeader><DialogTitle>{t("Pengaturan ")}{agent?.name}</DialogTitle><DialogDescription>{(agent?.transport==='manual-web'||agent?.transport==='browser-web')?t("Kelola profil bot web. Model dipilih langsung di browser DeepSeek."):t("Kelola profil, model, dan effort bot ini. Berlaku untuk semua proyek dan sesi.")}</DialogDescription></DialogHeader>
    {linkedApp&&<p className="text-sm text-brand-cyan">{t("Proyek ini memakai model dan izin dari chat aplikasi yang tertaut.")} {linkedApp.title}</p>}
    <form onSubmit={save} className="space-y-4">
      <AvatarPicker value={avatar} onChange={setAvatar} initials={name.slice(0,2).toUpperCase()} disabled={busy} onBusyChange={setProcessing}/>

      {agent?.transport==='browser-web'&&<div className="rounded-lg border border-border p-3"><BrowserBridgeSetup token={token}/></div>}
      <label className="block text-sm" htmlFor="bot-name">{t("Nama bot")}<input id="bot-name" value={name} disabled={busy} onChange={e=>setName(e.target.value)} maxLength={64} required className="mt-2 w-full rounded-lg border border-border bg-input p-2.5 outline-none focus:ring-2 focus:ring-ring"/></label>
      <label className="block text-sm" htmlFor="bot-role">{t("Peran")}<input id="bot-role" value={role} disabled={busy} onChange={e=>setRole(e.target.value)} placeholder={t("Misalnya: Lead Architect")} maxLength={120} className="mt-2 w-full rounded-lg border border-border bg-input p-2.5 outline-none focus:ring-2 focus:ring-ring"/></label>
      <label className="block text-sm" htmlFor="bot-bio">{t("Profil bot")}<textarea id="bot-bio" value={bio} disabled={busy} onChange={e=>setBio(e.target.value)} placeholder={t("Jelaskan spesialisasi dan tanggung jawab bot ini…")} maxLength={2000} rows={4} className="mt-2 w-full rounded-lg border border-border bg-input p-2.5 outline-none focus:ring-2 focus:ring-ring"/></label>
      {!linkedApp&&agent?.transport!=='manual-web'&&agent?.transport!=='browser-web'&&<section className="border-t border-border pt-4 space-y-3">
        <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Model & Effort</h3><button type="button" disabled={busy||refreshing} onClick={()=>void refresh()} aria-label={t("Perbarui daftar model")} title={t("Perbarui daftar model")} className="p-2 rounded-lg text-muted-foreground hover:bg-secondary"><RefreshCw className={`h-4 w-4 ${refreshing?'animate-spin':''}`}/></button></div>
        <label className="block text-sm" htmlFor="bot-model">Model<select id="bot-model" disabled={busy||refreshing} value={manual?'__manual__':model} onChange={e=>{const value=e.target.value;setManual(value==='__manual__');setModel(value==='__manual__'?'':value);setEffort('');}} className="mt-2 w-full rounded-lg border border-border bg-input p-2.5"><option value="">Default CLI</option>{models.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}<option value="__manual__">{t("Model ID manual…")}</option></select></label>
        {manual&&<label className="block text-sm" htmlFor="bot-model-id">Model ID<input id="bot-model-id" disabled={busy} value={model} onChange={e=>setModel(e.target.value)} maxLength={120} required className="mt-2 w-full rounded-lg border border-border bg-input p-2.5"/></label>}
        <label className="block text-sm" htmlFor="bot-effort">Reasoning effort<select id="bot-effort" disabled={busy||!efforts.length} value={effort} onChange={e=>setEffort(e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-input p-2.5 disabled:opacity-50"><option value="">{efforts.length?'Default provider':'Default model'}</option>{efforts.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      </section>}
      <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" disabled={busy||processing} onClick={onClose}>{t("Batal")}</Button><Button type="submit" disabled={busy||processing||refreshing||!name.trim()} className="gap-2"><Save className="h-4 w-4"/>{busy?t("Menyimpan…"):t("Simpan pengaturan")}</Button></div>
    </form>
  </DialogContent></Dialog>;
}
