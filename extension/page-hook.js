// Runs in DeepSeek's page world. It never reads cookies, storage, or auth headers.
(()=>{
  let job=null;
  addEventListener('message',event=>{
    if(event.source!==window||event.origin!==location.origin||event.data?.source!=='pitlane-content')return;
    if(event.data.kind==='ping')window.postMessage({source:'pitlane-page',kind:'ready',version:2},location.origin);
    if(event.data.kind==='arm'){job={id:event.data.id,prompt:event.data.prompt};emit(job,{kind:'armed',version:2});}
    if(event.data.kind==='disarm')job=null;
  });
  const emit=(current,event)=>window.postMessage({source:'pitlane-page',id:current.id,...event},location.origin);
  const chunks=(current,text)=>{for(let offset=0;offset<text.length;offset+=32768)emit(current,{kind:'chunk',chunk:text.slice(offset,offset+32768)});};
  const original=window.fetch;
  window.fetch=async function(...args){
    const request=args[0],url=new URL(typeof request==='string'||request instanceof URL?String(request):request.url,location.href);
    let payload=null;
    if(job&&url.origin===location.origin&&url.pathname==='/api/v0/chat/completion'){
      try{payload=JSON.parse(args[1]?.body||(request instanceof Request?await request.clone().text():'{}'));}catch{}
      if(payload?.prompt===job.prompt&&payload.parent_message_id!=null){emit(job,{kind:'error',message:'DeepSeek did not open a fresh chat. Nothing was sent.'});throw new Error('Pitlane requires a fresh chat.');}
    }
    const current=job;
    let response;
    try{response=await original.apply(this,args);}catch(error){if(current&&payload?.prompt===current.prompt)emit(current,{kind:'error',message:'DeepSeek network request failed.'});throw error;}
    if(current&&url.origin===location.origin&&/\/file\/upload/.test(url.pathname)){
      response.clone().json().then(result=>emit(current,{kind:'upload',success:response.ok&&result.code===0&&result.data?.biz_code===0})).catch(()=>emit(current,{kind:'upload',success:false}));
    }
    if(current&&payload?.prompt===current.prompt&&url.origin===location.origin&&url.pathname==='/api/v0/chat/completion'){
      const copy=response.clone();
      (async()=>{
        try{
          emit(current,{kind:'start',status:response.status,type:response.headers.get('content-type')||''});
          const reader=copy.body.getReader(),decoder=new TextDecoder();let size=0;
          for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2_000_000)throw new Error('limit');chunks(current,decoder.decode(value,{stream:true}));}
          const tail=decoder.decode();if(tail)emit(current,{kind:'chunk',chunk:tail});emit(current,{kind:'done'});
        }catch{emit(current,{kind:'error',message:'The DeepSeek response stream was interrupted.'});}
      })();
    }
    return response;
  };
  // Some DeepSeek frontend builds use XMLHttpRequest instead of fetch.
  // Observe only the bridge's exact prompt, without reading request headers.
  if(typeof XMLHttpRequest!=='undefined'){
    const metadata=new WeakMap(),open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open=function(method,url,...rest){metadata.set(this,new URL(String(url),location.href));return open.call(this,method,url,...rest);};
    XMLHttpRequest.prototype.send=function(body){
      const url=metadata.get(this),current=job;
      if(current&&url?.origin===location.origin){
        let payload;try{payload=JSON.parse(body);}catch{}
        if(url.pathname==='/api/v0/chat/completion'&&payload?.prompt===current.prompt){
          if(payload.parent_message_id!=null){emit(current,{kind:'error',message:'DeepSeek did not open a fresh chat. Nothing was sent.'});throw new Error('Pitlane requires a fresh chat.');}
          let started=false,offset=0,failed=false;
          const fail=()=>{if(!failed){failed=true;emit(current,{kind:'error',message:'The DeepSeek XHR response was interrupted or unreadable.'});}};
          const read=()=>{
            if(failed||this.readyState<2)return;
            try{
              if(!started){started=true;emit(current,{kind:'start',status:this.status,type:this.getResponseHeader('content-type')||''});}
              const text=this.responseText;if(text.length>2_000_000){fail();return;}chunks(current,text.slice(offset));offset=text.length;
            }catch{fail();}
          };
          this.addEventListener('readystatechange',read);this.addEventListener('progress',read);
          this.addEventListener('load',()=>{read();if(!failed)emit(current,{kind:'done'});},{once:true});
          for(const name of ['error','abort','timeout'])this.addEventListener(name,fail,{once:true});
        }else if(/\/file\/upload/.test(url.pathname)){
          this.addEventListener('load',()=>{let success=false;try{const result=this.responseType==='json'?this.response:JSON.parse(this.responseText);success=this.status===200&&result.code===0&&result.data?.biz_code===0;}catch{}emit(current,{kind:'upload',success});},{once:true});
        }
      }
      return send.call(this,body);
    };
  }
})();
