// DeepSeek's web stream is a patch stream, not an OpenAI completion stream.
// Unknown formats fail closed instead of treating reasoning or page text as a reply.
export class DeepSeekStream {
  constructor(onText=()=>{}){this.buffer='';this.state={};this.path='';this.operation='';this.text='';this.onText=onText;this.bytes=0;this.legacy='';this.done=false;}
  push(chunk){
    this.bytes+=Buffer.byteLength(chunk);if(this.bytes>2_000_000)throw new Error('DeepSeek response exceeded the bridge limit.');
    this.buffer=(this.buffer+chunk).replace(/\r\n/g,'\n');
    let boundary;
    while((boundary=this.buffer.indexOf('\n\n'))!==-1){const frame=this.buffer.slice(0,boundary);this.buffer=this.buffer.slice(boundary+2);this.frame(frame);}
  }
  frame(frame){
    const raw=frame.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
    if(!raw)return;if(raw==='[DONE]'){this.done=true;return;}
    let item;try{item=JSON.parse(raw);}catch{throw new Error('DeepSeek returned an unreadable response stream.');}
    if(item.error || item.type==='error' || (typeof item.code==='number'&&item.code!==0))throw new Error('DeepSeek rejected the browser request. Check its browser window.');
    if(item.choices){this.legacy+=item.choices[0]?.delta?.content||'';if(item.choices[0]?.finish_reason)this.done=true;}
    else if(Object.hasOwn(item,'v')){
      if(item.p!==undefined)this.path=item.p;
      if(item.o!==undefined)this.operation=item.o;
      if(!this.path&&typeof item.v==='object'&&item.v!==null)this.state=item.v;
      else if(this.path)this.patch(this.path,this.operation,item.v);
    }
    const response=this.state.response||this.state;
    if(response.status==='FINISHED'||response.quasi_status==='FINISHED')this.done=true;
    if(['STOPPED','ERROR','FAILED'].includes(response.status))throw new Error('DeepSeek did not finish its response. Check its browser window.');
    const text=this.legacy||(response.fragments||[]).filter(fragment=>fragment.type==='RESPONSE').map(fragment=>fragment.content||'').join('');
    if(text!==this.text){this.text=text;this.onText(text);}
  }
  patch(path,operation,value,depth=0){
    if(depth>16||typeof path!=='string')throw new Error('DeepSeek returned an unsupported patch path.');
    const keys=path.split('/').filter(Boolean);
    if(!keys.length||keys.some(key=>['__proto__','prototype','constructor'].includes(key)))throw new Error('DeepSeek returned an unsupported patch path.');
    if(operation==='BATCH'){
      if(!Array.isArray(value))throw new Error('DeepSeek returned an invalid batch patch.');
      for(const child of value)this.patch(path+'/'+child.p,child.o||'SET',child.v,depth+1);return;
    }
    let target=this.state;
    for(const key of keys.slice(0,-1)){const index=Array.isArray(target)&&key==='-1'?target.length-1:key;if(target[index]===undefined)target[index]={};target=target[index];}
    const last=keys.at(-1),key=Array.isArray(target)&&last==='-1'?target.length-1:last;
    if(operation==='APPEND'&&typeof target[key]==='string')target[key]+=value;
    else if(operation==='APPEND'&&Array.isArray(target[key]))target[key].push(...(Array.isArray(value)?value:[value]));
    else target[key]=value;
  }
  finish(){if(this.buffer.trim())this.frame(this.buffer);if(!this.text.trim())throw new Error('DeepSeek returned no supported answer text. The web format may have changed.');if(!this.done)throw new Error('DeepSeek stream ended before the answer was complete.');return this.text;}
}
