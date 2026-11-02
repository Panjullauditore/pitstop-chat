"use client";
import {useI18n} from "@/lib/i18n";
import {useEffect,useId,useRef,useState} from 'react';
import {Camera,RotateCcw} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {toast} from 'sonner';
import {avatarCrop} from '@/lib/avatar-crop.mjs';

const SIZE=256;
const clamp=(value:number)=>Math.max(-1,Math.min(1,value));
export function AvatarPicker({value,onChange,initials,disabled=false,onBusyChange}:{value:string;onChange:(value:string)=>void;initials:string;disabled?:boolean;onBusyChange?:(busy:boolean)=>void}){
  const {t}=useI18n();
  const input=useRef<HTMLInputElement>(null),canvas=useRef<HTMLCanvasElement>(null);
  const zoomId=useId();
  const mounted=useRef(true);
  const bitmapRef=useRef<ImageBitmap|null>(null),busyCallback=useRef(onBusyChange);busyCallback.current=onBusyChange;
  const drag=useRef<{x:number;y:number;panX:number;panY:number}|null>(null);
  const [image,setImage]=useState<ImageBitmap|null>(null),[loading,setLoading]=useState(false),[zoom,setZoom]=useState(1),[pan,setPan]=useState({x:0,y:0});
  useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;bitmapRef.current?.close();busyCallback.current?.(false);};},[]);
  const draw=(node:HTMLCanvasElement)=>{
    const ctx=node.getContext('2d');if(!ctx||!image)return;
    const {side,sx,sy}=avatarCrop(image.width,image.height,zoom,pan.x,pan.y);
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,SIZE,SIZE);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(image,sx,sy,side,side,0,0,SIZE,SIZE);
  };
  const close=()=>{setImage(null);bitmapRef.current?.close();bitmapRef.current=null;drag.current=null;busyCallback.current?.(false);};
  const load=async(file?:File)=>{
    if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024){toast.error(t("Gunakan PNG, JPG, atau WebP maksimal 10 MB."));return;}
    setLoading(true);busyCallback.current?.(true);
    try{
      const bitmap=await createImageBitmap(file);
      if(!mounted.current){bitmap.close();return;}
      if(bitmap.width*bitmap.height>40_000_000){bitmap.close();throw new Error(t("Resolusi foto maksimal 40 megapiksel."));}
      bitmapRef.current?.close();bitmapRef.current=bitmap;setZoom(1);setPan({x:0,y:0});setImage(bitmap);
    }catch(error:any){toast.error(t("Foto gagal dibaca"),{description:error.message});busyCallback.current?.(false);}finally{setLoading(false);}
  };
  const apply=()=>{
    if(!canvas.current)return;
    try{let result=canvas.current.toDataURL('image/jpeg',0.82);if(result.length>100000)result=canvas.current.toDataURL('image/jpeg',0.65);onChange(result);close();}catch{toast.error(t("Foto gagal dipotong. Coba pilih foto kembali."));}
  };
  return <>
    <div className="flex items-center gap-4">
      <div className="h-20 w-20 rounded-md bg-secondary overflow-hidden flex items-center justify-center text-xl font-semibold shrink-0">{value?<img src={value} alt={t("Foto profil")} className="h-full w-full object-cover"/>:initials}</div>
      <div className="space-y-2"><input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={event=>{void load(event.target.files?.[0]);event.target.value='';}}/>
        <Button type="button" variant="outline" disabled={disabled||loading||!!image} onClick={()=>input.current?.click()} className="gap-2"><Camera className="h-4 w-4"/>{loading?t("Membaca foto…"):t("Ganti foto")}</Button>
        <p className="text-xs text-muted-foreground">{t("Template kotak · 256 × 256 px")}</p>
        {value&&<button type="button" disabled={disabled||loading||!!image} onClick={()=>onChange('')} className="block text-xs text-muted-foreground hover:text-foreground">{t("Hapus foto")}</button>}
      </div>
    </div>
    <Dialog open={!!image} onOpenChange={open=>{if(!open)close();}}><DialogContent className="max-w-sm max-h-[90dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>{t("Atur potongan foto")}</DialogTitle><DialogDescription>{t("Geser foto dan atur zoom agar pas di template kotak. Bisa juga menggunakan tombol panah.")}</DialogDescription></DialogHeader>
      <div role="group" aria-label={t("Area crop foto kotak, geser foto atau gunakan tombol panah")} tabIndex={0}
        onKeyDown={event=>{const step=event.shiftKey?0.1:0.02;const directions:Record<string,{x:number;y:number}>={ArrowLeft:{x:step,y:0},ArrowRight:{x:-step,y:0},ArrowUp:{x:0,y:step},ArrowDown:{x:0,y:-step}};const d=directions[event.key];if(d){event.preventDefault();setPan(old=>({x:clamp(old.x+d.x),y:clamp(old.y+d.y)}));}}}
        onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);drag.current={x:event.clientX,y:event.clientY,panX:pan.x,panY:pan.y};}}
        onPointerMove={event=>{if(!drag.current||!image)return;const side=Math.min(image.width,image.height)/zoom,width=event.currentTarget.getBoundingClientRect().width;const dx=(event.clientX-drag.current.x)*side/width,dy=(event.clientY-drag.current.y)*side/width;setPan({x:clamp(drag.current.panX-(image.width>side?2*dx/(image.width-side):0)),y:clamp(drag.current.panY-(image.height>side?2*dy/(image.height-side):0))});}}
        onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}
        className="relative mx-auto w-full max-w-64 aspect-square overflow-hidden rounded-md border border-border bg-background cursor-grab active:cursor-grabbing touch-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <canvas ref={node=>{canvas.current=node;if(node)draw(node);}} width={SIZE} height={SIZE} aria-label={t("Preview potongan foto")} className="block w-full h-full"/>
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none">{[1,2].map(index=><span key={index}><span className="absolute inset-y-0 border-l border-white/40" style={{left:`${index*100/3}%`}}/><span className="absolute inset-x-0 border-t border-white/40" style={{top:`${index*100/3}%`}}/></span>)}</div>
      </div>
      <label className="block text-sm" htmlFor={zoomId}>Zoom <span className="float-right text-xs text-muted-foreground tabular-nums">{zoom.toFixed(2)}×</span><input id={zoomId} type="range" min={1} max={4} step={0.01} value={zoom} onChange={event=>setZoom(Number(event.target.value))} className="w-full mt-3 accent-brand-cyan"/></label>
      <div className="flex justify-between gap-2"><Button type="button" variant="ghost" onClick={()=>{setZoom(1);setPan({x:0,y:0});}} className="gap-2"><RotateCcw className="h-4 w-4"/>Reset</Button><div className="flex gap-2"><Button type="button" variant="outline" onClick={close}>{t("Batal")}</Button><Button type="button" onClick={apply}>{t("Pakai potongan")}</Button></div></div>
      <p className="text-xs text-muted-foreground">{t("Hasil 1:1 · 256 × 256 px. Klik Simpan di pengaturan profil untuk menyimpan perubahan.")}</p>
    </DialogContent></Dialog>
  </>;
}
