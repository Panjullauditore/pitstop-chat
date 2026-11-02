"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  fetchBootstrap,
  setApiSession,
  sendChat,
  stopChat,
  subscribeRoomEvents,
  mutateSession,
  mutateProject,
  configureAgent,
  refreshCatalogModels,
} from "@/lib/api";
import {
  RoomSnapshot,
  CatalogData,
  SessionData,
  AgentDefinition,
} from "@/lib/types";
import {
  loadStoredSessions,
  DEFAULT_NEUTRAL_SOUL,
} from "@/lib/sessions";
import { formatJakartaDate } from "@/lib/utils";
import { BrandLogo } from "@/components/room/BrandLogo";
import { Sidebar } from "@/components/room/Sidebar";
import { TeamPanel } from "@/components/room/TeamPanel";
import { MessageSearch } from "@/components/room/MessageSearch";
import { ChatMessages } from "@/components/room/ChatMessages";
import { ProjectDecisionPanel } from "@/components/room/ProjectDecisionPanel";
import { Composer } from "@/components/room/Composer";
import { SoulMemoryDrawer } from "@/components/room/SoulMemoryDrawer";
import { AttendanceDialog } from "@/components/room/AttendanceDialog";
import { AgentProfileDialog } from "@/components/room/AgentProfileDialog";
import { SettingsDialog } from "@/components/room/SettingsDialog";
import { AgentConnectorDialog as AddAgentDialog } from "@/components/room/AgentConnectorDialog";
import { ManualWebPanel } from "@/components/room/ManualWebPanel";
import { ReconnectDialog } from "@/components/room/ReconnectDialog";
import { Button } from "@/components/ui/button";
import {
  Menu,
  Sparkles,
  Users,
  Download,
  AlertTriangle,
  Wifi,
  WifiOff,
  Share2,
  Database,
  Brain,
  PanelRight,
} from "lucide-react";
import {useI18n} from "@/lib/i18n";
import { toast } from "sonner";

export default function PitlanePage() {
  const {t,setLanguage}=useI18n();
  const [searchTarget,setSearchTarget] = useState<{messageId:string;query:string;nonce:number}|null>(null);
  const [token, setToken] = useState("");
  const [roomState, setRoomState] = useState<RoomSnapshot | null>(null);
  const [catalog, setCatalog] = useState<Record<string, CatalogData>>({});
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState("");

  // Sessions state
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("session-default");

  // Layout Drawer / Panel states
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(()=>{setSidebarOpen(window.innerWidth>=1024);},[]);
  const [teamPanelOpen, setTeamPanelOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    const update = () => setTeamPanelOpen(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  // Dialog states
  const [memoryTab,setMemoryTab]=useState<"project"|"soul">("project");
  const [soulDialogOpen, setSoulDialogOpen] = useState(false);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [profileAgent,setProfileAgent]=useState<AgentDefinition|null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [addAgentDialogOpen, setAddAgentDialogOpen] = useState(false);
  const [reconnectDialogOpen, setReconnectDialogOpen] = useState(false);
  const [chatScrollRequest,setChatScrollRequest]=useState(0);

  // Active Session helper
  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || sessions[0] || null;
  }, [sessions, activeSessionId]);

  // Current User Name
  const currentUserName = roomState?.brain?.preferences?.displayName || "Username";

  const allAgents = useMemo<AgentDefinition[]>(() => (roomState?.agents || []).map(agent => ({
    ...agent,
    model: roomState?.brain?.selections?.[agent.id]?.model || "",
    effort: roomState?.brain?.selections?.[agent.id]?.effort || "",
  })), [roomState]);
  const applySnapshot = useCallback((snapshot: RoomSnapshot) => {
    setLanguage(snapshot.language || 'en');
    setApiSession(snapshot.sessionId || "session-default");
    setRoomState(snapshot);
    setSessions(snapshot.sessions || []);
    setActiveSessionId(snapshot.sessionId || "session-default");
  }, [setLanguage]);

  // Server owns the active session, transcript and Soul; reconnect obtains a fresh token.
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    async function connect() {
      try {
        const data = await fetchBootstrap();
        if (disposed) return;
        setToken(data.token); setCatalog(data.catalog || {}); applySnapshot(data.state);
        setOnline(true); setInitError("");
        const stored = loadStoredSessions();
        if (stored.sessions.some(s => s.messages.length > 0 || s.id !== "session-default")) {
          try {
            const imported = await mutateSession("import", { sessions: stored.sessions }, data.token);
            if (!disposed) applySnapshot(imported);
          } catch (err: any) { toast.warning(t("Migrasi riwayat browser belum selesai"), {description:err.message}); }
        }
        if (disposed) return;
        unsubscribe = subscribeRoomEvents(data.token,
          snapshot => { if (!disposed) { setOnline(true); applySnapshot(snapshot); } },
          warning => toast.warning(t("Peringatan Room"), {description:warning}),
          () => {
            if (disposed) return;
            setOnline(false); unsubscribe?.();
            if (!retry) retry = setTimeout(() => { retry = undefined; void connect(); }, 2000);
          });
        void refreshCatalogModels(data.token).then(value => {if (!disposed) setCatalog(value);}).catch(() => {});
      } catch (error: any) {
        if (disposed) return;
        setOnline(false); setInitError(error.message || t("Backend belum tersambung."));
        retry = setTimeout(() => {retry=undefined;void connect();}, 3000);
      } finally { if (!disposed) setLoading(false); }
    }
    void connect();
    return () => {disposed=true;unsubscribe?.();if(retry)clearTimeout(retry);};
  }, [applySnapshot]);

  const sessionMutation = useCallback(async (action: string, input: Record<string, unknown>) => {
    try { setSearchTarget(null);applySnapshot(await mutateSession(action, input, token)); }
    catch (error: any) { toast.error(t("Sesi gagal diperbarui"), {description:error.message}); }
  }, [token, applySnapshot]);
  const handleSelectSession = useCallback((sessionId: string) => sessionMutation("switch", {sessionId}), [sessionMutation]);
  const handleRenameSession = useCallback((sessionId: string, title: string) => sessionMutation("rename", {sessionId, title}), [sessionMutation]);
  const handleNewSession = useCallback(() => sessionMutation("new", {title:"New Chat",soulContent:DEFAULT_NEUTRAL_SOUL}), [sessions.length, sessionMutation]);
  const handleDeleteSession = useCallback((sessionId: string) => sessionMutation("delete", {sessionId}), [sessionMutation]);

  const projectMutation = useCallback(async (action:string,input:Record<string,unknown>)=>{
    applySnapshot(await mutateProject(action,input,token));
  },[token,applySnapshot]);
  const newProjectSession = useCallback(async (projectId:string|null)=>{
    await sessionMutation("new",{title:"New Chat",projectId,soulContent:projectId?`# ${roomState?.projects?.find(p=>p.id===projectId)?.name || t("Proyek")}\n\n## Tujuan\nTentukan tujuan sesi ini.`:DEFAULT_NEUTRAL_SOUL});
  },[sessions.length,roomState?.projects,sessionMutation]);
  const activeAgents = allAgents.filter(a=>(roomState?.enabledAgentIds || allAgents.map(agent=>agent.id)).includes(a.id));

  // Send Chat message
  const handleSendMessage = useCallback(
    async (text: string, mode: string, syncMemory = true, attachmentIds: string[] = [], decisionId?: string) => {
      if (!token) {
        toast.error(t("Pitlane Belum Terhubung"));
        return;
      }

      await sendChat({ text, mode, syncMemory, attachmentIds, decisionId, sessionId: activeSessionId }, token);
      setSearchTarget(null);
      setChatScrollRequest(value=>value+1);
    },
    [token, activeSessionId]
  );

  const handlePromptSelected = useCallback((text: string) => {
    void handleSendMessage(text, 'discussion').catch(error=>toast.error(t("Pesan gagal dikirim"),{description:error.message}));
  }, [handleSendMessage]);

  const handleSearchSelect = useCallback(async(sessionId:string,messageId:string,query:string)=>{
    if(sessionId!==activeSessionId)applySnapshot(await mutateSession('switch',{sessionId},token));
    setSearchTarget({messageId,query,nonce:Date.now()});
  },[activeSessionId,token,applySnapshot]);

  // Stop current run
  const handleStopRun = useCallback(async () => {
    if (!token) return;
    try {
      await stopChat(token);
      toast.info(t("Menghentikan Respons"), {
        description: t("Proses giliran AI sedang dihentikan."),
      });
    } catch (err: any) {
      toast.error(t("Gagal Stop"), { description: err.message });
    }
  }, [token]);

  const handleAddAgent = useCallback(async (agent: AgentDefinition) => {
    applySnapshot(await configureAgent(agent, token));
  }, [token, applySnapshot]);

  // Quota warnings calculation (<= 5%)
  const quotaWarnings = useMemo(() => {
    return Object.values(roomState?.quota || {}).flatMap(
      (status) => status.warnings || []
    );
  }, [roomState?.quota]);

  const displayMessages = roomState?.messages || [];
  const activeProject=roomState?.projects?.find(p=>p.id===activeSession?.projectId);
  const projectName = roomState?.projects?.find(p=>p.id===activeSession?.projectId)?.name || t("Chat di luar proyek");

  // Status text for composer
  const isRunning = Boolean(roomState?.run);
  const isStopping = Boolean(roomState?.run?.stopping);
  const endings: Record<string, string> = {
    consensus: t("Tim AI merasa pembahasan sudah cukup."),
    "needs-user": t("Diskusi menunggu arahan Anda."),
    budget: t("Diskusi dijeda untuk menghemat jatah kuota."),
    "missing-control": t("Pembahasan dijeda; tidak ada instruksi lanjut."),
    stopped: t("Diskusi dihentikan oleh pengguna."),
    error: t("Respons terhenti karena error."),
  };
  const activeSpeakerName = roomState?.run?.speaker
    ? allAgents.find((a) => a.id === roomState.run!.speaker)?.name || roomState.run.speaker
    : "AI";
  const runStatusText = roomState?.webRequest ? t("Menunggu impor balasan DeepSeek web…") : isRunning
    ? isStopping
      ? t("Menghentikan respons…")
      : t("{0} sedang berpikir…", [activeSpeakerName])
    : endings[roomState?.lastRun?.reason || ""] || t("Siap untuk topik diskusi berikutnya.");

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      {/* 1. Sidebar Kiri (Navigation, New Session, Search, Time-grouped History, Profile, Settings) */}
      <Sidebar token={token}
        onOpen={()=>setSidebarOpen(true)}
        onSearchSelect={handleSearchSelect}
        projects={roomState?.projects || []}
        agents={allAgents}
        onProject={projectMutation}
        onNewProjectSession={newProjectSession}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        onNewSession={handleNewSession}
        avatar={roomState?.brain?.preferences?.avatar}
        currentUserName={currentUserName}
        onOpenProfile={() => setProfileDialogOpen(true)}
        onOpenSettings={() => setProfileDialogOpen(true)}
        currentProjectName={projectName}
        soulContent={roomState?.brain?.soul?.content || ""}
        soulRevision={roomState?.brain?.soul?.revision || 0}
      />

      {/* 2. Area Utama (Center Chat Workspace) */}
      <main className="flex-1 flex flex-col min-w-0 h-dvh min-h-0 overflow-hidden bg-background relative isolate">
        {/* TopNavBar Collaboration Header (Stitch Architecture) */}
        <header className="h-16 px-4 sm:px-6 border-b border-border/60 bg-background flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {!sidebarOpen&&<button type="button" onClick={()=>setSidebarOpen(true)} className="lg:hidden h-9 w-9 rounded-lg hover:bg-secondary flex items-center justify-center shrink-0" aria-label={t("Buka navigasi")}><Menu className="w-4 h-4"/></button>}
            <h1 className="text-sm font-semibold truncate" title={activeSession?.title}>{activeSession?.title || 'New Chat'}</h1>
            {activeSession?.projectId&&<span className="hidden lg:block text-sm text-muted-foreground truncate max-w-48" title={projectName}>/ {projectName}</span>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="lg:hidden"><MessageSearch sessions={sessions} onSelect={handleSearchSelect} compact/></span>
            <Button variant="ghost" size="sm" onClick={()=>{setMemoryTab('project');setSoulDialogOpen(true);}} className="h-9 gap-2 px-2.5" aria-label={t("Buka Project Memory")} title="Project Memory"><Brain className="w-4 h-4"/><span className="hidden sm:inline text-xs">Project Memory</span></Button>
            <Button variant="ghost" size="sm" onClick={()=>setTeamPanelOpen(value=>!value)} className="h-9 gap-2 px-2.5" aria-label={teamPanelOpen?t("Tutup tim"):t("Buka tim")} aria-pressed={teamPanelOpen} title={t("Panel tim")}><Users className="w-4 h-4"/><span className="hidden sm:inline text-xs">{t("Tim")}</span></Button>
            <Button variant="ghost" size="sm" disabled={!token} onClick={()=>{window.location.href=`/api/export?token=${encodeURIComponent(token)}`;}} className="h-9 w-9 p-0" aria-label={t("Unduh percakapan")} title={t("Unduh percakapan")}><Download className="w-4 h-4"/></Button>
          </div>
        </header>

        {/* Low Quota Warning Alert (<= 5%) */}
        {quotaWarnings.length > 0 && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs space-y-1 shrink-0">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{t("Peringatan Limit Kuota Agent (Sisa ≤ 5%):")}</span>
            </div>
            {quotaWarnings.map((warn, wIdx) => {
              const rem = new Intl.NumberFormat("id-ID", {
                maximumFractionDigits: 1,
              }).format(warn.remainingPercent);
              return (
                <div key={wIdx} className="ml-5 text-[11px] leading-relaxed">
                  <strong>{warn.agent.toUpperCase()}</strong>: {warn.group} ({warn.bucket}{t(") sisa")}{" "}
                  <span className="font-bold underline">{rem}%</span>{t(". Reset:")}{" "}
                  {formatJakartaDate(warn.resetAt)}.
                </div>
              );
            })}
          </div>
        )}

        {searchTarget&&<div className="px-4 py-2 border-b border-border bg-secondary/50 flex justify-between items-center gap-2 text-xs">
          <span className="truncate">{t("Hasil pencarian: ")}<strong>{searchTarget.query}</strong></span>
          <button className="text-primary shrink-0 hover:underline" onClick={()=>setSearchTarget(null)}>{t("Ke pesan terbaru")}</button>
        </div>}
        {/* Chat Messages */}
        <ChatMessages
          managerId={activeProject?.managerId}
          key={`messages-${activeSessionId}`}
          agents={allAgents}
          searchTarget={searchTarget}
          messages={displayMessages}
          scrollRequest={chatScrollRequest}
          avatar={roomState?.brain?.preferences?.avatar}
          currentUserName={currentUserName}
          token={token}
          quotaMap={roomState?.quota || {}}
          pinnedIds={roomState?.projectMemory?.pinnedIds || []}
          onPromptSelected={handlePromptSelected}
          onMessagePinned={()=>{void fetchBootstrap().then(data=>applySnapshot(data.state));}}
        />

        {/* Composer */}
        {activeProject?.pendingDecision ? <ProjectDecisionPanel key={activeProject.pendingDecision.id} question={activeProject.pendingDecision.question} disabled={!online} onDecision={text=>handleSendMessage(text,'discussion',true,[],activeProject.pendingDecision!.id)}/> : roomState?.webRequest ? <ManualWebPanel key={roomState.webRequest.id} request={roomState.webRequest} token={token} onStop={handleStopRun}/> : <Composer
          key={`composer-${activeSessionId}`}
          token={token}
          sessionId={activeSessionId}
          onSendMessage={handleSendMessage}
          onStop={handleStopRun}
          isRunning={isRunning}
          isStopping={isStopping}
          statusText={runStatusText}
          errorMessage={initError}
          agents={activeAgents}
          disabled={!online}
        />}
      </main>

      {/* 3. Panel Tim di Kanan (Collapsible on Desktop, Drawer on Mobile) */}
      <TeamPanel linkedApps={activeProject?.linkedApps}
        managerId={activeProject?.managerId}
        onOpen={()=>setTeamPanelOpen(true)}
        onOpenAgentProfile={setProfileAgent}
        projectName={projectName}
        sessionSummary={roomState?.projectMemory?.auto?.updates?.at(-1)?.summary}
        isOpen={teamPanelOpen}
        onClose={() => setTeamPanelOpen(false)}
        agents={activeAgents}
        quotaMap={roomState?.quota || {}}
        token={token}
        busySpeaker={roomState?.run?.speaker}
        onOpenAddAgent={() => setAddAgentDialogOpen(true)}
        onOpenReconnect={() => setReconnectDialogOpen(true)}
        onOpenAttendance={() => setAttendanceDialogOpen(true)}
        onOpenSoulMemory={() => {setMemoryTab("project");setSoulDialogOpen(true);}}
        onQuotaUpdated={(agId, qData) => {
          setRoomState((prev) =>
            prev
              ? {
                  ...prev,
                  quota: {
                    ...prev.quota,
                    [agId]: {
                      status: "ok",
                      data: qData,
                      warnings: prev.quota?.[agId]?.warnings,
                    },
                  },
                }
              : null
          );
        }}
      />

      {/* 2-Tier Soul Memory Drawer (Stitch Architecture) */}
      <SoulMemoryDrawer
        projectMemory={roomState?.projectMemory}
        initialKind={memoryTab}
        key={activeSessionId}
        open={soulDialogOpen}
        onClose={() => setSoulDialogOpen(false)}
        token={token}
        initialContent={
          roomState?.brain?.soul?.content ||
          DEFAULT_NEUTRAL_SOUL
        }
        revision={roomState?.brain?.soul?.revision || 1}
        updatedAt={roomState?.brain?.soul?.updatedAt}
        onSaved={() => {void fetchBootstrap().then(data=>applySnapshot(data.state)).catch(error=>toast.error(t("Gagal memuat memori terbaru"), {description:error.message}));}}

      />

      {/* Model & Reasoning Settings Dialog */}
      {/* Attendance Dialog */}
      <AttendanceDialog
        open={attendanceDialogOpen}
        onOpenChange={setAttendanceDialogOpen}
        token={token}
        attendance={roomState?.attendance || null}
      />

      {/* Profile Dialog */}
      <SettingsDialog
        open={profileDialogOpen} onOpenChange={setProfileDialogOpen} token={token}
        currentName={currentUserName} currentAvatar={roomState?.brain?.preferences?.avatar || ''}
        soul={roomState?.brain?.soul}
        onSaved={()=>{void fetchBootstrap().then(data=>applySnapshot(data.state));}}
      />

      <AgentProfileDialog linkedApp={activeProject?.linkedApps?.[profileAgent?.id as "codex"|"antigravity"]} catalog={catalog} onCatalogRefreshed={setCatalog} agent={profileAgent} token={token} onClose={()=>setProfileAgent(null)} onSaved={applySnapshot}/>

      {/* Add Agent Dialog */}
      <AddAgentDialog
        open={addAgentDialogOpen}
        onOpenChange={setAddAgentDialogOpen}
        catalog={catalog}
        agents={allAgents}
        onAgentAdded={handleAddAgent}
      />

      {/* Reconnect Dialog */}
      <ReconnectDialog
        open={reconnectDialogOpen}
        onOpenChange={setReconnectDialogOpen}
        token={token}
        onReconnected={() => {
          fetchBootstrap().then((data) => {
            setToken(data.token);
            setCatalog(data.catalog || {});
            setRoomState(data.state);
            setOnline(true);
          });
        }}
      />
    </div>
  );
}
