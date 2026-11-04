"use client";
import {useI18n} from "@/lib/i18n";

import React, { useEffect, useState } from "react";
import { Settings, Folder, MessageSquare, PanelLeftClose, PanelLeftOpen, SquarePen, Flag, Database, ChevronDown, Eye, EyeOff } from "lucide-react";
import { ProjectNavigation } from "./ProjectNavigation";
import { ProjectData, AgentDefinition, SessionData, ProjectMemoryData } from "@/lib/types";
import { BrandLogo } from "./BrandLogo";
import { MessageSearch } from "./MessageSearch";
import {Popover,PopoverTrigger,PopoverContent} from "@/components/ui/popover";
import {toast} from "sonner";
import {LiveDot} from "./LiveDot";

interface SidebarProps {
  token: string;
  projects: ProjectData[];
  agents: AgentDefinition[];
  onProject: (action:string,input:Record<string,unknown>)=>Promise<void>;
  onNewProjectSession: (projectId:string|null)=>Promise<void>;
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  onSearchSelect: (sessionId:string,messageId:string,query:string)=>Promise<void>;
  sessions: SessionData[];
  activeSessionId: string;
  activeProjectId?: string|null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onNewSession: () => void;
  currentUserName: string;
  avatar?: string;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenSoulMemory?: () => void;
  currentProjectName?: string;
  soulContent?: string;
  soulRevision?: number;
  online?: boolean;
  projectMemory?: ProjectMemoryData|null;
  onOpenProjectMemory?: () => void;
}

export function Sidebar({
  token, projects, agents, onProject, onNewProjectSession, isOpen, onClose, onOpen, onSearchSelect,
  sessions, activeSessionId, activeProjectId, onSelectSession, onDeleteSession, onRenameSession,
  onNewSession, currentUserName, avatar, onOpenProfile, onOpenSettings, onOpenSoulMemory, online=false, projectMemory, onOpenProjectMemory,
}: SidebarProps) {
  const {t}=useI18n();
  const [projectMenuOpen,setProjectMenuOpen]=useState(false);
  const [memoryVisible,setMemoryVisible]=useState(true);
  useEffect(()=>{try{setMemoryVisible(localStorage.getItem('pitstop.sidebar.projectMemory.visible')!=='false');}catch{}},[]);
  const toggleMemory=()=>{const next=!memoryVisible;setMemoryVisible(next);try{localStorage.setItem('pitstop.sidebar.projectMemory.visible',String(next));}catch{}};
  const activeProject=projects.find(project=>project.id===activeProjectId&&project.status!=='completed');
  const activeProjectSession=activeProject?(sessions.find(session=>session.id===activeSessionId&&session.projectId===activeProject.id)||sessions.filter(session=>session.projectId===activeProject.id).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0]):null;

  useEffect(()=>{
    const toggle=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.code==='KeyS'){event.preventDefault();isOpen?onClose():onOpen();}else if(event.key==='Escape'&&isOpen&&window.innerWidth<1024)onClose();};
    window.addEventListener('keydown',toggle);return ()=>window.removeEventListener('keydown',toggle);
  },[isOpen,onClose,onOpen]);
  const searchSelect=async(sessionId:string,messageId:string,query:string)=>{await onSearchSelect(sessionId,messageId,query);if(window.innerWidth<1024)onClose();};
  const newChat=()=>{onNewSession();if(window.innerWidth<1024)onClose();};
  const railButton='h-10 w-10 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors';
  const userInitial=Array.from(currentUserName)[0]?.toLocaleUpperCase("id-ID") || "U";
  const memoryChars=(projectMemory?.content||'').split('<!-- PITLANE_AUTO_MEMORY -->')[0].trim().length;
  const memoryPercent=Math.min(100,Math.round(memoryChars/(projectMemory?.maxCharacters||18000)*100));
  return <>
    <div onClick={onClose} className={`fixed inset-0 z-40 bg-black/60 lg:hidden transition-opacity duration-200 ${isOpen?'opacity-100':'opacity-0 pointer-events-none'}`} aria-hidden="true"/>
    <div className="pitlane-sidebar-slot" data-open={isOpen}>
    <div className="relative min-w-0 h-full">
      <nav aria-label={t("Navigasi ringkas")} aria-hidden={isOpen} inert={isOpen} className={`hidden lg:flex absolute inset-y-0 left-0 w-[60px] flex-col items-center gap-2 py-3 overflow-y-auto overscroll-contain bg-rail border-r border-border/60 transition-opacity duration-150 ${isOpen?'opacity-0 pointer-events-none':'opacity-100'}`}>
        <button type="button" onClick={onOpen} aria-label={t("Buka sidebar")} title={t("Buka sidebar (Ctrl+Shift+S)")} aria-expanded={false} className={`${railButton} group relative`}><span className="group-hover:opacity-0 transition-opacity"><BrandLogo size={24}/></span><PanelLeftOpen className="absolute h-[18px] w-[18px] opacity-0 group-hover:opacity-100 transition-opacity"/></button>
        <button type="button" onClick={newChat} aria-label="New Chat" title="New Chat" className={`${railButton} bg-secondary/60 text-foreground`}><SquarePen className="w-[18px] h-[18px]"/></button>
        <MessageSearch sessions={sessions} onSelect={searchSelect} compact/>
        <button type="button" onClick={onOpen} aria-label={t("Lihat proyek")} title={t("Proyek")} className={railButton}><Folder className="w-[18px] h-[18px]"/></button>
        <button type="button" onClick={onOpen} aria-label={t("Lihat riwayat chat")} title={t("Riwayat chat")} className={railButton}><MessageSquare className="w-[18px] h-[18px]"/></button>
        <div className="flex-1"/>
        <button type="button" onClick={onOpenSettings} aria-label={t("Pengaturan")} title={t("Pengaturan")} className={railButton}><Settings className="w-[18px] h-[18px]"/></button>
        <button type="button" onClick={onOpenProfile} aria-label={t("Profil")} title={currentUserName} className={railButton}><span className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center text-xs overflow-hidden">{avatar?<img src={avatar} alt="" className="h-full w-full object-cover"/>:userInitial}</span></button>
      </nav>
    <aside id="pitlane-sidebar" aria-label={t("Navigasi Pitstop")} aria-hidden={!isOpen} inert={!isOpen} data-open={isOpen} className="pitlane-sidebar-panel fixed lg:absolute inset-y-0 left-0 z-50 w-[274px] max-w-[85vw] flex flex-col overflow-hidden bg-rail text-foreground border-r border-border/60 select-none">
      <div className="px-3.5 pt-4 pb-3.5 shrink-0 border-b border-border bg-rail">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/40 bg-background"><BrandLogo size={29}/></span><div className="min-w-0"><span className="block text-lg font-display font-bold uppercase tracking-tight">Pitstop<span aria-hidden="true" className="text-primary">.</span></span><span className="block text-[9px] font-mono uppercase tracking-[0.1em] text-primary">Multi-agent workspace</span></div></div>
          <div className="flex items-center gap-0.5 text-muted-foreground">
            <button type="button" aria-label={t("Tutup navigasi")} title={t("Tutup sidebar (Ctrl+Shift+S)")} aria-expanded={isOpen} aria-controls="pitlane-sidebar" onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary/70 hover:text-foreground"><PanelLeftClose className="w-[17px] h-[17px]"/></button>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar"><div className="flex min-h-full flex-col">
      <div className="px-3.5 py-3.5 shrink-0 border-b border-border">
        <p className="mb-3 font-mono text-[9px] leading-4 text-muted-foreground">MULTIPLE MINDS. ONE TEAM. ONE GOAL.</p>
        <button type="button" onClick={newChat} className="pitstop-transmit w-full h-9 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-display font-semibold uppercase text-primary-foreground hover:brightness-110 transition-colors"><Flag className="w-4 h-4"/>New Chat</button>
      </div>
      <section aria-label={t("Proyek Aktif")} className="px-3.5 pt-3.5 pb-3 border-b border-border/70">
        <div className="mb-2 flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-wide"><span className="text-muted-foreground">{t("Proyek Aktif")}</span>{activeProject&&<span className="text-brand-yellow">{t("Aktif")}</span>}</div>
        {activeProject?<Popover open={projectMenuOpen} onOpenChange={setProjectMenuOpen}><PopoverTrigger asChild><button type="button" className="w-full flex items-center gap-2.5 rounded-md border border-border bg-secondary px-2.5 py-3 text-left hover:border-primary/50"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-primary/30 bg-primary/10 text-primary"><Folder className="h-4 w-4"/></span><span className="min-w-0 flex-1"><span className="flex min-w-0 items-center gap-2 text-sm font-display font-semibold"><LiveDot className="h-1.5 w-1.5"/><span className="truncate">{activeProject.name}</span></span><span className="mt-1 block truncate font-mono text-[9px] text-muted-foreground">{activeProjectSession?.title||'New Chat'}</span></span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground"/></button></PopoverTrigger><PopoverContent align="start" className="w-[246px] p-1.5">{projects.filter(project=>project.status!=='completed').map(project=><button type="button" key={project.id} className="flex w-full items-center gap-2 rounded px-2.5 py-2.5 text-sm text-left hover:bg-secondary" onClick={()=>{setProjectMenuOpen(false);void onProject('open',{projectId:project.id}).catch(error=>toast.error(t("Gagal membuka proyek"),{description:error.message}));}}><Folder className="h-4 w-4 text-primary"/><span className="truncate">{project.name}</span>{activeProject.id===project.id&&<LiveDot className="ml-auto h-1.5 w-1.5"/>}</button>)}</PopoverContent></Popover>:<p className="rounded-md border border-dashed border-border px-3 py-3 text-xs leading-5 text-muted-foreground">{t("Belum ada proyek aktif")}</p>}
      </section>
      <div className="px-3.5 pt-3"><MessageSearch sessions={sessions} onSelect={searchSelect} wide/></div>
      <div className="flex-1 px-2 pb-4">
        <ProjectNavigation token={token} projects={projects} agents={agents} sessions={sessions} activeId={activeSessionId} activeProjectId={activeProjectId}

          onProject={onProject} onNew={onNewProjectSession}
          onSelect={id=>{onSelectSession(id);if(window.innerWidth<1024)onClose();}}
          onRename={onRenameSession} onDelete={onDeleteSession}/>
      </div>
      <div className="shrink-0 p-3 border-t border-border space-y-2.5">

      <div className="flex items-center gap-1 rounded-md border border-border bg-secondary p-1">
        <button type="button" onClick={onOpenProfile} title={t("Ubah nama tampilan")} className="min-w-0 flex-1 flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-secondary/70 text-left text-[13px]">
          <span className="w-8 h-8 rounded-md border border-primary/40 bg-primary/10 text-primary flex items-center justify-center text-xs shrink-0">{avatar?<img src={avatar} alt={t("Foto profil")} className="w-full h-full rounded-md object-cover"/>:userInitial}</span><span className="min-w-0"><span className="block truncate font-display font-semibold">{currentUserName}</span><span className="block mt-0.5 text-[9px] font-mono uppercase text-brand-yellow">General Manager</span></span>
        </button>
        <button type="button" onClick={onOpenSettings} aria-label={t("Pengaturan profil dan Soul Memory")} title={t("Pengaturan")} className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary/70"><Settings className="w-4 h-4"/></button>
      </div>
      <div className="flex items-center gap-1.5 px-1 font-mono text-[9px] uppercase text-muted-foreground"><span className={`h-1.5 w-1.5 rounded-full ${online?'bg-brand-lime':'bg-muted-foreground'}`}/>{online?t("Terhubung"):t("Menyambungkan ke Pitstop…")}</div>
      </div>
      </div></div>
      {projectMemory&&<section className="shrink-0 mx-3 my-3 rounded-md border border-border bg-secondary">
          <div className="flex items-center gap-1 p-2"><button type="button" onClick={onOpenProjectMemory} aria-label={t("Buka Project Memory")} className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1.5 text-left font-mono text-[10px] uppercase hover:text-brand-cyan"><Database className="h-3.5 w-3.5 shrink-0 text-brand-cyan"/><span className="truncate">Project Memory</span></button><button type="button" onClick={toggleMemory} aria-expanded={memoryVisible} aria-controls="sidebar-project-memory-details" aria-label={memoryVisible?t("Sembunyikan Project Memory"):t("Tampilkan Project Memory")} title={memoryVisible?t("Sembunyikan Project Memory"):t("Tampilkan Project Memory")} className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground">{memoryVisible?<EyeOff className="h-3.5 w-3.5"/>:<Eye className="h-3.5 w-3.5"/>}</button></div>
          {memoryVisible&&<button id="sidebar-project-memory-details" type="button" onClick={onOpenProjectMemory} aria-label={t("Buka Project Memory")} className="block w-full border-t border-border/60 px-3 pb-3 pt-2 text-left hover:bg-background/30"><span className="flex justify-between gap-2 font-mono text-[9px] text-muted-foreground"><span>{memoryChars.toLocaleString()} / {(projectMemory?.maxCharacters||18000).toLocaleString()}</span><span className="text-primary">{memoryPercent}%</span></span><span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-background"><span className="block h-full rounded-full bg-brand-yellow" style={{width:`${memoryPercent}%`}}/></span></button>}
        </section>}
    </aside>
    </div>
    </div>
  </>;
}
