import { Database } from '../../src/storage/Database';
import { WorkspaceCommandApprovalService } from '../../src/services/WorkspaceCommandApprovalService';

describe('WorkspaceCommandApprovalService', () => {
  let db: Database;
  let service: WorkspaceCommandApprovalService;
  const workspaceId = 'test-workspace';

  beforeAll(async () => {
    db = await Database.getInstance();
    service = new WorkspaceCommandApprovalService(db);
  });

  beforeEach(() => {
    // Clear command approvals table
    db.run('DELETE FROM workspace_command_approvals');
  });

  it('registers pending approvals correctly', async () => {
    const command = 'npm install';
    const operationId = await service.requestApproval(workspaceId, command, false);
    expect(operationId).toBeDefined();

    const row = db.get<{ approved: number; command: string }>(
      'SELECT approved, command FROM workspace_command_approvals WHERE operation_id = -',
      [operationId]
    );
    expect(row).not.toBeUndefined();
    expect(row?.approved).toBe(0);
    expect(row?.command).toBe(command);
  });

  it('registers auto-approved approvals correctly', async () => {
    const command = 'git status';
    const operationId = await service.requestApproval(workspaceId, command, true);
    expect(operationId).toBeDefined();

    const row = db.get<{ approved: number }>(
      'SELECT approved FROM workspace_command_approvals WHERE operation_id = -',
      [operationId]
    );
    expect(row?.approved).toBe(1);
  });

  it('approves operations correctly', async () => {
    const command = 'npm install';
    const operationId = await service.requestApproval(workspaceId, command, false);
    await service.approveOperation(operationId);

    const row = db.get<{ approved: number }>(
      'SELECT approved FROM workspace_command_approvals WHERE operation_id = -',
      [operationId]
    );
    expect(row?.approved).toBe(1);
  });

  it('denies operations correctly', async () => {
    const command = 'npm install';
    const operationId = await service.requestApproval(workspaceId, command, false);
    await service.denyOperation(operationId);

    const row = db.get<{ approved: number }>(
      'SELECT approved FROM workspace_command_approvals WHERE operation_id = -',
      [operationId]
    );
    expect(row).toBeUndefined();
  });

  it('consumes approvals atomically and prevents replay', async () => {
    const command = 'git status';
    const operationId = await service.requestApproval(workspaceId, command, true);

    // Consume first time: succeeds
    const success = await service.consumeApproval(workspaceId, command, operationId);
    expect(success).toBe(true);

    // Consume second time: fails (prevent replay)
    const success2 = await service.consumeApproval(workspaceId, command, operationId);
    expect(success2).toBe(false);
  });

  it('fails consumption if command doesn\'t match', async () => {
    const command = 'git status';
    const operationId = await service.requestApproval(workspaceId, command, true);

    // Consume with wrong command: fails
    const success = await service.consumeApproval(workspaceId, 'npm test', operationId);
    expect(success).toBe(false);

    // Still exists- Let's check: yes, it should still exist since delete is conditional
    const row = db.get<{ approved: number }>(
      'SELECT approved FROM workspace_command_approvals WHERE operation_id = -',
      [operationId]
    );
    expect(row).not.toBeUndefined();
  });
});
