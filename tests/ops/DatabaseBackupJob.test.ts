import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildDefaultBackupTargets, DatabaseBackupJob } from '../../ops/backups/DatabaseBackupJob';

describe('DatabaseBackupJob', () => {
  it('creates snapshot directories and manifests for existing targets', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-backup-'));
    const sourceRoot = path.join(root, 'workspace');
    const backupRoot = path.join(root, 'backups');
    fs.mkdirSync(path.join(sourceRoot, 'data', 'runtime'), { recursive: true });
    fs.writeFileSync(path.join(sourceRoot, 'data', 'zavorth.db'), 'db', 'utf8');
    fs.writeFileSync(path.join(sourceRoot, 'data', 'runtime', 'state.json'), '{}', 'utf8');

    const job = new DatabaseBackupJob({
      backupRoot,
      sourceRoot,
      targets: [
        { sourcePath: path.join(sourceRoot, 'data', 'zavorth.db'), relativePath: path.join('data', 'zavorth.db') },
        { sourcePath: path.join(sourceRoot, 'data', 'runtime'), relativePath: path.join('data', 'runtime') },
      ],
    });

    const manifest = job.createSnapshot();
    expect(fs.existsSync(path.join(manifest.snapshotDir, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(manifest.snapshotDir, 'data', 'zavorth.db'))).toBe(true);
    expect(fs.existsSync(path.join(manifest.snapshotDir, 'data', 'runtime', 'state.json'))).toBe(true);
  });

  it('builds a critical-state default target set without copying the whole runtime directory', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-backup-defaults-'));
    const targets = buildDefaultBackupTargets({
      projectRoot: root,
      dbPath: path.join(root, 'data', 'zavorth.db'),
      dbEncryptionKeyFile: path.join(root, 'data', 'runtime', 'db-field.key'),
      hostIdentityFile: path.join(root, 'data', 'runtime', 'authorized-host.json'),
      mailboxSecretFile: path.join(root, 'data', 'runtime', 'mailbox-secret.key'),
      memoryDir: path.join(root, 'memory'),
      operationalMemoryDir: path.join(root, 'data', 'operational-memory'),
      workspaceProfilesDir: path.join(root, 'data', 'workspace-profiles'),
      securityAuditTrailDir: path.join(root, 'data', 'runtime', 'security-audit-trail'),
      runtimeStateFiles: [
        path.join(root, 'data', 'runtime', 'node-mesh-state.json'),
        path.join(root, 'data', 'runtime', 'channel-provider-doctor-last.json'),
      ],
    });

    expect(targets.some((entry) => entry.relativePath === path.join('data', 'runtime'))).toBe(false);
    expect(targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ relativePath: path.join('data', 'zavorth.db') }),
        expect.objectContaining({ relativePath: 'memory' }),
        expect.objectContaining({ relativePath: path.join('data', 'runtime', 'node-mesh-state.json') }),
        expect.objectContaining({ relativePath: path.join('data', 'runtime', 'db-field.key') }),
        expect.objectContaining({ relativePath: path.join('data', 'workspace-profiles') }),
      ]),
    );
  });
});
