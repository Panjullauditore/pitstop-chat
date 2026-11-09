import {homedir} from 'node:os';
import {join,isAbsolute,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {stat} from 'node:fs/promises';
import {codexRequest} from './accounts.mjs';
import {deepseekChat} from './deepseek-chat.mjs';
import {getSessionInfo,listSessions} from '@anthropic-ai/claude-agent-sdk';

export const validChatId=id=>typeof id==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{7,127}$/.test(id);
const validClaudeSession=id=>typeof id==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);
const claudeChat=session=>({id:session.sessionId,title:(session.customTitle||session.summary||session.sessionId).split(/\r?\n/)[0].slice(0,120),cwd:session.cwd,source:'claude'});
export async function listClaudeChats({query='',cursor=null}={}){
  const search=query.toLowerCase();
  const items=(await listSessions()).filter(session=>validClaudeSession(session.sessionId)&&session.cwd).map(claudeChat)
    .filter(item=>!search||[item.title,item.cwd,item.id].some(value=>value.toLowerCase().includes(search)));
  const offset=/^\d{1,8}$/.test(cursor||'')?Number(cursor):0;
  return {items:items.slice(offset,offset+50),nextCursor:items.length>offset+50?String(offset+50):null};
}
export async function listCodexChats(definition,{query='',cursor=null}={}){
  const result=await codexRequest(definition,'thread/list',{limit:50,archived:false,useStateDbOnly:true,...(query?{searchTerm:query.slice(0,120)}:{}),...(cursor?{cursor}:{})});
  return {items:(result.data||[]).filter(thread=>!thread.ephemeral).map(thread=>({id:thread.id,title:thread.name||thread.preview?.split('\n')[0]?.slice(0,100)||thread.id,cwd:thread.cwd||'',source:'codex',status:thread.status?.type||'unknown'})),nextCursor:result.nextCursor||null};
}
export async function antigravityChats({root=join(homedir(),'.gemini'),query='',id=null}={}){
  const {DatabaseSync}=await import('node:sqlite');const items=[];
  for(const scope of ['antigravity','antigravity-cli','antigravity-ide']){
    const path=join(root,scope,'conversation_summaries.db');let db;
    try{
      await stat(path);db=new DatabaseSync(path,{readOnly:true});
      const rows=db.prepare('SELECT conversation_id,title,workspace_uris,status,app_data_dir,source,step_count,last_modified_time FROM conversation_summaries WHERE '+(id?'conversation_id = ?':'title LIKE ?')+' ORDER BY last_modified_time DESC LIMIT 100').all(id||'%'+query.slice(0,120)+'%');
      for(const row of rows){
        // Desktop caches also index CLI summaries. Select native rows only.
        if(scope==='antigravity'&&row.source?.includes('CLI'))continue;
        let cwd='';try{const uri=JSON.parse(row.workspace_uris||'[]')[0];if(uri?.startsWith('file:'))cwd=fileURLToPath(uri);}catch{}
        items.push({id:row.conversation_id,title:row.title||row.conversation_id,cwd,source:scope,status:row.status||'',steps:row.step_count,updatedAt:row.last_modified_time});
      }
    }catch(error){if(error.code!=='ENOENT')throw new Error('Could not read Antigravity chat metadata: '+error.message);}finally{db?.close();}
  }
  return {items,nextCursor:null};
}
export async function validateWorkspace(path){
  if(typeof path!=='string'||!isAbsolute(path)||path.includes('\0'))throw new Error('Choose an existing absolute project folder.');
  const cwd=resolve(path);if(!(await stat(cwd)).isDirectory())throw new Error('The project folder is not a directory.');return cwd;
}
export async function resolveAppLink(provider,input,{definitions,geminiRoot,workspaceFallback}={}){
  if(provider==='deepseek'){const chat=deepseekChat(input?.remoteUrl);if(input.id&&input.id!==chat.id)throw new Error('The DeepSeek URL opens a different chat.');return {id:chat.id,title:'DeepSeek project chat',source:'deepseek',transport:'browser-chat',remoteUrl:chat.url,cwd:'',state:'linked',linkedAt:new Date().toISOString()};}
  if(!validChatId(input?.id))throw new Error('Choose a valid native chat ID.');
  if(provider==='claude'){
    const session=validClaudeSession(input.id)?await getSessionInfo(input.id):null;
    if(!session?.cwd)throw new Error('Choose an existing local Claude Code session.');
    const item=claudeChat(session);
    return {...item,cwd:await validateWorkspace(item.cwd),state:'linked',linkedAt:new Date().toISOString()};
  }
  if(provider==='codex'){
    const {thread}=await codexRequest(definitions.codex,'thread/read',{threadId:input.id,includeTurns:false});
    if(!thread||thread.id!==input.id||thread.ephemeral)throw new Error('Choose a persistent Codex chat.');
    const cwd=await validateWorkspace(thread.cwd);
    return {id:thread.id,title:thread.name||thread.preview?.split('\n')[0]?.slice(0,100)||thread.id,cwd,source:'codex',state:'linked',linkedAt:new Date().toISOString()};
  }
  if(provider==='antigravity'){
    if(!['antigravity','antigravity-cli','antigravity-ide'].includes(input.source))throw new Error('Choose the Antigravity chat source.');
    const {items}=await antigravityChats({root:geminiRoot,id:input.id});const item=items.find(item=>item.id===input.id&&item.source===input.source);
    if(!item)throw new Error('Antigravity chat was not found in its native store.');
    if(item.source!=='antigravity')throw new Error('Choose an Antigravity App chat. CLI/IDE copies do not meet the native-app history requirement.');
    const cwd=await validateWorkspace(item.cwd||input.cwd||workspaceFallback);
    return {id:item.id,title:item.title,cwd,source:item.source,transport:'remote-app',state:'needs-bridge',linkedAt:new Date().toISOString()};
  }
  throw new Error('Choose Codex, Claude Code, Antigravity, or DeepSeek.');
}
export async function nativeAntigravityFile(link,{root=join(homedir(),'.gemini'),input,reply,afterIndex=-1}={}){
  if(link.source!=='antigravity'||!validChatId(link.id))throw new Error('Invalid native Antigravity chat.');
  const file=join(root,'antigravity','conversations',link.id+'.db');const info=await stat(file);
  const wal=await stat(file+'-wal').catch(()=>null);
  const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(file,{readOnly:true});
  try{
    const steps=db.prepare('SELECT COUNT(*) AS count,COALESCE(MAX(idx),-1) AS lastIndex FROM steps').get();
    // Verify the actual appended prompt and reply, not just a touched database.
    // SQLite returns booleans only; no unrelated transcript is loaded or exposed.
    const contains=text=>Boolean(db.prepare('SELECT MAX(instr(step_payload,?) > 0) AS found FROM steps WHERE idx > ?').get(Buffer.from(text),afterIndex)?.found);
    return {file,modified:Math.max(info.mtimeMs,wal?.mtimeMs||0),size:info.size+(wal?.size||0),stepCount:steps.count,lastIndex:steps.lastIndex,...(input&&reply?{hasInput:contains(input),hasReply:contains(reply)}:{})};
  }finally{db.close();}
}
