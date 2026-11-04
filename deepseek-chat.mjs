export function deepseekChat(value){
  let url;try{url=new URL(value);}catch{throw new Error('Paste the complete DeepSeek conversation URL.');}
  const match=url.pathname.match(/^\/(?:a\/)?chat\/s\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\/?$/i);
  if(url.origin!=='https://chat.deepseek.com'||url.username||url.password||!match||url.search||url.hash)throw new Error('Choose a DeepSeek conversation URL such as https://chat.deepseek.com/a/chat/s/<chat-id>.');
  url.pathname=url.pathname.replace(/\/$/,'');return {id:match[1],url:url.href};
}
