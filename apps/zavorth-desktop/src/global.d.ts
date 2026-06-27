export {};

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

declare global {
  interface Window {
    zavorthDesktop?: {
      getRuntimeStatus(): Promise<RuntimeStatus>;
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
      readFileTree(rootPath: string): Promise<{ ok: boolean; tree?: FileExplorerNode[]; error?: string }>;
    };
  }
}

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
