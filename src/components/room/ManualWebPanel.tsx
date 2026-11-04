"use client";
import {useI18n} from "@/lib/i18n";
import {useState} from 'react';
import {Copy,ExternalLink} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {RoomSnapshot} from '@/lib/types';
import {toast} from 'sonner';
import {useDownloadConfirmation,downloadFile} from './DownloadConfirmation';

export function ManualWebPanel({request,token,onStop}:{request:NonNullable<RoomSnapshot['webRequest']>;token:string;onStop:()=>Promise<void>}){
  const {t}=useI18n();
  const confirmDownload=useDownloadConfirmation();
  const [text,setText]=useState(''),[busy,setBusy]=useState(false),[needsDecision,setNeedsDecision]=useState(false);
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);try{
    const res=await fetch('/api/web-agent/reply',{method:'POST',headers:{'Content-Type':'application/json','X-Room-Token':token,'X-Room-Session':request.sessionId},body:JSON.stringify({requestId:request.id,text,needsDecision})});
    const data=await res.json();if(!res.ok)throw new Error(data.error || t("Balasan gagal diimpor."));toast.success(t("Balasan DeepSeek diimpor"));
  }catch(error:any){toast.error(t("Gagal mengimpor balasan"),{description:error.message});setBusy(false);}};
  const copy=async()=>{try{await navigator.clipboard.writeText(request.prompt);toast.success(t("Konteks disalin"));}catch{toast.error(t("Clipboard tidak diizinkan. Buka konteks dan salin teks secara manual."));}};
  return <section aria-label={t("Balasan DeepSeek Web manual")} className="shrink-0 max-h-[55dvh] overflow-y-auto border-t border-brand-cyan/30 px-4 sm:px-6 py-4 bg-background">
    <form onSubmit={submit} className="max-w-[760px] mx-auto space-y-3">
      <h2 className="text-sm font-semibold">{t("DeepSeek Web · menunggu balasan manual")}</h2>
      <p className="text-xs text-muted-foreground leading-5">{t("Salin konteks, buka chat baru di DeepSeek, lalu tempel dan kirim. Setelah mendapat jawaban, salin balasannya ke kolom di bawah. Tim Pitstop menunggu giliran ini selesai.")}</p>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={()=>void copy()} className="gap-2"><Copy className="h-4 w-4"/>{t("Salin konteks lengkap")}</Button><Button variant="outline" asChild><a href="https://chat.deepseek.com/" target="_blank" rel="noreferrer" className="gap-2">{t("Buka DeepSeek")}<ExternalLink className="h-4 w-4"/></a></Button></div>
      <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">{t("Lihat konteks yang akan dikirim")}</summary><textarea aria-label={t("Konteks lengkap untuk DeepSeek")} readOnly value={request.prompt} rows={6} className="mt-2 w-full rounded-lg border border-border bg-input p-3 text-xs leading-5"/></details>
      {!!request.attachments.length&&<div className="text-xs leading-5 text-muted-foreground">{t("Foto harus diunggah sendiri ke DeepSeek agar dapat dilihat:")}{request.attachments.map(file=><a key={file.id} href={`/api/attachments/${encodeURIComponent(file.id)}?download=1&token=${encodeURIComponent(token)}`} onClick={event=>{event.preventDefault();confirmDownload({filename:file.name,run:()=>downloadFile(`/api/attachments/${encodeURIComponent(file.id)}?download=1&token=${encodeURIComponent(token)}`,file.name)});}} className="block text-brand-cyan underline">{t("Unduh ")}{file.name}</a>)}</div>}
      <textarea aria-label={t("Balasan dari DeepSeek web")} value={text} onChange={e=>setText(e.target.value)} placeholder={t("Tempel jawaban DeepSeek di sini…")} maxLength={40000} rows={3} disabled={busy} required className="w-full rounded-xl border border-border bg-input p-3 text-sm outline-none focus:ring-2 focus:ring-ring"/>
      <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={needsDecision} disabled={busy} onChange={e=>setNeedsDecision(e.target.checked)}/>{t("Balasan ini memerlukan keputusan saya / ada perdebatan")}</label>
      <div className="flex justify-between gap-2"><Button type="button" variant="outline" disabled={busy} onClick={()=>void onStop()}>{t("Hentikan diskusi")}</Button><Button type="submit" disabled={busy||!text.trim()}>{busy?t("Mengimpor…"):t("Impor balasan & lanjutkan")}</Button></div>
    </form>
  </section>;
}
