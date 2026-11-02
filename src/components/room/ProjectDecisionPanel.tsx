"use client";
import {useI18n} from "@/lib/i18n";
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {toast} from 'sonner';

export function ProjectDecisionPanel({question,onDecision,disabled}:{question:string;onDecision:(text:string)=>Promise<void>;disabled:boolean}){
  const {t}=useI18n();
  const [text,setText]=useState(''),[busy,setBusy]=useState(false);
  const submit=async(e:React.FormEvent)=>{e.preventDefault();if(!text.trim())return;setBusy(true);try{await onDecision(text.trim());}catch(error:any){toast.error(t("Keputusan belum tersimpan"),{description:error.message});}finally{setBusy(false);}};
  return <section aria-label={t("Keputusan General Manager")} className="shrink-0 px-4 sm:px-6 py-4 border-t border-primary/30 bg-background max-h-[50dvh] overflow-y-auto">
    <form onSubmit={submit} className="max-w-[760px] mx-auto space-y-3">
      <h2 className="font-semibold text-sm text-primary">{t("Tim menunggu keputusan General Manager")}</h2>
      <p className="text-sm leading-6 whitespace-pre-wrap max-h-28 overflow-y-auto">{question}</p>
      <p className="text-xs text-muted-foreground">{t("Diskusi dihentikan. Tetapkan pilihan atau arah baru; semua agent akan menerima keputusanmu sebelum melanjutkan.")}</p>
      <textarea aria-label={t("Keputusan General Manager")} value={text} onChange={e=>setText(e.target.value)} maxLength={8000} rows={3} disabled={busy||disabled} placeholder={t("Keputusan saya: …")} className="w-full rounded-xl border border-border bg-input p-3 text-sm outline-none focus:ring-2 focus:ring-ring"/>
      <div className="flex justify-end"><Button type="submit" disabled={busy||disabled||!text.trim()}>{busy?t("Menyimpan keputusan…"):t("Tetapkan keputusan & lanjutkan")}</Button></div>
    </form>
  </section>;
}
