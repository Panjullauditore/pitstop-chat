import {runLinkedCodex} from './codex-linked.mjs';
import {validateWorkspace,validChatId} from './linked-apps.mjs';
import {getSessionInfo} from '@anthropic-ai/claude-agent-sdk';
import {runAgent} from './adapters.mjs';

export async function runLinkedApp(provider,link,prompt,options,{definitions,runCodex=runLinkedCodex,runNativeApp}={}){
  if(!validChatId(link?.id))throw new Error('The linked app chat ID is invalid. Re-link the chat.');
  await validateWorkspace(link.cwd);
  const input='[Message sent through Pitlane. The following includes the user request and Pitlane communication/project context.]\n\n'+prompt;
  if(provider==='codex')return runCodex(definitions.codex,link,input,{...options,transport:options.codexTransport||'shared'});
  if(provider==='claude'&&link.source==='claude'){
    const before=await getSessionInfo(link.id,{dir:link.cwd});
    if(!before)throw new Error('The linked Claude Code session could not be found. Choose it again in Linked App Chat.');
    let resultSession;
    const text=await runAgent('claude',input,{...options,definitions,cwd:link.cwd,resumeSession:link.id,selection:{},onEvent:event=>{
      if(event.type==='result')resultSession=event.session_id;
    }});
    const after=await getSessionInfo(link.id,{dir:link.cwd});
    if(resultSession!==link.id||!after||!(after.fileSize>before.fileSize||after.lastModified>before.lastModified))throw new Error('Claude Code did not confirm a saved reply in the selected session.');
    return {text,nativeChat:{provider:'claude',id:link.id,title:link.title,history:'saved'}};
  }
  if(provider!=='antigravity'||link.source!=='antigravity')throw new Error('Native app history is unsupported for this chat source.');
  if(link.transport==='remote-app'){
    if(!runNativeApp)throw new Error('Antigravity App bridge is not connected. Open Remote Control in the Chrome profile paired with Pitlane Bridge. The CLI cannot control this native App chat; no CLI copy was started.');
    return runNativeApp(link,input,options);
  }
  throw new Error('Re-link this Antigravity App chat using Remote Control. CLI continuation of an App chat is unsupported; no CLI copy was started.');
}
