"use client";
import {Circle, CircleCheck, CircleX} from 'lucide-react';
import {ReactNode} from 'react';
import {ArchiveMemoryStatus} from '@/lib/types';
import {useI18n} from '@/lib/i18n';
import {formatJakartaDate} from '@/lib/utils';

export function MemoryArchiveEntry({status,children}:{status?:ArchiveMemoryStatus;children:ReactNode}){
 const {t}=useI18n(),included=status?.incorporated===true,skipped=!included&&status?.reviewed===true;
 const Icon=included?CircleCheck:skipped?CircleX:Circle;
 const label=included?t('Sudah masuk Project Memory'):skipped?t('Diperiksa dan dilewati peringkas'):t('Belum diperiksa peringkas');
 const description=status?.deleteAt?`${label} · ${t('Dibersihkan: {0}',[formatJakartaDate(status.deleteAt)])}`:label;
 return <div className="flex gap-2.5 text-xs">
  <span role="img" aria-label={description} title={description} className={`mt-0.5 shrink-0 ${included?'text-green-400':skipped?'text-destructive':'text-muted-foreground'}`}>
   <Icon className="h-4 w-4" aria-hidden="true"/>
  </span><div className="min-w-0 flex-1 space-y-1 leading-5">{children}</div>
 </div>;
}
