"use client";
import {useI18n} from "@/lib/i18n";
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { SessionData } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface Props {
  compact?: boolean;
  sessions: SessionData[];
  onSelect: (sessionId:string,messageId:string,query:string)=>Promise<void>;
}

export function HighlightMatch({text,query}:{text:string;query:string}) {
  const needle=query.trim().toLowerCase();
  if(!needle)return <>{text}</>;
  const parts:React.ReactNode[]=[];let position=0,index=text.toLowerCase().indexOf(needle);
  while(index!==-1){
    parts.push(text.slice(position,index));
    parts.push(<mark key={index} className="rounded-sm bg-yellow-300 text-slate-950 px-0.5">{text.slice(index,index+needle.length)}</mark>);
    position=index+needle.length;index=text.toLowerCase().indexOf(needle,position);
  }
  parts.push(text.slice(position));return <>{parts}</>;
}

export function MessageSearch({sessions,onSelect,compact=false}:Props) {
  const {t}=useI18n();
  const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const needle=query.trim().toLowerCase();
  const results=useMemo(()=>{
    if(!needle)return [];
    const rows=[];
    for(const session of sessions)for(const message of session.messages){
      const index=message.text.toLowerCase().indexOf(needle);if(index===-1)continue;
      const start=Math.max(0,index-65),end=Math.min(message.text.length,index+needle.length+110);
      rows.push({session,message,snippet:(start?'…':'')+message.text.slice(start,end)+(end<message.text.length?'…':'')});
      if(rows.length===100)return rows;
    }
    return rows;
  },[sessions,needle]);
  const select=async(sessionId:string,messageId:string)=>{
    if(busy)return;setBusy(true);setError('');
    try{await onSelect(sessionId,messageId,query.trim());setOpen(false);}catch(error:any){setError(error.message);}finally{setBusy(false);}
  };
  return <>
    <button type="button" aria-label={t("Cari dalam pesan")} title={t("Cari kata dalam semua chat")} className={compact?"h-9 w-9 shrink-0 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary":"h-8 flex items-center gap-1.5 rounded-md border border-border bg-secondary/60 px-2 text-muted-foreground hover:text-foreground"} onClick={()=>setOpen(true)}>
      <Search className="w-3.5 h-3.5"/>{!compact&&<span className="hidden xl:inline text-xs">{t("Cari pesan")}</span>}
    </button>
    <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}}><DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
      <DialogHeader><DialogTitle>{t("Cari dalam pesan")}</DialogTitle><DialogDescription>{t("Cari kata atau frasa di semua sesi. Pilih hasil untuk membuka chat dan langsung menuju pesannya.")}</DialogDescription></DialogHeader>
      <input autoFocus aria-label={t("Kata atau frasa dalam pesan")} placeholder={t("Ketik kata atau frasa…")} value={query} onChange={event=>setQuery(event.target.value)}
        onKeyDown={event=>{if(event.key==='Enter'&&!event.nativeEvent.isComposing&&results[0]){event.preventDefault();void select(results[0].session.id,results[0].message.id);}}}
        className="w-full rounded-lg bg-input border border-border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"/>
      {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="overflow-y-auto min-h-0 space-y-2" aria-label={t("Hasil pencarian pesan")} aria-busy={busy}>
        {!needle?<p className="text-sm text-muted-foreground py-3">{t("Masukkan kata yang ingin dicari.")}</p>:!results.length?<p role="status" className="text-sm text-muted-foreground py-3">{t("Tidak ada pesan yang cocok.")}</p>:results.map(({session,message,snippet})=><button key={`${session.id}:${message.id}`} disabled={busy} onClick={()=>void select(session.id,message.id)} className="block w-full rounded-lg border border-border p-3 text-left hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex justify-between gap-2 text-xs text-muted-foreground mb-1"><span className="truncate">{session.title}</span><span>{message.role==='user'?t("Pengguna"):message.role}</span></span>
          <span className="block text-sm break-words whitespace-pre-wrap"><HighlightMatch text={snippet} query={query}/></span>
        </button>)}
        {results.length===100&&<p className="text-xs text-muted-foreground">{t("Menampilkan 100 hasil pertama. Tambahkan kata agar pencarian lebih spesifik.")}</p>}
      </div>
    </DialogContent></Dialog>
  </>;
}
