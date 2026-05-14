import { TelegramExternalExecutorPermissionApprovalService } from '../../../src/telegram/controllers/TelegramExternalExecutorPermissionApprovalService';

describe('TelegramExternalExecutorPermissionApprovalService', () => {
  function createService(overrides: Record<string, any> = {}) {
    const permissionPolicy = {
      getExternalExecutorAgentRole: jest.fn().mockReturnValue('reviewer'),
      mergePathPolicies: jest
        .fn()
        .mockImplementation((...policies: any[]) => policies.filter(Boolean)),
      normalizePathPolicy: jest.fn().mockImplementation((policy: any) => policy),
      getPermissionAccessLevel: jest.fn().mockReturnValue('read_only'),
    };
    const taskApprovalSupport = {
      appendApprovalDecision: jest.fn().mockReturnValue({
        approval_history: ['decision'],
      }),
      completeTaskApproval: jest.fn().mockResolvedValue(true),
    };

    return {
      permissionPolicy,
      taskApprovalSupport,
      service: new TelegramExternalExecutorPermissionApprovalService({
        permissionPolicy: permissionPolicy as any,
        taskApprovalSupport: taskApprovalSupport as any,
        ...overrides,
      }),
    };
  }

  it('maps agent bindings into role-specific metadata before delegating completion', async () => {
    const { service, taskApprovalSupport } = createService();
    const task = {
      metadata: {
        external_executor_agent_bindings: {
          maker: 'maker-agent',
        },
        external_executor_permission_ids: {
          maker: 'perm-maker',
        },
      },
    };
    const approved = {
      permission_id: 'perm-reviewer',
      metadata: {
        suggested_agent_id: 'reviewer-agent',
      },
    };

    const handled = await service.finalizeApproval(
      {} as any,
      {
        kind: 'agent_binding',
      } as any,
      approved as any,
      '42',
      task as any,
    );

    expect(handled).toBe(true);
    expect(taskApprovalSupport.completeTaskApproval).toHaveBeenCalledWith(
      {},
      task,
      approved,
      expect.objectContaining({
        external_executor_agent_id: 'reviewer-agent',
        external_executor_agent_role: 'reviewer',
        external_executor_agent_bindings: {
          maker: 'maker-agent',
          reviewer: 'reviewer-agent',
        },
        external_executor_permission_ids: {
          maker: 'perm-maker',
          reviewer: 'perm-reviewer',
        },
        external_executor_permission_id: 'perm-reviewer',
        pendingPermissionId: null,
        pendingPermissionNotifiedAt: null,
        pendingPermissionNotificationError: null,
      }),
    );
  });

  it('builds merged path metadata for workspace access approvals', async () => {
    const { service, permissionPolicy, taskApprovalSupport } = createService();
    const task = {
      metadata: {
        extra_allowed_paths: ['C:/workspace'],
        extra_allowed_path_policies: [{ path: 'C:/workspace', access_level: 'read_only' }],
      },
    };
    const permission = {
      kind: 'workspace_access',
      requested_value: 'C:/outside',
    };
    const approved = {
      permission_id: 'perm-path',
      scope: 'workspace',
      resolved_value: 'C:/outside',
    };

    await service.finalizeApproval(
      {} as any,
      permission as any,
      approved as any,
      '42',
      task as any,
    );

    expect(permissionPolicy.normalizePathPolicy).toHaveBeenCalledWith({
      path: 'C:/workspace',
      access_level: 'read_only',
    });
    expect(permissionPolicy.getPermissionAccessLevel).toHaveBeenCalledWith(approved);
    expect(taskApprovalSupport.completeTaskApproval).toHaveBeenCalledWith(
      {},
      task,
      approved,
      expect.objectContaining({
        extra_allowed_paths: ['C:/workspace', 'C:/outside'],
        extra_allowed_path_policies: expect.any(Array),
        external_executor_requested_access_path: 'C:/outside',
        external_executor_permission_id: 'perm-path',
        externalExecutorPermissionScope: 'workspace',
      }),
    );
  });
});
