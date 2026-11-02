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
