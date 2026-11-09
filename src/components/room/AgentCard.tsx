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
  chatEnabled: boolean;
  powerDisabled: boolean;
  onTogglePower: () => void;
  quotaStatus?: AgentQuotaStatus;
  isBusy?: boolean;
  isManager?: boolean;
  token: string;
  onOpenReconnect?: () => void;
  onOpenProfile?: () => void;
  onQuotaUpdated?: (agentId: string, quota: any) => void;
  onCheckConnection:()=>void;
  checkingConnection:boolean;
}

export function AgentCard({
  linkedApp,
  agent,
  chatEnabled,
  powerDisabled,
  onTogglePower,
  quotaStatus,
  isBusy = false,
  isManager = false,
  token,
  onOpenReconnect,
  onOpenProfile,
  onQuotaUpdated,
  onCheckConnection,
  checkingConnection,
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

  const transport=linkedApp?(linkedApp.source==='deepseek'?'Web':'App'):browser?'Web':agent.transport==='manual-web'?'Manual':'CLI';
  return <>
    <Dialog open={bridgeOpen} onOpenChange={setBridgeOpen}><DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{t("Hubungkan Chrome")}</DialogTitle><DialogDescription>{t("Sambungkan DeepSeek di browser aktif ke Pitstop.")}</DialogDescription></DialogHeader><BrowserBridgeSetup token={token}/></DialogContent></Dialog>
    <article className={`pitstop-panel rounded-2xl border p-4 space-y-3.5 transition-colors ${isBusy?'border-primary/60':'border-border/80'}`}>
      <div className="flex items-start gap-3">
        <div className="relative shrink-0 mt-0.5"><div aria-hidden="true" className={`h-11 w-11 overflow-hidden rounded-md border flex items-center justify-center font-mono text-sm font-bold ${avatar.color}`}>{agent.avatar?<img src={agent.avatar} alt="" className="w-full h-full object-cover"/>:avatar.initials}</div><span aria-hidden="true" className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-card ${isBusy&&isConnected?'bg-primary animate-pulse':isConnected?'bg-brand-lime':'bg-brand-yellow'}`}/></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5"><h3 className="min-w-0 text-sm font-display font-bold truncate" title={agent.name}>{agent.name}</h3><span className={`shrink-0 rounded border px-1 font-mono text-[9px] uppercase ${isConnected?'text-brand-lime border-brand-lime/30':'text-brand-yellow border-brand-yellow/30'}`}>{transport}</span><button type="button" onClick={onOpenProfile} aria-label={t("Pengaturan {0}",[agent.name])} title={t("Pengaturan bot")} className="ml-auto shrink-0 p-1 rounded text-muted-foreground hover:bg-secondary hover:text-primary"><Settings className="h-3.5 w-3.5"/></button></div>
          <p className="mt-1.5 text-[10px] font-mono leading-4 text-muted-foreground truncate">{isManager?<span className="text-brand-cyan">Project Manager</span>:agent.role||'AI agent'}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={chatEnabled}
        aria-label={t("Akses chat untuk {0}",[agent.name])}
        title={t("Berlaku untuk semua sesi Pitstop")}
        disabled={powerDisabled}
        onClick={onTogglePower}
        className="flex min-h-10 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 text-xs text-foreground hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-cyan disabled:opacity-60"
      >
        <span>{t("Akses chat")}</span>
        <span className={chatEnabled?"font-semibold text-brand-cyan":"text-muted-foreground"}>{chatEnabled?"On":"Off"}</span>
      </button>
      <div className="flex items-center gap-2"><p className="min-w-0 flex-1 text-[11px] text-muted-foreground truncate" title={agent.accountEmail||agent.connectionDetail}>{linkedApp?agent.connectionDetail:browser?agent.connectionDetail:agent.transport==='manual-web'?t("Balasan diimpor dari DeepSeek web"):agent.accountEmail||(isConnected?t("Email tidak tersedia"):t("Akun belum tersambung"))}</p><button type="button" onClick={onCheckConnection} disabled={checkingConnection} aria-label={t('Periksa koneksi {0}',[agent.name])} title={t('Periksa koneksi {0}',[agent.name])} className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-brand-cyan disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${checkingConnection?'animate-spin':''}`}/></button></div>
      {agent.connectionCheckedAt&&<p className="text-[10px] text-muted-foreground">{t('Diperiksa')}: {new Date(agent.connectionCheckedAt).toLocaleTimeString()}</p>}
      {linkedApp?<div className="rounded-md border border-border/70 bg-background px-2.5 py-2"><p className="text-[10px] font-mono text-brand-cyan truncate" title={linkedApp.cwd}>Linked App Chat · {linkedApp.title}</p><p className={`mt-1 text-[10px] leading-4 ${linkedApp.state==='error'?'text-destructive':'text-muted-foreground'}`} title={linkedApp.error||''}>{linkedApp.state==='error'?t("Sinkron gagal"):linkedApp.state==='needs-bridge'&&!isConnected?t("Penghubung App belum tersambung"):linkedApp.state==='unverified'?t("Menunggu verifikasi riwayat"):t("Model mengikuti chat aplikasi")}</p></div>:<div className="flex items-center gap-2 rounded-md border border-border/70 bg-background px-2.5 py-2 font-mono text-[10px] text-muted-foreground"><Cpu className="h-3.5 w-3.5 shrink-0 text-primary"/><span className="truncate" title={agent.model}>{agent.model||(agent.id==='deepseek'?t("Dipilih di DeepSeek web"):t("Model bawaan CLI"))}</span>{agent.effort&&<span className="ml-auto shrink-0 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 uppercase text-primary">{agent.effort}</span>}</div>}
      <div className="grid grid-cols-2 gap-2 border-y border-border/70 py-2.5 font-mono text-[10px] uppercase">
        <div><span className="block text-[9px] text-muted-foreground mb-1.5">{t("Koneksi")}</span><span className={`inline-flex items-center gap-1.5 ${isConnected?'text-brand-lime':'text-brand-yellow'}`} title={agent.connectionDetail}><span className={`h-1.5 w-1.5 rounded-full ${isConnected?'bg-brand-lime':'bg-brand-yellow'}`}/>{isConnected?t("Terhubung"):t("Belum terhubung")}</span></div>
        <div><span className="block text-[9px] text-muted-foreground mb-1.5">{t("Aktivitas")}</span><span className={isBusy?'text-primary':'text-foreground'}>{!isConnected?t('Belum terhubung'):isBusy?agent.transport==='manual-web'?t("Menunggu impor"):t("Menanggapi…"):t("Siaga")}</span></div>
      </div>
      {linkedApp?.transport==='remote-app'?<p className="text-[11px] leading-5 text-muted-foreground">{t("Limit akun App dilihat langsung di Antigravity.")}</p>:<AgentQuotaBars agent={agent} quotaStatus={quotaStatus} token={token} onQuotaUpdated={onQuotaUpdated}/>}
      {browser?<button type="button" disabled={isBusy} onClick={()=>setBridgeOpen(true)} className="w-full min-h-8 rounded-md border border-brand-cyan/25 bg-background font-mono text-[10px] uppercase text-brand-cyan hover:bg-secondary disabled:opacity-50">{t("Hubungkan Chrome")}</button>:!isConnected&&onOpenReconnect?<button type="button" onClick={onOpenReconnect} className="w-full inline-flex items-center justify-center gap-2 min-h-8 rounded-md border border-primary/30 bg-background text-primary font-mono text-[10px] uppercase hover:bg-primary/10"><RefreshCw className="h-3 w-3"/>{t("Hubungkan")}</button>:null}
    </article>
  </>;
}
