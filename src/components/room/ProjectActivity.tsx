"use client";

import {useState} from 'react';
import {useI18n} from '@/lib/i18n';
import type {ProjectActivityData} from '@/lib/types';
import {Tooltip,TooltipContent,TooltipProvider,TooltipTrigger} from '@/components/ui/tooltip';

const activityColors = [
  'border-border bg-secondary text-muted-foreground',
  'border-emerald-800 bg-emerald-950 text-emerald-200',
  'border-emerald-700 bg-emerald-900 text-emerald-100',
  'border-emerald-500 bg-emerald-700 text-white',
];
const updateGlow = 'border-emerald-100 bg-emerald-300 text-emerald-950 ring-1 ring-emerald-100 shadow-[0_0_8px_2px_#a7f3d0,0_0_22px_5px_rgba(52,211,153,0.95),0_0_38px_8px_rgba(16,185,129,0.55)]';

export function ProjectActivity({activity}:{activity:ProjectActivityData}) {
  const {t,language} = useI18n();
  const [selected,setSelected] = useState<string|null>(null);
  const locale = language === 'id' ? 'id-ID' : 'en-US';
  const firstDay = new Date(activity.month + '-01T00:00:00Z');
  const monthLabel = new Intl.DateTimeFormat(locale,{month:'long',year:'numeric',timeZone:'UTC'}).format(firstDay);
  const dateFormat = new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',timeZone:'UTC'});
  const weekdayFormat = new Intl.DateTimeFormat(locale,{weekday:'short',timeZone:'UTC'});
  const length = new Date(Date.UTC(firstDay.getUTCFullYear(),firstDay.getUTCMonth()+1,0)).getUTCDate();
  const offset = (firstDay.getUTCDay()+6)%7;
  const details = (day:string) => {
    const stats = activity.days[day] || {messages:0,decisions:0};
    return {
      date:dateFormat.format(new Date(day+'T00:00:00Z')),
      decisions:t('{0} keputusan GM tercatat',[stats.decisions]),
      messages:t('{0} pesan diskusi',[stats.messages]),
      last:day===activity.lastUpdateDay,
      level:stats.messages>=5?3:stats.messages>=2?2:stats.messages>0?1:0,
    };
  };
  const selectedDay = selected ? details(selected) : null;
  const updateLabel = t('Pembaruan terakhir Project Memory');

  return <section className="space-y-3 rounded-md border border-border bg-background p-3" aria-label={t('Kalender aktivitas proyek')}>
    <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h3 className="text-sm font-semibold">{t('Kalender aktivitas proyek')}</h3>
      <span className="text-xs text-muted-foreground">{monthLabel}</span>
    </header>
    <TooltipProvider delayDuration={180}>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({length:7},(_,i)=><span key={i} className="text-center text-[11px] text-muted-foreground">{weekdayFormat.format(new Date(Date.UTC(2024,0,1+i)))}</span>)}
        {Array.from({length:offset},(_,i)=><span key={'blank'+i} aria-hidden="true"/>)}
        {Array.from({length},(_,i)=>{
          const day = activity.month+'-'+String(i+1).padStart(2,'0');
          const info = details(day);
          const label = [info.date,info.decisions,info.messages,info.last?updateLabel:''].filter(Boolean).join(' · ');
          return <Tooltip key={day}>
            <TooltipTrigger asChild>
              <button type="button" onClick={()=>setSelected(current=>current===day?null:day)} aria-pressed={selected===day} aria-label={label} className={`min-h-8 rounded border text-xs font-semibold tabular-nums hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan ${info.last?`relative z-10 ${updateGlow}`:activityColors[info.level]}`}>{i+1}</button>
            </TooltipTrigger>
            <TooltipContent side="top" className="space-y-1">
              <p className="font-semibold">{info.date}</p>
              <p>{info.decisions} · {info.messages}</p>
              {info.last&&<p className="text-emerald-300">{updateLabel}</p>}
            </TooltipContent>
          </Tooltip>;
        })}
      </div>
    </TooltipProvider>
    {selectedDay&&<p role="status" className="rounded border border-border px-2 py-1.5 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">{selectedDay.date}</strong> · {selectedDay.decisions} · {selectedDay.messages}{selectedDay.last&&<span className="block text-emerald-300">{updateLabel}</span>}</p>}
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] leading-4 text-muted-foreground">
      <span className="flex items-center gap-1.5"><span aria-hidden="true" className={`h-3 w-3 rounded-sm border ${activityColors[0]}`}/>{t('Tanpa diskusi')}</span>
      <span className="flex items-center gap-1.5"><span aria-hidden="true" className="flex gap-0.5">{activityColors.slice(1).map(color=><span key={color} className={`h-3 w-3 rounded-sm border ${color}`}/>)}</span>{t('Lebih banyak diskusi')}</span>
      <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-sm border border-emerald-100 bg-emerald-300 shadow-[0_0_9px_2px_rgba(52,211,153,0.75)]"/>{updateLabel}</span>
    </div>
  </section>;
}
