import { PermissionService } from '../../../src/services/PermissionService';

describe('PermissionService telemetry', () => {
  function createRepo() {
    const store = new Map<string, any>();

    return {
      init: jest.fn().mockResolvedValue(undefined),
      save: jest.fn((permission: any) => {
        store.set(permission.permission_id, permission);
      }),
      getById: jest.fn((permissionId: string) => store.get(permissionId)),
      list: jest.fn().mockReturnValue([]),
      findPendingMatch: jest.fn().mockReturnValue(undefined),
      findApproved: jest.fn().mockReturnValue(undefined),
      findApprovedMatch: jest.fn().mockReturnValue(undefined),
      listApproved: jest.fn().mockReturnValue([]),
    };
  }

  it('records creation and approval events with a stable task trace id', async () => {
    const repo = createRepo();
    const telemetryRuntime = {
      record: jest.fn().mockResolvedValue(undefined),
    } as any;
    const service = new PermissionService(repo as any, telemetryRuntime);

    const created = await service.createRequest({
      task_id: 'task-telemetry',
      executor: 'codex',
      kind: 'command_access',
      requested_value: 'npm test',
      resolved_value: 'npm test',
      reason: 'Needs to run sensitive test',
    });
    await service.approveRequest(created.permission_id, 'operator-1');

    expect(telemetryRuntime.record).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: 'task:task-telemetry',
        source: 'permission-service',
        eventType: 'permission.created',
        status: 'pending',
      }),
    );
    expect(telemetryRuntime.record).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: 'task:task-telemetry',
        source: 'permission-service',
        eventType: 'permission.approved',
        status: 'approved',
        payload: expect.objectContaining({
          permissionId: created.permission_id,
          decidedBy: 'operator-1',
        }),
      }),
    );
  });
});
