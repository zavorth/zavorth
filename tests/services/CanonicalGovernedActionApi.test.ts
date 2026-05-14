import { CanonicalPublicApiService } from '../../src/api/public/CanonicalPublicApiService';

function baseRuntime(overrides: Record<string, any> = {}) {
  return {
    getRuntime: () => ({}),
    getGateway: () => null,
    getSessionPlane: () => null,
    getNodeMesh: () => null,
    getPlatformRegistry: () => null,
    getRemoteTransports: () => null,
    getOperationsHealth: () => null,
    getLearningPlane: () => null,
    getLayeredMemory: () => null,
    ...overrides,
  } as any;
}

function permissionFixture(status: 'pending' | 'approved' | 'rejected' = 'pending') {
  return {
    permission_id: 'perm-1',
    created_at: '2026-05-14T00:00:00.000Z',
    updated_at: '2026-05-14T00:00:00.000Z',
    task_id: 'task-1',
    executor: 'runtime',
    kind: 'tool',
    status,
    scope: 'once',
    workspace: null,
    requested_value: 'write src/index.ts',
    resolved_value: null,
    reason: 'Needs a scoped approval.',
    requested_by: 'agent',
    decided_by: status === 'pending' ? null : 'user-1',
    decision_note: null,
    metadata: {},
  };
}

describe('Canonical governed action API', () => {
  it('approves and denies approvals through PermissionService with Policy Broker receipts', async () => {
    const permission = permissionFixture();
    const permissionService = {
      listRequests: jest.fn(),
      getRequest: jest.fn(async () => permission),
      approveRequest: jest.fn(async () => permissionFixture('approved')),
      rejectRequest: jest.fn(async () => permissionFixture('rejected')),
    };
    const service = new CanonicalPublicApiService(baseRuntime({
      getPermissionService: () => permissionService,
    }));

    const approved = await service.approveApproval({
      approvalId: 'perm-1',
      decidedBy: 'user-1',
    });
    const denied = await service.denyApproval({
      approvalId: 'perm-1',
      decidedBy: 'user-1',
    });

    expect(permissionService.approveRequest).toHaveBeenCalledWith('perm-1', 'user-1', expect.any(Object));
    expect(permissionService.rejectRequest).toHaveBeenCalledWith('perm-1', 'user-1', expect.any(String));
    expect(approved).toEqual(expect.objectContaining({
      surface: 'governed-action-v1',
      status: 'applied',
      safety: expect.objectContaining({
        controllerMutatedDirectly: false,
        policyBrokerEvaluated: true,
      }),
      receipt: expect.objectContaining({
        policyReceipt: expect.objectContaining({
          surface: 'tool',
          operation: 'approval.approve',
        }),
      }),
    }));
    expect(denied).toEqual(expect.objectContaining({
      status: 'denied',
      receipt: expect.objectContaining({
        policyReceipt: expect.objectContaining({
          operation: 'approval.deny',
        }),
      }),
    }));
  });

  it('blocks sensitive channel actions until the API request is explicitly confirmed', async () => {
    const channelActions = {
      execute: jest.fn(async () => ({
        generatedAt: '2026-05-14T00:00:00.000Z',
        channelId: 'telegram',
        actionId: 'logout',
        status: 'applied',
        ok: true,
        summary: 'done',
        details: [],
        selected: null,
        snapshot: {},
      })),
    };
    const service = new CanonicalPublicApiService(baseRuntime({
      getChannelActions: () => channelActions,
    }));

    const blocked = await service.executeChannelAction({
      channelId: 'telegram',
      actionId: 'logout',
      requestedBy: 'user-1',
    });
    const applied = await service.executeChannelAction({
      channelId: 'telegram',
      actionId: 'logout',
      requestedBy: 'user-1',
      approved: true,
    });

    expect(blocked.status).toBe('needs_approval');
    expect(blocked.ok).toBe(false);
    expect(channelActions.execute).toHaveBeenCalledTimes(1);
    expect(applied).toEqual(expect.objectContaining({
      status: 'applied',
      ok: true,
    }));
  });

  it('runs provider tests through the readiness service and records policy receipts', async () => {
    const providerReadiness = {
      buildLiveSnapshot: jest.fn(async () => ({
        schemaVersion: 1,
        surface: 'provider-readiness-matrix',
        status: 'ready',
        summary: { ready: 1 },
        entries: [{ id: 'openai', status: 'ready' }],
      })),
    };
    const service = new CanonicalPublicApiService(baseRuntime({
      getProviderReadiness: () => providerReadiness,
    }));

    const result = await service.testProvider({
      providerId: 'openai',
    });

    expect(providerReadiness.buildLiveSnapshot).toHaveBeenCalledWith({
      providerId: 'openai',
      probe: true,
      live: false,
    });
    expect(result).toEqual(expect.objectContaining({
      surface: 'governed-action-v1',
      status: 'applied',
      receipt: expect.objectContaining({
        policyReceipt: expect.objectContaining({
          surface: 'provider',
          operation: 'provider.test.preview',
        }),
      }),
    }));
  });

  it('cancels missions only through the supervised execution gateway', async () => {
    const gateway = {
      cancelAction: jest.fn(async () => ({
        actionId: 'mission-1',
        status: 'cancelled',
      })),
    };
    const service = new CanonicalPublicApiService(baseRuntime({
      getSupervisedExecutionGateway: () => gateway,
    }));

    const result = await service.cancelMission({
      missionId: 'mission-1',
      requestedBy: 'user-1',
    });

    expect(gateway.cancelAction).toHaveBeenCalledWith({
      actionId: 'mission-1',
      requestedBy: 'user-1',
      reason: 'Cancelled through public API v1.',
    });
    expect(result).toEqual(expect.objectContaining({
      status: 'applied',
      safety: expect.objectContaining({
        controllerMutatedDirectly: false,
      }),
    }));
  });
});
