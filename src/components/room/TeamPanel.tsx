"use client";
import {useI18n} from "@/lib/i18n";

import React from "react";
import { AgentDefinition, AgentQuotaStatus, LinkedAppChat } from "@/lib/types";
import { AgentQuotaIndicator } from "./AgentQuotaIndicator";
import { AgentCard } from "./AgentCard";
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
} from "lucide-react";

interface TeamPanelProps {
  linkedApps?:Partial<Record<string,LinkedAppChat>>;
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  agents: AgentDefinition[];
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
}

export function TeamPanel({
  linkedApps,
  isOpen,
  onClose,
  onOpen,
  agents,
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
}: TeamPanelProps) {
  const {t}=useI18n();


  const connectedCount = agents.filter((a) => a.connection === "connected" && a.transport!=="manual-web").length;
  const manualCount=agents.filter(a=>a.transport==='manual-web').length;
  const standbyCount = agents.length - connectedCount - manualCount;

  return <>
    <div onClick={onClose} className={`fixed inset-0 z-40 bg-black/60 xl:hidden transition-opacity duration-200 ${isOpen?'opacity-100':'opacity-0 pointer-events-none'}`} aria-hidden="true"/>
    <div className="pitlane-team-slot" data-open={isOpen}><div className="relative h-full min-w-0">
      <nav aria-label={t("Tim ringkas")} aria-hidden={isOpen} inert={isOpen} className={`hidden xl:flex absolute inset-y-0 right-0 w-[68px] bg-card border-l border-border/60 flex-col items-center py-3 gap-4 transition-opacity duration-150 ${isOpen?'opacity-0 pointer-events-none':'opacity-100'}`}>
        <button type="button" onClick={onOpen} aria-label={t("Buka panel tim")} title={t("Buka panel tim")} className="h-10 w-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground"><PanelRightOpen className="h-[18px] w-[18px]"/></button>
        <div className="flex-1 min-h-0 overflow-y-auto w-full flex flex-col items-center gap-5 py-1">
          {agents.map(agent=><div key={agent.id} className="flex flex-col items-center gap-1.5">
            <button type="button" onClick={()=>onOpenAgentProfile(agent)} aria-label={t("Pengaturan {0}", [agent.name])} title={agent.name} className="relative h-9 w-9 rounded-md border border-border bg-secondary flex items-center justify-center text-xs font-semibold hover:border-brand-cyan transition-colors">
              {agent.avatar?<img src={agent.avatar} alt="" className="w-full h-full rounded-md object-cover"/>:agent.name.slice(0,2).toUpperCase()}
              <span aria-hidden="true" className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-card ${busySpeaker===agent.id?'bg-primary animate-pulse':agent.connection==='connected'?'bg-brand-cyan':'bg-muted-foreground'}`}/>
            </button>
            <AgentQuotaIndicator agent={agent} status={linkedApps?.[agent.id]?.transport==='remote-app'?undefined:quotaMap[agent.id]}/>
          </div>)}
        </div>
        <button type="button" onClick={onOpenAddAgent} aria-label={t("Tambah agent")} title={t("Tambah agent")} className="h-10 w-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground"><Plus className="h-[18px] w-[18px]"/></button>
      </nav>
    <aside aria-label={t("Tim Agent")} aria-hidden={!isOpen} inert={!isOpen} data-open={isOpen} className="pitlane-team-panel fixed xl:absolute inset-y-0 right-0 z-50 w-[304px] max-w-[88vw] bg-card border-l border-border/60 flex flex-col">
      <div className="h-16 px-4 flex items-center justify-between shrink-0 border-b border-border/60"><h2 className="text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-brand-cyan"/>{t("Tim Agent")}</h2><div className="flex items-center gap-1"><button type="button" aria-label={t("Tambah agent")} onClick={onOpenAddAgent} className="h-8 px-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 text-xs font-semibold"><Plus className="w-3.5 h-3.5"/><span>Agent</span></button><button type="button" onClick={onClose} aria-label={t("Tutup panel tim")} title={t("Tutup panel tim")} className="h-9 w-9 rounded-lg hover:bg-secondary flex items-center justify-center"><PanelRightClose className="w-4 h-4"/></button></div></div>
      <div className="flex-1 overflow-y-auto px-3 py-4 min-h-0 space-y-3"><p className="text-xs text-muted-foreground px-1 pb-1"><span className="text-brand-cyan">{connectedCount} {t(" terhubung")}</span> · {standbyCount} {t(" belum terhubung")}{manualCount>0&&` · ${manualCount} web manual`}</p>{agents.map(agent=><AgentCard linkedApp={linkedApps?.[agent.id]} key={agent.id} agent={agent} isManager={agent.id===managerId} quotaStatus={quotaMap[agent.id]} isBusy={busySpeaker===agent.id} token={token} onOpenReconnect={onOpenReconnect} onOpenProfile={()=>onOpenAgentProfile(agent)} onQuotaUpdated={onQuotaUpdated}/>)}{!agents.length&&<p className="py-6 px-1 text-sm text-muted-foreground">{t("Belum ada agent dalam sesi ini. Atur peserta melalui menu chat.")}</p>}</div>
      <div className="p-3 border-t border-border/60 space-y-3 shrink-0"><button type="button" onClick={onOpenSoulMemory} className="w-full text-left rounded-xl border border-border/80 bg-background/40 p-3.5 hover:border-brand-cyan/50 transition-colors"><span className="flex items-center justify-between text-sm font-semibold"><span className="flex items-center gap-2"><Building className="w-4 h-4 text-brand-cyan"/>Project Memory</span><ExternalLink className="w-3.5 h-3.5 text-muted-foreground"/></span><span className="block text-sm truncate mt-3" title={projectName}>{projectName || t("Memori chat ini")}</span><span className="block text-xs text-muted-foreground mt-1 line-clamp-2 leading-5">{sessionSummary || t("Belum ada checkpoint diskusi.")}</span><span className="block text-xs text-brand-cyan mt-3">{t("Buka memori")}</span></button><div className="flex gap-2"><Button variant="outline" size="sm" onClick={onOpenAttendance} className="flex-1 text-xs gap-1.5"><UserCheck className="h-3.5 w-3.5"/>{t("Absen tim")}</Button></div></div>
    </aside>
    </div></div>
  </>;
}
