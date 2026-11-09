"use client";

import {useState} from 'react';
import {ListOrdered, Pencil, Play, X} from 'lucide-react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {updateChatQueue} from '@/lib/api';
import {useI18n} from '@/lib/i18n';
import type {QueuedChat} from '@/lib/types';

export function ChatQueue({items,token,sessionId,disabled}:{items:QueuedChat[];token:string;sessionId:string;disabled:boolean}) {
  const {t}=useI18n();
  const [editing,setEditing]=useState<{id:string;text:string}|null>(null);
  const [busy,setBusy]=useState(false);
  const edit=items.find(item=>item.id===editing?.id);
  if(!items.length)return null;

  const update=async(item:QueuedChat,action:'hold'|'edit'|'resume'|'cancel',text?:string)=>{
    setBusy(true);
    try{
      await updateChatQueue(token,sessionId,item.id,action,text);
      if(action==='hold')setEditing({id:item.id,text:item.text});
      else if(item.id===editing?.id)setEditing(null);
    }catch(error){
      toast.error(t('Gagal memperbarui antrean.'),{description:error instanceof Error?t(error.message):undefined});
    }finally{setBusy(false);}
  };

  return <section aria-label={t('Antrean pesan')} className="shrink-0 border-t border-border bg-rail px-4 py-2 sm:px-6">
    <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
      <h2 className="flex items-center gap-2 font-semibold"><ListOrdered className="h-4 w-4 text-brand-cyan" aria-hidden="true"/>{t('Antrean pesan')}</h2>
      <span aria-live="polite" className="tabular-nums text-muted-foreground">{items.length} / 5</span>
    </div>
    <ol className="max-h-[30dvh] space-y-1 overflow-y-auto overscroll-contain">
      {items.map((item,index)=><li key={item.id} className="pitstop-queue-entry rounded-md border border-border bg-card">
        <div className="flex min-h-10 items-center gap-2 px-2.5">
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{index+1}.</span>
          <div className="min-w-0 flex-1 py-1.5">
            <p className="truncate text-xs" title={item.text}>{item.text||t('{0} lampiran',[item.attachmentIds.length])}</p>
            {item.error&&<p className="mt-0.5 text-xs text-destructive">{t(item.error)}</p>}
            {item.held&&editing?.id!==item.id&&<p className="mt-0.5 text-xs text-muted-foreground">{t('Dijeda untuk diedit')}</p>}
          </div>
          {editing?.id!==item.id&&<Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={disabled||busy||Boolean(edit)} onClick={()=>void update(item,'hold')} aria-label={t('Edit pesan antrean {0}',[index+1])} title={t('Edit')}><Pencil className="h-3.5 w-3.5"/></Button>}
          {editing?.id!==item.id&&(item.held||item.error)&&<Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={disabled||busy} onClick={()=>void update(item,'resume')} aria-label={t('Lanjutkan pesan antrean {0}',[index+1])} title={t('Lanjutkan')}><Play className="h-3.5 w-3.5"/></Button>}
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" disabled={disabled||busy} onClick={()=>void update(item,'cancel')} aria-label={t('Batalkan pesan antrean {0}',[index+1])} title={t('Batalkan pesan')}><X className="h-4 w-4"/></Button>
        </div>
        {editing?.id===item.id&&<form className="space-y-2 px-2.5 pb-2.5" onSubmit={event=>{event.preventDefault();void update(item,'edit',editing.text);}}>
          <textarea autoFocus value={editing.text} onChange={event=>setEditing({id:item.id,text:event.target.value})} aria-label={t('Edit pesan antrean {0}',[index+1])} maxLength={8000} rows={2} className="w-full resize-y rounded-md border border-border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"/>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" disabled={disabled||busy} onClick={()=>void update(item,'resume')}>{t('Batal edit')}</Button>
            <Button type="submit" size="sm" disabled={disabled||busy||(!editing.text.trim()&&!item.attachmentIds.length)}>{t('Simpan perubahan')}</Button>
          </div>
        </form>}
      </li>)}
    </ol>
  </section>;
}
