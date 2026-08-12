import { ZavorthTenantGovernanceActionService } from '../../src/services/ZavorthTenantGovernanceActionService';

describe('ZavorthTenantGovernanceActionService', () => {
  const tenantSnapshot = {
    generatedAt: '2026-04-03T17:00:00.000Z',
    summary: {
      total: 1,
      shared: 1,
      personal: 0,
      pendingOnboarding: 1,
      publicServers: 1,
      readyShared: 0,
      restrictedShared: 0,
      byPlatform: { discord: 1 },
    },
    tenants: [
      {
        tenantId: 'discord-public',
        platform: 'discord',
        scopeId: 'discord:1489',
        sessionId: null,
        sourceUserId: '956',
        runtimeUserId: '1',
        guildId: '1489',
        channelId: null,
        threadId: null,
        actions: [
          {
            id: 'start-onboarding-review',
            label: 'Abrir review de onboarding',
            description: 'Dispara um workflow de review para fechar onboarding e policy do tenant.',
            command: '/workflow review Fechar onboarding do tenant discord-public',
            actionKind: 'guided',
            emphasis: 'primary',
          },
          {
            id: 'review-teams',
            label: 'Revisar /teams',
            description: 'Confere quais workflows compostos podem operar nesta superficie.',
            command: '/teams',
            actionKind: 'guided',
            emphasis: 'primary',
          },
          {
            id: 'review-runtime',
            label: 'Revisar /runtime',
            description: 'Confere posture, fail-closed e sinais do runtime principal.',
            command: '/runtime',
            actionKind: 'guided',
            emphasis: 'secondary',
          },
          {
            id: 'review-memoryplane',
            label: 'Revisar /memoryplane',
            description: 'Retoma contexto, entregas e memorias ligadas a este tenant.',
            command: '/memoryplane',
            actionKind: 'guided',
            emphasis: 'secondary',
          },
          {
            id: 'review-sessions',
            label: 'Revisar /sessions',
            description: 'Abre o session plane para retomadas e handoffs ligados ao tenant.',
            command: '/sessions',
            actionKind: 'guided',
            emphasis: 'secondary',
          },
        ],
      },
    ],
    pendingOnboarding: [],
    featuredRecipes: [],
    narrative: {
      headline: 'Governanca de tenants com 1 tenant(s) observado(s).',
      operatorSummary: '1 pending onboarding.',
      nextAction: 'Revisar teams.',
    },
  } as any;

  it('reviews teams for a tenant and returns updated snapshots', async () => {
    const service = new ZavorthTenantGovernanceActionService({
      tenantGovernanceService: {
        buildSnapshot: jest.fn(() => tenantSnapshot),
      } as any,
      teamCatalogService: {
        buildSnapshot: jest.fn(() => ({
          summary: { total: 2 },
          teams: [{ id: 'ship' }],
        })),
      } as any,
    });

    const result = await service.execute({
      actionId: 'review-teams',
      tenantId: 'discord-public',
      workspace: 'C:/repo',
    });

    expect(result.action).toEqual(
      expect.objectContaining({
        actionId: 'review-teams',
        tenantId: 'discord-public',
        command: '/teams',
        targetPanel: 'inspector-panel',
      }),
    );
    expect(result.tenantGovernance).toBe(tenantSnapshot);
    expect(result.teams).toEqual(
      expect.objectContaining({
        teams: expect.arrayContaining([
          expect.objectContaining({ id: 'ship' }),
        ]),
      }),
    );
  });

  it('reviews runtime/security for a tenant and returns both snapshots', async () => {
    const service = new ZavorthTenantGovernanceActionService({
      tenantGovernanceService: {
        buildSnapshot: jest.fn(() => tenantSnapshot),
      } as any,
      runtimeModesService: {
        buildSnapshot: jest.fn(() => ({
          summary: { total: 4 },
        })),
      } as any,
      securityMeshService: {
        buildSnapshot: jest.fn(() => ({
          posture: { label: 'Guarded' },
        })),
      } as any,
    });

    const result = await service.execute({
      actionId: 'review-runtime',
      tenantId: 'discord-public',
    });

    expect(result.action).toEqual(
      expect.objectContaining({
        actionId: 'review-runtime',
        command: '/runtime',
      }),
    );
    expect(result.runtimeModes).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({ total: 4 }),
      }),
    );
    expect(result.securityMesh).toEqual(
      expect.objectContaining({
        posture: expect.objectContaining({ label: 'Guarded' }),
      }),
    );
  });

  it('reviews the memory plane for a tenant and returns a workspace-focused payload', async () => {
    const buildSnapshot = jest.fn(async () => ({
      summary: { persistedMemories: 3 },
      narrative: { headline: 'Retomada pronta.' },
    }));
    const service = new ZavorthTenantGovernanceActionService({
      tenantGovernanceService: {
        buildSnapshot: jest.fn(() => tenantSnapshot),
      } as any,
      memoryPlaneService: {
        buildSnapshot,
      } as any,
      runtimeUserId: '1',
    });

    const result = await service.execute({
      actionId: 'review-memoryplane',
      tenantId: 'discord-public',
      workspace: 'C:/repo',
    });

    expect(buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '1',
        platform: 'discord',
        chatId: 'discord:1489',
        sessionId: null,
        sourceUserId: '956',
        workspaceHint: 'C:/repo',
      }),
    );
    expect(result.action).toEqual(
      expect.objectContaining({
        actionId: 'review-memoryplane',
        command: '/memoryplane',
        targetPanel: 'workspace-panel',
        targetWorkspaceView: 'history',
      }),
    );
    expect(result.memoryPlane).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({ persistedMemories: 3 }),
      }),
    );
  });

  it('reviews the session plane for a tenant and returns a workspace-focused payload', async () => {
    const buildSnapshot = jest.fn(async () => ({
      summary: { sessions: 4 },
      narrative: { headline: 'Session plane ready.' },
    }));
    const service = new ZavorthTenantGovernanceActionService({
      tenantGovernanceService: {
        buildSnapshot: jest.fn(() => tenantSnapshot),
      } as any,
      sessionPlaneService: {
        buildSnapshot,
      } as any,
      runtimeUserId: '1',
    });

    const result = await service.execute({
      actionId: 'review-sessions',
      tenantId: 'discord-public',
      workspace: 'C:/repo',
    });

    expect(buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '1',
        platform: 'discord',
        chatId: 'discord:1489',
        sessionId: null,
        sourceUserId: '956',
        workspaceHint: 'C:/repo',
        limit: 8,
      }),
    );
    expect(result.action).toEqual(
      expect.objectContaining({
        actionId: 'review-sessions',
        command: '/sessions',
        targetPanel: 'workspace-panel',
        targetWorkspaceView: 'history',
      }),
    );
    expect(result.sessionPlane).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({ sessions: 4 }),
      }),
    );
  });

  it('starts an onboarding review workflow for a tenant', async () => {
    const handleWorkflow = jest.fn(async (_ctx: any, args: string) => {
      expect(args).toBe('review Fechar onboarding do tenant discord-public');
    });
    const service = new ZavorthTenantGovernanceActionService({
      tenantGovernanceService: {
        buildSnapshot: jest.fn(() => tenantSnapshot),
      } as any,
      teamCatalogService: {
        buildSnapshot: jest.fn(() => ({
          summary: { total: 2 },
          teams: [{ id: 'review' }],
        })),
      } as any,
      workflowController: {
        handleWorkflow,
      },
      runtimeUserId: '1',
    });

    const result = await service.execute({
      actionId: 'start-onboarding-review',
      tenantId: 'discord-public',
      workspace: 'C:/repo',
    });

    expect(handleWorkflow).toHaveBeenCalledTimes(1);
    expect(result.action).toEqual(
      expect.objectContaining({
        status: 'started',
        actionId: 'start-onboarding-review',
        command: '/workflow review Fechar onboarding do tenant discord-public',
      }),
    );
    expect(result.teams).toEqual(
      expect.objectContaining({
        teams: expect.arrayContaining([
          expect.objectContaining({ id: 'review' }),
        ]),
      }),
    );
  });
});
