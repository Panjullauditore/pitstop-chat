"use client";
import {useEffect,useState} from 'react';
import {AlertTriangle} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {ProjectMemoryData} from '@/lib/types';
import {updateMemorySummary} from '@/lib/api';
import {DEFAULT_MEMORY_CHARACTERS,MIN_MEMORY_CHARACTERS,MAX_MEMORY_CHARACTERS,MEMORY_CONTEXT_WARNING_CHARACTERS,validMemoryLimit} from '@/lib/memory-limits.mjs';
import {useI18n} from '@/lib/i18n';
import {toast} from 'sonner';

export function MemoryLimitControl({memory,draftLength,token,onChanged}:{memory:ProjectMemoryData;draftLength:number;token:string;onChanged:()=>void}){
 const {t}=useI18n(),limit=memory.maxCharacters||DEFAULT_MEMORY_CHARACTERS;
 const [value,setValue]=useState(String(limit)),[busy,setBusy]=useState(false);
 useEffect(()=>setValue(String(limit)),[limit,memory.scopeId]);
 const proposed=Number(value),invalid=!validMemoryLimit(proposed),tooSmall=!invalid&&proposed<draftLength,running=memory.summary?.status==='running';
 const apply=async(event:React.FormEvent)=>{event.preventDefault();if(invalid||tooSmall||busy||running)return;setBusy(true);try{await updateMemorySummary('limit',{scopeId:memory.scopeId,maxCharacters:proposed},token);onChanged();toast.success(t('Batas Project Memory tersimpan'));}catch(error:any){toast.error(t('Gagal menyimpan batas memori'),{description:error.message});}finally{setBusy(false);}};
 return <form onSubmit={event=>void apply(event)} className="space-y-2">
  <label htmlFor="project-memory-limit" className="block text-xs font-medium">{t('Batas karakter Project Memory')}</label>
  <div className="flex gap-2"><input id="project-memory-limit" type="number" min={MIN_MEMORY_CHARACTERS} max={MAX_MEMORY_CHARACTERS} step={1} value={value} disabled={busy||running} onChange={event=>setValue(event.target.value)} aria-describedby="project-memory-limit-help" className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-xs tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"/><Button size="sm" type="submit" variant="outline" disabled={busy||running||invalid||tooSmall||proposed===limit}>{busy?t('Menyimpan…'):t('Terapkan')}</Button></div>
  <p id="project-memory-limit-help" className="text-xs leading-5 text-muted-foreground">{tooSmall?t('Batas harus mencakup isi editor saat ini. Teks tidak akan dipotong.'):t('Pilih 1.000–100.000 karakter. Ini batas atas, bukan target panjang rangkuman.')}</p>
  {(proposed>MEMORY_CONTEXT_WARNING_CHARACTERS||limit>MEMORY_CONTEXT_WARNING_CHARACTERS)&&<p className="flex gap-2 text-xs leading-5 text-amber-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true"/><span>{t('Di atas 50.000 karakter: semakin panjang isi memory yang dikirim, semakin banyak konteks dan jatah agent yang terpakai. Menaikkan batas saja tidak menambah pemakaian. Tetap utamakan rangkuman yang ringkas.')}</span></p>}
 </form>;
}
