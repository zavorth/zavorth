import fs from 'fs';
import os from 'os';
import path from 'path';
import { Database } from '../../src/storage/Database';
import { TrustedWorkspaceService } from '../../src/services/TrustedWorkspaceService';
import { WorkspaceSessionGrantCache } from '../../src/services/WorkspaceSessionGrantCache';
import { WorkspaceResolver } from '../../src/security/WorkspaceResolver';
import { LogRepository } from '../../src/storage/LogRepository';
import { config } from '../../src/config/index';

async function getAuditLogs(eventType: string) {
  const logRepo = new LogRepository();
  await logRepo.init();
  const logs = logRepo.getRecentLogs(100);
  return logs.filter(l => l.message === eventType);
}

describe('TrustedWorkspaceService', () => {
  let db: Database;
  let service: TrustedWorkspaceService;
  const workspaceId = 'test-project';
  let activeWorkspacePath: string;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-trust-service-')));
    config.dbPath = path.join(tempDir, 'data', 'zavorth.db');
    // Mock WorkspaceResolver to return tempDir
    jest.spyOn(WorkspaceResolver, 'resolve').mockReturnValue(tempDir);

    (TrustedWorkspaceService as any).instance = null;
    db = await Database.getInstance();
    service = await TrustedWorkspaceService.getInstance();
    activeWorkspacePath = tempDir;
  });

  beforeEach(() => {
    // Clear relevant tables
    db.run('DELETE FROM workspace_trust_entries');
    db.run('DELETE FROM workspace_command_approvals');
    db.run('DELETE FROM system_logs'); // clear logs
    WorkspaceSessionGrantCache.getInstance().clearAll();
  });

  afterAll(() => {
    db.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch { /* intentionally empty */ }
    jest.restoreAllMocks();
  });

  it('successfully grants trust and stores configuration in SQLite', async () => {
    const entry = await service.grantTrust(workspaceId, activeWorkspacePath, {
      allowRiskUpTo: 'MEDIUM',
      allowPackageInstall: true,
      allowNetwork: true,
    });

    expect(entry).not.toBeNull();
    expect(entry.workspaceId).toBe(workspaceId);
    expect(entry.trusted).toBe(true);
    expect(entry.allowRiskUpTo).toBe('MEDIUM');
    expect(entry.allowPackageInstall).toBe(true);
    expect(entry.allowNetwork).toBe(true);

    const row = db.get('SELECT * FROM workspace_trust_entries WHERE workspace_id = ?', [workspaceId]);
    expect(row).toBeDefined();
    expect(row.trusted).toBe(1);
    expect(row.allow_risk_up_to).toBe('MEDIUM');
    expect(row.allow_package_install).toBe(1);
    expect(row.allow_network).toBe(1);

    // Verify session grant is automatically created
    const grant = WorkspaceSessionGrantCache.getInstance().getGrant(workspaceId);
    expect(grant).not.toBeNull();
    expect(grant?.allowRiskUpTo).toBe('MEDIUM');
    expect(grant?.allowPackageInstall).toBe(true);
    expect(grant?.allowNetwork).toBe(true);

    // Verify audit logs exist
    const auditLogs = await getAuditLogs('workspace_trust_granted');
    expect(auditLogs.length).toBeGreaterThan(0);
    // Path should not appear as absolute path in metadata
    const auditMeta = auditLogs[0].metadata;
    expect(auditMeta).toBeDefined();
    expect(auditMeta?.rootPath).toBeUndefined(); // raw absolute path should be omitted from metadata
  });

  it('rejects path validation if rootPath does not match active session workspace', async () => {
    const invalidPath = path.resolve(activeWorkspacePath, '../other-random-path');
    await expect(service.grantTrust(workspaceId, invalidPath)).rejects.toThrow();
  });

  it('loads trust and performs spoofing checks', async () => {
    // Grant trust first
    await service.grantTrust(workspaceId, activeWorkspacePath, {
      allowRiskUpTo: 'LOW',
      allowPackageInstall: false,
      allowNetwork: false,
    });

    // 1. Success case: loading with the correct path
    const entry = service.loadTrust(workspaceId, activeWorkspacePath);
    expect(entry).not.toBeNull();
    expect(entry?.trusted).toBe(true);
    expect(entry?.allowRiskUpTo).toBe('LOW');

    // Verify session grant cache was synchronized
    const isDevMode = WorkspaceSessionGrantCache.getInstance().isDeveloperModeActive(workspaceId);
    expect(isDevMode).toBe(true);

    // 2. Failure case: loading with a different path (potential spoofing attempt)
    // We mock the verification by passing a path that resolves differently
    const spoofedPath = path.resolve(activeWorkspacePath, './some-other-subdir');
    const spoofedEntry = service.loadTrust(workspaceId, spoofedPath);
    expect(spoofedEntry).toBeNull();

    // Verify audit rejection log was created
    const rejectedLogs = await getAuditLogs('workspace_trust_rejected');
    expect(rejectedLogs.length).toBeGreaterThan(0);
  });

  it('revoking trust clears entries, session grants, and pending approvals', async () => {
    // Grant trust
    await service.grantTrust(workspaceId, activeWorkspacePath, {
      allowRiskUpTo: 'MEDIUM',
      allowPackageInstall: true,
      allowNetwork: true,
    });

    // Insert pending approvals for that workspaceId
    db.run(
      `INSERT INTO workspace_command_approvals (operation_id, workspace_id, command, args_hash, approved, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['test-op-1', workspaceId, 'npm install', 'hash123', 0, new Date(Date.now() + 50000).toISOString(), new Date().toISOString()]
    );

    // Verify they exist
    const initialApprovals = db.all('SELECT * FROM workspace_command_approvals WHERE workspace_id = ?', [workspaceId]);
    expect(initialApprovals.length).toBe(1);

    // Revoke trust
    await service.revokeTrust(workspaceId);

    // 1. Trust entry deleted
    const entry = service.getTrustEntry(workspaceId);
    expect(entry).toBeNull();

    // 2. Session grant revoked
    const grant = WorkspaceSessionGrantCache.getInstance().getGrant(workspaceId);
    expect(grant).toBeNull();
    const isDevMode = WorkspaceSessionGrantCache.getInstance().isDeveloperModeActive(workspaceId);
    expect(isDevMode).toBe(false);

    // 3. Pending approvals invalidated/deleted
    const postApprovals = db.all('SELECT * FROM workspace_command_approvals WHERE workspace_id = ?', [workspaceId]);
    expect(postApprovals.length).toBe(0);

    // 4. Audit log created
    const revokeLogs = await getAuditLogs('workspace_trust_revoked');
    expect(revokeLogs.length).toBeGreaterThan(0);
  });
});
