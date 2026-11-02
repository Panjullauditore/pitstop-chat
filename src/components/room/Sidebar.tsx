"use client";
import {useI18n} from "@/lib/i18n";

import React, { useEffect } from "react";
import { Settings, Folder, MessageSquare, PanelLeftClose, PanelLeftOpen, SquarePen } from "lucide-react";
import { ProjectNavigation } from "./ProjectNavigation";
import { ProjectData, AgentDefinition, SessionData } from "@/lib/types";
import { BrandLogo } from "./BrandLogo";
import { MessageSearch } from "./MessageSearch";

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
}

export function Sidebar({
  token, projects, agents, onProject, onNewProjectSession, isOpen, onClose, onOpen, onSearchSelect,
  sessions, activeSessionId, onSelectSession, onDeleteSession, onRenameSession,
  onNewSession, currentUserName, avatar, onOpenProfile, onOpenSettings, onOpenSoulMemory,
}: SidebarProps) {
  const {t}=useI18n();

  useEffect(()=>{
    const toggle=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.code==='KeyS'){event.preventDefault();isOpen?onClose():onOpen();}else if(event.key==='Escape'&&isOpen&&window.innerWidth<1024)onClose();};
    window.addEventListener('keydown',toggle);return ()=>window.removeEventListener('keydown',toggle);
  },[isOpen,onClose,onOpen]);
  const searchSelect=async(sessionId:string,messageId:string,query:string)=>{await onSearchSelect(sessionId,messageId,query);if(window.innerWidth<1024)onClose();};
  const newChat=()=>{onNewSession();if(window.innerWidth<1024)onClose();};
  const railButton='h-10 w-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors';
  const userInitial=Array.from(currentUserName)[0]?.toLocaleUpperCase("id-ID") || "U";
  return <>
    <div onClick={onClose} className={`fixed inset-0 z-40 bg-black/60 lg:hidden transition-opacity duration-200 ${isOpen?'opacity-100':'opacity-0 pointer-events-none'}`} aria-hidden="true"/>
    <div className="pitlane-sidebar-slot" data-open={isOpen}>
    <div className="relative min-w-0 h-full">
      <nav aria-label={t("Navigasi ringkas")} aria-hidden={isOpen} inert={isOpen} className={`hidden lg:flex absolute inset-y-0 left-0 w-[60px] flex-col items-center gap-2 py-3 bg-background border-r border-border/60 transition-opacity duration-150 ${isOpen?'opacity-0 pointer-events-none':'opacity-100'}`}>
        <button type="button" onClick={onOpen} aria-label={t("Buka sidebar")} title={t("Buka sidebar (Ctrl+Shift+S)")} aria-expanded={false} className={`${railButton} group relative`}><span className="group-hover:opacity-0 transition-opacity"><BrandLogo size={24}/></span><PanelLeftOpen className="absolute h-[18px] w-[18px] opacity-0 group-hover:opacity-100 transition-opacity"/></button>
        <button type="button" onClick={newChat} aria-label="New Chat" title="New Chat" className={`${railButton} bg-secondary/60 text-foreground`}><SquarePen className="w-[18px] h-[18px]"/></button>
        <MessageSearch sessions={sessions} onSelect={searchSelect} compact/>
        <button type="button" onClick={onOpen} aria-label={t("Lihat proyek")} title={t("Proyek")} className={railButton}><Folder className="w-[18px] h-[18px]"/></button>
        <button type="button" onClick={onOpen} aria-label={t("Lihat riwayat chat")} title={t("Riwayat chat")} className={railButton}><MessageSquare className="w-[18px] h-[18px]"/></button>
        <div className="flex-1"/>
        <button type="button" onClick={onOpenSettings} aria-label={t("Pengaturan")} title={t("Pengaturan")} className={railButton}><Settings className="w-[18px] h-[18px]"/></button>
        <button type="button" onClick={onOpenProfile} aria-label={t("Profil")} title={currentUserName} className={railButton}><span className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center text-xs overflow-hidden">{avatar?<img src={avatar} alt="" className="h-full w-full object-cover"/>:userInitial}</span></button>
      </nav>
    <aside id="pitlane-sidebar" aria-label={t("Navigasi Pitlane")} aria-hidden={!isOpen} inert={!isOpen} data-open={isOpen} className="pitlane-sidebar-panel fixed lg:absolute inset-y-0 left-0 z-50 w-[274px] max-w-[85vw] flex flex-col bg-background text-foreground border-r border-border/60 select-none">
      <div className="px-3 pt-3 pb-1 shrink-0">
        <div className="flex items-center justify-between gap-2 h-9 mb-3">
          <div className="flex items-center gap-2 pl-1"><BrandLogo size={23}/><span className="text-lg font-semibold tracking-tight">Pitlane</span></div>
          <div className="flex items-center gap-0.5 text-muted-foreground">
            <MessageSearch sessions={sessions} onSelect={searchSelect} compact/>
            <button type="button" aria-label={t("Tutup navigasi")} title={t("Tutup sidebar (Ctrl+Shift+S)")} aria-expanded={isOpen} aria-controls="pitlane-sidebar" onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary/70 hover:text-foreground"><PanelLeftClose className="w-[17px] h-[17px]"/></button>
          </div>
        </div>
        <button type="button" onClick={newChat} className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-left bg-secondary/60 hover:bg-secondary transition-colors"><SquarePen className="w-[17px] h-[17px]"/>New Chat</button>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar px-2 pb-4">
        <ProjectNavigation token={token} projects={projects} agents={agents} sessions={sessions} activeId={activeSessionId}

          onProject={onProject} onNew={onNewProjectSession}
          onSelect={id=>{onSelectSession(id);if(window.innerWidth<1024)onClose();}}
          onRename={onRenameSession} onDelete={onDeleteSession}/>
      </div>
      <div className="shrink-0 p-2 flex items-center gap-1">
        <button type="button" onClick={onOpenProfile} title={t("Ubah nama tampilan")} className="min-w-0 flex-1 flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-secondary/70 text-left text-[13px]">
          <span className="w-6 h-6 rounded-md bg-secondary text-foreground flex items-center justify-center text-xs shrink-0">{avatar?<img src={avatar} alt={t("Foto profil")} className="w-full h-full rounded-md object-cover"/>:userInitial}</span><span className="truncate">{currentUserName}</span>
        </button>
        <button type="button" onClick={onOpenSettings} aria-label={t("Pengaturan profil dan Soul Memory")} title={t("Pengaturan")} className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary/70"><Settings className="w-4 h-4"/></button>
      </div>
    </aside>
    </div>
    </div>
  </>;
}
