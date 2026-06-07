export {};

declare global {
  interface Window {
    zavorthDesktop?: {
      getRuntimeStatus(): Promise<RuntimeStatus>;
      startRuntime(): Promise<RuntimeStatus>;
      openDashboard(): Promise<RuntimeStatus>;
      repairAccess(): Promise<RuntimeStatus>;
      startSetup(): Promise<{ ok: boolean; command: string; message: string }>;
      openLogs(): Promise<{ ok: boolean; path: string }>;
      onBootEvent(callback: (event: BootEvent) => void): () => void;
    };
  }
}

export type RuntimeStatus = {
  ok: boolean;
  running: boolean;
  dashboardUrl: string;
  publicUrl: string;
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
