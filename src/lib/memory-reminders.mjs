const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export const MEMORY_REMINDER_MINUTES=[23*60+30,23*60+40,23*60+50,23*60+55];
export function memoryReminder(now,last={}){
 const parts=Object.fromEntries(formatter.formatToParts(new Date(now)).map(p=>[p.type,p.value]));
 const date=`${parts.year}-${parts.month}-${parts.day}`,minute=Number(parts.hour)*60+Number(parts.minute);
 const due=MEMORY_REMINDER_MINUTES.filter(value=>value<=minute).at(-1);
 if(due===undefined||(last.date===date&&last.minute>=due))return null;
 return {date,minute:due,time:`23:${String(due%60).padStart(2,'0')}`};
}
export function quotaWarningKey(warning){return JSON.stringify([warning.agent,warning.group,warning.bucket,warning.resetAt,warning.exhausted||warning.remainingPercent<=0]);}
