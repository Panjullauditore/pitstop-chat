"use client";
import {Circle, CircleCheck} from 'lucide-react';
import {ReactNode} from 'react';
import {ArchiveMemoryStatus} from '@/lib/types';
import {useI18n} from '@/lib/i18n';
import {formatJakartaDate} from '@/lib/utils';

export function MemoryArchiveEntry({status,children}:{status?:ArchiveMemoryStatus;children:ReactNode}){
 const {t}=useI18n(),included=status?.incorporated===true;
 const label=included?t('Sudah masuk Project Memory'):t('Belum terkonfirmasi masuk Project Memory');
 const description=included&&status.deleteAt?`${label} · ${t('Dibersihkan: {0}',[formatJakartaDate(status.deleteAt)])}`:label;
 return <div className="flex gap-2.5 text-xs">
  <span role="img" aria-label={description} title={description} className={`mt-0.5 shrink-0 ${included?'text-green-400':'text-muted-foreground'}`}>
   {included?<CircleCheck className="h-4 w-4" aria-hidden="true"/>:<Circle className="h-4 w-4" aria-hidden="true"/>}
  </span><div className="min-w-0 flex-1 space-y-1 leading-5">{children}</div>
 </div>;
}
