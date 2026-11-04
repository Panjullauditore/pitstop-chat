/** The leading mention is the source of truth for message routing.
 * @param {string} text
 * @param {{id:string,name:string}[]} agents
 */
export function messageRecipient(text,agents){
  return recipientMatch(text,agents)?.agent;
}

/** @param {string} text @param {{id:string,name:string}[]} agents */
function recipientMatch(text,agents){
  const start=text.trimStart();
  return agents.flatMap(agent=>[...new Set([agent.name,agent.id])].map(name=>({agent,tag:'@'+name})))
    .sort((a,b)=>b.tag.length-a.tag.length).find(({tag})=>start.slice(0,tag.length).toLowerCase()===tag.toLowerCase()&&(!start[tag.length]||/\s/.test(start[tag.length])));
}

/** @param {string} text @param {{id:string,name:string}[]} agents @param {string} id */
export function selectRecipient(text,agents,id){
  const previous=recipientMatch(text,agents);
  const body=previous?text.trimStart().slice(previous.tag.length).replace(/^\s+/,''):text;
  const next=agents.find(agent=>agent.id===id);
  return next?'@'+next.name+' '+body:body;
}

/** Find an unfinished @mention at the caret, ignoring email addresses.
 * @template {{id:string,name:string}} T
 * @param {string} text @param {number} caret @param {T[]} agents
 */
export function mentionSuggestions(text,caret,agents){
  const before=text.slice(0,caret),match=before.match(/(?:^|\s)@([^@\r\n]{0,80})$/);
  if(!match)return null;
  const query=match[1].toLowerCase(),start=caret-match[1].length-1;
  if(/\s$/.test(query)&&agents.some(agent=>[agent.name,agent.id].some(name=>name.toLowerCase()===query.trimEnd())))return null;
  const items=agents.filter(agent=>[agent.name,agent.id].some(name=>name.toLowerCase().includes(query)));
  if(!items.length)return null;
  // If editing inside a complete tag, replace its remainder as well.
  const full=recipientMatch(text.slice(start),agents);
  const tail=text.slice(caret).match(/^[^\s@]*/)?.[0]||'';
  const tailIsName=tail&&items.some(agent=>[agent.name,agent.id].some(name=>name.toLowerCase().startsWith(query+tail.toLowerCase())));
  const end=full?Math.max(caret,start+full.tag.length):tailIsName?caret+tail.length:caret;
  return {start,end,query,items};
}

/** Complete a tag and route it through the existing leading-mention rule.
 * @param {string} text @param {{id:string,name:string}[]} agents
 * @param {string} id @param {{start:number,end:number}} range
 */
export function completeMention(text,agents,id,range){
  const left=text.slice(0,range.start),right=text.slice(range.end);
  const atStart=range.start===text.length-text.trimStart().length;
  const remainder=atStart?right.trimStart():left+(/\s$/.test(left)&&/^\s/.test(right)?right.slice(1):right);
  const previous=recipientMatch(remainder,agents);
  const removed=previous?remainder.length-(remainder.trimStart().slice(previous.tag.length).replace(/^\s+/,'' )).length:0;
  const bodyBefore=atStart?0:Math.max(0,range.start-removed);
  const agent=agents.find(agent=>agent.id===id);
  if(!agent)return {text,caret:range.end};
  const next=selectRecipient(remainder,agents,id);
  return {text:next,caret:Math.min(next.length,agent.name.length+2+bodyBefore)};
}
