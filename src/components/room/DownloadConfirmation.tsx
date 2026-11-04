"use client";
import {createContext,useContext,useRef,useState,ReactNode} from 'react';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel} from '@/components/ui/alert-dialog';
import {Button} from '@/components/ui/button';
import {useI18n} from '@/lib/i18n';

type Request={filename:string;description?:string;run:()=>void|Promise<void>};
const DownloadContext=createContext<((request:Request)=>void)|null>(null);
export function DownloadConfirmationProvider({children}:{children:ReactNode}){
  const {t}=useI18n();const [pending,setPending]=useState<Request|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');const inFlight=useRef(false);
  const request=(value:Request)=>{if(inFlight.current)return;setError('');setPending(value);};
  const confirm=async()=>{if(!pending||inFlight.current)return;inFlight.current=true;setBusy(true);setError('');try{await pending.run();setPending(null);}catch(error:any){setError(error.message||t('Unduhan gagal. Coba lagi.'));}finally{inFlight.current=false;setBusy(false);}};
  return <DownloadContext.Provider value={request}>{children}<AlertDialog open={!!pending} onOpenChange={open=>{if(!open&&!inFlight.current)setPending(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t('Konfirmasi unduhan')}</AlertDialogTitle><AlertDialogDescription>{t('Unduh file berikut? Browser baru mulai mengunduh setelah kamu mengonfirmasi.')}</AlertDialogDescription></AlertDialogHeader><p className="break-all rounded-md border border-border bg-background px-3 py-2 text-sm">{pending?.filename}</p>{pending?.description&&<p className="text-xs leading-5 text-muted-foreground">{pending.description}</p>}{error&&<p role="alert" className="text-xs text-destructive">{error}</p>}<AlertDialogFooter><AlertDialogCancel disabled={busy}>{t('Batal')}</AlertDialogCancel><Button type="button" onClick={()=>void confirm()} disabled={busy}>{busy?t('Mengunduh…'):t('Unduh')}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog></DownloadContext.Provider>;
}
export function useDownloadConfirmation(){const context=useContext(DownloadContext);if(!context)throw new Error('DownloadConfirmationProvider is missing.');return context;}
export function saveDownload(blob:Blob,filename:string){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function downloadFile(url:string,filename:string){const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok){let message='Download failed.';try{message=(await response.json()).error||message;}catch{}throw new Error(message);}saveDownload(await response.blob(),filename);}
