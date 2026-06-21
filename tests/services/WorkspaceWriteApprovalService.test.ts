import fs from 'fs';
import os from 'os';
import path from 'path';
import { Database } from '../../src/storage/Database.js';
import { WorkspaceWriteApprovalService } from '../../src/services/WorkspaceWriteApprovalService.js';
import { SecurityAuditLogger } from '../../src/services/SecurityAuditLogger.js';
import { LogRepository } from '../../src/storage/LogRepository.js';

describe('WorkspaceWriteApprovalService', () => {
  let tempDir: string;
  let db: Database;
  let auditLogger: SecurityAuditLogger;
  let mockLogRepo: jest.Mocked<LogRepository>;
  let service: WorkspaceWriteApprovalService;

  beforeEach(async () => {
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-approval-test-')));
    process.env.ZAVORTH_HOME = tempDir;
    process.env.ZAVORTH_AUDIT_HASH_KEY = 'test-hash-key-123';

    db = await Database.getInstance();

    mockLogRepo = {
      log: jest.fn(),
      init: jest.fn().mockResolvedValue(undefined),
      getRecentLogs: jest.fn(),
    } as unknown as jest.Mocked<LogRepository>;

    auditLogger = new SecurityAuditLogger(mockLogRepo);
    service = new WorkspaceWriteApprovalService(db, auditLogger);
  });

  afterEach(async () => {
    db.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    delete process.env.ZAVORTH_HOME;
    delete process.env.ZAVORTH_AUDIT_HASH_KEY;
    jest.restoreAllMocks();
  });

  it('requests and approves a write operation', async () => {
    const workspaceId = 'ws-1';
    const toolName = 'workspace.filesystem.write';
    const resolvedPath = path.join(tempDir, 'file.txt');
    const args = { file: 'file.txt', content: 'hello world' };

    const operationId = await service.requestApproval(workspaceId, toolName, resolvedPath, args);
    expect(operationId.startsWith('write-')).toBe(true);

    // Check request log
    expect(mockLogRepo.log).toHaveBeenCalledWith(
      'security',
      'security_audit',
      'workspace_write_requested',
      expect.objectContaining({
        event: 'workspace_write_requested',
        workspaceId,
        toolName,
        operation: 'request-approval',
        reason: operationId,
      })
    );

    // Verify it is not approved initially
    const rawDb = db.getRawDb();
    const row = rawDb.prepare('SELECT * FROM workspace_write_approvals WHERE operation_id = ?').get(operationId) as any;
    expect(row).toBeDefined();
    expect(row.approved).toBe(0);

    // Approve the operation
    await service.approveOperation(operationId);

    // Check row status
    const rowApproved = rawDb.prepare('SELECT * FROM workspace_write_approvals WHERE operation_id = ?').get(operationId) as any;
    expect(rowApproved.approved).toBe(1);

    // Check approval log
    expect(mockLogRepo.log).toHaveBeenCalledWith(
      'security',
      'security_audit',
      'workspace_write_approved',
      expect.objectContaining({
        event: 'workspace_write_approved',
        workspaceId,
        toolName,
        operation: 'approve-operation',
        reason: operationId,
      })
    );
  });

  it('denies a pending write operation', async () => {
    const workspaceId = 'ws-1';
    const toolName = 'workspace.filesystem.write';
    const resolvedPath = path.join(tempDir, 'file.txt');
    const args = { file: 'file.txt', content: 'hello world' };

    const operationId = await service.requestApproval(workspaceId, toolName, resolvedPath, args);

    // Deny it
    await service.denyOperation(operationId);

    // Check row is deleted
    const rawDb = db.getRawDb();
    const row = rawDb.prepare('SELECT * FROM workspace_write_approvals WHERE operation_id = ?').get(operationId) as any;
    expect(row).toBeUndefined();

    // Check deny log
    expect(mockLogRepo.log).toHaveBeenCalledWith(
      'security',
      'security_audit',
      'workspace_write_denied',
      expect.objectContaining({
        event: 'workspace_write_denied',
        workspaceId,
        toolName,
        operation: 'deny-operation',
        reason: operationId,
      })
    );
  });

  it('consumes approved operation atomically and prevents replay', async () => {
    const workspaceId = 'ws-1';
    const toolName = 'workspace.filesystem.write';
    const resolvedPath = path.join(tempDir, 'file.txt');
    const args = { file: 'file.txt', content: 'hello world' };

    const operationId = await service.requestApproval(workspaceId, toolName, resolvedPath, args);

    // Cannot consume if not approved
    let consumed = await service.consumeApproval(workspaceId, toolName, resolvedPath, args, operationId);
    expect(consumed).toBe(false);

    // Approve
    await service.approveOperation(operationId);

    // Consume successfully
    consumed = await service.consumeApproval(workspaceId, toolName, resolvedPath, args, operationId);
    expect(consumed).toBe(true);

    // Row should be deleted now
    const rawDb = db.getRawDb();
    const row = rawDb.prepare('SELECT * FROM workspace_write_approvals WHERE operation_id = ?').get(operationId);
    expect(row).toBeUndefined();

    // Replay block: second consume fails
    consumed = await service.consumeApproval(workspaceId, toolName, resolvedPath, args, operationId);
    expect(consumed).toBe(false);
  });

  it('blocks consumption if path, tool, workspace or arguments mismatch', async () => {
    const workspaceId = 'ws-1';
    const toolName = 'workspace.filesystem.write';
    const resolvedPath = path.join(tempDir, 'file.txt');
    const args = { file: 'file.txt', content: 'hello world' };

    const operationId = await service.requestApproval(workspaceId, toolName, resolvedPath, args);
    await service.approveOperation(operationId);

    // Mismatched path
    let consumed = await service.consumeApproval(workspaceId, toolName, path.join(tempDir, 'different.txt'), args, operationId);
    expect(consumed).toBe(false);

    // Mismatched arguments (content altered)
    consumed = await service.consumeApproval(workspaceId, toolName, resolvedPath, { ...args, content: 'altered' }, operationId);
    expect(consumed).toBe(false);

    // Mismatched workspaceId
    consumed = await service.consumeApproval('ws-different', toolName, resolvedPath, args, operationId);
    expect(consumed).toBe(false);

    // Mismatched toolName (Cross-operation test: mkdir cannot consume write)
    consumed = await service.consumeApproval(workspaceId, 'workspace.filesystem.mkdir', resolvedPath, args, operationId);
    expect(consumed).toBe(false);
  });

  it('verifies that approval for mkdir cannot be consumed by write, and vice versa', async () => {
    const workspaceId = 'ws-1';

    // 1. mkdir approval -> write consumption should fail
    const mkdirTool = 'workspace.filesystem.mkdir';
    const mkdirPath = path.join(tempDir, 'newdir');
    const mkdirArgs = { directory: 'newdir' };

    const mkdirOpId = await service.requestApproval(workspaceId, mkdirTool, mkdirPath, mkdirArgs);
    await service.approveOperation(mkdirOpId);

    const mkdirConsumedByWrite = await service.consumeApproval(
      workspaceId,
      'workspace.filesystem.write',
      mkdirPath,
      { file: 'newdir', content: 'hello' },
      mkdirOpId
    );
    expect(mkdirConsumedByWrite).toBe(false);

    // 2. write approval -> mkdir consumption should fail
    const writeTool = 'workspace.filesystem.write';
    const writePath = path.join(tempDir, 'file.txt');
    const writeArgs = { file: 'file.txt', content: 'hello world' };

    const writeOpId = await service.requestApproval(workspaceId, writeTool, writePath, writeArgs);
    await service.approveOperation(writeOpId);

    const writeConsumedByMkdir = await service.consumeApproval(
      workspaceId,
      'workspace.filesystem.mkdir',
      writePath,
      { directory: 'file.txt' },
      writeOpId
    );
    expect(writeConsumedByMkdir).toBe(false);
  });

  it('blocks consumption if token is expired', async () => {
    const workspaceId = 'ws-1';
    const toolName = 'workspace.filesystem.write';
    const resolvedPath = path.join(tempDir, 'file.txt');
    const args = { file: 'file.txt', content: 'hello world' };

    const operationId = await service.requestApproval(workspaceId, toolName, resolvedPath, args);
    await service.approveOperation(operationId);

    // Manually force expire in database
    const rawDb = db.getRawDb();
    const expiredTime = new Date(Date.now() - 1000).toISOString();
    rawDb.prepare('UPDATE workspace_write_approvals SET expires_at = ? WHERE operation_id = ?').run(expiredTime, operationId);

    // Consume should fail due to expiry
    const consumed = await service.consumeApproval(workspaceId, toolName, resolvedPath, args, operationId);
    expect(consumed).toBe(false);
  });
});
