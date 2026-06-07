import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { MemoryKnowledgeRecord } from '../contracts/SourceMemoryDocumentTerminalPackContract.js';
import { SqliteVecMemoryBackend } from '../adapters/memory/SqliteVecMemoryBackend.js';

export type ZavorthMemoryEncryptionMode = 'off' | 'opportunistic' | 'required';
export type ZavorthMemoryEncryptionAction = 'preview' | 'apply' | 'rollback';

export type ZavorthMemoryEncryptionStatus = {
  generatedAt: string;
  dbPath: string;
  databaseExists: boolean;
  jsonFallbackExists: boolean;
  records: number;
  contentEncrypted: true;
  safeForDailyUse: boolean;
  atRestEncryptionMode: 'field' | 'field+file' | 'json-field';
  fullFileEncrypted: boolean;
  fullFileEncryptionStatus: 'off' | 'active' | 'unavailable' | 'required-unavailable' | 'unverified';
  fullFileEncryptionRequired: boolean;
  fullFileEncryptionKeyStorage: string;
  fullFileEncryptionDriverPackage: string | null;
  fullFileEncryptionProof: {
    unkeyedOpenBlocked: boolean | null;
    reason: string;
  };
  guidance: string;
};

export type ZavorthMemoryEncryptionMigrationReceipt = {
  generatedAt: string;
  action: ZavorthMemoryEncryptionAction;
  status: 'preview' | 'blocked' | 'applied' | 'rolled-back' | 'failed';
  dbPath: string;
  backupPath: string | null;
  wouldBackup: boolean;
  wouldReplaceDatabase: boolean;
  recordsMigrated: number;
  fullFileEncrypted: boolean;
  reason: string;
};

type Runtime = {
  now?: () => Date;
  defaultDbPath?: string;
};

type StatusInput = {
  dbPath?: string | null;
  mode?: ZavorthMemoryEncryptionMode | null;
  key?: string | Buffer | null;
  keyPath?: string | null;
  keyStore?: 'auto' | 'file' | 'os' | null;
  driverPackages?: string[];
};

type MigrationInput = StatusInput & {
  backupPath?: string | null;
};

type PersistedMemoryStore =
  | { exists: false; kind: 'none'; path: string }
  | { exists: true; kind: 'sqlite' | 'json'; path: string };

export class ZavorthMemoryEncryptionStatusService {
  private readonly now: () => Date;
  private readonly defaultDbPath?: string;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.defaultDbPath = runtime.defaultDbPath;
  }

  public buildStatus(input: StatusInput = {}): ZavorthMemoryEncryptionStatus {
    const dbPath = this.resolveDbPath(input.dbPath);
    const store = this.resolvePersistedStore(dbPath);
    const databaseExists = store.kind === 'sqlite';
    const jsonFallbackExists = fs.existsSync(jsonFallbackPath(dbPath));
    const backendPath = store.exists ? dbPath : this.createProbeDbPath();
    const backend = new SqliteVecMemoryBackend({
      dbPath: backendPath,
      now: this.now,
      forceJsonFallback: store.kind === 'json',
      fullFileEncryption: this.buildFullFileConfig(input),
    });
    if (!store.exists) {
      backend.write({
        namespace: 'memory-encryption-probe',
        text: 'Zavorth memory encryption status probe.',
        metadata: { source: 'memory-encryption-status' },
      });
    }
    const records = store.exists ? backend.exportRecords().length : 0;
    const snapshot = backend.buildReplaySnapshot(store.exists ? undefined : 'memory-encryption-probe');
    backend.close();
    if (!store.exists) {
      removeFileFamily(backendPath);
    }

    const safeForDailyUse = snapshot.atRestEncrypted === true
      && (snapshot.fullFileEncryptionRequired ? snapshot.fullFileEncrypted : true);
    const status: ZavorthMemoryEncryptionStatus = {
      generatedAt: this.now().toISOString(),
      dbPath,
      databaseExists,
      jsonFallbackExists,
      records,
      contentEncrypted: true,
      safeForDailyUse,
      atRestEncryptionMode: snapshot.atRestEncryptionMode,
      fullFileEncrypted: snapshot.fullFileEncrypted,
      fullFileEncryptionStatus: snapshot.fullFileEncryptionStatus,
      fullFileEncryptionRequired: snapshot.fullFileEncryptionRequired,
      fullFileEncryptionKeyStorage: snapshot.fullFileEncryptionKeyStorage,
      fullFileEncryptionDriverPackage: snapshot.fullFileEncryptionDriverPackage,
      fullFileEncryptionProof: snapshot.fullFileEncryptionProof,
      guidance: this.guidanceFor(snapshot.fullFileEncryptionStatus, snapshot.fullFileEncryptionRequired),
    };
    return status;
  }

  public previewMigration(input: MigrationInput = {}): ZavorthMemoryEncryptionMigrationReceipt {
    const dbPath = this.resolveDbPath(input.dbPath);
    const store = this.resolvePersistedStore(dbPath);
    const backupPath = input.backupPath || defaultBackupPath(store.path, this.now);
    if (!store.exists) {
      return this.migrationReceipt('preview', 'blocked', dbPath, backupPath, 0, false, 'Memory database does not exist yet.');
    }
    let records = 0;
    try {
      records = this.exportSourceRecords(store, dbPath, input).length;
    } catch (error) {
      return this.migrationReceipt('preview', 'failed', dbPath, backupPath, 0, false, error instanceof Error ? error.message : 'Memory source preview failed.');
    }
    let currentFullFileEncrypted = false;
    try {
      currentFullFileEncrypted = this.buildStatus(input).fullFileEncrypted;
    } catch {
      currentFullFileEncrypted = false;
    }
    const target = this.probeFullFileTarget(input, dbPath);
    if (!target.fullFileEncrypted) {
      return this.migrationReceipt('preview', 'blocked', dbPath, backupPath, records, false, `Full-file encryption is ${target.fullFileEncryptionStatus}.`);
    }
    return this.migrationReceipt('preview', 'preview', dbPath, backupPath, records, currentFullFileEncrypted, 'Migration can be applied with backup and verification.');
  }

  public applyMigration(input: MigrationInput = {}): ZavorthMemoryEncryptionMigrationReceipt {
    const dbPath = this.resolveDbPath(input.dbPath);
    const store = this.resolvePersistedStore(dbPath);
    if (!store.exists) {
      return this.migrationReceipt('apply', 'blocked', dbPath, null, 0, false, 'Memory database does not exist yet.');
    }

    let records: MemoryKnowledgeRecord[] = [];
    try {
      records = this.exportSourceRecords(store, dbPath, input);
    } catch (error) {
      return this.migrationReceipt('apply', 'failed', dbPath, null, 0, false, error instanceof Error ? error.message : 'Memory source export failed.');
    }

    const backupPath = input.backupPath || defaultBackupPath(store.path, this.now);
    const tempPath = dbPath.replace(/\.sqlite$/i, `.migrating-${process.pid}-${Date.now()}.sqlite`);

    try {
      const target = new SqliteVecMemoryBackend({
        dbPath: tempPath,
        now: this.now,
        atRestEncryptionKeyPath: defaultFieldKeyPath(dbPath),
        fullFileEncryption: this.buildMigrationFullFileConfig(input, dbPath),
      });
      target.importRecords(records);
      const snapshot = target.buildReplaySnapshot(records[0]?.namespace || 'credential-vault');
      target.close();

      if (!snapshot.fullFileEncrypted) {
        removeFileFamily(tempPath);
        return this.migrationReceipt('apply', 'blocked', dbPath, backupPath, records.length, false, `Full-file encryption is ${snapshot.fullFileEncryptionStatus}.`);
      }

      fs.mkdirSync(path.dirname(backupPath), { recursive: true });
      fs.copyFileSync(store.path, backupPath);
      if (store.kind === 'json') {
        removeSqliteFilesOnly(dbPath);
      }
      fs.copyFileSync(tempPath, dbPath);
      if (store.kind === 'json') {
        rmSyncWithRetry(jsonFallbackPath(dbPath));
      }
      removeFileFamily(tempPath);
      return this.migrationReceipt('apply', 'applied', dbPath, backupPath, records.length, true, 'Memory database migrated with verified full-file encryption.');
    } catch (error) {
      removeFileFamily(tempPath);
      return this.migrationReceipt('apply', 'failed', dbPath, backupPath, records.length, false, error instanceof Error ? error.message : 'Memory migration failed.');
    }
  }

  public rollbackMigration(input: MigrationInput = {}): ZavorthMemoryEncryptionMigrationReceipt {
    const dbPath = this.resolveDbPath(input.dbPath);
    const backupPath = input.backupPath || null;
    if (!backupPath || !fs.existsSync(backupPath)) {
      return this.migrationReceipt('rollback', 'blocked', dbPath, backupPath, 0, false, 'Backup path is required for rollback.');
    }
    if (backupPath.includes('.json.backup-')) {
      removeSqliteFilesOnly(dbPath);
      rmSyncWithRetry(defaultFullFileKeyPath(dbPath));
      rmSyncWithRetry(`${defaultFullFileKeyPath(dbPath)}.dpapi`);
      fs.copyFileSync(backupPath, jsonFallbackPath(dbPath));
    } else {
      fs.copyFileSync(backupPath, dbPath);
    }
    return this.migrationReceipt('rollback', 'rolled-back', dbPath, backupPath, 0, false, 'Memory database restored from backup.');
  }

  public formatStatusText(status: ZavorthMemoryEncryptionStatus): string {
    return [
      'Zavorth memory encryption',
      `Memory content encryption: ${status.contentEncrypted ? 'active' : 'inactive'}`,
      `Advanced file encryption: ${status.fullFileEncrypted ? 'active' : status.fullFileEncryptionStatus}`,
      `Mode: ${status.atRestEncryptionMode}`,
      `Database: ${status.databaseExists ? status.dbPath : 'not created yet'}`,
      `Records: ${status.records}`,
      `Key storage: ${status.fullFileEncryptionKeyStorage}`,
      `Driver: ${status.fullFileEncryptionDriverPackage || 'none'}`,
      `Unkeyed open blocked: ${String(status.fullFileEncryptionProof.unkeyedOpenBlocked)}`,
      `Guidance: ${status.guidance}`,
    ].join('\n');
  }

  public formatMigrationText(receipt: ZavorthMemoryEncryptionMigrationReceipt): string {
    return [
      'Zavorth memory encryption migration',
      `Action: ${receipt.action}`,
      `Status: ${receipt.status}`,
      `Database: ${receipt.dbPath}`,
      `Backup: ${receipt.backupPath || 'none'}`,
      `Records: ${receipt.recordsMigrated}`,
      `Full-file encrypted: ${receipt.fullFileEncrypted}`,
      `Reason: ${receipt.reason}`,
    ].join('\n');
  }

  private resolveDbPath(value?: string | null): string {
    return path.resolve(value || this.defaultDbPath || process.env.ZAVORTH_MEMORY_DB_PATH || path.join(process.cwd(), 'data', 'source-credential-vault', 'memory.sqlite'));
  }

  private buildFullFileConfig(input: StatusInput): {
    mode: ZavorthMemoryEncryptionMode;
    key?: string | Buffer;
    keyPath?: string;
    keyStore?: 'auto' | 'file' | 'os';
    driverPackages?: string[];
  } {
    return {
      mode: input.mode || readModeFromEnv() || 'off',
      ...(input.key ? { key: input.key } : {}),
      ...(input.keyPath ? { keyPath: input.keyPath } : {}),
      ...(input.keyStore ? { keyStore: input.keyStore } : {}),
      ...(input.driverPackages ? { driverPackages: input.driverPackages } : {}),
    };
  }

  private buildMigrationFullFileConfig(input: StatusInput, dbPath: string): {
    mode: ZavorthMemoryEncryptionMode;
    key?: string | Buffer;
    keyPath?: string;
    keyStore?: 'auto' | 'file' | 'os';
    driverPackages?: string[];
  } {
    const config = this.buildFullFileConfig({
      ...input,
      mode: input.mode || 'required',
    });
    if (config.mode !== 'off' && !config.key && !config.keyPath) {
      config.keyPath = defaultFullFileKeyPath(dbPath);
      config.keyStore = input.keyStore || config.keyStore || 'auto';
    }
    return config;
  }

  private buildPreviewFullFileConfig(input: StatusInput): {
    mode: ZavorthMemoryEncryptionMode;
    key?: string | Buffer;
    keyPath?: string;
    keyStore?: 'auto' | 'file' | 'os';
    driverPackages?: string[];
  } {
    const config = this.buildFullFileConfig({
      ...input,
      mode: input.mode || 'required',
    });
    if (config.mode !== 'off' && !config.key) {
      delete config.keyPath;
      delete config.keyStore;
      config.key = 'zavorth-memory-encryption-preview-key';
    }
    return config;
  }

  private exportSourceRecords(store: PersistedMemoryStore & { exists: true }, dbPath: string, input: StatusInput): MemoryKnowledgeRecord[] {
    if (store.kind === 'json') {
      const backend = new SqliteVecMemoryBackend({
        dbPath,
        now: this.now,
        forceJsonFallback: true,
        fullFileEncryption: { mode: 'off' },
      });
      try {
        return backend.exportRecords();
      } finally {
        backend.close();
      }
    }

    const attempts = [
      { mode: 'off' as const },
      this.buildMigrationFullFileConfig(input, dbPath),
    ];
    let lastError: unknown = null;
    for (const fullFileEncryption of attempts) {
      let backend: SqliteVecMemoryBackend | null = null;
      try {
        backend = new SqliteVecMemoryBackend({
          dbPath,
          now: this.now,
          fullFileEncryption,
        });
        return backend.exportRecords();
      } catch (error) {
        lastError = error;
      } finally {
        backend?.close();
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Memory source export failed.');
  }

  private probeFullFileTarget(input: StatusInput, dbPath: string): {
    fullFileEncrypted: boolean;
    fullFileEncryptionStatus: ZavorthMemoryEncryptionStatus['fullFileEncryptionStatus'];
  } {
    const tempPath = dbPath.replace(/\.sqlite$/i, `.preview-${process.pid}-${Date.now()}.sqlite`);
    let backend: SqliteVecMemoryBackend | null = null;
    try {
      backend = new SqliteVecMemoryBackend({
        dbPath: tempPath,
        now: this.now,
        fullFileEncryption: this.buildPreviewFullFileConfig(input),
      });
      const snapshot = backend.buildReplaySnapshot('memory-encryption-preview');
      return {
        fullFileEncrypted: snapshot.fullFileEncrypted,
        fullFileEncryptionStatus: snapshot.fullFileEncryptionStatus,
      };
    } catch {
      return {
        fullFileEncrypted: false,
        fullFileEncryptionStatus: 'required-unavailable',
      };
    } finally {
      backend?.close();
      removeFileFamily(tempPath);
    }
  }

  private resolvePersistedStore(dbPath: string): PersistedMemoryStore {
    if (fs.existsSync(dbPath)) {
      return { exists: true, kind: 'sqlite', path: dbPath };
    }
    const fallbackPath = jsonFallbackPath(dbPath);
    if (fs.existsSync(fallbackPath)) {
      return { exists: true, kind: 'json', path: fallbackPath };
    }
    return { exists: false, kind: 'none', path: dbPath };
  }

  private createProbeDbPath(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-memory-encryption-probe-'));
    return path.join(dir, 'memory.sqlite');
  }

  private guidanceFor(status: ZavorthMemoryEncryptionStatus['fullFileEncryptionStatus'], required: boolean): string {
    if (status === 'active') {
      return 'Advanced memory protection is active.';
    }
    if (required) {
      return 'Advanced memory protection is required but unavailable; memory uses encrypted JSON fallback instead of unsafe SQLite.';
    }
    if (status === 'unverified') {
      return 'Memory content is encrypted; the current SQLite driver did not prove full-file encryption.';
    }
    if (status === 'unavailable') {
      return 'Memory content is encrypted; install the optional encryption driver to protect the whole SQLite file.';
    }
    return 'Memory content is encrypted. Advanced file encryption is optional.';
  }

  private migrationReceipt(
    action: ZavorthMemoryEncryptionAction,
    status: ZavorthMemoryEncryptionMigrationReceipt['status'],
    dbPath: string,
    backupPath: string | null,
    recordsMigrated: number,
    fullFileEncrypted: boolean,
    reason: string,
  ): ZavorthMemoryEncryptionMigrationReceipt {
    return {
      generatedAt: this.now().toISOString(),
      action,
      status,
      dbPath,
      backupPath,
      wouldBackup: action === 'preview' && Boolean(backupPath),
      wouldReplaceDatabase: action === 'preview' && status === 'preview',
      recordsMigrated,
      fullFileEncrypted,
      reason,
    };
  }
}

function readModeFromEnv(): ZavorthMemoryEncryptionMode | null {
  const raw = String(process.env.ZAVORTH_MEMORY_SQLCIPHER_MODE || process.env.ZAVORTH_MEMORY_FULL_FILE_ENCRYPTION || '').trim().toLowerCase();
  if (!raw) return null;
  if (['0', 'false', 'no', 'off'].includes(raw)) return 'off';
  if (['1', 'true', 'yes', 'on', 'optional', 'opportunistic'].includes(raw)) return 'opportunistic';
  return raw === 'required' ? 'required' : null;
}

function defaultBackupPath(dbPath: string, now: () => Date): string {
  return `${dbPath}.backup-${now().toISOString().replace(/[:.]/g, '-')}`;
}

function defaultFullFileKeyPath(dbPath: string): string {
  return dbPath.replace(/\.sqlite$/i, '.sqlcipher.key');
}

function defaultFieldKeyPath(dbPath: string): string {
  return dbPath.replace(/\.sqlite$/i, '.key');
}

function jsonFallbackPath(dbPath: string): string {
  return dbPath.replace(/\.sqlite$/i, '.json');
}

function removeSqliteFilesOnly(dbPath: string): void {
  for (const candidate of [dbPath, `${dbPath}-shm`, `${dbPath}-wal`]) {
    rmSyncWithRetry(candidate);
  }
}

function removeFileFamily(dbPath: string): void {
  for (const candidate of [
    dbPath,
    `${dbPath}-shm`,
    `${dbPath}-wal`,
    dbPath.replace(/\.sqlite$/i, '.json'),
    dbPath.replace(/\.sqlite$/i, '.key'),
    dbPath.replace(/\.sqlite$/i, '.sqlcipher.key'),
    `${dbPath.replace(/\.sqlite$/i, '.sqlcipher.key')}.dpapi`,
  ]) {
    rmSyncWithRetry(candidate);
  }
  const parent = path.dirname(dbPath);
  try {
    if (fs.existsSync(parent) && fs.readdirSync(parent).length === 0 && path.basename(parent).startsWith('zavorth-memory-encryption-probe-')) {
      rmSyncWithRetry(parent);
    }
  } catch {
    // Best effort cleanup only.
  }
}

function rmSyncWithRetry(targetPath: string): void {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      fs.rmSync(targetPath, { force: true, recursive: true });
      return;
    } catch {
      sleepSync(25 * (attempt + 1));
    }
  }
}

function sleepSync(ms: number): void {
  const buffer = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(buffer), 0, 0, ms);
}
