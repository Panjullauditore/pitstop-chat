const form=document.querySelector('#pair'),status=document.querySelector('#status');
chrome.storage.local.get('bridgeStatus').then(data=>{status.textContent=data.bridgeStatus||'Not paired. Generate a code in Pitlane → DeepSeek settings.';});
form.addEventListener('submit',async event=>{
  event.preventDefault();const button=form.querySelector('button');button.disabled=true;
  try{const result=await chrome.runtime.sendMessage({action:document.querySelector('#provider').value==='antigravity'?'app-pair':'pair',code:document.querySelector('#code').value.trim()});if(result.error)throw new Error(result.error);document.querySelector('#code').value='';status.textContent='Paired. Keep the selected service open in this Chrome profile.';}
  catch(error){status.textContent=error.message;}finally{button.disabled=false;}
});

document.querySelector('#provider').addEventListener('change',async event=>{const key=event.target.value==='antigravity'?'appBridgeStatus':'bridgeStatus';const data=await chrome.storage.local.get(key);status.textContent=data[key]||'Generate a pairing code in Pitlane for this connection.';});
