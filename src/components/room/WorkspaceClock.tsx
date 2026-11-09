"use client";
import {useEffect,useRef,useState} from 'react';
import {Clock3} from 'lucide-react';
import {LiveDot} from './LiveDot';
import {useI18n} from '@/lib/i18n';
import {memoryReminder,MEMORY_REMINDER_MINUTES} from '@/lib/memory-reminders.mjs';
import {toast} from 'sonner';

const clockFormatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const badge='inline-flex h-6 shrink-0 items-center gap-1.5 rounded border px-1.5 font-mono text-[9px] sm:px-2';

export function WorkspaceClock({online,reminderPending}:{online:boolean;reminderPending:boolean}){
 const {t}=useI18n(),[now,setNow]=useState<Date|null>(null);
 useEffect(()=>{setNow(new Date());const timer=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(timer);},[]);
 const time=now?clockFormatter.format(now):'--:--:--';
 const reminder=now&&reminderPending?memoryReminder(now):null;
 const stage=reminder?MEMORY_REMINDER_MINUTES.indexOf(reminder.minute):undefined;
 return <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
  <time dateTime={now?.toISOString()} title={reminder?t('Pengingat Project Memory · {0} WIB',[reminder.time]):t('Waktu Jakarta (WIB)')} data-reminder-stage={stage} className={`${badge} tabular-nums ${reminder?'pitstop-clock-alert border-red-400/70 bg-red-950 text-red-100':'border-border bg-secondary text-muted-foreground'}`}><Clock3 aria-hidden="true" className="h-3 w-3"/><span>{time.slice(0,5)}<span className="hidden md:inline">{time.slice(5)}</span> WIB</span></time>
  <span className={`${badge} uppercase ${online?'border-brand-lime/30 bg-brand-lime/5 text-brand-lime':'border-border bg-secondary text-muted-foreground'}`}>{online?<LiveDot className="h-1.5 w-1.5"/>:<span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-muted-foreground"/>}{online?'Live':t('Menghubungkan')}</span>
 </div>;
}

export function MemoryUpdateReminder({scopeId,pending,running,onOpen}:{scopeId?:string;pending:boolean;running:boolean;onOpen:()=>void}){
 const {t}=useI18n(),openRef=useRef(onOpen),seen=useRef<Record<string,{date:string;minute:number}>>({});openRef.current=onOpen;
 useEffect(()=>{
  if(!scopeId||!pending||running)return;
  const key='pitstop-memory-reminder:'+scopeId;
  const check=()=>{
   if(document.visibilityState!=='visible')return;
   let last=seen.current[key];try{last=JSON.parse(localStorage.getItem(key)||'null')||last;}catch{}
   const reminder=memoryReminder(Date.now(),last||{});if(!reminder)return;
   seen.current[key]=reminder;try{localStorage.setItem(key,JSON.stringify(reminder));}catch{}
   toast.warning(t('Pengingat Project Memory · {0} WIB',[reminder.time]),{id:'project-memory-evening',description:t('Ada diskusi yang belum dirangkum. Perbarui Project Memory sebelum tengah malam. Catatan yang belum tercakup tetap aman.'),duration:20000,closeButton:true,action:{label:t('Buka Project Memory'),onClick:()=>openRef.current()}});
  };
  check();const timer=setInterval(check,15000);document.addEventListener('visibilitychange',check);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',check);};
 },[scopeId,pending,running,t]);
 return null;
}
