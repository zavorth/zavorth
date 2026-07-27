import { PermissionService } from '../../src/services/PermissionService';

describe('PermissionService', () => {
  function createRepo() {
    return {
      init: jest.fn().mockResolvedValue(undefined),
      save: jest.fn(),
      getById: jest.fn(),
      list: jest.fn().mockReturnValue([]),
      findPendingMatch: jest.fn().mockReturnValue(undefined),
      findApproved: jest.fn().mockReturnValue(undefined),
      findApprovedMatch: jest.fn().mockReturnValue(undefined),
      listApproved: jest.fn().mockReturnValue([]),
    };
  }

  it('matches pending ExternalExecutor bindings by role metadata', async () => {
    const repo = createRepo();
    const service = new PermissionService(repo as any);

    await service.createRequest({
      task_id: 'task-1',
      executor: 'external_executor',
      kind: 'agent_binding',
      workspace: 'C:/repo',
      requested_value: '/mnt/c/repo',
      resolved_value: 'reviewer-agent',
      reason: 'workspace mismatch',
      metadata: {
        agent_role: 'reviewer',
      },
    });

    expect(repo.findPendingMatch).toHaveBeenCalledWith(
      'external_executor',
      'agent_binding',
      'C:/repo',
      '/mnt/c/repo',
      'task-1',
      { agent_role: 'reviewer' },
    );
  });

  it('matches approved ExternalExecutor bindings by role metadata when granting policies', async () => {
    const repo = createRepo();
    const service = new PermissionService(repo as any);

    await service.grantPolicy({
      executor: 'external_executor',
      kind: 'agent_binding',
      scope: 'persistent',
      workspace: 'C:/repo',
      requested_value: '/mnt/c/repo',
      resolved_value: 'maker-agent',
      reason: 'manual policy',
      metadata: {
        agent_role: 'maker',
      },
    });

    expect(repo.findApprovedMatch).toHaveBeenCalledWith(
      'external_executor',
      'agent_binding',
      'C:/repo',
      'maker-agent',
      { agent_role: 'maker' },
    );
  });

  it('resolves exact role-specific ExternalExecutor bindings before falling back to the default role', async () => {
    const repo = createRepo();
    repo.findApproved
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({
        permission_id: 'perm-default',
        metadata: {},
      });
    const service = new PermissionService(repo as any);

    const result = await service.findApprovedExternalExecutorBinding('C:/repo', 'default');

    expect(repo.findApproved).toHaveBeenNthCalledWith(
      1,
      'external_executor',
      'agent_binding',
      'C:/repo',
      { agent_role: 'default' },
    );
    expect(repo.findApproved).toHaveBeenNthCalledWith(
      2,
      'external_executor',
      'agent_binding',
      'C:/repo',
      undefined,
    );
    expect(result).toEqual(
      expect.objectContaining({
        permission_id: 'perm-default',
      }),
    );
  });

  it('passes tenant metadata when resolving ExternalExecutor bindings for a tenant-scoped runtime', async () => {
    const repo = createRepo();
    const service = new PermissionService(repo as any);

    await service.findApprovedExternalExecutorBinding('C:/repo', 'reviewer', {
      tenant_id: 'discord:guild:guild-1',
    });

    expect(repo.findApproved).toHaveBeenCalledWith(
      'external_executor',
      'agent_binding',
      'C:/repo',
      {
        agent_role: 'reviewer',
        tenant_id: 'discord:guild:guild-1',
      },
    );
  });

  it('defaults workspace access permissions to read-only metadata', async () => {
    const repo = createRepo();
    const service = new PermissionService(repo as any);

    await service.createRequest({
      task_id: 'task-2',
      executor: 'file_delivery',
      kind: 'workspace_access',
      workspace: 'C:/repo',
      requested_value: 'C:/fora',
      resolved_value: 'C:/fora',
      reason: 'needs to list folder',
    });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          access_level: 'read_only',
          policy_family: 'scoped_file_read',
        }),
      }),
    );
  });

  it('stores command access rules with prefix match when requested', async () => {
    const repo = createRepo();
    const service = new PermissionService(repo as any);

    await service.grantPolicy({
      executor: 'codex',
      kind: 'command_access',
      scope: 'persistent',
      workspace: 'C:/repo',
      requested_value: 'npm run *',
      resolved_value: 'npm run *',
      reason: 'manual command policy',
      metadata: {
        match_type: 'prefix',
      },
    });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          match_type: 'prefix',
        }),
      }),
    );
  });
});
