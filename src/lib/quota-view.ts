import {AgentDefinition,QuotaData} from './types';

export function quotaRows(agent:AgentDefinition,data?:QuotaData|null){
  let groups=data?.groups||[];
  if(agent.id==='antigravity'){
    if(/^gemini/i.test(agent.model||''))groups=groups.filter(group=>/gemini/i.test(group.name));
    else if(/^(claude|gpt)/i.test(agent.model||''))groups=groups.filter(group=>/claude|gpt/i.test(group.name));
  }
  return groups.flatMap(group=>group.buckets.map(bucket=>({group:group.name,bucket})));
}
