"use client";
import {useI18n} from "@/lib/i18n";
import { useState } from 'react';
import { Plus, Folder, FolderOpen, MoreHorizontal, ChevronRight } from 'lucide-react';
import { ProjectData, SessionData, AgentDefinition } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LinkedAppChatsDialog } from "./LinkedAppChatsDialog";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { RenameSessionDialog } from './RenameSessionDialog';
import { DeleteSessionAlert } from './DeleteSessionAlert';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

interface Props {
  token:string;
  searchOpen?: boolean;
  projects: ProjectData[]; sessions: SessionData[]; agents: AgentDefinition[]; activeId: string;
  onSelect: (id:string)=>void; onNew: (projectId:string|null)=>Promise<void>;
  onProject: (action:string,input:Record<string,unknown>)=>Promise<void>;
  onRename: (id:string,title:string)=>void; onDelete: (id:string)=>void;
}
export function ProjectNavigation({token,searchOpen=false,projects,sessions,agents,activeId,onSelect,onNew,onProject,onRename,onDelete}:Props) {
  const {t}=useI18n();
  const [linkedProjectId,setLinkedProjectId]=useState<string|null>(null);
  const [menuOpenId,setMenuOpenId]=useState<string|null>(null);
  const [collapsed,setCollapsed]=useState<Set<string>>(new Set());
  const [moving,setMoving]=useState<SessionData|null>(null);
  const [deleteConfirmation,setDeleteConfirmation]=useState('');
  const [removeProject,setRemoveProject]=useState<ProjectData|null>(null);
  const [query,setQuery]=useState(''),[drop,setDrop]=useState<string|null>(null);
  const [editor,setEditor]=useState<{kind:'new'|'project'|'session';id?:string}|null>(null);
  const [managerId,setManagerId]=useState('');
  const [name,setName]=useState(''),[ids,setIds]=useState<string[]>([]),[inherit,setInherit]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [rename,setRename]=useState<SessionData|null>(null),[remove,setRemove]=useState<SessionData|null>(null);
  const entry=sessions.find(s=>s.id===editor?.id);
  const parent=projects.find(p=>p.id===entry?.projectId);
  const choices=editor?.kind==='session' && parent ? agents.filter(a=>parent.agentIds.includes(a.id)) : agents;
  const open=(kind:'new'|'project'|'session',id?:string)=>{
    const project=projects.find(p=>p.id===id),session=sessions.find(s=>s.id===id),projectOfSession=projects.find(p=>p.id===session?.projectId);
    setEditor({kind,id});setManagerId(project?.managerId||'');setName(project?.name||'');setError('');setInherit(!session?.agentIds);
    setIds(kind==='project'?project?.agentIds||[]:kind==='session'?session?.agentIds||projectOfSession?.agentIds||agents.map(a=>a.id):agents.filter(a=>a.installed).map(a=>a.id));
  };
  const save=async()=>{setBusy(true);setError('');try{
    await onProject(editor?.kind==='new'?'new':editor?.kind==='project'?'update':'session-agents',editor?.kind==='session'?{sessionId:editor.id,agentIds:inherit?null:ids}:{projectId:editor?.id,name,agentIds:ids,...(managerId?{managerId}:{})});setEditor(null);
  }catch(e:any){setError(e.message);}finally{setBusy(false);}};
  const move=(sessionId:string,projectId:string|null)=>{void onProject('move',{sessionId,projectId}).catch(e=>setError(e.message));};
  const menuClass="w-full rounded-md px-2.5 py-2 text-left text-xs hover:bg-secondary focus-visible:bg-secondary";
  const group=(project:ProjectData|null)=>{
    const key=project?.id||'loose';
    const needle=searchOpen?query.trim().toLowerCase():'';
    const rows=sessions.filter(session=>(session.projectId||null)===(project?.id||null))
      .filter(session=>!needle||session.title.toLowerCase().includes(needle)||session.messages.some(message=>message.text.toLowerCase().includes(needle)))
      .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
    if(needle&&!rows.length)return null;
    const folded=project&&collapsed.has(project.id)&&!needle;
    return <section key={key} aria-label={project?.name||t("Chat terbaru")} className={`mt-1 rounded-lg transition-colors ${drop===key?'bg-brand-cyan/10 ring-1 ring-inset ring-brand-cyan/40':''}`}
      onDragOver={event=>{if(event.dataTransfer.types.includes('application/x-pitlane-session')){event.preventDefault();setDrop(key);}}}
      onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setDrop(null);}}
      onDrop={event=>{event.preventDefault();setDrop(null);const id=event.dataTransfer.getData('application/x-pitlane-session');if(id){move(id,project?.id||null);if(project)setCollapsed(old=>{const next=new Set(old);next.delete(project.id);return next;});}}}>
      {project?<div className="group/project flex items-center rounded-lg pr-1 hover:bg-secondary/50">
        <button type="button" aria-expanded={!folded} onClick={()=>setCollapsed(old=>{const next=new Set(old);next.has(project.id)?next.delete(project.id):next.add(project.id);return next;})} className="min-w-0 flex-1 flex items-center gap-2.5 pl-2 pr-1 py-2 text-left text-[15px]" title={project.name}>
          {folded?<Folder className="w-[17px] h-[17px] shrink-0"/>:<FolderOpen className="w-[17px] h-[17px] shrink-0"/>}<span className="truncate">{project.name}</span>
        </button>
        <Popover open={menuOpenId===project.id} onOpenChange={value=>setMenuOpenId(value?project.id:null)}><PopoverTrigger asChild><button type="button" aria-label={t("Menu proyek {0}", [project.name])} className="p-1.5 rounded text-muted-foreground hover:text-foreground opacity-100 sm:opacity-0 sm:group-hover/project:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"><MoreHorizontal className="w-4 h-4"/></button></PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-1"><button className={menuClass} onClick={()=>{setMenuOpenId(null);void onNew(project.id);}}>{t("Chat baru di proyek")}</button><button className={menuClass} onClick={()=>{setMenuOpenId(null);open('project',project.id);}}>{t("Pengaturan proyek & agent")}</button><button className={menuClass} onClick={()=>{setMenuOpenId(null);setLinkedProjectId(project.id);}}>Linked App Chat</button><button className={`${menuClass} text-destructive`} onClick={()=>{setMenuOpenId(null);setError('');setDeleteConfirmation('');setRemoveProject(project);}}>{t("Hapus proyek")}</button></PopoverContent>
        </Popover>
      </div>:<h3 className="px-2 pt-6 pb-2 text-[12px] font-semibold text-muted-foreground">{t("Terbaru")}</h3>}
      {!folded&&rows.map(session=><div key={session.id} draggable title={t("Seret chat ke proyek")} onDragStart={event=>{event.dataTransfer.setData('application/x-pitlane-session',session.id);event.dataTransfer.effectAllowed='move';}}
        className={`group/chat flex items-center rounded-lg pr-1 transition-colors ${activeId===session.id?'bg-accent/15 text-foreground':'hover:bg-secondary/60 text-foreground/85'}`}>
        <button type="button" onClick={()=>onSelect(session.id)} className={`min-w-0 flex-1 text-left truncate text-[14px] py-2 ${project?'pl-8':'pl-2'} pr-1`} title={session.title}>{session.title}</button>
        <Popover open={menuOpenId===session.id} onOpenChange={value=>setMenuOpenId(value?session.id:null)}><PopoverTrigger asChild><button type="button" aria-label={t("Menu chat {0}", [session.title])} className="p-1.5 rounded text-muted-foreground hover:text-foreground opacity-100 sm:opacity-0 sm:group-hover/chat:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"><MoreHorizontal className="w-4 h-4"/></button></PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-1">
            <button className={menuClass} onClick={()=>{setMenuOpenId(null);setRename(session);}}>{t("Ubah judul")}</button>
            <button className={menuClass} onClick={()=>{setMenuOpenId(null);setMoving(session);}}>{t("Pindahkan ke proyek")}</button>
            <button className={menuClass} onClick={()=>{setMenuOpenId(null);open('session',session.id);}}>{t("Atur agent sesi")}</button>
            <button className={`${menuClass} text-destructive`} onClick={()=>{setMenuOpenId(null);setRemove(session);}}>{t("Hapus chat")}</button>
          </PopoverContent>
        </Popover>
      </div>)}
      {!folded&&!rows.length&&<p className="pl-8 py-2 text-[12px] text-muted-foreground">{t("Belum ada chat")}</p>}
    </section>;
  };
  return <div className="pb-2">
    {searchOpen&&<input autoFocus aria-label={t("Cari chat")} className="w-full mb-2 rounded-lg bg-input border border-border px-3 py-2 text-[13px] outline-none focus:border-accent" placeholder={t("Cari chat…")} value={query} onChange={event=>setQuery(event.target.value)}/>}
    {error&&!editor&&<p role="alert" className="text-xs text-destructive px-2">{error}</p>}
    <div className="group/projects flex items-center justify-between pl-2 pr-1 pt-5 pb-1"><h3 className="text-[12px] font-semibold text-muted-foreground">{t("Proyek")}</h3><button type="button" aria-label={t("Proyek Baru")} title={t("Proyek baru")} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/70" onClick={()=>open('new')}><Plus className="w-4 h-4"/></button></div>
    {projects.map(project=>group(project))}
    {!projects.length&&<button type="button" className="px-2 py-2 text-[13px] text-muted-foreground hover:text-foreground" onClick={()=>open('new')}>{t("Buat proyek pertama")}</button>}
    {group(null)}
    <AlertDialog open={Boolean(removeProject)} onOpenChange={value=>{if(!busy&&!value){setRemoveProject(null);setDeleteConfirmation('');setError('');}}}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("Hapus proyek “")}{removeProject?.name}”?</AlertDialogTitle><AlertDialogDescription>{t("Proyek akan dihapus dari sidebar. Semua chat di dalamnya dipindahkan ke Terbaru; riwayat, Project Memory, dan pilihan agent tetap tersimpan.")}</AlertDialogDescription></AlertDialogHeader>
        {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
        <label className="text-sm" htmlFor="delete-project-confirmation">{t("Ketik ")}<strong className="font-mono">DELETE</strong> {t(" untuk mengonfirmasi.")}</label>
        <input id="delete-project-confirmation" autoComplete="off" spellCheck={false} disabled={busy} value={deleteConfirmation} onChange={event=>setDeleteConfirmation(event.target.value)} placeholder="DELETE" className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        <AlertDialogFooter><AlertDialogCancel disabled={busy}>{t("Batal")}</AlertDialogCancel><AlertDialogAction disabled={busy || deleteConfirmation!=='DELETE'} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={event=>{event.preventDefault();if(!removeProject || deleteConfirmation!=='DELETE')return;setBusy(true);setError('');void onProject('delete',{projectId:removeProject.id,confirmation:deleteConfirmation}).then(()=>{setRemoveProject(null);setDeleteConfirmation('');}).catch(error=>setError(error.message)).finally(()=>setBusy(false));}}>{busy?t("Menghapus…"):t("Hapus proyek")}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <Dialog open={Boolean(moving)} onOpenChange={value=>!value&&setMoving(null)}><DialogContent><DialogHeader><DialogTitle>{t("Pindahkan chat")}</DialogTitle><DialogDescription>{t("Pilih proyek untuk “")}{moving?.title}{t("”. Riwayat chat ikut dipindahkan dan chat akan memakai Project Memory tujuan.")}</DialogDescription></DialogHeader>
      <div className="space-y-1 max-h-[50vh] overflow-y-auto">{[{id:'',name:t("Di luar proyek")},...projects].map(project=><button key={project.id} className={menuClass} onClick={()=>{if(moving)move(moving.id,project.id||null);setMoving(null);}}>{project.name}</button>)}</div>
    </DialogContent></Dialog>
    {linkedProjectId&&<LinkedAppChatsDialog key={linkedProjectId} project={projects.find(p=>p.id===linkedProjectId)!} token={token} onClose={()=>setLinkedProjectId(null)} onSave={links=>onProject("linked-apps",{projectId:linkedProjectId,links})}/>}
    <CreateProjectDialog open={editor?.kind==='new'} onClose={()=>setEditor(null)} agents={agents} onCreate={input=>onProject('new',input)}/>
    <Dialog open={Boolean(editor)&&editor?.kind!=='new'} onOpenChange={open=>{if(!busy&&!open)setEditor(null);}}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{editor?.kind==='new'?t("Proyek Baru"):editor?.kind==='project'?t("Pengaturan Proyek"):t("Agent Sesi")}</DialogTitle><DialogDescription>{t("Pilih agent yang ikut berdiskusi. Sesi dapat mengikuti pilihan proyek atau memakai sebagian agent proyek.")}</DialogDescription></DialogHeader>
      {editor?.kind!=='session'&&<label className="text-sm">{t("Nama proyek")}<input className="mt-1 w-full rounded border border-border bg-input p-2" maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>}
      {editor?.kind==='project'&&<label className="block text-sm">Project Manager<select value={managerId} onChange={e=>{setManagerId(e.target.value);if(e.target.value)setIds(old=>[...new Set([e.target.value,...old])]);}} className="mt-2 w-full rounded-lg border border-border bg-input p-2"><option value="">{t("Belum ditetapkan")}</option>{agents.map(agent=><option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label>}
      {editor?.kind==='session'&&<label className="flex gap-2 text-sm"><input type="checkbox" checked={inherit} onChange={e=>setInherit(e.target.checked)}/>{t("Ikuti agent ")}{parent?t("proyek"):t("bawaan")}</label>}
      {choices.map(agent=><label key={agent.id} className="flex gap-2 items-center text-sm"><input type="checkbox" disabled={(editor?.kind==='session'&&inherit)||agent.id===(editor?.kind==='session'?parent?.managerId:managerId)} checked={ids.includes(agent.id)||agent.id===(editor?.kind==='session'?parent?.managerId:managerId)} onChange={e=>setIds(old=>e.target.checked?[...old,agent.id]:old.filter(id=>id!==agent.id))}/>{agent.name}<span className="text-xs text-muted-foreground">{agent.connection==='connected'?t("Terhubung"):t("Belum terhubung")}</span></label>)}
      {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={busy||(!inherit&&ids.length===0)||(editor?.kind!=='session'&&(!name.trim()||!ids.length))} onClick={()=>void save()}>{busy?t("Menyimpan…"):t("Simpan")}</Button>
    </DialogContent></Dialog>
    <RenameSessionDialog open={Boolean(rename)} onOpenChange={open=>!open&&setRename(null)} currentTitle={rename?.title||''} onRename={title=>{if(rename)onRename(rename.id,title);setRename(null);}}/>
    <DeleteSessionAlert open={Boolean(remove)} onOpenChange={open=>!open&&setRemove(null)} sessionTitle={remove?.title||''} onConfirm={()=>{if(remove)onDelete(remove.id);setRemove(null);}}/>
  </div>;
}
