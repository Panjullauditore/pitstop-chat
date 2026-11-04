"use client";
import {useState} from 'react';
import {RefreshCw,Square} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {AgentDefinition,ProjectMemoryData} from '@/lib/types';
import {useI18n} from '@/lib/i18n';
import {updateMemorySummary} from '@/lib/api';
import {formatJakartaDate} from '@/lib/utils';
import {toast} from 'sonner';

export function MemorySummaryControls({memory,agents,token,dirty,onChanged}:{memory:ProjectMemoryData;agents:AgentDefinition[];token:string;dirty:boolean;onChanged:()=>void}){
 const {t}=useI18n(),[busy,setBusy]=useState(false),summary=memory.summary;
 if(!summary)return null;
 const running=summary.status==='running',choices=agents.filter(a=>summary.agentIds.includes(a.id));
 const act=async(action:'settings'|'update'|'stop',settings?:Record<string,unknown>)=>{
  setBusy(true);try{await updateMemorySummary(action,{scopeId:memory.scopeId,...settings},token);onChanged();}catch(error:any){toast.error(t('Gagal memperbarui rangkuman'),{description:error.message});}finally{setBusy(false);}
 };
 return <section className="space-y-3 border-y border-border py-4" aria-label={t('Pembaruan rangkuman')}>
  <div className="flex gap-2 items-end">
   <div className="min-w-0 flex-1 space-y-1.5"><label htmlFor="memory-summarizer" className="text-xs font-medium">{t('Agent perangkum')}</label>
    <select id="memory-summarizer" value={summary.agentId} disabled={busy||running} onChange={e=>void act('settings',{autoEnabled:summary.autoEnabled,agentId:e.target.value})} className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
     {!choices.some(a=>a.id===summary.agentId)&&<option value={summary.agentId}>{t('Pilih agent')}</option>}
     {choices.map(agent=><option value={agent.id} key={agent.id}>{agent.name}{agent.connection==='disconnected'?` · ${t('Terputus')}`:''}</option>)}
    </select>
   </div>
   <Button size="sm" variant={running?'outline':'default'} disabled={busy||(!running&&(dirty||!summary.pendingMessages||!choices.length))} onClick={()=>void act(running?'stop':'update')} className="h-9 shrink-0 gap-1.5">
    {running?<Square className="h-3.5 w-3.5"/>:<RefreshCw className="h-3.5 w-3.5"/>}{running?t('Hentikan'):t('Perbarui sekarang')}
   </Button>
  </div>
  <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={summary.autoEnabled} disabled={busy||running||!choices.length} onChange={e=>void act('settings',{autoEnabled:e.target.checked,agentId:summary.agentId})} className="accent-primary h-3.5 w-3.5"/>{t('Perbarui otomatis setelah diskusi')}</label>
  <p className="text-xs leading-5 text-muted-foreground">{t('Gabungkan diskusi baru dari semua sesi proyek ke rangkuman inti. Memakai jatah agent yang dipilih; tidak mengganti Project Manager.')}</p>
  <div className="space-y-1 text-xs leading-5" role="status" aria-live="polite">
   <p className={summary.status==='error'?'text-destructive':'text-muted-foreground'}>{running?t('Merangkum bagian {0} dari {1}…',[summary.batch||1,summary.totalBatches||1]):summary.status==='error'?t(summary.error||'Gagal memperbarui rangkuman'):summary.status==='stopped'?t('Update dihentikan. Bagian yang belum tersimpan tetap menunggu.'):summary.pendingMessages?t('Ada diskusi baru yang belum dirangkum.'):summary.lastUpdatedAt?t('Semua diskusi yang tersedia sudah dirangkum.'):t('Belum ada diskusi untuk dirangkum.')}</p>
   <p className="text-muted-foreground">{summary.lastUpdatedAt?t('Terakhir dirangkum: {0}',[formatJakartaDate(summary.lastUpdatedAt)]):t('Belum ada checkpoint rangkuman. Update pertama membaca riwayat proyek yang tersedia.')}</p>
   {summary.throughAt&&<p className="text-muted-foreground">{t('Diskusi tercakup sampai: {0}',[formatJakartaDate(summary.throughAt)])}</p>}
   {dirty&&<p className="text-brand-cyan">{t('Simpan perubahan editor sebelum meminta update dari agent.')}</p>}
  </div>
 </section>;
}
