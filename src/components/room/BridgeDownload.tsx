"use client";

import {useState} from 'react';
import {Copy,Download} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {useI18n} from '@/lib/i18n';
import {toast} from 'sonner';
import {useDownloadConfirmation} from './DownloadConfirmation';

export function BridgeDownload({token}:{token:string}){
  const {t}=useI18n();
  const confirmDownload=useDownloadConfirmation();
  const [downloading,setDownloading]=useState(false);
  const [error,setError]=useState('');
  const download=async()=>{
    setDownloading(true);setError('');
    try{
      const response=await fetch('/api/extensions/bridge/download',{headers:{'X-Room-Token':token},signal:AbortSignal.timeout(30000)});
      if(!response.ok){const data=await response.json();throw new Error(data.error||t('Gagal mengunduh bridge.'));}
      const url=URL.createObjectURL(await response.blob());
      const link=document.createElement('a');
      link.href=url;link.download=response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]||'pitstop-bridge.zip';
      document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(error:any){setError(error.message||t('Gagal mengunduh bridge.'));}
    finally{setDownloading(false);}
  };
  const copy=async()=>{try{await navigator.clipboard.writeText('chrome://extensions');toast.success(t('Alamat halaman extension disalin'));}catch{toast.error(t('Tidak bisa menyalin teks'));}};
  return <section className="border-b border-border pb-5 space-y-3" aria-label={t('Pasang Bridge')}>
    <div className="flex flex-wrap items-center gap-2"><Button type="button" size="sm" onClick={()=>confirmDownload({filename:'pitstop-bridge.zip',run:download})} disabled={!token||downloading} className="gap-2"><Download className="h-4 w-4"/>{downloading?t('Mengunduh…'):t('Download Bridge')}</Button><Button type="button" size="sm" variant="outline" onClick={()=>void copy()} className="gap-2"><Copy className="h-3.5 w-3.5"/>{t('Salin chrome://extensions')}</Button></div>
    <p className="text-xs leading-5 text-muted-foreground">{t('Chrome tidak memasang extension ZIP langsung dari website. Setelah mengunduh, ikuti langkah ini:')}</p>
    <ol className="list-decimal space-y-2 pl-4 text-xs leading-5 text-muted-foreground">
      <li>{t('Ekstrak ZIP ke folder permanen. Jangan hapus folder setelah dipasang.')}</li>
      <li>{t('Buka chrome://extensions, aktifkan Developer mode, lalu klik Load unpacked. Pilih folder pitstop-bridge yang berisi manifest.json.')}</li>
      <li>{t('Buka DeepSeek atau Antigravity di profil Chrome yang sama, lalu gunakan kode pairing dari bagian layanan di bawah.')}</li>
    </ol>
    <p className="text-xs leading-5 text-muted-foreground">{t('Sudah terpasang? Untuk memperbarui, ekstrak ke folder extension yang sama, klik Reload di Chrome, lalu refresh DeepSeek. Tidak perlu pairing ulang.')}</p>
    {error&&<p role="alert" className="text-xs leading-5 text-destructive">{error}</p>}
  </section>;
}
