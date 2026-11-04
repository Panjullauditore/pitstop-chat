"use client";
import {useEffect,useId,useState} from 'react';
import {Copy,RefreshCw,Link2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {useI18n} from '@/lib/i18n';
import {toast} from 'sonner';
import {connectExtension} from '@/lib/bridge-connect';

type Setup={paired:boolean;connected:boolean;status:'unpaired'|'disconnected'|'busy'|'ready';detail:string;folder:string;extensionId:string};
export function BrowserBridgeSetup({token,provider="deepseek"}:{token:string;provider?:"deepseek"|"antigravity"}){
  const native=provider==="antigravity";
  const {t}=useI18n();
  const codeId=useId();
  const [setup,setSetup]=useState<Setup|null>(null),[code,setCode]=useState(''),[expires,setExpires]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [connectionError,setConnectionError]=useState(''),[now,setNow]=useState(Date.now());
  const request=async(path:string,method='GET')=>{const response=await fetch((native?'/api/linked-apps/antigravity/bridge/':'/api/web-agent/')+(native?path.replace('extension/',''):path),{method,headers:{'X-Room-Token':token}});const data=await response.json();if(!response.ok)throw new Error(data.error||t('Koneksi gagal'));return data;};
  const refresh=async()=>{try{setSetup(await request('extension/setup'));setConnectionError('');}catch(error:any){setConnectionError(error.message);}};
  useEffect(()=>{let active=true;let timer:ReturnType<typeof setTimeout>;setSetup(null);setCode('');setError('');setConnectionError('');const poll=async()=>{try{const result=await request('extension/setup');if(active){setSetup(result);setConnectionError('');}}catch(error:any){if(active)setConnectionError(error.message);}finally{if(active){setNow(Date.now());timer=setTimeout(()=>void poll(),5000);}}};void poll();return()=>{active=false;clearTimeout(timer);};},[token,provider]);
  const pair=async()=>{setBusy(true);try{const result=await request('extension/pair-code','POST');setCode(result.code);setExpires(result.expiresAt);setError('');}catch(error:any){setError(error.message);}finally{setBusy(false);}};
  const connect=async()=>{setBusy(true);setError('');try{const available=await connectExtension({action:'ping'});if(!available.available)throw new Error(t('Extension belum siap.'));const pairing=await request('extension/pair-code','POST');const result=await connectExtension({action:'connect',provider,code:pairing.code});if(!result.paired)throw new Error(t('Pairing belum berhasil.'));setCode('');await refresh();toast.success(t('Pairing tersimpan. Status tersambung mengikuti kesiapan tab agent.'));}catch(error:any){setError(t(error.message));}finally{setBusy(false);}};
  const copy=async(value:string)=>{try{await navigator.clipboard.writeText(value);toast.success(t('Teks disalin'));}catch{toast.error(t('Tidak bisa menyalin teks'));}};
  const test=async()=>{setBusy(true);try{const result=await request('browser/test','POST');if(!result.success)throw new Error(t('DeepSeek belum mengembalikan jawaban tes yang sesuai.'));toast.success(t('DeepSeek tersambung ke Pitstop'));}catch(error:any){setError(error.message);}finally{setBusy(false);void refresh();}};
  const disconnect=async()=>{setBusy(true);try{await request('extension/revoke','POST');setCode('');await refresh();}catch(error:any){setError(error.message);}finally{setBusy(false);}};
  const connected=!!setup?.connected&&!connectionError;
  const working=setup?.status==='busy';
  const expired=!!expires&&now>=Date.parse(expires);
  return <section className="space-y-4 text-sm">
    <div className="flex flex-wrap items-center gap-2 font-medium"><Link2 className="h-4 w-4 text-brand-cyan"/>{native?'Antigravity App':'DeepSeek Web'}<span role="status" className={`ml-auto inline-flex items-center gap-1.5 text-xs ${connected?'text-brand-cyan':'text-muted-foreground'}`}><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${connected?'bg-brand-cyan':'bg-muted-foreground'}`}/>{connectionError?t('Status tidak tersedia'):!setup?t('Memeriksa koneksi…'):connected?working?t('Terhubung · sedang bekerja'):t('Terhubung'):setup.paired?t('Tidak tersambung · sudah dipasangkan'):t('Belum dipasangkan')}</span></div>
    <p className="text-xs leading-5 text-muted-foreground">{native?t('Buka Pitstop dan Remote Control Antigravity di profil Chrome yang sama. Dengan Bridge v1.3.0, klik Hubungkan langsung tanpa menyalin kode; pairing tersimpan untuk sambungan berikutnya.'):t('Gunakan sesi DeepSeek di Chrome aktifmu. Pitstop Bridge terpisah dari extension Codex; tidak membaca cookie, password, atau token akun.')}</p>
    <details className="text-xs leading-5 text-muted-foreground"><summary className="cursor-pointer font-medium text-foreground rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t('Cara menyambungkan bridge')}</summary><ol className="mt-3 list-decimal pl-4 space-y-3">
      <li>{t('Di chrome://extensions, aktifkan Developer mode, pilih Load unpacked, lalu pilih folder ini:')}
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-border bg-input p-2.5"><code className="flex-1 min-w-0 break-all text-foreground">{setup?.folder||'…'}</code><button type="button" disabled={!setup} onClick={()=>void copy(setup!.folder)} aria-label={t('Salin folder extension')} className="p-1 rounded hover:bg-secondary"><Copy className="h-3.5 w-3.5"/></button></div>
      </li>
      <li>{native?t('Di Antigravity App, aktifkan Settings → Application → Enable Remote Control. Buka antigravity.google.com di profil Chrome yang sama, login, lalu buka perangkat dan chat yang ingin ditautkan.'):t('Buka chat.deepseek.com di profil Chrome tempat extension dipasang, lalu login.')}</li>
      <li>{t('Dengan Bridge v1.3.0, buka Pitstop di http://127.0.0.1:4317 pada profil Chrome yang sama lalu klik Hubungkan langsung. Kode manual tetap tersedia sebagai cadangan.')}</li>
      <li>{t('Buat kode di bawah, buka popup Pitlane Bridge lewat ikon Extensions di Chrome, lalu pilih Connection:')} <strong className="text-foreground">{native?'Antigravity App':'DeepSeek'}</strong>. {t('Tempel kode dan klik Connect. Kode pairing tiap layanan berbeda.')}</li>
      <li>{native?t('Setelah memasang atau memperbarui extension, refresh tab Remote Control Antigravity dan biarkan terbuka. Persetujuan alat tetap dilakukan di App.'):t('Setelah memasang extension, refresh tab DeepSeek yang sudah login dan biarkan terbuka. Tab khusus tiap pesan dibuat dalam profil Chrome yang sama.')}</li>
      {native&&<li>{t('Untuk memakai chat App yang sama, tautkan URL chat Remote Control melalui pengaturan proyek. Biarkan Antigravity App dan tab Remote Control terbuka; izinkan permintaan alat di App bila muncul.')}</li>}
    </ol></details>
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" onClick={()=>void connect()} disabled={busy||!setup||!!connectionError||working||connected}><Link2 className="mr-1.5 h-3.5 w-3.5"/>{busy?t('Menghubungkan…'):t('Hubungkan langsung')}</Button>
      <Button type="button" variant="outline" size="sm" onClick={()=>void pair()} disabled={busy||!setup||!!connectionError||working}>{t('Buat kode pairing')}</Button>
      {connected&&!native&&<Button type="button" size="sm" onClick={()=>void test()} disabled={busy||working}>{t('Tes koneksi')}</Button>}
      <Button type="button" variant="ghost" size="sm" onClick={()=>void refresh()} disabled={busy} aria-label={t('Perbarui koneksi')}><RefreshCw className={`h-4 w-4 ${busy?'animate-spin':''}`}/></Button>
      {setup?.paired&&<Button type="button" variant="ghost" size="sm" onClick={()=>void disconnect()} disabled={busy||working||!!connectionError}>{t('Putuskan')}</Button>}
    </div>
    {code&&<div className="space-y-2"><label htmlFor={codeId} className="text-xs text-muted-foreground">{t('Kode sekali pakai · berlaku 5 menit')}</label><div className="flex gap-2"><input id={codeId} readOnly value={code} className="min-w-0 w-full rounded-lg border border-border bg-input p-2 text-sm"/><Button type="button" variant="outline" size="sm" disabled={expired} onClick={()=>void copy(code)}>{t('Salin')}</Button></div><p className="text-xs text-muted-foreground">{expired?t('Kode kedaluwarsa. Buat kode pairing baru.'):`${t('Kedaluwarsa')}: ${new Date(expires).toLocaleTimeString()}`}</p></div>}
    {connectionError&&<p role="alert" className="text-xs leading-5 text-destructive">{t('Status bridge gagal dimuat. Periksa koneksi Pitstop lalu klik perbarui.')} {connectionError}</p>}
    {error&&<p role="alert" className="text-xs leading-5 text-destructive">{error}</p>}
  </section>;
}
