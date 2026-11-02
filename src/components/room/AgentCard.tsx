"use client";
import {useI18n} from "@/lib/i18n";

import React, {useState} from "react";
import {BrowserBridgeSetup} from "./BrowserBridgeSetup";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";

import { AgentDefinition, AgentQuotaStatus, LinkedAppChat } from "@/lib/types";
import { AgentQuotaBars } from "./AgentQuotaBars";
import { Cpu, RefreshCw, Settings } from "lucide-react";

interface AgentCardProps {
  linkedApp?:LinkedAppChat;
  agent: AgentDefinition;
  quotaStatus?: AgentQuotaStatus;
  isBusy?: boolean;
  isManager?: boolean;
  token: string;
  onOpenReconnect?: () => void;
  onOpenProfile?: () => void;
  onQuotaUpdated?: (agentId: string, quota: any) => void;
}

export function AgentCard({
  linkedApp,
  agent,
  quotaStatus,
  isBusy = false,
  isManager = false,
  token,
  onOpenReconnect,
  onOpenProfile,
  onQuotaUpdated,
}: AgentCardProps) {
  const {t}=useI18n();
  const [bridgeOpen,setBridgeOpen]=useState(false);
  const browser=agent.transport==='browser-web';
  const isConnected = agent.connection === "connected";
  const identity = agent.provider || agent.id;
  const avatar = identity === 'codex'
    ? { initials: 'CX', color: 'bg-brand-blue/15 text-foreground border-brand-blue/40' }
    : identity === 'antigravity'
    ? { initials: 'AG', color: 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/30' }
    : { initials: identity === 'claude' ? 'CL' : agent.name.slice(0, 2).toUpperCase(), color: 'bg-primary/10 text-primary border-primary/30' };

  return <><Dialog open={bridgeOpen} onOpenChange={setBridgeOpen}><DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{t("Hubungkan Chrome")}</DialogTitle><DialogDescription>{t("Sambungkan DeepSeek di browser aktif ke Pitstop.")}</DialogDescription></DialogHeader><BrowserBridgeSetup token={token}/></DialogContent></Dialog><div className={`rounded-xl border p-3.5 space-y-3 transition-colors ${isBusy ? 'border-brand-cyan/50 bg-brand-cyan/5' : 'border-border/80 bg-background/40'}`}>
    <div className="flex items-center gap-3">
      <div aria-hidden="true" className={`h-10 w-10 shrink-0 overflow-hidden rounded-md border flex items-center justify-center text-xs font-bold ${avatar.color}`}>{agent.avatar?<img src={agent.avatar} alt="" className="w-full h-full object-cover"/>:avatar.initials}</div>
      <div className="min-w-0 flex-1"><div className="flex items-center gap-1"><h3 className="text-sm font-semibold truncate" title={agent.name}>{agent.name}</h3><button type="button" onClick={onOpenProfile} aria-label={t("Pengaturan {0}", [agent.name])} title={t("Pengaturan bot")} className="shrink-0 p-1 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"><Settings className="h-3.5 w-3.5"/></button></div><p className="text-xs text-muted-foreground mt-1 truncate">{isManager?<span className="text-brand-cyan">Project Manager</span>:agent.role || 'AI agent'}<span className="ml-2 text-muted-foreground/80">{linkedApp?'App':browser?t("Browser lokal"):agent.transport==='manual-web'?t("Web manual"):'CLI'}</span></p></div>
    </div>
    <p className="text-xs text-muted-foreground truncate" title={agent.accountEmail||agent.connectionDetail}>{linkedApp?agent.connectionDetail:browser?agent.connectionDetail:agent.transport==='manual-web'?t("Balasan diimpor dari DeepSeek web"):agent.accountEmail || (isConnected?t("Email tidak tersedia"):t("Akun belum tersambung"))}</p>
    {linkedApp?<p className="text-xs text-brand-cyan truncate" title={linkedApp.error||linkedApp.cwd}>Linked App Chat · {linkedApp.title}<span className="block text-muted-foreground mt-1">{linkedApp.state==='error'?t("Sinkron gagal"):linkedApp.state==='needs-bridge'&&!isConnected?t("Penghubung App belum tersambung"):linkedApp.state==='unverified'?t("Menunggu verifikasi riwayat"):t("Model mengikuti chat aplikasi")}</span></p>:<>
    <div className="flex items-center gap-2 text-xs text-muted-foreground" title={agent.model || (agent.transport!=='cli'&&agent.id==='deepseek'?t("Dipilih di DeepSeek web"):t("Model bawaan CLI"))}><Cpu className="h-3.5 w-3.5 shrink-0"/><span className="truncate">{agent.model || (agent.transport!=='cli'&&agent.id==='deepseek'?t("Dipilih di DeepSeek web"):t("Model bawaan CLI"))}</span>{agent.effort&&<span className="ml-auto shrink-0 rounded bg-secondary px-1.5 py-0.5">{agent.effort}</span>}</div>
    </>}
    {linkedApp?.transport==='remote-app'?<p className="text-xs text-muted-foreground border-t border-border/50 pt-3">{t("Limit akun App dilihat langsung di Antigravity.")}</p>:<AgentQuotaBars agent={agent} quotaStatus={quotaStatus} token={token} onQuotaUpdated={onQuotaUpdated}/>}
    <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2.5 text-xs">
      <span className={`inline-flex items-center gap-1.5 ${isBusy || isConnected ? 'text-brand-cyan' : 'text-muted-foreground'}`} title={agent.connectionDetail}><span className={`w-1.5 h-1.5 rounded-full ${isBusy?'bg-brand-cyan animate-pulse':isConnected?'bg-brand-cyan':'bg-muted-foreground'}`}/>{isBusy?agent.transport==='manual-web'?t("Menunggu impor"):t("Menanggapi…"):isConnected?agent.transport==='manual-web'?t("Siap · manual"):t("Terhubung"):t("Belum terhubung")}</span>
      {browser?<button type="button" disabled={isBusy} onClick={()=>setBridgeOpen(true)} className="inline-flex items-center gap-1 text-brand-cyan hover:underline min-h-7 disabled:opacity-50">{t("Hubungkan Chrome")}</button>:!isConnected&&onOpenReconnect?<button type="button" onClick={onOpenReconnect} className="inline-flex items-center gap-1 text-primary hover:underline min-h-7"><RefreshCw className="h-3 w-3"/>{t("Hubungkan")}</button>:<span className="text-muted-foreground">{isBusy?t("Bekerja"):t("Siaga")}</span>}
    </div>
  </div></>;
}
