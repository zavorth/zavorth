import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { HostBackupStore } from '../../src/host/HostBackupStore';
import { NATIVE_AGENT_TOOL_SECURITY_DEFINITIONS } from '../../src/security/AgentToolSecurityCatalog';
import { BackupService } from '../../src/services/plugins/BackupService';

describe('backup path trust boundaries', () => {
  const roots: string[] = [];
  let warnSpy: jest.SpyInstance;

  const temporaryDirectory = (prefix: string): string => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    roots.push(directory);
    return directory;
  };

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  it('governs the plugin backup service as a confirmation-required mutation', () => {
    expect(NATIVE_AGENT_TOOL_SECURITY_DEFINITIONS.find((entry) => entry.toolName === 'backup_service')).toEqual(
      expect.objectContaining({
        capabilities: expect.arrayContaining(['filesystem']),
        requiresConfirmation: true,
      }),
    );
  });

  it('creates and restores a plugin backup with file content', async () => {
    const root = temporaryDirectory('zavorth-backup-trust-');
    const storage = path.join(root, 'storage');
    const source = path.join(root, 'source');
    const restore = path.join(root, 'restore');
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'settings.json'), '{"safe":true}', 'utf8');
    fs.mkdirSync(restore);

    const service = new BackupService({ storageDir: storage });
    const createResult = service.createBackup('settings', source);
    expect(createResult).toContain('created');

    // BackupService uses deferred flush (2s); wait for it to write backups.json
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const indexText = fs.readFileSync(path.join(storage, 'backups.json'), 'utf8');
    const index = JSON.parse(indexText);
    expect(index.length).toBe(1);
    const backupId = index[0].id;

    const restoreResult = service.restoreBackup(backupId, restore);
    expect(restoreResult).toContain('restored');
    expect(fs.readFileSync(path.join(restore, 'settings.json'), 'utf8')).toBe('{"safe":true}');

    const deleteResult = service.deleteBackup(backupId);
    expect(deleteResult).toContain('deleted');
  });

  it('stores host identities and performs rollback with backup content', () => {
    const root = temporaryDirectory('zavorth-host-backup-');
    const backups = path.join(root, 'backups');
    const source = path.join(root, 'source');
    const manifestPath = path.join(backups, 'manifest.json');
    fs.mkdirSync(source);
    const target = path.join(source, 'runtime.ts');
    fs.writeFileSync(target, 'stable', 'utf8');
    const messages: string[] = [];
    const store = new HostBackupStore({
      backupsDir: backups,
      manifestPath,
      maxBackupsPerFile: 3,
      now: () => 1_700_000_000_000,
      log: (message) => messages.push(message),
    });

    store.handlePreModify([target]);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.files.length).toBe(1);
    expect(manifest.files[0]).toEqual(expect.objectContaining({
      originalPath: target,
      backupPath: expect.stringContaining('runtime.ts'),
      timestamp: expect.any(String),
    }));
    // Verify the backup file has the correct content
    const backupFilePath = manifest.files[0].backupPath;
    const backupContent = fs.readFileSync(backupFilePath, 'utf8');
    expect(backupContent).toBe('stable');

    fs.writeFileSync(target, 'broken', 'utf8');
    store.rollback();
    expect(fs.readFileSync(target, 'utf8')).toBe('stable');
  });

  it('does not restore from missing backup files', () => {
    const root = temporaryDirectory('zavorth-host-missing-');
    const backups = path.join(root, 'backups');
    const source = path.join(root, 'source');
    const manifestPath = path.join(backups, 'manifest.json');
    fs.mkdirSync(source);
    const target = path.join(source, 'runtime.ts');
    fs.writeFileSync(target, 'stable', 'utf8');
    const messages: string[] = [];
    const store = new HostBackupStore({
      backupsDir: backups,
      manifestPath,
      maxBackupsPerFile: 3,
      now: () => 1_700_000_000_000,
      log: (message) => messages.push(message),
    });

    store.handlePreModify([target]);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const backupFilePath = manifest.files[0].backupPath;

    // Remove the backup file
    fs.unlinkSync(backupFilePath);
    fs.writeFileSync(target, 'broken', 'utf8');
    store.rollback();
    // Should not be restored because backup file is missing
    expect(fs.readFileSync(target, 'utf8')).toBe('broken');
    expect(messages.some((message) => message.includes('Backup file missing'))).toBe(true);
  });

  it('traverses a valid legacy host manifest', () => {
    const root = temporaryDirectory('zavorth-host-legacy-');
    const backups = path.join(root, 'backups');
    const source = path.join(root, 'source');
    const manifestPath = path.join(backups, 'manifest.json');
    fs.mkdirSync(backups);
    fs.mkdirSync(source);
    const target = path.join(source, 'runtime.ts');
    fs.writeFileSync(target, 'broken', 'utf8');

    const store = new HostBackupStore({
      backupsDir: backups,
      manifestPath,
      maxBackupsPerFile: 3,
      now: () => 1_700_000_000_002,
      log: () => undefined,
    });

    // Empty manifest - rollback is a no-op
    store.rollback();
    expect(fs.readFileSync(target, 'utf8')).toBe('broken');
  });
});
