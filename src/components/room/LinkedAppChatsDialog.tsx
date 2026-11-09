"use client";

import {useEffect,useState} from 'react';
import {Link2, Search, Check, Loader2} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {ProjectData,LinkedAppChat} from '@/lib/types';
import {BrowserBridgeSetup} from './BrowserBridgeSetup';
import {useI18n} from '@/lib/i18n';

const providers={codex:'Codex',claude:'Claude Code',antigravity:'Antigravity',deepseek:'DeepSeek'} as const;
type Provider=keyof typeof providers;
type Chat={id:string;title:string;cwd:string;source:string;status?:string};
type Links=Partial<Record<Provider,Pick<LinkedAppChat,'id'|'source'|'cwd'|'title'|'remoteUrl'>>>;
export function LinkedAppChatsDialog({project,token,onClose,onSave}:{project:ProjectData;token:string;onClose:()=>void;onSave:(links:Links)=>Promise<void>}){
  const {t}=useI18n();
  const [provider,setProvider]=useState<Provider>('codex');
  const [links,setLinks]=useState<Links>(()=>project.linkedApps||{});
  const [deepseekUrl,setDeepseekUrl]=useState(project.linkedApps?.deepseek?.remoteUrl||'');
  const [query,setQuery]=useState(''),[search,setSearch]=useState('');
  const [items,setItems]=useState<Chat[]>([]),[cursor,setCursor]=useState<string|null>(null);
  const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const [page,setPage]=useState<string|null>(null),[refresh,setRefresh]=useState(0);
  useEffect(()=>{
    if(provider==='deepseek'){setItems([]);setLoading(false);setCursor(null);setError('');return;}
    const controller=new AbortController();setLoading(true);setError('');
    if(!page)setItems([]);
    const params=new URLSearchParams({provider,query:search,...(page?{cursor:page}:{})});
    void fetch('/api/linked-apps/chats?'+params,{headers:{'X-Room-Token':token},signal:controller.signal}).then(async response=>{
      const data=await response.json();if(controller.signal.aborted)return;if(!response.ok)throw new Error(data.error||t('Gagal memuat chat. Coba lagi.'));
      setItems(old=>page?[...old,...data.items.filter((item:Chat)=>!old.some(row=>row.id===item.id&&row.source===item.source))]:data.items);setCursor(data.nextCursor);
    }).catch(e=>{if(e.name!=='AbortError')setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[provider,search,page,refresh,token,t]);
  const selected=links[provider],saved=project.linkedApps?.[provider];
  const saveLinks=async()=>{const next={...links};if(deepseekUrl.trim()){let url:URL;try{url=new URL(deepseekUrl.trim());}catch{throw new Error(t('Tempel URL percakapan DeepSeek yang lengkap.'));}next.deepseek={id:url.pathname.split('/').filter(Boolean).at(-1)||'',source:'deepseek',cwd:'',title:'DeepSeek project chat',remoteUrl:url.href};}else delete next.deepseek;await onSave(next);};
  return <Dialog open onOpenChange={open=>{if(!open&&!saving)onClose();}}><DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto">
    <DialogHeader><DialogTitle className="flex items-center gap-2"><Link2 className="w-5 h-5 text-brand-cyan"/>Linked App Chat</DialogTitle><DialogDescription>{project.name} · {t('Lanjutkan chat yang sama di aplikasi asal.')}</DialogDescription></DialogHeader>
    <p className="text-sm text-muted-foreground">{t('Pesan dari semua sesi proyek ini dikirim ke chat pilihan, termasuk konteks Soul Memory dan Project Memory. Model dan izin mengikuti aplikasi asal.')}</p>
    <div className="flex flex-wrap gap-1 border-b border-border" role="tablist" aria-label="App">
      {(Object.keys(providers) as Provider[]).map(id=><button key={id} role="tab" aria-selected={provider===id} onClick={()=>{setProvider(id);setSearch('');setQuery('');setPage(null);}} className={`px-3 py-2 text-sm rounded-t-lg ${provider===id?'bg-secondary text-foreground':'text-muted-foreground hover:text-foreground'}`}>{providers[id]}{links[id]&&<Check className="inline ml-2 w-3 h-3 text-brand-cyan"/>}</button>)}
    </div>
    {provider==='claude'&&<p className="text-sm text-muted-foreground">{t('Pilih sesi Claude Code lokal. Saat ditautkan, pesan Pitstop dan balasannya tersimpan di sesi itu. Tool dan MCP Claude dinonaktifkan selama percakapan dari Pitstop.')}</p>}
    {provider==='antigravity'&&<p className="text-sm text-muted-foreground">{t('Chat Antigravity App memerlukan penghubung Remote Control. Aktifkan di Settings → Application, lalu login di profil Chrome yang dipasangkan ke Pitlane Bridge.')}</p>}
    <div className="rounded-lg bg-secondary/50 p-3 space-y-1 text-sm">
      <span className="font-medium block">{selected?.title||t('Tidak ditautkan')}</span>
      {selected&&<p className="text-xs text-muted-foreground break-words">{provider==='antigravity'?t('Game diakses melalui MCP Antigravity. Folder kerja agent disiapkan otomatis.'):selected.cwd}</p>}
      {saved&&selected?.id===saved.id&&<p className="text-xs text-muted-foreground">{saved.state==='saved'?t('Riwayat tersimpan'):saved.state==='error'?t('Sinkron gagal'):saved.state==='needs-bridge'?t('Penghubung App belum tersambung'):saved.state==='unverified'?t('Menunggu verifikasi riwayat'):t('Tertaut')}{saved.lastSyncedAt?' · '+new Date(saved.lastSyncedAt).toLocaleString():''}</p>}
      {saved?.error&&selected?.id===saved.id&&<p role="alert" className="text-xs text-destructive break-words">{saved.error}</p>}
      {selected&&<button className="text-xs text-brand-cyan hover:underline" onClick={()=>{if(provider==='deepseek')setDeepseekUrl('');setLinks(old=>{const next={...old};delete next[provider];return next;});}}>{t('Lepaskan tautan')}</button>}
    </div>
    {provider!=='deepseek'&&<><form className="flex gap-2" onSubmit={event=>{event.preventDefault();setPage(null);setSearch(query.trim());setRefresh(value=>value+1);}}>
      <label className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-input px-3"><Search className="w-4 h-4 text-muted-foreground"/><input aria-label={t('Cari chat aplikasi')} placeholder={t('Cari chat aplikasi')} value={query} maxLength={120} onChange={e=>setQuery(e.target.value)} className="w-full min-w-0 py-2 bg-transparent text-sm outline-none"/></label>
      <Button type="submit" variant="outline" disabled={loading}>{t('Cari')}</Button>
    </form>
    <div className="min-h-24 max-h-60 overflow-y-auto custom-scrollbar" aria-busy={loading}>
      {items.map(item=>{const disabled=provider==='antigravity'&&item.source!=='antigravity',active=selected?.id===item.id&&selected.source===item.source;return <button type="button" key={item.source+item.id} disabled={disabled||saving} aria-pressed={active} onClick={()=>setLinks(old=>({...old,[provider]:{...item,...(old[provider]?.id===item.id?{remoteUrl:old[provider]?.remoteUrl}:{})}}))} className={`w-full text-left p-3 rounded-lg flex gap-3 items-center disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring ${active?'bg-accent/15':'hover:bg-secondary'}`}>
        <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{item.title}</p><p className="text-xs text-muted-foreground truncate">{disabled?t('Salinan CLI/IDE · tidak dapat dipilih'):item.cwd||item.source}</p></div>{active&&<Check className="w-4 h-4 shrink-0 text-brand-cyan"/>}
      </button>;})}
      {!loading&&!items.length&&!error&&<p className="text-sm text-muted-foreground py-5 text-center">{t('Tidak ada chat ditemukan.')}</p>}
      {loading&&<p role="status" className="text-sm text-muted-foreground py-4 flex gap-2 justify-center"><Loader2 className="w-4 h-4 animate-spin"/>{t('Memuat chat…')}</p>}
      {!loading&&cursor&&<button className="w-full py-2 text-sm text-brand-cyan" onClick={()=>setPage(cursor)}>{t('Muat lainnya')}</button>}
    </div></>}
    {provider==='deepseek'&&<div className="space-y-4"><label className="block text-sm">{t('URL chat DeepSeek')}<input type="url" value={deepseekUrl} onChange={event=>setDeepseekUrl(event.target.value)} placeholder="https://chat.deepseek.com/a/chat/s/…" className="mt-2 w-full rounded-lg border border-border bg-input p-2.5 text-sm"/></label><p className="text-xs leading-5 text-muted-foreground">{t('Buka percakapan DeepSeek yang ingin dipakai, lalu salin URL lengkap dari address bar. Proyek ini akan terus memakai percakapan tersebut; bridge tidak membuat chat baru setiap pesan.')}</p><BrowserBridgeSetup token={token}/></div>}
    {provider==='antigravity'&&selected&&<div className="space-y-4 border-t border-border pt-4"><label className="text-sm block">{t('Tautan chat Remote Control')}<input type="url" value={selected.remoteUrl||''} onChange={e=>setLinks(old=>({...old,antigravity:{...selected,remoteUrl:e.target.value}}))} placeholder="https://antigravity.google.com/r/…?p=c%2F…" className="mt-2 w-full rounded-lg border border-border bg-input p-2 text-sm"/><span className="block text-xs text-muted-foreground mt-1">{t('Buka chat yang dipilih di Remote Control, lalu salin alamat halaman browsernya.')}</span></label><BrowserBridgeSetup token={token} provider="antigravity"/></div>}
    {error&&<p role="alert" className="text-sm text-destructive break-words">{error}</p>}
    <p className="text-xs text-muted-foreground">{t('Melepaskan tautan tidak menghapus riwayat aplikasi. Jika agent meminta persetujuan alat, lanjutkan di aplikasi asal.')}</p>
    <div className="flex justify-end gap-2 border-t border-border pt-4"><Button variant="outline" disabled={saving} onClick={onClose}>{t('Batal')}</Button><Button disabled={saving||!token} onClick={async()=>{setSaving(true);setError('');try{await saveLinks();onClose();}catch(e:any){setError(e.message);}finally{setSaving(false);}}}>{saving?t('Menyimpan…'):t('Simpan tautan')}</Button></div>
  </DialogContent></Dialog>;
}
