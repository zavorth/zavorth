import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SqliteVecMemoryBackend } from '../../src/adapters/memory/SqliteVecMemoryBackend.js';
import { ZavorthMemoryEncryptionStatusService } from '../../src/services/ZavorthMemoryEncryptionStatusService.js';

describe('ZavorthMemoryEncryptionStatusService', () => {
  const now = () => new Date('2026-06-07T12:00:00.000Z');
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-memory-encryption-'));
  });

  afterEach(() => {
    rmWithRetry(tempRoot);
  });

  it('reports field encryption status with readable product guidance', () => {
    const dbPath = path.join(tempRoot, 'memory.sqlite');
    const backend = new SqliteVecMemoryBackend({ dbPath, now });
    backend.write({
      namespace: 'status',
      text: 'Status command keeps learned text encrypted.',
      metadata: { source: 'status-test' },
    });
    backend.close();

    const service = new ZavorthMemoryEncryptionStatusService({ now });
    const status = service.buildStatus({
      dbPath,
      mode: 'off',
      driverPackages: ['better-sqlite3'],
    });

    expect(status).toEqual(
      expect.objectContaining({
        contentEncrypted: true,
        databaseExists: true,
        atRestEncryptionMode: 'field',
        fullFileEncrypted: false,
        fullFileEncryptionStatus: 'off',
        safeForDailyUse: true,
      }),
    );
    expect(service.formatStatusText(status)).toContain('Memory content encryption: active');
    expect(service.formatStatusText(status)).toContain('Advanced file encryption: off');
  });

  it('previews required migration without mutating the current database', () => {
    const dbPath = path.join(tempRoot, 'preview-memory.sqlite');
    const backend = new SqliteVecMemoryBackend({ dbPath, now });
    backend.write({
      namespace: 'preview',
      text: 'Preview migration should not mutate this database.',
      metadata: { source: 'preview-test' },
    });
    backend.close();

    const service = new ZavorthMemoryEncryptionStatusService({ now });
    const preview = service.previewMigration({
      dbPath,
      mode: 'required',
      driverPackages: ['zavorth-missing-sqlcipher-driver'],
    });

    expect(preview).toEqual(
      expect.objectContaining({
        status: 'blocked',
        action: 'preview',
        wouldBackup: true,
        wouldReplaceDatabase: false,
        reason: expect.stringContaining('unavailable'),
      }),
    );
    expect(fs.existsSync(`${dbPath}.backup-2026-06-07T12-00-00-000Z`)).toBe(false);
  });

  it('rolls back from an explicit migration backup', () => {
    const dbPath = path.join(tempRoot, 'rollback-memory.sqlite');
    const backupPath = path.join(tempRoot, 'rollback-memory.sqlite.backup');
    fs.writeFileSync(dbPath, 'current database bytes');
    fs.writeFileSync(backupPath, 'backup database bytes');

    const service = new ZavorthMemoryEncryptionStatusService({ now });
    const rollback = service.rollbackMigration({ dbPath, backupPath });

    expect(rollback).toEqual(
      expect.objectContaining({
        status: 'rolled-back',
        action: 'rollback',
        backupPath,
      }),
    );
    expect(fs.readFileSync(dbPath, 'utf8')).toBe('backup database bytes');
  });

  it('applies full-file migration when an encryption driver is available', () => {
    const driverAvailable = canLoadDriver('better-sqlite3-multiple-ciphers');
    if (!driverAvailable) {
      expect(driverAvailable).toBe(false);
      return;
    }

    const dbPath = path.join(tempRoot, 'migrate-memory.sqlite');
    const backend = new SqliteVecMemoryBackend({ dbPath, now });
    backend.write({
      namespace: 'migrate',
      text: 'Migration should preserve memory text while sealing the database file.',
      metadata: { source: 'migration-test' },
    });
    backend.close();

    const service = new ZavorthMemoryEncryptionStatusService({ now });
    const result = service.applyMigration({
      dbPath,
      mode: 'required',
      key: 'migration-key',
      driverPackages: ['better-sqlite3-multiple-ciphers'],
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'applied',
        action: 'apply',
        fullFileEncrypted: true,
        recordsMigrated: 1,
      }),
    );

    const status = service.buildStatus({
      dbPath,
      mode: 'required',
      key: 'migration-key',
      driverPackages: ['better-sqlite3-multiple-ciphers'],
    });
    expect(status).toEqual(
      expect.objectContaining({
        atRestEncryptionMode: 'field+file',
        fullFileEncrypted: true,
        fullFileEncryptionStatus: 'active',
      }),
    );
  });
});

function canLoadDriver(packageName: string): boolean {
  try {
    require(packageName);
    return true;
  } catch {
    return false;
  }
}

function rmWithRetry(targetPath: string): void {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
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
