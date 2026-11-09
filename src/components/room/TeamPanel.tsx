"use client";
import {useI18n} from "@/lib/i18n";

import React, {useState} from "react";
import {checkAgentConnections,setBotPower} from '@/lib/api';
import {toast} from 'sonner';
import { AgentDefinition, AgentQuotaStatus, LinkedAppChat } from "@/lib/types";
import { AgentQuotaIndicator } from "./AgentQuotaIndicator";
import { AgentCard } from "./AgentCard";
import {LiveDot} from "./LiveDot";
import { Button } from "@/components/ui/button";
import {
  Users,
  Plus,
  X,
  UserCheck,
  Settings,
  Brain,
  Building,
  MessageSquare,
  ExternalLink,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
} from "lucide-react";

interface TeamPanelProps {
  linkedApps?:Partial<Record<string,LinkedAppChat>>;
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  agents: AgentDefinition[];
  disabledBotIds: string[];
  onBotPowerChanged: (disabledBotIds: string[]) => void;
  quotaMap: Record<string, AgentQuotaStatus>;
  token: string;
  projectName?: string;
  managerId?: string;
  sessionSummary?: string;
  busySpeaker?: string | null;
  onOpenAddAgent: () => void;
  onOpenReconnect: () => void;
  onOpenAttendance: () => void;
  onOpenAgentProfile: (agent: AgentDefinition) => void;
  onOpenSoulMemory?: () => void;
  onQuotaUpdated?: (agentId: string, quota: any) => void;
  onConnectionsChecked:(sessionId:string,agents:AgentDefinition[])=>void;
}

export function TeamPanel({
  linkedApps,
  isOpen,
  onClose,
  onOpen,
  agents,
  disabledBotIds,
  onBotPowerChanged,
  quotaMap,
  token,
  projectName,
  managerId,
  sessionSummary,
  busySpeaker,
  onOpenAddAgent,
  onOpenReconnect,
  onOpenAttendance,
  onOpenAgentProfile,
  onOpenSoulMemory,
  onQuotaUpdated,
  onConnectionsChecked,
}: TeamPanelProps) {
  const {t}=useI18n();
  const [checking,setChecking]=useState<string|null>(null);
  const [checkMessage,setCheckMessage]=useState('');
  const [savingPower,setSavingPower]=useState(false);
  const toggleBot=async(agentId:string)=>{
    setSavingPower(true);
    try {
      onBotPowerChanged(await setBotPower(token,agentId,disabledBotIds.includes(agentId)));
    } catch(error) {
      toast.error(t('Gagal mengubah akses chat bot.'),{description:error instanceof Error?t(error.message):undefined});
    } finally {
      setSavingPower(false);
    }
  };
  const checkConnections=async(agentId?:string)=>{
    if(checking)return;
    setChecking(agentId||'all');setCheckMessage('');
    try{
      const result=await checkAgentConnections(token,agentId);
      onConnectionsChecked(result.sessionId,result.agents);
      const ids=agentId?[agentId]:agents.map(agent=>agent.id);
      const selected=result.agents.filter(agent=>ids.includes(agent.id));
      const count=selected.filter(agent=>agent.connection==='connected').length;
      const message=t('Diperiksa: {0}/{1} bot tersambung.',[String(count),String(selected.length)]);
      const phase=result.browser.request?.phase;
      const detail=ids.includes('deepseek')&&phase?(phase==='queued'?t('DeepSeek: menunggu bridge mengambil pesan.'):phase==='waiting-stream'?t('DeepSeek: bridge aktif, tetapi stream balasan belum diterima.'):phase==='waiting-answer'?t('DeepSeek: stream masuk, menunggu teks jawaban.'):t('DeepSeek: sedang menerima jawaban.')):'';
      setCheckMessage([message,detail].filter(Boolean).join(' '));
      toast.success(t('Pemeriksaan koneksi selesai'),{description:message});
    }catch(error:any){setCheckMessage(t('Pemeriksaan gagal. Coba lagi atau buka Settings → Extensions & Bridge.'));toast.error(t('Pemeriksaan koneksi gagal'),{description:error.message});}
    finally{setChecking(null);}
  };


  const connectedCount = agents.filter((a) => a.connection === "connected" && a.transport!=="manual-web").length;
  const manualCount=agents.filter(a=>a.transport==='manual-web').length;
  const standbyCount = agents.length - connectedCount - manualCount;

  return <>
    <div onClick={onClose} className={`fixed inset-0 z-40 bg-black/60 xl:hidden transition-opacity duration-200 ${isOpen?'opacity-100':'opacity-0 pointer-events-none'}`} aria-hidden="true"/>
    <div className="pitlane-team-slot" data-open={isOpen}><div className="relative h-full min-w-0">
      <nav aria-label={t("Tim ringkas")} aria-hidden={isOpen} inert={isOpen} className={`hidden xl:flex absolute inset-y-0 right-0 w-[68px] bg-rail border-l border-border/60 flex-col items-center py-3 gap-4 transition-opacity duration-150 ${isOpen?'opacity-0 pointer-events-none':'opacity-100'}`}>
        <button type="button" onClick={onOpen} aria-label={t("Buka panel tim")} title={t("Buka panel tim")} className="h-10 w-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground"><PanelRightOpen className="h-[18px] w-[18px]"/></button>
        <button type="button" onClick={()=>void checkConnections()} disabled={!!checking||!token||!agents.length} aria-label={t('Periksa semua koneksi')} title={t('Periksa semua koneksi')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-brand-cyan disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${checking?'animate-spin':''}`}/></button>
        <div className="flex-1 min-h-0 overflow-y-auto w-full flex flex-col items-center gap-5 py-1">
          {agents.map(agent=><div key={agent.id} className="flex flex-col items-center gap-1.5">
            <button type="button" onClick={()=>onOpenAgentProfile(agent)} aria-label={t("Pengaturan {0}", [agent.name])} title={agent.name} className="relative h-9 w-9 rounded-md border border-border bg-secondary flex items-center justify-center text-xs font-semibold hover:border-brand-cyan transition-colors">
              {agent.avatar?<img src={agent.avatar} alt="" className="w-full h-full rounded-md object-cover"/>:agent.name.slice(0,2).toUpperCase()}
              <span aria-hidden="true" className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-card ${busySpeaker===agent.id&&agent.connection==='connected'?'bg-primary animate-pulse':agent.connection==='connected'?'bg-brand-cyan':'bg-muted-foreground'}`}/>
            </button>
            <AgentQuotaIndicator agent={agent} status={linkedApps?.[agent.id]?.transport==='remote-app'?undefined:quotaMap[agent.id]}/>
          </div>)}
        </div>
        <button type="button" onClick={onOpenAddAgent} aria-label={t("Tambah agent")} title={t("Tambah agent")} className="h-10 w-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground"><Plus className="h-[18px] w-[18px]"/></button>
      </nav>
    <aside aria-label={t("Tim Agent")} aria-hidden={!isOpen} inert={!isOpen} data-open={isOpen} className="pitlane-team-panel fixed xl:absolute inset-y-0 right-0 z-50 w-[320px] max-w-[88vw] bg-rail border-l border-border/60 flex flex-col">
      <div className="h-[76px] px-4 flex items-center justify-between gap-2 shrink-0 border-b border-border"><div className="min-w-0"><h2 className="flex items-center gap-2 font-mono text-[11px] uppercase font-semibold whitespace-nowrap">{connectedCount?<LiveDot/>:<span className="h-2 w-2 rounded-full shrink-0 bg-brand-yellow"/>}{t("Tim Agent")}</h2><p className="mt-1.5 font-mono text-[9px] uppercase text-muted-foreground">{connectedCount} {t(" terhubung")} · {standbyCount} {t(" belum terhubung")}{manualCount>0&&` · ${manualCount} web manual`}</p></div><div className="flex items-center shrink-0 gap-1"><button type="button" aria-label={t("Tambah agent")} onClick={onOpenAddAgent} className="h-8 px-2 rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1 text-[10px] font-mono uppercase"><Plus className="w-3 h-3"/><span>Agent</span></button><button type="button" onClick={onClose} aria-label={t("Tutup panel tim")} title={t("Tutup panel tim")} className="h-8 w-6 rounded hover:bg-secondary flex items-center justify-center"><PanelRightClose className="w-3.5 h-3.5"/></button></div></div>
      <div className="border-b border-border px-3 py-2.5 space-y-2"><button type="button" onClick={()=>void checkConnections()} disabled={!!checking||!token||!agents.length} className="inline-flex min-h-8 items-center gap-2 rounded-md px-2 text-xs text-muted-foreground hover:bg-secondary hover:text-brand-cyan disabled:opacity-50"><RefreshCw className={'h-3.5 w-3.5 '+(checking?'animate-spin':'')}/>{checking?t('Memeriksa koneksi…'):t('Periksa semua koneksi')}</button><p role="status" className="text-[11px] leading-5 text-muted-foreground">{checkMessage}</p></div>
      <div className="flex-1 overflow-y-auto px-3 py-4 min-h-0 space-y-3">{agents.map(agent=><AgentCard linkedApp={linkedApps?.[agent.id]} key={agent.id} agent={agent} chatEnabled={!disabledBotIds.includes(agent.id)} powerDisabled={savingPower||!token} onTogglePower={()=>void toggleBot(agent.id)} checkingConnection={!!checking} onCheckConnection={()=>void checkConnections(agent.id)} isManager={agent.id===managerId} quotaStatus={quotaMap[agent.id]} isBusy={busySpeaker===agent.id} token={token} onOpenReconnect={onOpenReconnect} onOpenProfile={()=>onOpenAgentProfile(agent)} onQuotaUpdated={onQuotaUpdated}/>)}{!agents.length&&<p className="py-6 px-1 text-sm text-muted-foreground">{t("Belum ada agent dalam sesi ini. Atur peserta melalui menu chat.")}</p>}</div>
      <div className="p-3 border-t border-border/60 space-y-3 shrink-0"><button type="button" onClick={onOpenSoulMemory} className="w-full text-left rounded-xl border border-border/80 bg-card p-3.5 hover:border-brand-cyan/50 transition-colors"><span className="flex items-center justify-between text-sm font-semibold"><span className="flex items-center gap-2"><Building className="w-4 h-4 text-brand-cyan"/>Project Memory</span><ExternalLink className="w-3.5 h-3.5 text-muted-foreground"/></span><span className="mt-3 block rounded border border-border/70 bg-background px-2.5 py-2 text-xs truncate" title={projectName}>{projectName || t("Memori chat ini")}</span><span className="mt-2 block rounded border border-border/70 bg-background px-2.5 py-2 text-[11px] text-muted-foreground line-clamp-2 leading-5">{sessionSummary || t("Belum ada checkpoint diskusi.")}</span><span className="mt-3 block rounded border border-border bg-secondary py-2 text-center font-mono text-[10px] uppercase text-foreground">{t("Buka memori")}</span></button><div className="flex gap-2"><Button variant="outline" size="sm" onClick={onOpenAttendance} className="flex-1 text-xs gap-1.5"><UserCheck className="h-3.5 w-3.5"/>{t("Absen tim")}</Button></div></div>
    </aside>
    </div></div>
  </>;
}
