import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index.js';
import { Database } from '../../src/storage/Database';
import { HostCommandApprovalService } from '../../src/services/HostCommandApprovalService';
import { HostCommandPayloadCache } from '../../src/services/HostCommandPayloadCache';

describe('HostCommandApprovalService', () => {
  let db: Database;
  let service: HostCommandApprovalService;
  const workspaceId = 'test-workspace';
  const originalDbPath = config.dbPath;
  const tempDirs: string[] = [];

  beforeEach(async () => {
    // Close any global Database singleton instance so we can switch paths
    const dbInstance = (Database as any).instance;
    if (dbInstance) {
      dbInstance.close();
    }

    const tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-hcmd-approval-test-')));
    tempDirs.push(tempDir);
    config.dbPath = path.join(tempDir, 'zavorth-test.db');

    db = await Database.getInstance();
    service = new HostCommandApprovalService(db);
    db.run('DELETE FROM workspace_host_command_proposals');
    HostCommandPayloadCache.getInstance().clear();
  });

  afterEach(async () => {
    const dbInstance = (Database as any).instance;
    if (dbInstance) {
      dbInstance.close();
    }

    config.dbPath = originalDbPath;
    HostCommandPayloadCache.getInstance().destroy();

    for (const dir of tempDirs) {
      try {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      } catch (err) {
        // ignore cleanup errors
      }
    }
    tempDirs.length = 0;
  });

  it('proposes command correctly and caches in memory while hashing in SQLite', async () => {
    const command = 'git';
    const args = ['commit', '-m', 'feat: add hpm'];
    const cwd = '/some/dir';
    const shell = false;
    const reason = 'Commit changes';

    const result = await service.propose(workspaceId, command, args, cwd, shell, reason);

    expect(result.operationId).toBeDefined();
    expect(result.approved).toBe(false);
    expect(result.riskLevel).toBe('LOW');

    // Verify raw values NOT persisted in SQLite
    const row = db.get<any>('SELECT * FROM workspace_host_command_proposals WHERE operation_id = ?', [result.operationId]);
    expect(row).toBeDefined();
    expect(row.command_hash).toBe(service.hashValue(command));
    expect(row.command_preview_redacted).toBe('git');
    expect(row.args_hash).toBe(service.hashValue(JSON.stringify(args)));
    expect(row.cwd_hash).toBe(service.hashValue(cwd));
    expect(row.approved).toBe(0);

    // Verify raw values cached in memory
    const cached = HostCommandPayloadCache.getInstance().get(result.operationId);
    expect(cached).toBeDefined();
    expect(cached?.command).toBe(command);
    expect(cached?.args).toEqual(args);
    expect(cached?.cwd).toBe(cwd);
  });

  it('classifies risk levels correctly', () => {
    // 1. shell:true is HIGH
    expect(service.classifyRisk('git', [], true)).toBe('HIGH');

    // 2. Interpreters are HIGH
    expect(service.classifyRisk('powershell', ['-c', 'ls'], false)).toBe('HIGH');
    expect(service.classifyRisk('cmd.exe', ['/c', 'dir'], false)).toBe('HIGH');
    expect(service.classifyRisk('bash', [], false)).toBe('HIGH');

    // 3. Destructive patterns or secrets are CRITICAL
    expect(service.classifyRisk('rm', ['-rf', '/'], false)).toBe('CRITICAL');
    expect(service.classifyRisk('del', ['/s', '*.pem'], false)).toBe('CRITICAL');
    expect(service.classifyRisk('git', ['clone', 'https://token:secret123@github.com'], false)).toBe('CRITICAL');

    // 4. Default is LOW
    expect(service.classifyRisk('git', ['status'], false)).toBe('LOW');
  });

  it('denies/revokes proposals correctly', async () => {
    const result = await service.propose(workspaceId, 'git', [], '.', false, 'status');
    await service.resolve(result.operationId, false);

    const row = db.get('SELECT * FROM workspace_host_command_proposals WHERE operation_id = ?', [result.operationId]);
    expect(row).toBeUndefined();
    expect(HostCommandPayloadCache.getInstance().get(result.operationId)).toBeUndefined();
  });

  it('validates strong confirmation on backend for CRITICAL risk level', async () => {
    // Propose CRITICAL command
    const result = await service.propose(workspaceId, 'rm', ['-rf', '/'], '.', false, 'wipe');
    expect(result.riskLevel).toBe('CRITICAL');

    // Try resolving without RUN -> fails
    await expect(service.resolve(result.operationId, true, 'NOT_RUN')).rejects.toThrow();

    // Try resolving with RUN -> succeeds
    await service.resolve(result.operationId, true, 'RUN');
    const row = db.get<any>('SELECT approved FROM workspace_host_command_proposals WHERE operation_id = ?', [result.operationId]);
    expect(row.approved).toBe(1);
  });

  it('atomically consumes approvals, preventing reuse/replay and mutation', async () => {
    const command = 'git';
    const args = ['status'];
    const cwd = '/my/workspace';
    const shell = false;

    const result = await service.propose(workspaceId, command, args, cwd, shell, 'check');
    await service.resolve(result.operationId, true);

    // 1. Consume with mutated command -> fails
    let success = await service.consumeApproval(workspaceId, result.operationId, 'git2', args, cwd, shell, 'LOW');
    expect(success).toBe(false);

    // 2. Consume with mutated args -> fails
    success = await service.consumeApproval(workspaceId, result.operationId, command, ['diff'], cwd, shell, 'LOW');
    expect(success).toBe(false);

    // 3. Consume with mutated cwd -> fails
    success = await service.consumeApproval(workspaceId, result.operationId, command, args, '/other/cwd', shell, 'LOW');
    expect(success).toBe(false);

    // 4. Consume with mutated shell -> fails
    success = await service.consumeApproval(workspaceId, result.operationId, command, args, cwd, true, 'LOW');
    expect(success).toBe(false);

    // 5. Consume with mutated risk -> fails
    success = await service.consumeApproval(workspaceId, result.operationId, command, args, cwd, shell, 'HIGH');
    expect(success).toBe(false);

    // 6. Consume with correct values -> succeeds
    success = await service.consumeApproval(workspaceId, result.operationId, command, args, cwd, shell, 'LOW');
    expect(success).toBe(true);

    // 7. Consume again (replay/reuse) -> fails
    success = await service.consumeApproval(workspaceId, result.operationId, command, args, cwd, shell, 'LOW');
    expect(success).toBe(false);
  });
});
