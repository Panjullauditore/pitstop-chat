import {createHash} from 'node:crypto';

export const SUMMARY_RETENTION_MS=24*60*60*1000;
export const ARCHIVE_KINDS=['gmDecisions','userNotes','updates','decisions'];
export const archiveKey=(kind,item)=>kind+':'+item.id;
export const archiveHash=item=>createHash('sha256').update(JSON.stringify(item)).digest('hex');
export function nextJakartaMidnight(at){
  const value=Date.parse(at);if(!Number.isFinite(value))return null;
  const offset=7*60*60*1000;return new Date((Math.floor((value+offset)/SUMMARY_RETENTION_MS)+1)*SUMMARY_RETENTION_MS-offset).toISOString();
}
export function archiveStatus(memory,kind,item){
  const key=archiveKey(kind,item),soul=memory?.soul||{};
  const incorporated=typeof item.id==='string'&&soul.summaryArchiveCoverage?.[key]===archiveHash(item);
  const incorporatedAt=incorporated?(soul.summaryArchiveIncorporatedAt?.[key]||soul.summaryUpdatedAt||null):null;
  return {incorporated,incorporatedAt,deleteAt:incorporatedAt?nextJakartaMidnight(incorporatedAt):null};
}
export function coveredAndExpired(kind,item,coverage,now=Date.now(),incorporatedAt={}){
  const key=archiveKey(kind,item),deleteAt=nextJakartaMidnight(incorporatedAt[key]);
  return typeof item.id==='string'&&Number.isFinite(Date.parse(item.at))&&coverage?.[key]===archiveHash(item)&&deleteAt!==null&&now>=Date.parse(deleteAt);
}
export function pendingArchive(memory,project){
  const coverage=memory?.soul?.summaryArchiveReviewed||memory?.soul?.summaryArchiveCoverage||{},rows=[];
  for(const kind of ARCHIVE_KINDS){
    const items=kind==='decisions'?project?.decisions:memory?.auto?.[kind];
    for(const item of items||[]){
      if(typeof item.id!=='string'||coverage[archiveKey(kind,item)]===archiveHash(item))continue;
      rows.push({archiveKind:kind,archiveKey:archiveKey(kind,item),id:item.id,at:item.at||'',speaker:'archive',text:JSON.stringify(item),sourceRecord:structuredClone(item)});
    }
  }
  return rows;
}
