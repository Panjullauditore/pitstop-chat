import { BootstrapResponse, RoomSnapshot, AgentDefinition, ChatAttachment } from "./types";

let currentSessionId = "";
export function setApiSession(id: string) {currentSessionId=id;}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function fetchBootstrap(): Promise<BootstrapResponse> {
  const res = await fetch("/api/bootstrap", {
    method: "GET",
    headers: { "Cache-Control": "no-cache" },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data.error || "Gagal menghubungi server lokal.", res.status);
  }
  return data;
}

export async function sendChat(
  input: { text: string; mode?: string; syncMemory?: boolean; sessionId?: string; attachmentIds?: string[]; decisionId?: string },
  token: string
): Promise<{ runId: string | null; queuedId?: string }> {
  const res = await fetch("/api/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Room-Token": token,
      "X-Room-Session":currentSessionId,
    },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data.error || "Gagal mengirim pesan.", res.status);
  }
  return data;
}

export async function stopChat(token: string): Promise<{ stopped: boolean }> {
  const res = await fetch("/api/stop", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Room-Token": token,
      "X-Room-Session":currentSessionId,
    },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data.error || "Gagal menghentikan respons.", res.status);
  }
  return data;
}

export async function updateChatQueue(token:string,sessionId:string,id:string,action:'hold'|'edit'|'resume'|'cancel',text?:string) {
  const res=await fetch('/api/chat-queue',{
    method:'POST',
    headers:{'Content-Type':'application/json','X-Room-Token':token,'X-Room-Session':sessionId},
    body:JSON.stringify({sessionId,id,action,text}),
  });
  const data=await res.json();
  if(!res.ok)throw new ApiError(data.error||'Gagal memperbarui antrean.',res.status);
}

export async function uploadChatFile(file: File, token: string, sessionId: string): Promise<ChatAttachment> {
  const res = await fetch('/api/attachments', {
    method: 'POST',
    headers: {'Content-Type': 'application/octet-stream', 'X-Room-Token': token, 'X-Room-Session': sessionId, 'X-File-Name': encodeURIComponent(file.name)},
    body: file,
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || 'File gagal diunggah.', res.status);
  return data.attachment;
}

export async function setBotPower(token: string, agent: string, enabled: boolean): Promise<string[]> {
  const res = await fetch("/api/agents/power", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Room-Token": token },
    body: JSON.stringify({ agent, enabled }),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || "Gagal mengubah akses chat bot.", res.status);
  return data.disabledBotIds;
}

export async function checkAgentConnections(token:string,agent?:string):Promise<{sessionId:string;agents:AgentDefinition[];checkedAt:string;browser:{request?:{phase:string}|null}}> {
  const sessionId=currentSessionId;
  const res=await fetch('/api/agents/check',{method:'POST',headers:{'Content-Type':'application/json','X-Room-Token':token,'X-Room-Session':sessionId},body:JSON.stringify(agent?{agent}:{}),signal:AbortSignal.timeout(45000)});
  const data=await res.json();
  if(!res.ok)throw new ApiError(data.error||'Pemeriksaan koneksi gagal.',res.status);
  if(currentSessionId!==sessionId)throw new ApiError('Sesi aktif berubah. Periksa koneksi pada sesi saat ini.');
  return data;
}

export async function refreshCatalogModels(token: string): Promise<Record<string, any>> {
  const res = await fetch("/api/models", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Room-Token": token,
      "X-Room-Session":currentSessionId,
    },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data.error || "Gagal memuat ulang model.", res.status);
  }
  return data.catalog;
}

export async function runAttendance(token: string): Promise<any> {
  const res = await fetch("/api/attendance", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Room-Token": token,
      "X-Room-Session":currentSessionId,
    },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data.error || "Gagal menjalankan absen.", res.status);
  }
  return data;
}

export async function checkAgentQuota(
  agent: string,
  token: string,
  force = false
): Promise<any> {
  const res = await fetch("/api/quota", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Room-Token": token,
      "X-Room-Session":currentSessionId,
    },
    body: JSON.stringify({ agent, force }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data.error || "Gagal membaca kuota.", res.status);
  }
  return data.quota;
}

export async function saveModelSettings(
  selections: Record<string, any>,
  token: string
): Promise<any> {
  const res = await fetch("/api/settings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Room-Token": token,
      "X-Room-Session":currentSessionId,
    },
    body: JSON.stringify({ selections }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data.error || "Gagal menyimpan pengaturan model.", res.status);
  }
  return data.brain;
}

export async function saveDisplayName(
  displayName: string,
  token: string
): Promise<any> {
  const res = await fetch("/api/profile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Room-Token": token,
      "X-Room-Session":currentSessionId,
    },
    body: JSON.stringify({ displayName }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data.error || "Gagal menyimpan nama pengguna.", res.status);
  }
  return data.brain;
}

export async function saveSoulDocument(
  content: string,
  revision: number,
  token: string
): Promise<any> {
  const res = await fetch("/api/soul", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Room-Token": token,
      "X-Room-Session":currentSessionId,
    },
    body: JSON.stringify({ content, revision }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data.error || "Gagal menyimpan Soul.", res.status);
  }
  return data.brain;
}

export async function pinChatMessage(
  messageId: string,
  token: string
): Promise<any> {
  const res = await fetch("/api/pin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Room-Token": token,
      "X-Room-Session":currentSessionId,
    },
    body: JSON.stringify({ messageId }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data.error || "Gagal menyematkan pesan ke Soul.", res.status);
  }
  return data.projectMemory;
}

export function subscribeRoomEvents(
  token: string,
  onUpdate: (snapshot: RoomSnapshot) => void,
  onWarning: (errorMsg: string) => void,
  onError: () => void
): () => void {
  const eventSource = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);

  eventSource.onmessage = (event) => {
    try {
      const data: RoomSnapshot = JSON.parse(event.data);
      onUpdate(data);
    } catch (e) {
      console.warn("Format SSE event tidak valid:", e);
    }
  };

  eventSource.addEventListener("warning", (event: any) => {
    try {
      const data = JSON.parse(event.data);
      onWarning(data.error || "Peringatan room");
    } catch {}
  });

  eventSource.onerror = () => {
    onError();
  };

  return () => {
    eventSource.close();
  };
}

export async function mutateSession(action: string, input: Record<string, unknown>, token: string): Promise<RoomSnapshot> {
  const res = await fetch(action === "delete" ? `/api/sessions/${encodeURIComponent(String(input.sessionId))}` : `/api/sessions/${action}`, {
    method:action === "delete" ? "DELETE" : "POST",
    headers:{"Content-Type":"application/json","X-Room-Token":token},
    ...(action !== "delete" ? {body:JSON.stringify(input)} : {}),
  });
  const data=await res.json();if(!res.ok)throw new ApiError(data.error || "Operasi sesi gagal.",res.status);return data.state;
}
export async function configureAgent(agent: AgentDefinition, token: string): Promise<RoomSnapshot> {
  const res=await fetch(agent.provider==='deepseek'?"/api/web-agent/connect":"/api/agents",{method:"POST",headers:{"Content-Type":"application/json","X-Room-Token":token,"X-Room-Session":currentSessionId},body:JSON.stringify(agent)});
  const data=await res.json();if(!res.ok)throw new ApiError(data.error || "Konfigurasi agent gagal.",res.status);return data.state;
}

export async function mutateProject(action: string, input: Record<string, unknown>, token: string): Promise<RoomSnapshot> {
  const res=await fetch(`/api/projects/${action}`,{method:'POST',headers:{'Content-Type':'application/json','X-Room-Token':token},body:JSON.stringify(input)});
  const data=await res.json();if(!res.ok)throw new ApiError(data.error || 'Operasi proyek gagal.',res.status);return data.state;
}

export async function saveProjectMemory(content:string,revision:number,token:string,scopeId:string):Promise<any>{
 const res=await fetch('/api/project-memory',{method:'POST',headers:{'Content-Type':'application/json','X-Room-Token':token,'X-Room-Session':currentSessionId},body:JSON.stringify({content,revision,scopeId})});
 const data=await res.json();if(!res.ok)throw new ApiError(data.error || 'Gagal menyimpan Project Memory.',res.status);return data.projectMemory;
}

export async function updateMemorySummary(action:'settings'|'update'|'stop'|'limit',input:Record<string,unknown>,token:string):Promise<void>{
 const res=await fetch(`/api/project-memory/summary/${action}`,{method:'POST',headers:{'Content-Type':'application/json','X-Room-Token':token,'X-Room-Session':currentSessionId},body:JSON.stringify(input)});
 const data=await res.json();if(!res.ok)throw new ApiError(data.error||'Memory update failed.',res.status);
}

export async function openDeepSeekBrowser(token:string):Promise<{state:RoomSnapshot;browser:{status:string;detail:string;connected:boolean}}>{
  const response=await fetch('/api/web-agent/browser/open',{method:'POST',headers:{'X-Room-Token':token}});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not open DeepSeek browser.');return data;
}
