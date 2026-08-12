export {};

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      platform?: string;
      getAppInfo(): Promise<{
        name: string;
        version: string;
        platform: string;
        isDev: boolean;
        port: number;
      }>;
      getDataDir(): Promise<string>;
      minimizeWindow(): void;
      maximizeWindow(): void;
      closeWindow(): void;
      openExternal(url: string): Promise<void>;
      restartServer(): Promise<{ success: boolean; [key: string]: unknown }>;
      onServerStatus(callback: (status: { status: string; port: number }) => void): () => void;
      onPortChanged(callback: (port: number) => void): () => void;
    };
  }
}
