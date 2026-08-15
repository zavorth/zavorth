import { SystemOverlordControlService } from '../../src/services/SystemOverlordControlService.js';


describe('SystemOverlordControlService', () => {
  function buildAction(overrides: Record<string, any> = {}) {
    return {
      actionId: overrides.actionId || 'host-action-1',
      runId: null,
      requestedBy: 'operator',
      surface: 'web-overlord',
      createdAt: '2026-04-10T10:00:00.000Z',
      updatedAt: '2026-04-10T10:00:01.000Z',
      status: overrides.status || 'completed',
      request: {
        capability: overrides.capability || 'host.shell',
        profile: 'safe',
        autonomyLevel: 1,
      },
      decision: {
        allowed: true,
        requiresApproval: false,
        reason: 'ok',
        capability: overrides.capability || 'host.shell',
        profile: 'safe',
        requiredProfile: 'safe',
        autonomyLevel: 1,
        requiredAutonomyLevel: 1,
        runtimeTarget: 'host',
        mutating: false,
        blockedReason: null,
      },
      command: 'git status',
      workspace: __dirname,
      stdout: 'ok',
      stderr: null,
      exitCode: 0,
      errorCode: null,
      errorMessage: null,
      rollbackAvailable: false,
      metadata: {},
      ...overrides,
    };
  }

  it('builds a canonical control snapshot with capabilities, adapters and recent action counts', () => {
    const gateway = {
      listActions: jest.fn(() => [
        buildAction({ actionId: 'a-1', status: 'pending_approval', capability: 'desktop.automation' }),
        buildAction({ actionId: 'a-2', status: 'blocked', capability: 'host.install' }),
        buildAction({ actionId: 'a-3', status: 'completed', capability: 'host.shell' }),
        buildAction({ actionId: 'a-4', status: 'timed_out', capability: 'docker.exec' }),
      ]),
      listAdapters: jest.fn(() => [{ id: 'desktop', label: 'Desktop adapter' }]),
      getKillSwitchState: jest.fn(() => ({
        active: false,
        reason: null,
        activatedAt: null,
        activatedBy: null,
        releasedAt: null,
        releasedBy: null,
        activeActionCount: 0,
        cancellableActionCount: 0,
      })),
      execute: jest.fn(),
    };
    const service = new SystemOverlordControlService({ executionGatewayService: gateway as any });

    const snapshot = service.buildSnapshot(4);

    expect(gateway.listActions).toHaveBeenCalledWith(100);
    expect(snapshot.narrative.headline).toBe('System Overlord supervisionado');
    expect(snapshot.summary).toEqual(expect.objectContaining({
      adapters: 1,
      recentActions: 4,
      pendingApprovals: 1,
      blockedActions: 1,
      completedActions: 1,
      failedActions: 0,
      timedOutActions: 1,
      runningActions: 0,
      killSwitchActive: false,
      highestRiskLevel: 'critical',
    }));
    expect(snapshot.profiles.map((entry) => entry.profile)).toEqual(['safe', 'trusted', 'dangerous', 'owner']);
    expect(snapshot.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        capability: 'computer_use.visual_action',
        requiredProfile: 'dangerous',
        approvalRequired: true,
      }),
    ]));
    expect(snapshot.approvalQueue).toEqual([
      expect.objectContaining({
        actionId: 'a-1',
        riskLevel: 'critical',
        requiredProfile: 'safe',
      }),
    ]);
  });

  it('executes actions through the supervised gateway with operator defaults', async () => {
    const action = buildAction({ actionId: 'a-4' });
    const gateway = {
      listActions: jest.fn(() => [action]),
      listAdapters: jest.fn(() => []),
      getKillSwitchState: jest.fn(() => ({
        active: false,
        reason: null,
        activatedAt: null,
        activatedBy: null,
        releasedAt: null,
        releasedBy: null,
        activeActionCount: 0,
        cancellableActionCount: 0,
      })),
      execute: jest.fn(async (input) => buildAction({
        actionId: input.actionId,
        requestedBy: input.requestedBy,
        surface: input.surface,
        request: input,
      })),
    };
    const service = new SystemOverlordControlService({ executionGatewayService: gateway as any });

    const result = await service.executeAction({
      actionId: 'a-4',
      capability: 'host.shell',
      command: 'git status',
    });

    expect(gateway.execute).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'a-4',
      capability: 'host.shell',
      requestedBy: 'operator',
      surface: 'web-overlord',
      profile: 'safe',
      autonomyLevel: 1,
      approved: false,
      dryRun: false,
    }));
    expect(result.action.actionId).toBe('a-4');
    expect(result.snapshot.summary.recentActions).toBe(1);
  });

  it('approves pending actions by upgrading to the required policy boundary', async () => {
    const pending = buildAction({
      actionId: 'approval-1',
      status: 'pending_approval',
      request: {
        capability: 'host.install',
        profile: 'safe',
        autonomyLevel: 1,
        command: 'npm install left-pad',
      },
      decision: {
        allowed: false,
        requiresApproval: true,
        reason: 'A capability host.install exige perfil trusted; perfil atual: safe.',
        capability: 'host.install',
        profile: 'safe',
        requiredProfile: 'trusted',
        autonomyLevel: 1,
        requiredAutonomyLevel: 3,
        runtimeTarget: 'container',
        mutating: true,
        blockedReason: 'profile_upgrade_required',
      },
      command: 'npm install left-pad',
    });
    const gateway = {
      listActions: jest.fn(() => [pending]),
      listAdapters: jest.fn(() => []),
      getKillSwitchState: jest.fn(() => ({
        active: false,
        reason: null,
        activatedAt: null,
        activatedBy: null,
        releasedAt: null,
        releasedBy: null,
        activeActionCount: 0,
        cancellableActionCount: 0,
      })),
      recordApprovalDecision: jest.fn(),
      execute: jest.fn(async (input) => buildAction({
        actionId: input.actionId,
        status: input.dryRun ? 'dry_run' : 'completed',
        request: input,
        decision: {
          ...pending.decision,
          allowed: true,
          requiresApproval: false,
          profile: input.profile,
          autonomyLevel: input.autonomyLevel,
        },
      })),
    };
    const service = new SystemOverlordControlService({ executionGatewayService: gateway as any });

    const result = await service.decideApproval({
      actionId: 'approval-1',
      decision: 'approve',
      requestedBy: 'alice',
      reason: 'ok',
      dryRun: true,
    });

    expect(gateway.execute).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'approval-1',
      requestedBy: 'alice',
      profile: 'trusted',
      autonomyLevel: 3,
      approved: true,
      dryRun: true,
      metadata: expect.objectContaining({
        approvalDecision: expect.objectContaining({
          decision: 'approve',
          decidedBy: 'alice',
        }),
      }),
    }));
    expect(result.approval.status).toBe('dry_run');
  });

  it('rejects pending actions through an auditable ledger decision', async () => {
    const pending = buildAction({
      actionId: 'approval-2',
      status: 'pending_approval',
      capability: 'desktop.automation',
      decision: {
        allowed: false,
        requiresApproval: true,
        reason: 'Precisa de aprovacao.',
        capability: 'desktop.automation',
        profile: 'safe',
        requiredProfile: 'dangerous',
        autonomyLevel: 1,
        requiredAutonomyLevel: 5,
        runtimeTarget: 'desktop',
        mutating: true,
        blockedReason: 'profile_upgrade_required',
      },
    });
    const rejected = buildAction({
      ...pending,
      status: 'rejected',
      errorCode: 'approval_rejected',
      errorMessage: 'nao agora',
    });
    const gateway = {
      listActions: jest.fn(() => [pending]),
      listAdapters: jest.fn(() => []),
      getKillSwitchState: jest.fn(() => ({
        active: false,
        reason: null,
        activatedAt: null,
        activatedBy: null,
        releasedAt: null,
        releasedBy: null,
        activeActionCount: 0,
        cancellableActionCount: 0,
      })),
      execute: jest.fn(),
      recordApprovalDecision: jest.fn(() => rejected),
    };
    const service = new SystemOverlordControlService({ executionGatewayService: gateway as any });

    const result = await service.decideApproval({
      actionId: 'approval-2',
      decision: 'reject',
      requestedBy: 'alice',
      reason: 'nao agora',
    });

    expect(gateway.recordApprovalDecision).toHaveBeenCalledWith(expect.objectContaining({
      action: pending,
      decision: 'reject',
      requestedBy: 'alice',
      reason: 'nao agora',
    }));
    expect(gateway.execute).not.toHaveBeenCalled();
    expect(result.approval.status).toBe('rejected');
  });

  it('exposes kill switch, cancel and rollback mutations through the control plane', async () => {
    const gateway = {
      listActions: jest.fn(() => [
        buildAction({ actionId: 'running-1', status: 'running', capability: 'docker.exec' }),
        buildAction({ actionId: 'tunnel-1', status: 'completed', capability: 'network.tunnel', rollbackAvailable: true }),
      ]),
      listAdapters: jest.fn(() => []),
      getKillSwitchState: jest.fn(() => ({
        active: true,
        reason: 'maintenance',
        activatedAt: '2026-04-11T12:00:00.000Z',
        activatedBy: 'alice',
        releasedAt: null,
        releasedBy: null,
        activeActionCount: 1,
        cancellableActionCount: 1,
      })),
      execute: jest.fn(),
      recordApprovalDecision: jest.fn(),
      setKillSwitch: jest.fn(async () => ({
        killSwitch: {
          active: true,
          reason: 'maintenance',
          activatedAt: '2026-04-11T12:00:00.000Z',
          activatedBy: 'alice',
          releasedAt: null,
          releasedBy: null,
          activeActionCount: 1,
          cancellableActionCount: 1,
        },
        affectedActions: [buildAction({ actionId: 'running-1', status: 'cancelled' })],
      })),
      cancelAction: jest.fn(async () => buildAction({ actionId: 'running-1', status: 'cancelled' })),
      rollbackAction: jest.fn(async () => buildAction({ actionId: 'rollback-1', capability: 'network.tunnel' })),
    };
    const service = new SystemOverlordControlService({ executionGatewayService: gateway as any });

    const snapshot = service.buildSnapshot(5);
    const killSwitch = await service.setKillSwitch({
      active: true,
      requestedBy: 'alice',
      reason: 'maintenance',
      cancelActive: true,
    });
    const cancelled = await service.cancelAction({
      actionId: 'running-1',
      requestedBy: 'alice',
      reason: 'pare',
    });
    const rollback = await service.rollbackAction({
      actionId: 'tunnel-1',
      requestedBy: 'alice',
      reason: 'desfazer',
    });

    expect(snapshot.summary.killSwitchActive).toBe(true);
    expect(snapshot.summary.runningActions).toBe(1);
    expect(killSwitch.killSwitch.active).toBe(true);
    expect(cancelled.action.status).toBe('cancelled');
    expect(rollback.action.actionId).toBe('rollback-1');
    expect(gateway.setKillSwitch).toHaveBeenCalledWith(expect.objectContaining({
      active: true,
      requestedBy: 'alice',
      cancelActive: true,
    }));
  });
});
