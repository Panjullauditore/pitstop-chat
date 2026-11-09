"use client";
import {useI18n} from "@/lib/i18n";
import {memo} from 'react';
import {Layers,Compass,ArrowUpRight} from 'lucide-react';
import {BrandLogo} from './BrandLogo';
import type {AgentDefinition,ProviderId} from '@/lib/types';

const AGENTS:{provider:ProviderId;src:string;name:string}[]=[{provider:'claude',src:'/agents/agent-claude.svg',name:'Claude'},{provider:'codex',src:'/agents/agent-openai.svg',name:'Codex'},{provider:'antigravity',src:'/agents/agent-antigravity.svg',name:'Antigravity'},{provider:'deepseek',src:'/agents/agent-deepseek.svg',name:'DeepSeek'}];

// The empty screen owns its layout and never enters the transcript scroll cycle.
export const ChatWelcome = memo(function ChatWelcome({onPromptSelected,agents=[]}:{onPromptSelected:(text:string)=>void;agents?:AgentDefinition[]}) {
  const {t}=useI18n();
  // A provider counts as online when any of its agents in this room is connected.
  const online=new Set(agents.filter(agent=>agent.connection==='connected'&&agent.provider).map(agent=>agent.provider));
  const card="pitstop-action pitstop-prompt pitstop-suggest group rounded-2xl border border-border/70 bg-card/70 p-5 text-left hover:bg-card";
  return <section aria-label={t("Mulai diskusi")} className="pitstop-welcome flex-1 min-h-0 overflow-y-auto bg-background px-4 sm:px-6 py-6 [contain:paint]">
    <div className="max-w-[760px] mx-auto min-h-full grid content-center">
      <div className="py-6 sm:py-10 flex flex-col items-center text-center">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-primary/30 bg-card shadow-[0_16px_40px_-18px_rgb(255_69_0/.5)]"><BrandLogo size={52}/></div>
        <h2 className="mt-6 text-4xl sm:text-5xl font-display font-bold tracking-tight text-balance">{t("Apa yang ingin dibahas?")}</h2>
        <p className="mt-3 text-[15px] text-muted-foreground leading-7 max-w-[56ch] text-pretty">{t("Tulis pesan untuk tim. Konsep dan keputusan disimpan di Project Memory; cara agent berkomunikasi diatur lewat Soul Memory.")}</p>
        <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-border/70 bg-card/60 py-1.5 pl-1.5 pr-4">
          <ul className="flex items-center gap-1.5" aria-label={t("Status AI")}>{AGENTS.map(a=>{const on=online.has(a.provider);return <li key={a.provider} title={`${a.name} · ${on?t("Terhubung"):t("Belum terhubung")}`} className="relative">
            <img src={a.src} alt={a.name} className={`h-7 w-7 rounded-full border border-border/70 bg-muted p-1.5 transition-[opacity,filter] duration-300 ${on?'':'opacity-35 grayscale'}`}/>
            <span aria-hidden="true" className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${on?'bg-brand-lime':'bg-muted-foreground/60'}`}/>
            <span className="sr-only">{on?t("Terhubung"):t("Belum terhubung")}</span>
          </li>;})}</ul>
          <span className="text-xs text-muted-foreground">{t("{0} dari {1} AI terhubung",[String(online.size),String(AGENTS.length)])}</span>
        </div>
        <div className="mt-10 w-full grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
          <button type="button" className={`${card} hover:border-brand-cyan/50`} onClick={()=>onPromptSelected(t("Bantu merumuskan konsep dan tujuan proyek ini. Bedakan keputusan user dan usulan tim."))}>
            <span className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-cyan/10"><Layers className="h-[18px] w-[18px] text-brand-cyan"/></span><ArrowUpRight className="pitstop-prompt-arrow h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"/></span>
            <span className="block text-[15px] font-display font-semibold mt-4">{t("Bahas konsep proyek")}</span>
            <span className="block text-sm leading-6 text-muted-foreground mt-1">{t("Rumuskan tujuan dan arah proyek bersama tim.")}</span>
          </button>
          <button type="button" className={`${card} hover:border-primary/50`} onClick={()=>onPromptSelected(t("Tinjau keputusan proyek yang sudah tersimpan dan usulkan langkah berikutnya yang bisa diverifikasi."))}>
            <span className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><Compass className="h-[18px] w-[18px] text-primary"/></span><ArrowUpRight className="pitstop-prompt-arrow h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"/></span>
            <span className="block text-[15px] font-display font-semibold mt-4">{t("Tinjau langkah berikutnya")}</span>
            <span className="block text-sm leading-6 text-muted-foreground mt-1">{t("Lanjutkan dari keputusan yang sudah tersimpan.")}</span>
          </button>
        </div>
      </div>
    </div>
  </section>;
});
