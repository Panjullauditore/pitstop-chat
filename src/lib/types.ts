export type ProviderId = "codex" | "antigravity" | "claude" | "deepseek";

export interface QuotaBucket {
  id: string;
  name: string;
  remainingPercent: number | null;
  usedPercent: number | null;
  resetAt: string | null;
  disabled: boolean;
}

export interface QuotaGroup {
  name: string;
  plan: string | null;
  buckets: QuotaBucket[];
}

export interface QuotaData {
  agent: string;
  source?: string;
  groups: QuotaGroup[];
  checkedAt: string;
}

export interface QuotaWarning {
  agent: string;
  group: string;
  bucket: string;
  remainingPercent: number;
  resetAt: string | null;
  exhausted: boolean;
}

export interface AgentQuotaStatus {
  status: "ok" | "error";
  data?: QuotaData;
  error?: string;
  warnings?: QuotaWarning[];
}

export interface AgentDefinition {
  transport?: 'cli' | 'manual-web' | 'browser-web' | 'native-app';
  avatar?: string;
  bio?: string;
  id: string;
  name: string;
  provider?: ProviderId;
  role?: string;
  installed: boolean;
  connection: "connected" | "disconnected";
  accountEmail?: string | null;
  connectionDetail?: string;
  connectionCheckedAt?: string | null;
  lastDelivery?: { at: string; messageCount: number } | null;
  model?: string;
  effort?: string;
}

export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'document' | 'text';
  truncated?: boolean;
  notice?: string;
}

export interface ChatMessage {
  nativeChat?: {provider:string;id:string;title:string;history:string};
  manualImport?: boolean;
  attachments?: ChatAttachment[];
  id: string;
  role: "user" | "codex" | "antigravity" | "claude" | "deepseek" | string;
  text: string;
  at: string;
  status: "streaming" | "done" | "stopped" | "error";
  round?: number;
  kind?: string;
  runId?: string;
  model?: string;
  modelName?: string;
  effort?: string;
  soulRevision?: number;
}

export interface SoulData {
  content: string;
  revision: number;
  updatedAt: string;
  pinnedIds?: string[];
}

export interface ModelSelection {
  model: string;
  effort: string;
  custom?: boolean;
  name?: string;
  cliModel?: string;
  cliEffort?: string;
}

export interface BrainSnapshot {
  schema: number;
  preferences: {
    displayName: string;
    avatar?: string;
  };
  soul: SoulData;
  selections: Record<string, ModelSelection>;
  auto?: {
    userNotes?: Array<{ id: string; text: string; at: string; memoryStatus?: ArchiveMemoryStatus }>;
    updates?: Array<{ id: string; agent: string; at: string; summary: string; next?: string; reportedProgress?: string; memoryStatus?: ArchiveMemoryStatus }>;
  };
}

export interface AttendanceAgentResult {
  status: "waiting" | "streaming" | "done" | "error" | "stopped";
  text: string;
  model?: string;
}

export interface AttendanceState {
  runId: string;
  status: "running" | "done" | "stopped";
  startedAt: string;
  finishedAt?: string;
  stale: boolean;
  agents: Record<string, AttendanceAgentResult>;
}

export interface RunState {
  id: string;
  mode: string;
  round: number;
  turn: number;
  speaker: string;
  stopping: boolean;
}

export interface LastRunState {
  id: string;
  mode: string;
  reason: "done" | "stopped" | "error" | "consensus" | "needs-user" | "budget" | "missing-control" | string;
  turns: number;
  at: string;
}

export interface ArchiveMemoryStatus {incorporated:boolean;incorporatedAt:string|null;deleteAt:string|null;}
export interface ProjectMemoryData extends SoulData {
  maxCharacters?:number;
  coreUpdatedAt?:string;
  summaryUpdatedAt?:string;
  summary?:{autoEnabled:boolean;agentId:string;agentIds:string[];status:'idle'|'running'|'done'|'error'|'stopped';error?:string|null;pendingMessages:number;lastUpdatedAt:string|null;throughAt:string|null;batch?:number;totalBatches?:number};
  managerId?: string|null;
  gmDecisions?: {id:string;text:string;question:string;at:string;memoryStatus?:ArchiveMemoryStatus}[];
  scopeId: string; projectId: string | null; scopeName: string; shared: boolean; auto?: BrainSnapshot["auto"];
}

export interface RoomSnapshot {
  activeProjectId?: string|null;
  language?: 'en'|'id';
  webRequest?: {id:string;agentId:string;sessionId:string;prompt:string;attachments:{id:string;name:string}[];createdAt:string}|null;
  projectMemory?: ProjectMemoryData | null;
  projects?: ProjectData[];
  enabledAgentIds?: string[];
  sessionId?: string;
  sessions?: SessionData[];
  messages: ChatMessage[];
  run: RunState | null;
  lastRun: LastRunState | null;
  attendance: AttendanceState | null;
  quota: Record<string, AgentQuotaStatus>;
  agents: AgentDefinition[];
  contextLoaded: boolean;
  brain: BrainSnapshot | null;
}

export interface ModelItem {
  id: string;
  name: string;
  efforts: string[];
  defaultEffort?: string;
  variants?: Record<string, string>;
  isDefault?: boolean;
}

export interface CatalogData {
  models: ModelItem[];
  fetchedAt?: string;
  error?: string | null;
}

export interface BootstrapResponse {
  token: string;
  state: RoomSnapshot;
  catalog: Record<string, CatalogData>;
}

export interface SessionData {
  projectId?: string | null;
  agentIds?: string[];
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  soul: {
    content: string;
    revision: number;
    updatedAt: string;
  };
}

export interface LinkedAppChat { remoteUrl?:string; transport?:string; id:string; title:string; cwd:string; source:string; state:string; linkedAt?:string; lastSyncedAt?:string; error?:string|null }

export interface ProjectData { status?: "active"|"completed"; completedAt?: string; linkedApps?: Partial<Record<"codex"|"antigravity"|"deepseek",LinkedAppChat>>; managerId?: string; pendingDecision?: {id:string;question:string;raisedBy:string;sessionId:string;at:string}|null; decisions?: {id:string;text:string;question:string;at:string}[]; id: string; name: string; agentIds: string[]; createdAt: string }
