"use client";
import {useI18n} from "@/lib/i18n";

import React, { useEffect, useState } from "react";
import { Settings, Folder, MessageSquare, PanelLeftClose, PanelLeftOpen, SquarePen, Flag, Database, ChevronDown } from "lucide-react";
import { ProjectNavigation } from "./ProjectNavigation";
import { ProjectData, AgentDefinition, SessionData, ProjectMemoryData } from "@/lib/types";
import { BrandLogo } from "./BrandLogo";
import { MessageSearch } from "./MessageSearch";
import {Popover,PopoverTrigger,PopoverContent} from "@/components/ui/popover";
import {toast} from "sonner";

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
  sessions, activeSessionId, onSelectSession, onDeleteSession, onRenameSession,
  onNewSession, currentUserName, avatar, onOpenProfile, onOpenSettings, onOpenSoulMemory, online=false, projectMemory, onOpenProjectMemory,
}: SidebarProps) {
  const {t}=useI18n();
  const [projectMenuOpen,setProjectMenuOpen]=useState(false);
  const activeProject=projects.find(project=>project.id===sessions.find(session=>session.id===activeSessionId)?.projectId);

  useEffect(()=>{
    const toggle=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.code==='KeyS'){event.preventDefault();isOpen?onClose():onOpen();}else if(event.key==='Escape'&&isOpen&&window.innerWidth<1024)onClose();};
    window.addEventListener('keydown',toggle);return ()=>window.removeEventListener('keydown',toggle);
  },[isOpen,onClose,onOpen]);
  const searchSelect=async(sessionId:string,messageId:string,query:string)=>{await onSearchSelect(sessionId,messageId,query);if(window.innerWidth<1024)onClose();};
  const newChat=()=>{onNewSession();if(window.innerWidth<1024)onClose();};
  const railButton='h-10 w-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors';
  const userInitial=Array.from(currentUserName)[0]?.toLocaleUpperCase("id-ID") || "U";
  const memoryChars=(projectMemory?.content||'').split('<!-- PITLANE_AUTO_MEMORY -->')[0].trim().length;
  const memoryPercent=Math.min(100,Math.round(memoryChars/18000*100));
  return <>
    <div onClick={onClose} className={`fixed inset-0 z-40 bg-black/60 lg:hidden transition-opacity duration-200 ${isOpen?'opacity-100':'opacity-0 pointer-events-none'}`} aria-hidden="true"/>
    <div className="pitlane-sidebar-slot" data-open={isOpen}>
    <div className="relative min-w-0 h-full">
      <nav aria-label={t("Navigasi ringkas")} aria-hidden={isOpen} inert={isOpen} className={`hidden lg:flex absolute inset-y-0 left-0 w-[60px] flex-col items-center gap-2 py-3 bg-rail border-r border-border/60 transition-opacity duration-150 ${isOpen?'opacity-0 pointer-events-none':'opacity-100'}`}>
        <button type="button" onClick={onOpen} aria-label={t("Buka sidebar")} title={t("Buka sidebar (Ctrl+Shift+S)")} aria-expanded={false} className={`${railButton} group relative`}><span className="group-hover:opacity-0 transition-opacity"><BrandLogo size={24}/></span><PanelLeftOpen className="absolute h-[18px] w-[18px] opacity-0 group-hover:opacity-100 transition-opacity"/></button>
        <button type="button" onClick={newChat} aria-label="New Chat" title="New Chat" className={`${railButton} bg-secondary/60 text-foreground`}><SquarePen className="w-[18px] h-[18px]"/></button>
        <MessageSearch sessions={sessions} onSelect={searchSelect} compact/>
        <button type="button" onClick={onOpen} aria-label={t("Lihat proyek")} title={t("Proyek")} className={railButton}><Folder className="w-[18px] h-[18px]"/></button>
        <button type="button" onClick={onOpen} aria-label={t("Lihat riwayat chat")} title={t("Riwayat chat")} className={railButton}><MessageSquare className="w-[18px] h-[18px]"/></button>
        <div className="flex-1"/>
        <button type="button" onClick={onOpenSettings} aria-label={t("Pengaturan")} title={t("Pengaturan")} className={railButton}><Settings className="w-[18px] h-[18px]"/></button>
        <button type="button" onClick={onOpenProfile} aria-label={t("Profil")} title={currentUserName} className={railButton}><span className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center text-xs overflow-hidden">{avatar?<img src={avatar} alt="" className="h-full w-full object-cover"/>:userInitial}</span></button>
      </nav>
    <aside id="pitlane-sidebar" aria-label={t("Navigasi Pitstop")} aria-hidden={!isOpen} inert={!isOpen} data-open={isOpen} className="pitlane-sidebar-panel fixed lg:absolute inset-y-0 left-0 z-50 w-[274px] max-w-[85vw] flex flex-col bg-rail text-foreground border-r border-border/60 select-none">
      <div className="px-3.5 pt-4 pb-3.5 shrink-0 border-b border-border bg-rail">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/40 bg-background"><BrandLogo size={29}/></span><div className="min-w-0"><span className="block text-lg font-display font-bold uppercase tracking-tight">Pitstop<span aria-hidden="true" className="text-primary">.</span></span><span className="block text-[9px] font-mono uppercase tracking-[0.1em] text-primary">Multi-agent workspace</span></div></div>
          <div className="flex items-center gap-0.5 text-muted-foreground">
            <MessageSearch sessions={sessions} onSelect={searchSelect} compact/>
            <button type="button" aria-label={t("Tutup navigasi")} title={t("Tutup sidebar (Ctrl+Shift+S)")} aria-expanded={isOpen} aria-controls="pitlane-sidebar" onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary/70 hover:text-foreground"><PanelLeftClose className="w-[17px] h-[17px]"/></button>
          </div>
        </div>
        <p className="mb-3 font-mono text-[9px] leading-4 text-muted-foreground">MULTIPLE MINDS. ONE TEAM. ONE GOAL.</p>
        <button type="button" onClick={newChat} className="pitstop-transmit w-full flex items-center justify-center gap-2 rounded-md px-3 py-3 text-sm font-display font-bold uppercase text-primary-foreground hover:brightness-110 transition-colors"><Flag className="w-4 h-4"/>New Chat</button>
      </div>
      <div className="px-3.5 pt-3.5 pb-3 border-b border-border/70"><div className="mb-2 flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-wide"><span className="text-muted-foreground">{t("Proyek")}</span>{activeProject&&<span className="text-brand-yellow">{t("Aktif")}</span>}</div><Popover open={projectMenuOpen} onOpenChange={setProjectMenuOpen}><PopoverTrigger asChild><button type="button" className="w-full flex items-center gap-2.5 rounded-md border border-border bg-secondary px-2.5 py-3 text-left hover:border-primary/50"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-primary/30 bg-primary/10 text-primary"><Folder className="h-4 w-4"/></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-display font-semibold">{activeProject?.name||t("Chat di luar proyek")}</span><span className="mt-1 block truncate font-mono text-[9px] text-muted-foreground">{sessions.find(session=>session.id===activeSessionId)?.title||'New Chat'}</span></span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground"/></button></PopoverTrigger><PopoverContent align="start" className="w-[246px] p-1.5">{projects.map(project=><button type="button" key={project.id} className="flex w-full items-center gap-2 rounded px-2.5 py-2.5 text-sm text-left hover:bg-secondary" onClick={()=>{setProjectMenuOpen(false);void onProject('open',{projectId:project.id}).catch(error=>toast.error(t("Gagal membuka proyek"),{description:error.message}));}}><Folder className="h-4 w-4 text-primary"/><span className="truncate">{project.name}</span>{activeProject?.id===project.id&&<span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary"/>}</button>)}{!projects.length&&<p className="p-3 text-xs text-muted-foreground">{t("Buat proyek pertama")}</p>}</PopoverContent></Popover></div>
      <div className="px-3.5 pt-3"><MessageSearch sessions={sessions} onSelect={searchSelect} wide/></div>
      <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar px-2 pb-4">
        <ProjectNavigation token={token} projects={projects} agents={agents} sessions={sessions} activeId={activeSessionId}

          onProject={onProject} onNew={onNewProjectSession}
          onSelect={id=>{onSelectSession(id);if(window.innerWidth<1024)onClose();}}
          onRename={onRenameSession} onDelete={onDeleteSession}/>
      </div>
      <div className="shrink-0 p-3 border-t border-border space-y-2.5">
        {projectMemory&&<button type="button" onClick={onOpenProjectMemory} aria-label={t("Buka Project Memory")} className="w-full rounded-md border border-border bg-secondary p-3 text-left hover:border-brand-cyan/60 transition-colors"><span className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase"><span className="flex items-center gap-2"><Database className="h-3.5 w-3.5 text-brand-cyan"/>Project Memory</span><span className="text-primary">{memoryPercent}%</span></span><span className="my-2 block h-1 w-full overflow-hidden rounded-full bg-background"><span className="block h-full rounded-full bg-brand-yellow" style={{width:`${memoryPercent}%`}}/></span><span className="flex justify-between gap-2 font-mono text-[9px] text-muted-foreground"><span>{memoryChars.toLocaleString()} / 18,000</span><span>v{projectMemory.revision}</span></span></button>}
      <div className="flex items-center gap-1 rounded-md border border-border bg-secondary p-1">
        <button type="button" onClick={onOpenProfile} title={t("Ubah nama tampilan")} className="min-w-0 flex-1 flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-secondary/70 text-left text-[13px]">
          <span className="w-8 h-8 rounded-md border border-primary/40 bg-primary/10 text-primary flex items-center justify-center text-xs shrink-0">{avatar?<img src={avatar} alt={t("Foto profil")} className="w-full h-full rounded-md object-cover"/>:userInitial}</span><span className="min-w-0"><span className="block truncate font-display font-semibold">{currentUserName}</span><span className="block mt-0.5 text-[9px] font-mono uppercase text-brand-yellow">General Manager</span></span>
        </button>
        <button type="button" onClick={onOpenSettings} aria-label={t("Pengaturan profil dan Soul Memory")} title={t("Pengaturan")} className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary/70"><Settings className="w-4 h-4"/></button>
      </div>
      <div className="flex items-center gap-1.5 px-1 font-mono text-[9px] uppercase text-muted-foreground"><span className={`h-1.5 w-1.5 rounded-full ${online?'bg-brand-lime':'bg-muted-foreground'}`}/>{online?t("Terhubung"):t("Menyambungkan ke Pitstop…")}</div>
      </div>
    </aside>
    </div>
    </div>
  </>;
}
