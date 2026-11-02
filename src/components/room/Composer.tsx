"use client";
import {useI18n} from "@/lib/i18n";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Send,
  Square,
  Radio,
  Paperclip,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { AgentDefinition, ChatAttachment } from "@/lib/types";
import { uploadChatFile } from "@/lib/api";
import { ChatAttachments } from "./ChatAttachments";
import {messageRecipient,selectRecipient} from '@/lib/recipient.mjs';

interface ComposerProps {
  onSendMessage: (text: string, mode: string, syncMemory?: boolean, attachmentIds?: string[]) => Promise<void>;
  token: string;
  sessionId: string;
  onStop: () => Promise<void>;
  isRunning: boolean;
  isStopping: boolean;
  statusText?: string;
  errorMessage?: string;
  agents: AgentDefinition[];
  disabled?: boolean;
}

export function Composer({
  onSendMessage,
  token,
  sessionId,
  onStop,
  isRunning,
  isStopping,
  statusText = "Siap untuk topik diskusi berikutnya.",
  errorMessage,
  agents,
  disabled = false,
}: ComposerProps) {
  const {t}=useI18n();
  const [text, setText] = useState("");
  const targetRecipient = messageRecipient(text,agents)?.id || 'broadcast';
  const [syncMemory, setSyncMemory] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadLock = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const chooseRecipient=(id:string)=>{
    const next=selectRecipient(text,agents,id);
    setText(next);
    requestAnimationFrame(()=>{
      const field=textareaRef.current;
      if(field){field.focus();field.setSelectionRange(next.length,next.length);}
    });
  };

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
    }
  }, [text]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if ((!trimmed && !attachments.length) || disabled || submitting || isRunning || uploadLock.current) return;

    const mode = targetRecipient === 'broadcast' ? 'discussion' : targetRecipient;

    setSubmitting(true);
    try {
      await onSendMessage(trimmed, mode, syncMemory, attachments.map(file=>file.id));
      setText("");
      setAttachments([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (error: any) {
      toast.error(t("Pesan gagal dikirim"), {description:error.message});
    } finally {
      setSubmitting(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const addFiles = async (files: File[]) => {
    if (uploadLock.current || disabled || submitting || isRunning || !files.length) return;
    if (files.length + attachments.length > 5) { toast.error(t("Maksimal 5 file per pesan")); return; }
    if (files.some(file=>file.size>10*1024*1024)) { toast.error(t("Ukuran file maksimal 10 MB")); return; }
    uploadLock.current = true; setUploading(true);
    try {
      for (const file of files) {
        try {
          const attachment = await uploadChatFile(file, token, sessionId);
          setAttachments(previous=>[...previous,attachment]);
        } catch (error: any) { toast.error(t("Gagal mengunggah {0}", [file.name]), {description:error.message}); }
      }
    } finally { uploadLock.current=false; setUploading(false); }
  };

  return <footer className="px-4 pb-4 pt-3 sm:px-6 shrink-0 bg-background">
    <div className="max-w-[760px] mx-auto">
      <p className="text-xs text-muted-foreground mb-3 flex items-center gap-2 min-h-4" role="status"><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${disabled?'bg-muted-foreground':isRunning?'bg-brand-cyan animate-pulse':'bg-brand-cyan'}`}/>{disabled?t("Menyambungkan ke Pitlane…"):t(statusText)}</p>
      <div onDragOver={event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();setDragging(true);}}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setDragging(false);}} onDrop={event=>{if(!event.dataTransfer.files.length)return;event.preventDefault();setDragging(false);void addFiles(Array.from(event.dataTransfer.files));}} className={`rounded-2xl border bg-card p-3 sm:p-4 focus-within:border-accent transition-colors ${dragging?'border-brand-cyan bg-brand-cyan/5':'border-border'}`}>
        <input ref={fileInputRef} type="file" multiple hidden accept="image/png,image/jpeg,image/webp,image/gif,.pdf,.docx,.txt,.md,.markdown,.csv,.tsv,.json,.jsonl,.yaml,.yml,.xml,.html,.css,.scss,.js,.jsx,.mjs,.cjs,.ts,.tsx,.py,.lua,.luau,.sql,.sh,.ps1,.bat,.log,.ini,.toml,.rs,.go,.java,.c,.h,.cpp,.hpp,.cs,.rb,.php,.svelte,.vue,.gitignore" onChange={event=>{void addFiles(Array.from(event.target.files || []));event.target.value='';}}/>
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-border/60 text-xs">
          <div role="group" aria-label={t("Tujuan pesan")} className="flex flex-wrap items-center gap-1">
            <span className="text-muted-foreground mr-1">{t("Kirim ke")}</span>
            <button type="button" aria-pressed={targetRecipient==='broadcast'} onClick={()=>chooseRecipient('broadcast')} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors ${targetRecipient==='broadcast'?'bg-primary/15 text-primary':'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}><Radio className="h-3.5 w-3.5"/>{t("Tim (Semua)")}</button>
            {agents.map(agent=><button type="button" key={agent.id} aria-pressed={targetRecipient===agent.id} onClick={()=>chooseRecipient(agent.id)} className={`rounded-lg px-2 py-1.5 transition-colors ${targetRecipient===agent.id?'bg-accent text-accent-foreground':'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>@{agent.name}</button>)}
          </div>
          <label className="flex items-center gap-2 text-muted-foreground"><input type="checkbox" checked={syncMemory} onChange={event=>setSyncMemory(event.target.checked)} className="accent-primary"/>{t("Catat ke Project Memory")}</label>
        </div>
        {attachments.length>0&&<div className="mb-3 max-h-52 overflow-y-auto"><ChatAttachments attachments={attachments} token={token} onRemove={submitting?undefined:id=>setAttachments(previous=>previous.filter(file=>file.id!==id))}/></div>}
        {(uploading||dragging)&&<p role="status" className="mb-3 flex items-center gap-2 text-xs text-brand-cyan">{uploading&&<Loader2 className="h-3.5 w-3.5 animate-spin"/>}{uploading?t("Mengunggah dan menyiapkan lampiran…"):t("Lepaskan file untuk melampirkan")}</p>}
        <textarea aria-label={t("Pesan untuk agent")} ref={textareaRef} value={text} onChange={event=>setText(event.target.value)} onKeyDown={handleKeyDown} onPaste={event=>{if(event.clipboardData.files.length){event.preventDefault();void addFiles(Array.from(event.clipboardData.files));}}} placeholder={t("Tulis pesan untuk tim…")} rows={2} maxLength={8000} disabled={disabled||submitting} className="w-full bg-transparent text-sm leading-6 resize-none outline-none placeholder:text-muted-foreground min-h-16"/>
        <div className="flex items-center justify-between gap-2 mt-3">
          <div className="flex items-center gap-1">
            <button type="button" disabled={disabled||uploading||submitting||isRunning||attachments.length>=5} onClick={()=>fileInputRef.current?.click()} title={t("Lampirkan file atau foto (maks. 5 file, 10 MB/file). Bisa drag atau paste foto.")} aria-label={t("Lampirkan file atau foto")} className="h-9 w-9 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-brand-cyan disabled:opacity-40 disabled:cursor-not-allowed">{uploading?<Loader2 className="h-4 w-4 animate-spin"/>:<Paperclip className="h-4 w-4"/>}</button>
            <span className="hidden md:inline text-xs text-muted-foreground ml-2">{t("Enter kirim · Shift+Enter baris baru")}</span>
          </div>
          {isRunning?<Button variant="destructive" onClick={onStop} disabled={isStopping} className="h-9 gap-2 text-xs"><Square className="w-3 h-3"/>{isStopping?t("Menghentikan…"):t("Hentikan")}</Button>:<Button onClick={()=>void handleSubmit()} disabled={disabled||(!text.trim()&&!attachments.length)||submitting||uploading} className="h-9 gap-2 text-xs"><span>{submitting?t("Mengirim…"):t("Kirim")}</span><Send className="w-3.5 h-3.5"/></Button>}
        </div>
      </div>
      {errorMessage&&<p role="alert" className="text-xs text-destructive mt-2">{errorMessage}</p>}
    </div>
  </footer>;
}
