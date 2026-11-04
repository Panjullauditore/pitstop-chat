// Isolated-world fallback for builds whose network client bypasses the page hook.
// Read only the answer following this job's exact prompt in its fresh owned tab.
globalThis.PitlaneDeepSeekDOM={read(job,baseline){
  if(job.chatId&&location.pathname.match(/^\/(?:a\/)?chat\/s\/([a-f0-9-]{36})\/?$/i)?.[1]!==job.chatId)return null;
  const normalize=value=>String(value||'').replace(/\s+/g,' ').trim();
  const messages=Array.from(document.querySelectorAll('.ds-message'));
  const index=messages.findIndex(node=>!baseline.has(node)&&!node.querySelector('.ds-assistant-message-main-content')&&normalize(node.textContent)===normalize(job.prompt));
  if(index<0)return null;
  const message=messages[index+1],answer=message?.querySelector('.ds-assistant-message-main-content');
  if(!answer||!answer.getClientRects().length||answer.closest('.ds-think-content'))return null;
  const text=answer.innerText?.trim();if(!text)return null;
  const field=Array.from(document.querySelectorAll('textarea')).find(node=>node.getClientRects().length);
  const control=field?.parentElement?.parentElement?.querySelector('[role="button"].ds-button--primary.ds-button--circle');
  const finished=!!message.parentElement?.querySelector('[aria-label="Read aloud"]')&&!!control?.classList.contains('ds-button--disabled')&&!field?.value.trim();
  return {text,finished};
}};
