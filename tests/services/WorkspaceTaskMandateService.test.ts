import fs from 'fs';
import os from 'os';
import path from 'path';
import { WorkspaceTaskMandateService } from '../../src/services/WorkspaceTaskMandateService';
import { TrustedWorkspaceService } from '../../src/services/TrustedWorkspaceService';
import { WorkspaceResolver } from '../../src/security/WorkspaceResolver';
import { LogRepository } from '../../src/storage/LogRepository';
import { Database } from '../../src/storage/Database';
import { config } from '../../src/config/index';

async function getAuditLogs(eventType: string) {
  const logRepo = new LogRepository();
  await logRepo.init();
  const logs = logRepo.getRecentLogs(100);
  return logs.filter(l => l.message === eventType);
}

describe('WorkspaceTaskMandateService', () => {
  let db: Database;
  let service: WorkspaceTaskMandateService;
  let trustService: TrustedWorkspaceService;
  const workspaceId = 'test-workspace';
  let tempDir: string;

  beforeAll(async () => {
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mandate-test-')));
    config.dbPath = path.join(tempDir, 'data', 'zavorth.db');
    // Mock WorkspaceResolver to return tempDir
    jest.spyOn(WorkspaceResolver, 'resolve').mockReturnValue(tempDir);

    db = await Database.getInstance();
    trustService = await TrustedWorkspaceService.getInstance();
    service = WorkspaceTaskMandateService.getInstance();
  });

  beforeEach(() => {
    db.run('DELETE FROM workspace_trust_entries');
    db.run('DELETE FROM workspace_command_approvals');
    db.run('DELETE FROM system_logs');
    service.revokeMandate(workspaceId);
  });

  afterAll(() => {
    db.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch { /* intentionally empty */ }
    jest.restoreAllMocks();
  });

  it('proposes, resolves and revokes mandates correctly', async () => {
    const proposed = service.proposeMandate(workspaceId, {
      description: 'Test mandate',
      targetDirectories: [path.join(tempDir, 'src')],
      allowedOperations: ['command.run', 'filesystem.write'],
      allowedBinaries: ['npm', 'git'],
      maxRiskLevel: 'MEDIUM',
      allowPackageInstall: true,
      allowNetwork: true,
      taskId: 'task-123'
    });

    expect(proposed.mandateId).toBeDefined();
    expect(proposed.taskId).toBe('task-123');

    // Verify proposed audit log
    const reqLogs = await getAuditLogs('workspace_task_mandate_requested');
    expect(reqLogs.length).toBeGreaterThan(0);
    const meta = reqLogs[0].metadata;
    // Relative paths used in audit logs
    expect(meta.metadata.targetDirectoriesRelative).toEqual(['src']);
    // No absolute paths in audit logs
    expect(reqLogs[0].rootPath).toBeUndefined();

    // Resolve - Approve
    const active = service.resolveMandate(workspaceId, true);
    expect(active).not.toBeNull();
    expect(active?.expiresAt).toBeDefined();

    // Verify approved audit log
    const appLogs = await getAuditLogs('workspace_task_mandate_approved');
    expect(appLogs.length).toBeGreaterThan(0);

    // Get active mandate
    const activeGet = service.getActiveMandate(workspaceId);
    expect(activeGet).not.toBeNull();
    expect(activeGet?.mandateId).toBe(active?.mandateId);

    // Revoke
    service.revokeMandate(workspaceId);
    expect(service.getActiveMandate(workspaceId)).toBeNull();

    const revLogs = await getAuditLogs('workspace_task_mandate_revoked');
    expect(revLogs.length).toBeGreaterThan(0);
  });

  it('mandato ativo impede fallback automático para Session Grant/Trusted Workspace quando ação viola targetDirectories', () => {
    service.proposeMandate(workspaceId, {
      description: 'Test mandate',
      targetDirectories: [path.join(tempDir, 'src/components')],
      allowedOperations: ['command.run', 'filesystem.write'],
      allowedBinaries: ['npm'],
      maxRiskLevel: 'MEDIUM',
      allowPackageInstall: true,
      allowNetwork: true,
    });
    service.resolveMandate(workspaceId, true);

    // Command run in src/config (outside targetDirectories)
    const checkResult = service.checkCommandApproval(
      workspaceId,
      tempDir,
      'npm test',
      path.join(tempDir, 'src/config'),
      'LOW'
    );

    expect(checkResult.allowed).toBe(false);
    expect(checkResult.blockFallback).toBe(true); // Must not fallback
    expect(checkResult.reason).toContain('Cwd is outside mandate target directories');
  });

  it('mandato ativo permite autoexecução quando dentro do escopo', () => {
    service.proposeMandate(workspaceId, {
      description: 'Test mandate',
      targetDirectories: [path.join(tempDir, 'src/components')],
      allowedOperations: ['command.run', 'filesystem.write'],
      allowedBinaries: ['npm'],
      maxRiskLevel: 'MEDIUM',
      allowPackageInstall: true,
      allowNetwork: true,
    });
    service.resolveMandate(workspaceId, true);

    const checkResult = service.checkCommandApproval(
      workspaceId,
      tempDir,
      'npm test',
      path.join(tempDir, 'src/components'),
      'LOW'
    );

    expect(checkResult.allowed).toBe(true);
    expect(checkResult.blockFallback).toBe(true);
  });

  it('mandato ativo impede fallback automático quando binary não está em allowedBinaries', () => {
    service.proposeMandate(workspaceId, {
      description: 'Test mandate',
      targetDirectories: [path.join(tempDir, 'src')],
      allowedOperations: ['command.run'],
      allowedBinaries: ['npm'],
      maxRiskLevel: 'MEDIUM',
      allowPackageInstall: true,
      allowNetwork: true,
    });
    service.resolveMandate(workspaceId, true);

    const checkResult = service.checkCommandApproval(
      workspaceId,
      tempDir,
      'git status',
      path.join(tempDir, 'src'),
      'LOW'
    );

    expect(checkResult.allowed).toBe(false);
    expect(checkResult.blockFallback).toBe(true);
    expect(checkResult.reason).toContain('not allowed by mandate');
  });

  it('mandato ativo impede fallback automático quando operação não está em allowedOperations', () => {
    service.proposeMandate(workspaceId, {
      description: 'Test mandate',
      targetDirectories: [path.join(tempDir, 'src')],
      allowedOperations: ['filesystem.write'],
      allowedBinaries: ['npm'],
      maxRiskLevel: 'MEDIUM',
      allowPackageInstall: true,
      allowNetwork: true,
    });
    service.resolveMandate(workspaceId, true);

    const checkResult = service.checkCommandApproval(
      workspaceId,
      tempDir,
      'npm test',
      path.join(tempDir, 'src'),
      'LOW'
    );

    expect(checkResult.allowed).toBe(false);
    expect(checkResult.blockFallback).toBe(true);
  });

  it('filesystem.move não autoexecuta se não houver implementação segura', () => {
    service.proposeMandate(workspaceId, {
      description: 'Test mandate',
      targetDirectories: [path.join(tempDir, 'src')],
      allowedOperations: ['filesystem.move' as any],
      allowedBinaries: [],
      maxRiskLevel: 'MEDIUM',
      allowPackageInstall: false,
      allowNetwork: false,
    });
    service.resolveMandate(workspaceId, true);

    const checkResult = service.checkWriteApproval(
      workspaceId,
      tempDir,
      path.join(tempDir, 'src/App.tsx'),
      'filesystem.move'
    );

    expect(checkResult.allowed).toBe(false);
    expect(checkResult.blockFallback).toBe(true);
    expect(checkResult.reason).toContain('reserved but inactive');
  });

  it('Date.now/Date.parse usado para expiração', () => {
    const active = service.proposeMandate(workspaceId, {
      description: 'Test mandate',
      targetDirectories: [path.join(tempDir, 'src')],
      allowedOperations: ['command.run'],
      allowedBinaries: ['npm'],
      maxRiskLevel: 'MEDIUM',
      allowPackageInstall: true,
      allowNetwork: true,
    });
    service.resolveMandate(workspaceId, true);

    const activeMandate = service.getActiveMandate(workspaceId);
    expect(activeMandate).not.toBeNull();

    // Check expiration parsing explicitly
    const parsedTime = Date.parse(activeMandate!.expiresAt);
    expect(isNaN(parsedTime)).toBe(false);
    expect(parsedTime).toBeGreaterThan(Date.now());
  });

  it('mandato não é reaproveitado por workspace diferente', () => {
    service.proposeMandate(workspaceId, {
      description: 'Test mandate',
      targetDirectories: [path.join(tempDir, 'src')],
      allowedOperations: ['command.run'],
      allowedBinaries: ['npm'],
      maxRiskLevel: 'MEDIUM',
      allowPackageInstall: true,
      allowNetwork: true,
    });
    service.resolveMandate(workspaceId, true);

    // Should return null for a different workspaceId
    expect(service.getActiveMandate('other-workspace')).toBeNull();
  });

  it('revogar Trusted Workspace revoga mandato ativo', async () => {
    await trustService.grantTrust(workspaceId, tempDir, {
      allowRiskUpTo: 'MEDIUM',
      allowPackageInstall: true,
      allowNetwork: true,
    });

    service.proposeMandate(workspaceId, {
      description: 'Test mandate',
      targetDirectories: [path.join(tempDir, 'src')],
      allowedOperations: ['command.run'],
      allowedBinaries: ['npm'],
      maxRiskLevel: 'MEDIUM',
      allowPackageInstall: true,
      allowNetwork: true,
    });
    service.resolveMandate(workspaceId, true);

    expect(service.getActiveMandate(workspaceId)).not.toBeNull();

    // Revoke workspace trust
    await trustService.revokeTrust(workspaceId);

    // Active mandate must be automatically revoked
    expect(service.getActiveMandate(workspaceId)).toBeNull();
  });
});
