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
  const soul=memory?.soul||{},hash=archiveHash(item);
  const keys=typeof item.id==='string'?[archiveKey(kind,item)]:[];
  // The same GM decision can be present in the memory and governance archives.
  if(keys.length&&kind==='gmDecisions')keys.push(archiveKey('decisions',item));
  if(keys.length&&kind==='decisions')keys.push(archiveKey('gmDecisions',item));
  const includedKeys=keys.filter(key=>soul.summaryArchiveCoverage?.[key]===hash);
  const reviewedKeys=keys.filter(key=>soul.summaryArchiveReviewed?.[key]===hash);
  const incorporated=includedKeys.length>0,reviewed=incorporated||reviewedKeys.length>0;
  const incorporatedAt=includedKeys.map(key=>soul.summaryArchiveIncorporatedAt?.[key]||soul.summaryUpdatedAt).filter(Boolean).sort()[0]||null;
  const skippedAt=reviewedKeys.map(key=>soul.summaryArchiveReviewedAt?.[key]||soul.legacyArchiveReviewAt).filter(Boolean).sort()[0];
  return {incorporated,reviewed,incorporatedAt,deleteAt:nextJakartaMidnight(incorporated?incorporatedAt:skippedAt)};
}
export function archiveExpired(memory,kind,item,now=Date.now()){
  const {deleteAt}=archiveStatus(memory,kind,item);
  return Number.isFinite(Date.parse(item.at))&&deleteAt!==null&&now>=Date.parse(deleteAt);
}
export function pendingArchive(memory,project){
  const rows=[];
  for(const kind of ARCHIVE_KINDS){
    const items=kind==='decisions'?project?.decisions:memory?.auto?.[kind];
    for(const item of items||[]){
      if(typeof item.id!=='string'||archiveStatus(memory,kind,item).reviewed)continue;
      rows.push({archiveKind:kind,archiveKey:archiveKey(kind,item),id:item.id,at:item.at||'',speaker:'archive',text:JSON.stringify(item),sourceRecord:structuredClone(item)});
    }
  }
  return rows;
}
