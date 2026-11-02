"use client";
import {useEffect,useState} from 'react';
import {Copy,RefreshCw,Link2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {useI18n} from '@/lib/i18n';
import {toast} from 'sonner';

type Setup={paired:boolean;connected:boolean;detail:string;folder:string;extensionId:string};
export function BrowserBridgeSetup({token,provider="deepseek"}:{token:string;provider?:"deepseek"|"antigravity"}){
  const native=provider==="antigravity";
  const {t}=useI18n();
  const [setup,setSetup]=useState<Setup|null>(null),[code,setCode]=useState(''),[expires,setExpires]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const request=async(path:string,method='GET')=>{const response=await fetch((native?'/api/linked-apps/antigravity/bridge/':'/api/web-agent/')+(native?path.replace('extension/',''):path),{method,headers:{'X-Room-Token':token}});const data=await response.json();if(!response.ok)throw new Error(data.error||t('Koneksi gagal'));return data;};
  const refresh=async()=>{try{setSetup(await request('extension/setup'));setError('');}catch(error:any){setError(error.message);}};
  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),5000);return()=>clearInterval(timer);},[token,provider]);
  const pair=async()=>{setBusy(true);try{const result=await request('extension/pair-code','POST');setCode(result.code);setExpires(result.expiresAt);setError('');}catch(error:any){setError(error.message);}finally{setBusy(false);}};
  const copy=async(value:string)=>{try{await navigator.clipboard.writeText(value);toast.success(t('Teks disalin'));}catch{toast.error(t('Tidak bisa menyalin teks'));}};
  const test=async()=>{setBusy(true);try{const result=await request('browser/test','POST');if(!result.success)throw new Error(t('DeepSeek belum mengembalikan jawaban tes yang sesuai.'));toast.success(t('DeepSeek tersambung ke Pitlane'));}catch(error:any){setError(error.message);}finally{setBusy(false);void refresh();}};
  const disconnect=async()=>{setBusy(true);try{await request('extension/revoke','POST');setCode('');await refresh();}catch(error:any){setError(error.message);}finally{setBusy(false);}};
  return <section className="space-y-4 text-sm">
    <div className="flex items-center gap-2 font-medium"><Link2 className="h-4 w-4 text-brand-cyan"/>Pitlane Bridge<span className={`ml-auto text-xs ${setup?.connected?'text-brand-cyan':'text-muted-foreground'}`}>{setup?.connected?t('Terhubung'):setup?.paired?t('Menunggu Chrome'):t('Belum dipasangkan')}</span></div>
    <p className="text-xs leading-5 text-muted-foreground">{native?t('Pasang Pitlane Bridge di profil Chrome yang sudah login Remote Control Antigravity. Pilih Antigravity App di popup extension saat pairing.'):t('Gunakan sesi DeepSeek di Chrome aktifmu. Pitlane Bridge terpisah dari extension Codex; tidak membaca cookie, password, atau token akun.')}</p>
    {!setup?.connected&&<ol className="list-decimal pl-4 space-y-3 text-xs leading-5 text-muted-foreground">
      <li>{t('Di chrome://extensions, aktifkan Developer mode, pilih Load unpacked, lalu pilih folder ini:')}
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-border bg-input p-2.5"><code className="flex-1 min-w-0 break-all text-foreground">{setup?.folder||'…'}</code><button type="button" disabled={!setup} onClick={()=>void copy(setup!.folder)} aria-label={t('Salin folder extension')} className="p-1 rounded hover:bg-secondary"><Copy className="h-3.5 w-3.5"/></button></div>
      </li>
      <li>{t('Buat kode di bawah, buka popup Pitlane Bridge di Chrome, tempel kode, lalu pilih Connect.')}</li>
      <li>{native?t('Setelah memasang atau memperbarui extension, refresh tab Remote Control Antigravity dan biarkan terbuka. Persetujuan alat tetap dilakukan di App.'):t('Setelah memasang extension, refresh tab DeepSeek yang sudah login dan biarkan terbuka. Tab khusus tiap pesan dibuat dalam profil Chrome yang sama.')}</li>
    </ol>}
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={()=>void pair()} disabled={busy}>{t('Buat kode pairing')}</Button>
      {setup?.connected&&!native&&<Button type="button" size="sm" onClick={()=>void test()} disabled={busy}>{t('Tes koneksi')}</Button>}
      <Button type="button" variant="ghost" size="sm" onClick={()=>void refresh()} disabled={busy} aria-label={t('Perbarui koneksi')}><RefreshCw className={`h-4 w-4 ${busy?'animate-spin':''}`}/></Button>
      {setup?.paired&&<Button type="button" variant="ghost" size="sm" onClick={()=>void disconnect()} disabled={busy}>{t('Putuskan')}</Button>}
    </div>
    {code&&<div className="space-y-2"><label htmlFor="bridge-code" className="text-xs text-muted-foreground">{t('Kode sekali pakai · berlaku 5 menit')}</label><div className="flex gap-2"><input id="bridge-code" readOnly value={code} className="min-w-0 w-full rounded-lg border border-border bg-input p-2 text-sm"/><Button type="button" variant="outline" size="sm" onClick={()=>void copy(code)}>{t('Salin')}</Button></div><p className="text-xs text-muted-foreground">{t('Kedaluwarsa')}: {new Date(expires).toLocaleTimeString()}</p></div>}
    {error&&<p role="alert" className="text-xs leading-5 text-destructive">{error}</p>}
  </section>;
}
