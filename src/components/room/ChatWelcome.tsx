"use client";
import {useI18n} from "@/lib/i18n";
import {memo} from 'react';
import {Layers,Compass,ArrowUpRight} from 'lucide-react';
import {BrandLogo} from './BrandLogo';

// The empty screen owns its layout and never enters the transcript scroll cycle.
export const ChatWelcome = memo(function ChatWelcome({onPromptSelected}:{onPromptSelected:(text:string)=>void}) {
  const {t}=useI18n();
  return <section aria-label={t("Mulai diskusi")} className="flex-1 min-h-0 overflow-y-auto bg-background px-4 sm:px-6 py-6 [contain:paint]">
    <div className="max-w-[880px] mx-auto min-h-full grid content-center">
          <div className="shrink-0 py-6 sm:py-8">
            <div className="flex flex-col items-start text-left">
              <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-primary/40 bg-card"><BrandLogo size={58}/></div>
              <h2 className="mt-5 text-5xl font-display font-bold tracking-tight">Pitstop</h2>
              <p className="mt-2 text-xs font-mono text-primary">Multiple minds. One team. One goal.</p>
              <p className="mt-5 text-xl font-display font-semibold">{t("Apa yang ingin dibahas?")}</p>
              <p className="text-sm text-muted-foreground leading-6 mt-2 max-w-lg">{t("Tulis pesan untuk tim. Konsep dan keputusan disimpan di Project Memory; cara agent berkomunikasi diatur lewat Soul Memory.")}</p>
            </div>
            <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
              <button type="button" className="group rounded-xl border border-border/80 bg-card p-4 text-left transition-colors hover:border-brand-cyan/60 hover:bg-secondary/70" onClick={()=>onPromptSelected(t("Bantu merumuskan konsep dan tujuan proyek ini. Bedakan keputusan user dan usulan tim."))}>
                <span className="flex items-center justify-between"><Layers className="h-5 w-5 text-brand-cyan"/><ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground"/></span>
                <span className="block text-sm font-semibold mt-4">{t("Bahas konsep proyek")}</span>
                <span className="block text-xs leading-5 text-muted-foreground mt-1">{t("Rumuskan tujuan dan arah proyek bersama tim.")}</span>
              </button>
              <button type="button" className="group rounded-xl border border-border/80 bg-card p-4 text-left transition-colors hover:border-primary/60 hover:bg-secondary/70" onClick={()=>onPromptSelected(t("Tinjau keputusan proyek yang sudah tersimpan dan usulkan langkah berikutnya yang bisa diverifikasi."))}>
                <span className="flex items-center justify-between"><Compass className="h-5 w-5 text-primary"/><ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground"/></span>
                <span className="block text-sm font-semibold mt-4">{t("Tinjau langkah berikutnya")}</span>
                <span className="block text-xs leading-5 text-muted-foreground mt-1">{t("Lanjutkan dari keputusan yang sudah tersimpan.")}</span>
              </button>
            </div>
          </div>
    </div>
  </section>;
});
