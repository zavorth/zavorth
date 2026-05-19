import { config } from '../../src/config/index.js';
import { DashboardService } from '../../src/services/DashboardService.js';
import {
  createTestLogRepo,
  fetchDashboardJson,
} from '../helpers/dashboardWebTestUtils.js';

describe('Web app tenant governance endpoint', () => {
  const logRepo = createTestLogRepo();
  const originalWebAuthToken = config.zavorthWebAuthToken;

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
  });

  it('exposes tenant governance on the protected web surface', async () => {
    config.zavorthWebAuthToken = 'checkpoint-5-token';
    const service = new DashboardService(logRepo, {
      tenantGovernanceService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-03T16:15:00.000Z',
          summary: {
            total: 2,
            shared: 1,
            personal: 1,
            pendingOnboarding: 1,
            publicServers: 1,
            readyShared: 0,
            restrictedShared: 0,
            byPlatform: {
              discord: 1,
              web: 1,
            },
          },
          tenants: [
            {
              tenantId: 'discord-public',
              platform: 'discord',
              governanceStatus: 'pending_onboarding',
              scopeLabel: 'guild:1489',
              operatorSummary: 'Tenant publico ainda pede onboarding.',
              nextAction: 'Configurar canais permitidos.',
            },
          ],
          pendingOnboarding: [
            {
              tenantId: 'discord-public',
              platform: 'discord',
              governanceStatus: 'pending_onboarding',
              scopeLabel: 'guild:1489',
              operatorSummary: 'Tenant publico ainda pede onboarding.',
              nextAction: 'Configurar canais permitidos.',
            },
          ],
          featuredRecipes: [
            {
              id: 'recipe:discord-public:public-onboarding',
              tenantId: 'discord-public',
              governanceStatus: 'pending_onboarding',
              label: 'Fechar onboarding do tenant publico',
              summary: 'Mantenha o tenant fail-closed ate owners, allowlists e workflows refletirem o runtime oficial.',
              actions: [
                {
                  id: 'inspect-tenant',
                  label: 'Trazer /tenants',
                  description: 'Carrega o tenant filtrado na surface textual compartilhada.',
                  command: '/tenants discord-public',
                  actionKind: 'guided',
                  emphasis: 'primary',
                },
              ],
            },
          ],
          narrative: {
            headline: 'Governanca de tenants com 2 tenant(s) observado(s).',
            operatorSummary: '1 compartilhado | 1 pendente de onboarding',
            nextAction: 'Fechar onboarding antes de abrir novas superficies.',
          },
        })),
      } as any,
      webUserId: '1',
    });

    await service.start();
    const result = await fetchDashboardJson(service.getUrl(), '/api/web/tenants', {
      token: 'checkpoint-5-token',
    });
    await service.stopAsync();

    expect(result.status).toBe(200);
    expect(result.payload).toEqual(
      expect.objectContaining({
        ok: true,
        tenantGovernance: expect.objectContaining({
          summary: expect.objectContaining({
            total: 2,
            pendingOnboarding: 1,
          }),
          tenants: expect.arrayContaining([
            expect.objectContaining({
              tenantId: 'discord-public',
              governanceStatus: 'pending_onboarding',
            }),
          ]),
          featuredRecipes: expect.arrayContaining([
            expect.objectContaining({
              tenantId: 'discord-public',
              label: 'Fechar onboarding do tenant publico',
            }),
          ]),
          narrative: expect.objectContaining({
            headline: expect.stringContaining('2 tenant(s)'),
          }),
        }),
      }),
    );
  });

  it('executes guided tenant actions through the protected web surface', async () => {
    config.zavorthWebAuthToken = 'checkpoint-5-token';
    const tenantGovernanceActionService = {
      execute: jest.fn(async () => ({
        action: {
          status: 'completed',
          actionId: 'review-runtime',
          tenantId: 'discord-public',
          label: 'Revisar /runtime',
          command: '/runtime',
          note: 'Runtime modes e security mesh atualizados para revisao do tenant.',
          targetPanel: 'inspector-panel',
          targetWorkspaceView: null,
        },
        tenantGovernance: {
          summary: { total: 1 },
          tenants: [{ tenantId: 'discord-public' }],
        },
        teams: null,
        channels: null,
        runtimeModes: {
          summary: { total: 6, coreReady: 3 },
        },
        securityMesh: {
          summary: { totalModes: 6, wasmReady: true },
        },
      })),
    };

    const service = new DashboardService(logRepo, {
      tenantGovernanceActionService: tenantGovernanceActionService as any,
      tenantGovernanceService: {
        buildSnapshot: jest.fn(() => ({
          summary: { total: 1 },
          tenants: [{ tenantId: 'discord-public' }],
          pendingOnboarding: [],
          featuredRecipes: [],
          narrative: {
            headline: 'Governanca de tenants com 1 tenant(s) observado(s).',
            operatorSummary: '1 compartilhado',
            nextAction: 'Revisar runtime.',
          },
        })),
      } as any,
      webUserId: '1',
    });

    await service.start();
    const result = await fetchDashboardJson(service.getUrl(), '/api/web/tenants/actions', {
      token: 'checkpoint-5-token',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId: 'discord-public',
          actionId: 'review-runtime',
        }),
      },
    });
    await service.stopAsync();

    expect(result.status).toBe(200);
    expect(tenantGovernanceActionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'discord-public',
        actionId: 'review-runtime',
      }),
    );
    expect(result.payload).toEqual(
      expect.objectContaining({
        ok: true,
        action: expect.objectContaining({
          actionId: 'review-runtime',
          tenantId: 'discord-public',
        }),
        runtimeModes: expect.objectContaining({
          summary: expect.objectContaining({
            total: 6,
          }),
        }),
        securityMesh: expect.objectContaining({
          summary: expect.objectContaining({
            totalModes: 6,
            wasmReady: true,
          }),
        }),
      }),
    );
  });

  it('executes a guided tenant action on the protected web surface', async () => {
    config.zavorthWebAuthToken = 'checkpoint-5-token';
    const execute = jest.fn(async () => ({
      action: {
        status: 'completed',
        actionId: 'review-teams',
        tenantId: 'discord-public',
        label: 'Revisar /teams',
        command: '/teams',
        note: 'Teams compostos atualizados para o tenant discord-public.',
        targetPanel: 'inspector-panel',
        targetWorkspaceView: null,
      },
      tenantGovernance: {
        generatedAt: '2026-04-03T16:16:00.000Z',
        summary: { total: 1 },
        tenants: [{ tenantId: 'discord-public' }],
        pendingOnboarding: [],
        featuredRecipes: [],
        narrative: {
          headline: 'Governanca de tenants com 1 tenant(s) observado(s).',
          operatorSummary: '1 compartilhado',
          nextAction: 'Revisar teams.',
        },
      },
      teams: {
        summary: { total: 2 },
        teams: [{ id: 'ship' }],
      },
      channels: null,
      runtimeModes: null,
      securityMesh: null,
    }));
    const service = new DashboardService(logRepo, {
      tenantGovernanceActionService: {
        execute,
      } as any,
      webUserId: '1',
    });

    await service.start();
    const result = await fetchDashboardJson(service.getUrl(), '/api/web/tenants/actions', {
      token: 'checkpoint-5-token',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId: 'discord-public',
          actionId: 'review-teams',
        }),
      },
    });
    await service.stopAsync();

    expect(execute).toHaveBeenCalledWith({
      tenantId: 'discord-public',
      actionId: 'review-teams',
      workspace: process.cwd(),
    });
    expect(result.status).toBe(200);
    expect(result.payload).toEqual(
      expect.objectContaining({
        ok: true,
        action: expect.objectContaining({
          actionId: 'review-teams',
          command: '/teams',
        }),
        tenantGovernance: expect.objectContaining({
          tenants: expect.arrayContaining([
            expect.objectContaining({
              tenantId: 'discord-public',
            }),
          ]),
        }),
        teams: expect.objectContaining({
          teams: expect.arrayContaining([
            expect.objectContaining({
              id: 'ship',
            }),
          ]),
        }),
      }),
    );
  });

  it('returns 202 when a tenant action starts a workflow review', async () => {
    config.zavorthWebAuthToken = 'checkpoint-5-token';
    const execute = jest.fn(async () => ({
      action: {
        status: 'started',
        actionId: 'start-onboarding-review',
        tenantId: 'discord-public',
        label: 'Abrir review de onboarding',
        command: '/workflow review Fechar onboarding do tenant discord-public',
        note: 'Workflow de onboarding iniciado para o tenant discord-public.',
        targetPanel: 'inspector-panel',
        targetWorkspaceView: null,
        replies: ['workflow:review Fechar onboarding do tenant discord-public'],
      },
      tenantGovernance: {
        generatedAt: '2026-04-03T16:16:00.000Z',
        summary: { total: 1 },
        tenants: [{ tenantId: 'discord-public' }],
        pendingOnboarding: [],
        featuredRecipes: [],
        narrative: {
          headline: 'Governanca de tenants com 1 tenant(s) observado(s).',
          operatorSummary: '1 compartilhado',
          nextAction: 'Revisar teams.',
        },
      },
      teams: {
        summary: { total: 2 },
        teams: [{ id: 'review' }],
      },
      channels: null,
      runtimeModes: null,
      securityMesh: null,
    }));
    const service = new DashboardService(logRepo, {
      tenantGovernanceActionService: {
        execute,
      } as any,
      webUserId: '1',
    });

    await service.start();
    const result = await fetchDashboardJson(service.getUrl(), '/api/web/tenants/actions', {
      token: 'checkpoint-5-token',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId: 'discord-public',
          actionId: 'start-onboarding-review',
        }),
      },
    });
    await service.stopAsync();

    expect(result.status).toBe(202);
    expect(result.payload).toEqual(
      expect.objectContaining({
        ok: true,
        action: expect.objectContaining({
          status: 'started',
          actionId: 'start-onboarding-review',
        }),
      }),
    );
  });

  it('returns memory and session plane payloads for guided tenant context reviews', async () => {
    config.zavorthWebAuthToken = 'checkpoint-5-token';
    const execute = jest.fn(async ({ actionId }: { actionId: string }) => {
      if (actionId === 'review-memoryplane') {
        return {
          action: {
            status: 'completed',
            actionId: 'review-memoryplane',
            tenantId: 'discord-public',
            label: 'Revisar /memoryplane',
            command: '/memoryplane',
            note: 'Memory plane atualizado para o tenant selecionado.',
            targetPanel: 'workspace-panel',
            targetWorkspaceView: 'history',
          },
          tenantGovernance: {
            summary: { total: 1 },
            tenants: [{ tenantId: 'discord-public' }],
          },
          teams: null,
          channels: null,
          memoryPlane: {
            summary: { persistedMemories: 4 },
            narrative: { headline: 'Retomada pronta.' },
          },
          runtimeModes: null,
          securityMesh: null,
          sessionPlane: null,
        };
      }

      return {
        action: {
          status: 'completed',
          actionId: 'review-sessions',
          tenantId: 'discord-public',
          label: 'Revisar /sessions',
          command: '/sessions',
          note: 'Session plane atualizado para retomadas do tenant.',
          targetPanel: 'workspace-panel',
          targetWorkspaceView: 'history',
        },
        tenantGovernance: {
          summary: { total: 1 },
          tenants: [{ tenantId: 'discord-public' }],
        },
        teams: null,
        channels: null,
        memoryPlane: null,
        runtimeModes: null,
        securityMesh: null,
        sessionPlane: {
          summary: { sessions: 3 },
          narrative: { headline: 'Session plane pronto.' },
        },
      };
    });
    const service = new DashboardService(logRepo, {
      tenantGovernanceActionService: {
        execute,
      } as any,
      webUserId: '1',
    });

    await service.start();
    const memoryResult = await fetchDashboardJson(service.getUrl(), '/api/web/tenants/actions', {
      token: 'checkpoint-5-token',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId: 'discord-public',
          actionId: 'review-memoryplane',
        }),
      },
    });
    const sessionResult = await fetchDashboardJson(service.getUrl(), '/api/web/tenants/actions', {
      token: 'checkpoint-5-token',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId: 'discord-public',
          actionId: 'review-sessions',
        }),
      },
    });
    await service.stopAsync();

    expect(memoryResult.status).toBe(200);
    expect(memoryResult.payload).toEqual(
      expect.objectContaining({
        ok: true,
        action: expect.objectContaining({
          actionId: 'review-memoryplane',
          targetPanel: 'workspace-panel',
          targetWorkspaceView: 'history',
        }),
        memoryPlane: expect.objectContaining({
          summary: expect.objectContaining({
            persistedMemories: 4,
          }),
        }),
      }),
    );
    expect(sessionResult.status).toBe(200);
    expect(sessionResult.payload).toEqual(
      expect.objectContaining({
        ok: true,
        action: expect.objectContaining({
          actionId: 'review-sessions',
          targetPanel: 'workspace-panel',
          targetWorkspaceView: 'history',
        }),
        sessionPlane: expect.objectContaining({
          summary: expect.objectContaining({
            sessions: 3,
          }),
        }),
      }),
    );
  });
});
