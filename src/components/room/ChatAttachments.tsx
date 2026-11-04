"use client";
import {useI18n} from "@/lib/i18n";

import { Download, FileText, X } from 'lucide-react';
import { ChatAttachment } from '@/lib/types';
import {useDownloadConfirmation,downloadFile} from './DownloadConfirmation';

export function ChatAttachments({ attachments, token, onRemove }: {
  attachments: ChatAttachment[];
  token: string;
  onRemove?: (id: string) => void;
}) {
  const {t}=useI18n();
  const confirmDownload=useDownloadConfirmation();
  return <div className="flex flex-wrap gap-2">
    {attachments.map(file => {
      const url = `/api/attachments/${encodeURIComponent(file.id)}?token=${encodeURIComponent(token)}`;
      return <div key={file.id} className="relative min-w-0 max-w-full rounded-xl border border-border bg-background/50 overflow-hidden">
        {file.kind === 'image' && <a href={url} target="_blank" rel="noreferrer" aria-label={t("Lihat foto {0}", [file.name])} className="block">
          {/* Authenticated originals must not go through the public image optimizer cache. */}
          <img src={url} alt={file.name} loading="lazy" className={`${onRemove ? 'h-20 w-32' : 'h-36 w-52'} object-contain bg-background`}/>
        </a>}
        <div className={`flex items-center gap-2 px-3 py-2 ${onRemove ? 'pr-9' : ''}`}>
          {file.kind !== 'image' && <FileText className="h-5 w-5 shrink-0 text-brand-cyan"/>}
          <a href={`${url}&download=1`} onClick={event=>{event.preventDefault();confirmDownload({filename:file.name,run:()=>downloadFile(`${url}&download=1`,file.name)});}} className="min-w-0 group" title={file.name}>
            <span className="block text-xs font-medium truncate max-w-44 group-hover:underline">{file.name}</span>
            <span className="block text-xs text-muted-foreground mt-0.5">{file.size < 1024*1024 ? `${Math.max(1,Math.round(file.size/1024))} KB` : `${(file.size/1024/1024).toFixed(1)} MB`}</span>
          </a>
          {!onRemove && <a href={`${url}&download=1`} onClick={event=>{event.preventDefault();confirmDownload({filename:file.name,run:()=>downloadFile(`${url}&download=1`,file.name)});}} aria-label={t("Unduh {0}", [file.name])} className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-foreground"><Download className="h-3.5 w-3.5"/></a>}
        </div>
        {file.notice && <p className="text-xs text-muted-foreground px-3 pb-2 max-w-64 leading-5">{file.notice}</p>}
        {onRemove && <button type="button" onClick={()=>onRemove(file.id)} aria-label={t("Lepas {0}", [file.name])} className="absolute right-1 top-1 h-7 w-7 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-secondary"><X className="h-3.5 w-3.5"/></button>}
      </div>;
    })}
  </div>;
}
