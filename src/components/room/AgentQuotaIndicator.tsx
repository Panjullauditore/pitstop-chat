"use client";
import {useI18n} from "@/lib/i18n";
import {useState} from 'react';
import {AgentDefinition,AgentQuotaStatus} from '@/lib/types';
import {quotaRows} from '@/lib/quota-view';
import {Tooltip,TooltipProvider,TooltipTrigger,TooltipContent} from '@/components/ui/tooltip';

export function AgentQuotaIndicator({agent,status}:{agent:AgentDefinition;status?:AgentQuotaStatus}){
  const {t}=useI18n();
  const [open,setOpen]=useState(false);
  const rows=quotaRows(agent,status?.data);
  const windows=[{label:'5-hour',match:/(?:^|[^0-9])5[\s-]*(?:h|hour|jam)/i},{label:'Weekly',match:/week|minggu/i}].map(({label,match})=>{
    const candidates=rows.filter(({bucket})=>match.test(`${bucket.name} ${bucket.id}`));
    const known=candidates.filter(({bucket})=>!bucket.disabled&&typeof bucket.remainingPercent==='number'&&Number.isFinite(bucket.remainingPercent));
    const percent=known.length?Math.max(0,Math.min(100,Math.min(...known.map(({bucket})=>bucket.remainingPercent!)))):null;
    return {label,percent,disabled:!!candidates.length&&candidates.every(({bucket})=>bucket.disabled)};
  });
  return <TooltipProvider delayDuration={0}><Tooltip open={open} onOpenChange={setOpen}><TooltipTrigger asChild>
    <button type="button" aria-label={`Limit ${agent.name}: ${windows.map(item=>`${item.label} ${item.percent===null?t("belum tersedia"):t("{0}% tersisa", [item.percent])}`).join(', ')}`} onClick={()=>setOpen(value=>!value)} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors">
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
        {windows.map((item,index)=><g key={item.label} transform="rotate(-90 16 16)"><circle cx="16" cy="16" r={index?9:13} fill="none" stroke="currentColor" className="text-border" strokeWidth="2.5"/>{item.percent!==null&&<circle cx="16" cy="16" r={index?9:13} fill="none" pathLength="100" stroke="currentColor" className={item.percent<=5?'text-primary':index?'text-brand-blue':'text-brand-cyan'} strokeWidth="2.5" strokeLinecap={item.percent>0?'round':'butt'} strokeDasharray={`${item.percent} 100`}/>}</g>)}
        <path d="M16 12l4 4-4 4-4-4z" fill="currentColor" className="text-muted-foreground"/>
      </svg>
    </button>
  </TooltipTrigger><TooltipContent side="left" sideOffset={10} className="min-w-48 rounded-xl p-3 space-y-2">
    <p className="font-semibold">Limit {agent.name}</p>
    {windows.map((item,index)=><div key={item.label} className="flex items-center justify-between gap-5 text-xs"><span className="flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full ${index?'bg-brand-blue':'bg-brand-cyan'}`}/>{item.label}</span><span className="tabular-nums">{item.percent===null?item.disabled?t("Tidak berlaku"):t("Belum tersedia"):t("{0}% tersisa", [new Intl.NumberFormat('id-ID',{maximumFractionDigits:1}).format(item.percent)])}</span></div>)}
    {status?.status==='error'&&<p className="text-xs text-muted-foreground">{t("Pembaruan limit belum berhasil.")}</p>}
  </TooltipContent></Tooltip></TooltipProvider>;
}
