"use client";

import {useEffect,useState} from 'react';
import {Brain,Download,User,Save,Plug,Languages} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {saveSoulDocument} from '@/lib/api';
import {SoulData} from '@/lib/types';
import {toast} from 'sonner';
import {useI18n} from '@/lib/i18n';
import {soulWithLanguage} from '@/lib/language.mjs';
import {AvatarPicker} from './AvatarPicker';
import {BrowserBridgeSetup} from './BrowserBridgeSetup';
import {BridgeDownload} from './BridgeDownload';
import {useDownloadConfirmation,saveDownload} from './DownloadConfirmation';

export function SettingsDialog({open,onOpenChange,token,currentName,currentAvatar,soul,onSaved}:{
  open:boolean;onOpenChange:(open:boolean)=>void;token:string;currentName:string;currentAvatar:string;soul?:SoulData;onSaved:()=>void;
}) {
  const {t,language,setLanguage}=useI18n();
  const confirmDownload=useDownloadConfirmation();
  const [chosenLanguage,setChosenLanguage]=useState(language);
  const [tab,setTab]=useState<'profile'|'soul'|'language'|'bridge'>('profile');
  const [name,setName]=useState(currentName),[avatar,setAvatar]=useState(currentAvatar);
  const [content,setContent]=useState(''),[revision,setRevision]=useState(1),[busy,setBusy]=useState(false),[processing,setProcessing]=useState(false);
  useEffect(()=>{if(open){setTab('profile');setChosenLanguage(language);setName(currentName);setAvatar(currentAvatar);setContent(soul?.content || '');setRevision(soul?.revision || 1);}},[open]);
  const save=async()=>{
    setBusy(true);
    try{
      if(tab==='language'){
        const res=await fetch('/api/language',{method:'POST',headers:{'Content-Type':'application/json','X-Room-Token':token},body:JSON.stringify({language:chosenLanguage,revision})});const data=await res.json();if(!res.ok)throw new Error(data.error||t("Gagal menyimpan"));setContent(data.state.brain.soul.content);setRevision(data.state.brain.soul.revision);setLanguage(chosenLanguage);
      }else if(tab==='profile'){
        const res=await fetch('/api/profile',{method:'POST',headers:{'Content-Type':'application/json','X-Room-Token':token},body:JSON.stringify({displayName:name,avatar})});
        const data=await res.json();if(!res.ok)throw new Error(data.error || t("Profil gagal disimpan."));
      }else{const result=await saveSoulDocument(content,revision,token);setContent(result.soul.content);setRevision(result.soul.revision);}
      onSaved();toast.success(tab==='language'?t("Pilihan bahasa tersimpan"):tab==='profile'?t("Profil tersimpan"):t("Soul Memory tersimpan"));
    }catch(error:any){toast.error(t("Gagal menyimpan"),{description:error.message});}finally{setBusy(false);}
  };
  const download=()=>confirmDownload({filename:'soul-memory.md',run:()=>saveDownload(new Blob([soulWithLanguage(content,language)],{type:'text/markdown;charset=utf-8'}),'soul-memory.md')});
  return <Dialog open={open} onOpenChange={value=>{if(!busy&&!processing)onOpenChange(value);}}><DialogContent className="max-w-2xl max-h-[90dvh] flex flex-col p-0 gap-0 overflow-hidden">
    <DialogHeader className="p-5 border-b border-border"><DialogTitle>{t("Pengaturan")}</DialogTitle><DialogDescription>{t("Kelola profil dan cara agent berkomunikasi denganmu.")}</DialogDescription></DialogHeader>
    <div className="flex flex-col sm:flex-row min-h-0 flex-1 overflow-hidden">
      <div role="tablist" aria-label={t("Bagian pengaturan")} className="flex sm:flex-col gap-1 p-3 border-b sm:border-b-0 sm:border-r border-border sm:w-44 shrink-0 overflow-x-auto">
        <button role="tab" id="settings-profile-tab" aria-controls="settings-panel" aria-selected={tab==='profile'} disabled={busy} onClick={()=>setTab('profile')} className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm ${tab==='profile'?'bg-secondary text-foreground':'text-muted-foreground hover:bg-secondary/50'}`}><User className="h-4 w-4"/>{t("Profil")}</button>
        <button role="tab" id="settings-soul-tab" aria-controls="settings-panel" aria-selected={tab==='soul'} disabled={busy} onClick={()=>setTab('soul')} className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm ${tab==='soul'?'bg-secondary text-foreground':'text-muted-foreground hover:bg-secondary/50'}`}><Brain className="h-4 w-4 text-primary"/>Soul Memory</button>
        <button role="tab" id="settings-language-tab" aria-controls="settings-panel" aria-selected={tab==='language'} disabled={busy} onClick={()=>{if(content!==(soul?.content||'')){toast.error(t('Simpan perubahan Soul Memory sebelum mengganti bahasa.'));return;}setTab('language');}} className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm ${tab==='language'?'bg-secondary text-foreground':'text-muted-foreground hover:bg-secondary/50'}`}><Languages className="h-4 w-4 shrink-0" aria-hidden="true"/>{t("Bahasa")}</button>
        <button role="tab" id="settings-bridge-tab" aria-controls="settings-panel" aria-selected={tab==='bridge'} disabled={busy||processing} onClick={()=>setTab('bridge')} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-left ${tab==='bridge'?'bg-secondary text-foreground':'text-muted-foreground hover:bg-secondary/50'}`}><Plug className="h-4 w-4 shrink-0"/>{t('Extension & Bridge')}</button>
      </div>
      <div role="tabpanel" id="settings-panel" aria-labelledby={`settings-${tab}-tab`} className="p-5 flex-1 min-w-0 overflow-y-auto space-y-5">
        {tab==='bridge'?<>
          <div><h3 className="font-semibold">{t('Extension & Bridge')}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{t('Hubungkan browser ke Pitstop. Status diperbarui otomatis setiap 5 detik. Pasangkan setiap layanan secara terpisah.')}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{t('Extension yang terpasang saat ini bernama Pitlane Bridge. Gunakan extension tersebut, tidak perlu memasang ulang.')}</p></div>
          <BridgeDownload token={token}/>
          <BrowserBridgeSetup token={token}/>
          <div className="border-t border-border pt-5"><BrowserBridgeSetup token={token} provider="antigravity"/></div>
        </>:tab==='language'?<>
          <h3 className="flex items-center gap-2 font-semibold"><Languages className="h-4 w-4" aria-hidden="true"/>{t("Bahasa")}</h3><p className="text-xs leading-5 text-muted-foreground">{t("Bahasa aplikasi dan respons default agent.")}</p>
          <select aria-label={t("Bahasa")} value={chosenLanguage} disabled={busy} onChange={event=>setChosenLanguage(event.target.value as 'en'|'id')} className="w-full rounded-lg border border-border bg-input p-3 text-sm"><option value="en">{t("English (default)")}</option><option value="id">{t("Bahasa Indonesia")}</option></select>
          <p className="text-xs leading-5 text-muted-foreground">{t("Mengganti bahasa juga menerjemahkan tulisan Soul Memory. Makna aturan, Project Memory, dan riwayat chat tetap dipertahankan.")}</p>
        </>:tab==='profile'?<>
          <div><h3 className="font-semibold">{t("Profil")}</h3><p className="text-xs leading-5 text-muted-foreground mt-1">{t("Nama dan foto yang tampil di ruang diskusi.")}</p></div>
          <AvatarPicker value={avatar} onChange={setAvatar} initials={Array.from(name)[0]?.toUpperCase()||'U'} disabled={busy} onBusyChange={setProcessing}/>

          <label className="block text-sm" htmlFor="profile-name">{t("Nama tampilan")}<input id="profile-name" value={name} onChange={event=>setName(event.target.value)} disabled={busy} maxLength={32} className="block w-full mt-2 rounded-lg bg-input border border-border px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"/></label>
        </>:<>
          <div><h3 className="font-semibold">Soul Memory</h3><p className="text-xs leading-5 text-muted-foreground mt-1">{t("Atur bahasa, nada, panjang jawaban, dan kebiasaan respons AI. Berlaku untuk semua proyek.")}</p></div>
          <textarea aria-label={t("Isi Soul Memory")} value={content} disabled={busy} onChange={event=>setContent(event.target.value)} maxLength={18000} rows={10} className="w-full rounded-lg bg-input border border-border p-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-ring"/>
          <Button variant="outline" onClick={download} className="gap-2"><Download className="h-4 w-4"/>{t("Unduh Soul Memory")}</Button>
        </>}
      </div>
    </div>
    <div className="border-t border-border p-4 flex justify-end gap-2"><Button variant="outline" disabled={busy||processing} onClick={()=>onOpenChange(false)}>{t("Tutup")}</Button>{tab!=='bridge'&&<Button disabled={busy||processing||(tab==='profile'?!name.trim():tab==='soul'?!content.trim():false)} onClick={()=>void save()} className="gap-2"><Save className="h-4 w-4"/>{busy?tab==='language'?t("Menyesuaikan bahasa…"):t("Menyimpan…"):t("Simpan")}</Button>}</div>
  </DialogContent></Dialog>;
}
