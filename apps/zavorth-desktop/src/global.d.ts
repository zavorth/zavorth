export {};

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

declare global {
  interface Window {
    zavorthDesktop?: {
      getRuntimeStatus(): Promise<RuntimeStatus>;
      getCodeBridgeSummary(): Promise<CodeBridgeSummary>;
      startRuntime(): Promise<RuntimeStatus>;
      apiRequest<T = unknown>(request: DesktopApiRequest): Promise<DesktopApiResult<T>>;
      connectGooglePersonalOps(): Promise<GooglePersonalOpsConnectResult>;
      repairAccess(): Promise<RuntimeStatus>;
      startSetup(): Promise<{ ok: boolean; command: string; message: string }>;
      selectWorkspaceFolder(): Promise<{ canceled: boolean; path: string | null; label: string | null }>;
      openLogs(): Promise<{ ok: boolean; path: string }>;
      onBootEvent(callback: (event: BootEvent) => void): () => void;
      sendNotification(options: { title: string; body: string; silent?: boolean }): Promise<{ ok: boolean; error?: string }>;
      getNotificationPermission(): Promise<string>;
      listSessions(): Promise<SessionEntry[]>;
      switchSession(sessionId: string): Promise<DesktopApiResult<unknown>>;
      createSession?(input?: {
        sessionId?: string;
        label?: string;
        surface?: string;
        workspaceId?: string | null;
      }): Promise<DesktopApiResult<{ sessionId: string; label?: string; surface?: string }>>;
      readFileTree(rootPath: string): Promise<{ ok: boolean; tree?: FileExplorerNode[]; error?: string }>;
      getPathForFile(file: File): string;
      checkUpdates(): Promise<{
        hasUpdate: boolean;
        version: string;
        latestVersion: string;
        changelog: string;
        channel?: string;
        source?: string;
        engine?: string;
        githubRepo?: string;
        downloadUrl?: string | null;
        releaseUrl?: string | null;
        providerConfigured?: boolean;
        downloaded?: boolean;
        deferredUntil?: string | null;
        rollbackVersion?: string | null;
        error?: string | null;
        message?: string;
      }>;
      downloadUpdate?(): Promise<{ ok: boolean; message?: string; error?: string; latestVersion?: string; mode?: string; engine?: string; releaseUrl?: string }>;
      deferUpdate?(input?: { days?: number }): Promise<{ ok: boolean; message?: string; deferredUntil?: string; error?: string }>;
      installUpdate?(): Promise<{ ok: boolean; message?: string; error?: string; rollbackVersion?: string; latestVersion?: string; releaseUrl?: string; mode?: string; engine?: string }>;
      rollbackUpdate?(): Promise<{ ok: boolean; message?: string; error?: string; rollbackVersion?: string; releaseUrl?: string }>;
      openGithubReleases?(): Promise<{ ok: boolean; message?: string; error?: string; releaseUrl?: string; repo?: string }>;
      getVoiceAgentStatus?(): Promise<{
        ok: boolean;
        running: boolean;
        pid: number | null;
        mode: string;
        hotkey: string;
        wakeWord: string | null;
        updatedAt: string | null;
        message: string;
        error?: string;
      }>;
      startVoiceAgent?(): Promise<{ ok: boolean; pid?: number; message?: string; error?: string }>;
      onVoiceHotkey?(callback: () => void): () => void;
      openWindow(): Promise<{ ok: boolean }>;
      onDeepLink(callback: (url: string) => void): () => void;
      openExternal?(url: string): Promise<{ ok: boolean } | void> | void;
      automations?: DesktopAutomationsApi;
      kaelOverlay?: KaelOverlayApi;
    };
  }
}

export type DesktopAutomationTask = {
  id: string;
  name: string;
  project: string;
  prompt: string;
  intervalMinutes: number;
  enabled: boolean;
  status: 'idle' | 'running' | 'success' | 'failed';
  nextRun?: number;
  lastRun?: number;
  lastSessionId?: string;
  workspace?: { id?: string; label?: string; path?: string | null };
  model?: string;
  profile?: string;
  effort?: string;
  createdAt?: number;
  updatedAt?: number;
  history: Array<{
    at: string;
    ok: boolean;
    sessionId?: string | null;
    message?: string | null;
  }>;
};

export type DesktopAutomationsApi = {
  list(): Promise<DesktopAutomationTask[]>;
  create(input: Partial<DesktopAutomationTask>): Promise<DesktopAutomationTask>;
  delete(id: string): Promise<{ ok: boolean }>;
  toggle(id: string, enabled: boolean): Promise<DesktopAutomationTask | null>;
  run(id: string): Promise<{ ok: boolean; task?: DesktopAutomationTask; sessionId?: string; error?: string }>;
  logs(sessionId: string): Promise<unknown[]>;
  onUpdated(callback: (tasks: DesktopAutomationTask[]) => void): () => void;
};

export type KaelMascotState = 'idle' | 'thinking' | 'working' | 'finished';

export type KaelOverlayStatePayload = {
  state?: KaelMascotState;
  bubbleText?: string | null;
};

export type KaelOverlayControlPayload =
  | { type: 'toggle-main-window' }
  | { type: 'submit-prompt'; text: string }
  | { type: 'pop-in' }
  | { type: string; text?: string; [key: string]: unknown };

export type KaelOverlayBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type KaelOverlayApi = {
  open(bounds: KaelOverlayBounds): Promise<unknown>;
  close(): Promise<unknown>;
  setBounds(bounds: KaelOverlayBounds): void;
  setIgnoreMouse(ignore: boolean): void;
  setFocusable(focusable: boolean): void;
  state(payload: KaelOverlayStatePayload): void;
  onState(callback: (payload: KaelOverlayStatePayload) => void): () => void;
  control(payload: KaelOverlayControlPayload): void;
  onControl(callback: (payload: KaelOverlayControlPayload) => void): () => void;
};

export type DesktopApiRequest = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  timeoutMs?: number;
};

export type DesktopApiResult<T = unknown> = {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
};

export type GooglePersonalOpsConnectResult = {
  ok: boolean;
  provider: 'google';
  accountEmail: string | null;
  connectors: string[];
  message?: string;
  error?: string;
};

export type RuntimeStatus = {
  ok: boolean;
  running: boolean;
  baseUrl: string;
  tokenReady: boolean;
  tokenSource: 'env' | 'file' | 'generated' | 'missing';
  runtimePid: number | null;
  message: string;
};

export type CodeBridgeCheck = {
  id?: string;
  label?: string;
  detail?: string;
  ok?: boolean;
};

export type CodeBridgeOps = {
  updatedAt?: number;
  ready?: boolean;
  providerReady?: boolean;
  approvals?: number;
  sessions?: number;
  modelLabel?: string;
  headline?: string;
  nextAction?: string;
  checks?: CodeBridgeCheck[];
};

export type CodeBridgeCompanion = {
  updatedAt?: number;
  pulse?: { sessions?: number };
};

export type CodeBridgeSummary = {
  stateDir?: string;
  paths?: { stateDir?: string; ops?: string; companion?: string; companionStatus?: string };
  ops?: CodeBridgeOps;
  companion?: CodeBridgeCompanion;
  companionStatus?: { online?: boolean; lastSeen?: number; name?: string };
  opsFresh: boolean;
  companionFresh: boolean;
  tone: 'ready' | 'warning' | 'muted' | string;
  label: string;
  detail: string;
};

export type BootEvent = {
  type: 'info' | 'warn' | 'error';
  message: string;
  at: string;
};

export type SessionEntry = {
  id: string;
  label: string;
  createdAt: string;
  messageCount: number;
  surface: string;
  lastMessage: string;
};

export type FileExplorerNode = {
  name: string;
  relativePath: string;
  type: 'file' | 'directory';
  children?: FileExplorerNode[];
};
