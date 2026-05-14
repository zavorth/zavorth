export type SettingsTranslator = (key: any, values?: any) => string;

export type StatusMessage = {
  type: string;
  message: string;
};

export type StorageHealth = {
  driver: string;
  dbPath: string;
  sizeBytes: number;
  retentionDays: {
    app: number;
    call: number;
  };
  tableMaxRows: {
    callLogs: number;
    proxyLogs: number;
  };
  lastBackupAt: string | null;
};

export type BackupEntry = {
  id: string;
  createdAt: string;
  reason: string;
  connectionCount: number;
  size: number;
};

export const DEFAULT_STORAGE_HEALTH: StorageHealth = {
  driver: "sqlite",
  dbPath: "~/.ZavorthGateway/storage.sqlite",
  sizeBytes: 0,
  retentionDays: {
    app: 7,
    call: 7,
  },
  tableMaxRows: {
    callLogs: 100000,
    proxyLogs: 100000,
  },
  lastBackupAt: null,
};
