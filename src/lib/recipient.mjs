const mentionStart = /(?<![\p{L}\p{M}\p{N}_@/\\.#%+-])@/gu;

/** @param {{id:string,name:string}} agent */
function aliases(agent){
  const name=agent.name||agent.id;
  return [...new Set([agent.id,name,name.replace(/\s+\([^()]+\)$/,'')])];
}

/** @template {{id:string,name:string}} T @param {string} text @param {T[]} agents */
function mentionMatches(text,agents){
  const tags=agents.flatMap(agent=>aliases(agent).map(name=>({agent,tag:'@'+name.toLowerCase()})))
    .sort((a,b)=>b.tag.length-a.tag.length);
  const matches=[];
  let end=0;
  for(const {index:start} of text.matchAll(mentionStart)){
    if(start<end)continue;
    const match=tags.find(({tag})=>{
      const after=text.slice(start+tag.length);
      return text.slice(start,start+tag.length).toLowerCase()===tag &&
        (!after||/^[\s,!?;:)\]}'"…]|^\.(?![\p{L}\p{M}\p{N}_])/u.test(after));
    });
    if(match){
      end=start+match.tag.length;
      matches.push({agent:match.agent,start,end});
    }
  }
  return matches;
}

/** Return each tagged agent once, in order of first mention.
 * @template {{id:string,name:string}} T
 * @param {string} text @param {T[]} agents
 */
export function messageRecipients(text,agents){
  return [...new Map(mentionMatches(text,agents).map(({agent})=>[agent.id,agent])).values()];
}

/** Toggle one recipient, or clear all tags with the Team button.
 * @param {string} text @param {{id:string,name:string}[]} agents @param {string} id
 */
export function selectRecipient(text,agents,id){
  const matches=mentionMatches(text,agents).filter(({agent})=>id==='broadcast'||agent.id===id);
  if(matches.length){
    return matches.reverse().reduce((draft,{start,end})=>{
      const left=draft.slice(0,start),right=draft.slice(end);
      return left+(!left||/\s$/.test(left)?right.replace(/^[ \t]+/,''):right);
    },text);
  }
  const agent=agents.find(agent=>agent.id===id);
  return agent?'@'+(agent.name||agent.id)+' '+text:text;
}

/** Find an unfinished mention at the caret, ignoring email addresses and URLs.
 * @template {{id:string,name:string}} T
 * @param {string} text @param {number} caret @param {T[]} agents
 */
export function mentionSuggestions(text,caret,agents){
  const before=text.slice(0,caret),start=[...before.matchAll(mentionStart)].at(-1)?.index;
  if(start===undefined)return null;
  const query=before.slice(start+1).toLowerCase();
  if(query.length>80||/[\r\n@]/.test(query))return null;
  const full=mentionMatches(text.slice(start),agents).find(match=>match.start===0);
  if(full&&caret>=start+full.end)return null;
  const items=agents.filter(agent=>aliases(agent).some(name=>name.toLowerCase().includes(query)));
  if(!items.length)return null;
  const tail=text.slice(caret).match(/^[\p{L}\p{M}\p{N}_-]*/u)?.[0]||'';
  const tailIsName=tail&&items.some(agent=>aliases(agent).some(name=>name.toLowerCase().startsWith(query+tail.toLowerCase())));
  return {start,end:full?start+full.end:tailIsName?caret+tail.length:caret,query,items};
}

/** Complete only the tag at the caret.
 * @param {string} text @param {{id:string,name:string}[]} agents
 * @param {string} id @param {{start:number,end:number}} range
 */
export function completeMention(text,agents,id,range){
  const agent=agents.find(agent=>agent.id===id);
  if(!agent)return {text,caret:range.end};
  const right=text.slice(range.end);
  const separator=!right||!/^[\s,!?;:.)\]}'"…]/u.test(right)?' ':'';
  const tag='@'+(agent.name||agent.id)+separator;
  return {text:text.slice(0,range.start)+tag+right,caret:range.start+tag.length};
}
