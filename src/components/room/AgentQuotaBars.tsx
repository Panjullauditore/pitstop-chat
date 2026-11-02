"use client";
import {useI18n} from "@/lib/i18n";
import {useEffect,useRef,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {AgentDefinition,AgentQuotaStatus,QuotaData} from '@/lib/types';
import {checkAgentQuota} from '@/lib/api';
import {quotaRows} from '@/lib/quota-view';
import {formatJakartaDate} from '@/lib/utils';

export function AgentQuotaBars({agent,quotaStatus,token,onQuotaUpdated}:{agent:AgentDefinition;quotaStatus?:AgentQuotaStatus;token:string;onQuotaUpdated?:(id:string,data:QuotaData)=>void}){
  const {t}=useI18n();
  const [loading,setLoading]=useState(false),[error,setError]=useState('');
  const [local,setLocal]=useState<QuotaData|null>(null);
  const callback=useRef(onQuotaUpdated);callback.current=onQuotaUpdated;
  const inFlight=useRef(false);
  useEffect(()=>{setLocal(null);},[quotaStatus]);
  const refresh=async(force=false)=>{
    if(inFlight.current||!token||['claude','deepseek'].includes(agent.id)||agent.connection!=='connected')return;
    inFlight.current=true;setLoading(true);
    try{const data=await checkAgentQuota(agent.id,token,force);setLocal(data);setError('');callback.current?.(agent.id,data);}
    catch(e:any){setError(e.message || t("Gagal membaca limit."));}
    finally{inFlight.current=false;setLoading(false);}
  };
  useEffect(()=>{
    void refresh();
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},60000);
    return ()=>clearInterval(timer);
  },[agent.id,agent.connection,token]);
  const data=local||quotaStatus?.data;
  const rows=quotaRows(agent,data);
  const groupCount=new Set(rows.map(row=>row.group)).size;
  return <section aria-label={t("Sisa limit {0}", [agent.name])} className="border-t border-border/50 pt-3 space-y-2.5">
    <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium">{t("Sisa limit")}</span>{!['claude','deepseek'].includes(agent.id)&&<button type="button" onClick={()=>void refresh(true)} disabled={loading||agent.connection!=='connected'} aria-label={t("Perbarui limit {0}", [agent.name])} title={t("Perbarui limit")} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40"><RefreshCw className={`w-3 h-3 ${loading?'animate-spin':''}`}/></button>}</div>
    {rows.length?rows.map(({group,bucket},index)=>{
      const available=!bucket.disabled&&typeof bucket.remainingPercent==='number'&&Number.isFinite(bucket.remainingPercent);
      const percent=available?Math.max(0,Math.min(100,bucket.remainingPercent!)):0;
      const low=available&&percent<=5;
      const label=available?`${new Intl.NumberFormat('id-ID',{maximumFractionDigits:1}).format(percent)}%`:bucket.disabled?t("Tidak berlaku"):t("Belum tersedia");
      return <div key={`${group}-${bucket.id}-${index}`} className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-xs"><span className="text-muted-foreground truncate" title={group}>{groupCount>1?`${group} · `:''}{t(bucket.name)}</span><span className={`shrink-0 tabular-nums ${low?'text-primary':available?'text-brand-cyan':'text-muted-foreground'}`}>{label}</span></div>
        {available&&<div role="progressbar" aria-label={t("{0}: {1}, sisa limit", [agent.name, bucket.name])} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="h-1.5 rounded-full bg-secondary overflow-hidden"><div className={`h-full rounded-full ${low?'bg-primary':'bg-brand-cyan'}`} style={{width:`${percent}%`}}/></div>}
        {bucket.resetAt&&!bucket.disabled&&<p className="text-xs leading-5 text-muted-foreground">Reset {formatJakartaDate(bucket.resetAt)}</p>}
      </div>;
    }):<p className="text-xs leading-5 text-muted-foreground">{loading?t("Membaca limit…"):agent.id==='deepseek'?t("Kuota web tidak dibaca otomatis."):agent.id==='claude'?t("Belum tersedia dari CLI Claude."):error||quotaStatus?.error?t("Limit belum tersedia. Coba perbarui."):t("Belum tersedia dari provider.")}</p>}
    {(error||quotaStatus?.status==='error')&&rows.length>0&&<p className="text-xs text-muted-foreground">{t("Pembaruan gagal; menampilkan data terakhir.")}</p>}
  </section>;
}
