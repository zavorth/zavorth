import fs from 'fs';
import os from 'os';
import path from 'path';
import { DatabaseBackupJob } from '../../ops/backups/DatabaseBackupJob';
import { DatabaseRestoreJob } from '../../ops/backups/DatabaseRestoreJob';

describe('DatabaseRestoreJob', () => {
  it('restores files from a snapshot manifest', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-restore-'));
    const sourceRoot = path.join(root, 'workspace');
    const backupRoot = path.join(root, 'backups');
    fs.mkdirSync(path.join(sourceRoot, 'data', 'runtime'), { recursive: true });
    const dbPath = path.join(sourceRoot, 'data', 'zavorth.db');
    fs.writeFileSync(dbPath, 'db-v1', 'utf8');

    const backup = new DatabaseBackupJob({
      backupRoot,
      sourceRoot,
      targets: [{ sourcePath: dbPath, relativePath: path.join('data', 'zavorth.db') }],
    });
    const manifest = backup.createSnapshot();

    fs.writeFileSync(dbPath, 'db-v2', 'utf8');

    const restore = new DatabaseRestoreJob({ sourceRoot });
    restore.restoreSnapshot(path.join(manifest.snapshotDir, 'manifest.json'));

    expect(fs.readFileSync(dbPath, 'utf8')).toBe('db-v1');
  });

  it('rejects manifests that try to restore outside the workspace root', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-restore-escape-'));
    const sourceRoot = path.join(root, 'workspace');
    const snapshotDir = path.join(root, 'snapshot');
    fs.mkdirSync(snapshotDir, { recursive: true });
    fs.writeFileSync(path.join(snapshotDir, 'escape.txt'), 'oops', 'utf8');
    fs.writeFileSync(
      path.join(snapshotDir, 'manifest.json'),
      JSON.stringify(
        {
          snapshotId: 'escape',
          createdAt: new Date().toISOString(),
          sourceRoot,
          snapshotDir,
          targets: [{ sourcePath: path.join(sourceRoot, 'escape.txt'), relativePath: '..\\escape.txt', exists: true }],
        },
        null,
        2,
      ),
      'utf8',
    );

    const restore = new DatabaseRestoreJob({ sourceRoot });
    expect(() => restore.restoreSnapshot(path.join(snapshotDir, 'manifest.json'))).toThrow(
      /fora do snapshot|fora do workspace/i,
    );
  });
});
