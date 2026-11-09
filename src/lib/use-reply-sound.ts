"use client";

import {useCallback,useEffect,useRef} from 'react';
import type {RoomSnapshot} from './types';

function playChime(context: AudioContext) {
  const start=context.currentTime;
  for(const [frequency,delay] of [[587.33,0],[783.99,0.1]]){
    const at=start+delay;
    const tone=context.createOscillator();
    const volume=context.createGain();
    tone.type='sine';
    tone.frequency.value=frequency;
    volume.gain.setValueAtTime(0.001,at);
    volume.gain.exponentialRampToValueAtTime(0.09,at+0.02);
    volume.gain.exponentialRampToValueAtTime(0.001,at+0.17);
    tone.connect(volume).connect(context.destination);
    tone.onended=()=>{tone.disconnect();volume.disconnect();};
    tone.start(at);
    tone.stop(at+0.18);
  }
}

export function useReplySound() {
  const audio=useRef<AudioContext|null>(null);
  const previous=useRef<{sessionId?:string;replyId?:string}|null>(null);

  useEffect(()=>{
    const unlock=()=>{
      if(typeof AudioContext==='undefined'||audio.current?.state==='running')return;
      try{
        const context=audio.current??new AudioContext();
        audio.current=context;
        void context.resume().catch(()=>{});
      }catch{
        // Audio is optional on browsers or devices that disallow playback.
      }
    };
    document.addEventListener('click',unlock,true);
    document.addEventListener('keydown',unlock,true);
    return ()=>{
      document.removeEventListener('click',unlock,true);
      document.removeEventListener('keydown',unlock,true);
      const context=audio.current;
      audio.current=null;
      if(context&&context.state!=='closed')void context.close().catch(()=>{});
    };
  },[]);

  return useCallback((snapshot:RoomSnapshot)=>{
    const reply=snapshot.messages.findLast(message=>message.status==='done'&&message.role!=='user'&&message.role!=='system'&&message.text?.trim());
    const prior=previous.current;
    previous.current={sessionId:snapshot.sessionId,replyId:reply?.id};
    if(!reply||!prior||prior.sessionId!==snapshot.sessionId||prior.replyId===reply.id)return;
    if(document.visibilityState==='visible'&&document.hasFocus())return;
    const context=audio.current;
    if(context?.state==='running'){
      try{playChime(context);}catch{
        // A playback failure must not interrupt chat updates.
      }
    }
  },[]);
}
