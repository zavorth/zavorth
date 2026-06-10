export {};

declare global {
  interface Window {
    zavorthDesktop?: {
      getRuntimeStatus(): Promise<RuntimeStatus>;
      startRuntime(): Promise<RuntimeStatus>;
      apiRequest<T = unknown>(request: DesktopApiRequest): Promise<DesktopApiResult<T>>;
      repairAccess(): Promise<RuntimeStatus>;
      startSetup(): Promise<{ ok: boolean; command: string; message: string }>;
      selectWorkspaceFolder(): Promise<{ canceled: boolean; path: string | null; label: string | null }>;
      openLogs(): Promise<{ ok: boolean; path: string }>;
      onBootEvent(callback: (event: BootEvent) => void): () => void;
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
