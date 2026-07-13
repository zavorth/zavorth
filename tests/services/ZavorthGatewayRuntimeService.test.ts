import {
  ZavorthGatewayRuntimeService,
  GATEWAY_CONTROL_API_CONTRACT_VERSION,
} from '../../src/services/ZavorthGatewayRuntimeService.js';
import { GATEWAY_CONTROL_OPERATION_CONTRACTS } from '../../src/zavorth-control/app/api/gateway-control/gatewayControlRouteSupport.js';

describe('ZavorthGatewayRuntimeService', () => {
  it('builds a canonical runtime snapshot from shared runtime and gateway infrastructure', async () => {
    const auth = {
      getStatus: jest.fn(() => ({
        enabled: true,
        source: 'env',
        tokenFile: 'C:/tmp/token.txt',
      })),
    } as any;
    const gateway = {
      buildHydratedSnapshot: jest.fn(async () => ({
        generatedAt: '2026-04-12T14:00:00.000Z',
        summary: { channelsReady: 2, sessionTargets: 1 },
        narrative: { headline: 'Gateway', operatorSummary: 'Gateway ready.' },
      })),
      buildShellSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-12T14:00:00.000Z',
        summary: { channelsReady: 2, sessionTargets: 0 },
        narrative: { headline: 'Gateway shell', operatorSummary: 'Gateway shell pronto.' },
      })),
    } as any;
    const gatewayChannelRegistry = {
      setRuntimeAdapters: jest.fn(),
    } as any;
    const infrastructure = {
      ensureSurfaceDispatcher: jest.fn((runtime: any) => ({
        ...runtime,
        surfaceTaskDispatcher: runtime.surfaceTaskDispatcher || { dispatchTaskMessage: jest.fn() },
      })),
      buildRealtimeInfrastructure: jest.fn((runtime: any) => ({
        runtime,
        realtime: {
          getChatId: jest.fn((sessionId: string) => `web:${sessionId}`),
          buildBusSnapshot: jest.fn(() => ({
            transport: 'sse',
            pollIntervalMs: 2000,
            sessionsTracked: 1,
            listenersAttached: 2,
            activeSessionIds: ['session-1'],
          })),
        },
        gatewaySessionStore: { kind: 'store' },
        gatewaySessionService: { kind: 'service' },
        gatewaySessionReadModel: { kind: 'read-model' },
        gatewayChannelRegistry,
        gatewayChannelRouter: { kind: 'router' },
      })),
      buildRuntimeGatewayInfrastructure: jest.fn(() => ({
        gateway,
        memoryPlane: { kind: 'memory-plane' },
        sessionPlane: { kind: 'session-plane' },
        sessionTools: { kind: 'session-tools' },
        gatewaySessionTools: { kind: 'gateway-session-tools' },
        toolSurface: { kind: 'tool-surface' },
      })),
    } as any;

    const service = new ZavorthGatewayRuntimeService(auth, infrastructure);
    service.attachRuntime({
      webUserId: 'telegram-admin',
    } as any);
    service.attachOperations({
      runtimeChannelAdapters: [{ id: 'telegram' }] as any,
      channelMesh: { buildSnapshot: jest.fn() } as any,
    });

    const snapshot = await service.buildCanonicalSnapshot({
      sessionId: 'session-1',
      chatId: 'web:session-1',
      userId: 'telegram-admin',
    });

    expect(infrastructure.buildRuntimeGatewayInfrastructure).toHaveBeenCalled();
    expect(gatewayChannelRegistry.setRuntimeAdapters).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'telegram' })]),
    );
    expect(snapshot.health).toEqual(
      expect.objectContaining({
        status: 'ready',
        runtimeAttached: true,
        realtimeAttached: true,
        gatewayAvailable: true,
        sessionPlaneAvailable: true,
        gatewaySource: 'runtime',
      }),
    );
    expect(snapshot.sessionBus).toEqual(
      expect.objectContaining({
        transport: 'sse',
        sessionsTracked: 1,
      }),
    );
    expect(snapshot.controlPlane).toEqual(
      expect.objectContaining({
        preferredTransport: 'ws',
        websocketPath: '/api/web/gateway/ws',
        ssePath: '/api/web/events',
      }),
    );
    expect(snapshot.gateway).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          channelsReady: 2,
        }),
      }),
    );
    expect(gateway.buildHydratedSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        chatId: 'web:session-1',
        userId: 'telegram-admin',
      }),
    );
  });

  it('builds a redacted Gateway Control API snapshot over existing provider and AIGateway services', () => {
    const auth = {
      getStatus: jest.fn(() => ({
        enabled: false,
        source: 'disabled',
        tokenFile: null,
      })),
    } as any;
    const providerControlPlane = {
      listProviders: jest.fn(() => [
        {
          id: 'openai',
          kind: 'provider',
          label: 'OpenAI',
          effectiveProviderName: 'openai',
          aliases: [],
          visibility: 'public',
          mode: 'cloud',
          summary: 'Provider cloud.',
          currentModel: 'gpt-4o',
          requirements: ['OPENAI_API_KEY'],
          readiness: 'ready',
          ready: true,
          issue: null,
          apiKey: 'sk-test-secret',
          nested: {
            accessToken: 'token-secret',
          },
        },
        {
          id: 'AIGateway',
          kind: 'provider',
          label: 'AIGateway',
          effectiveProviderName: 'AIGateway',
          aliases: [],
          visibility: 'public',
          mode: 'hybrid',
          summary: 'Rota local.',
          currentModel: 'qwen-coder',
          requirements: ['AIGateway_BASE_URL'],
          readiness: 'needs_probe',
          ready: false,
          issue: 'Precisa de probe no runtime.',
        },
      ]),
      listProfiles: jest.fn(() => [
        {
          id: 'coding',
          label: 'Coding',
          summary: 'Coding profile.',
          preferredOrder: ['openai'],
          secret: 'profile-secret',
        },
      ]),
      getCurrentConversationalProvider: jest.fn(() => 'openai'),
      getCurrentConversationalModel: jest.fn(() => 'gpt-4o'),
      getCurrentModelForProvider: jest.fn((providerName: string) => providerName === 'openai' ? 'gpt-4o' : 'qwen-coder'),
      resolveSelection: jest.fn(() => null),
      resolveProfileSelection: jest.fn(() => null),
    } as any;
    const aiGatewayGateway = {
      readStatus: jest.fn(() => ({
        enabled: true,
        ready: true,
        running: true,
        pid: 4512,
        host: '127.0.0.1',
        port: 21128,
        baseUrl: 'http://127.0.0.1:21128/v1',
        upstreamBaseUrl: 'http://127.0.0.1:20128/v1',
        localOnly: true,
        overlayFile: 'C:/repo/config/AIGateway-overlay.json',
        checkedAt: '2026-04-27T12:00:00.000Z',
        message: 'Gateway proprio do AIGateway ativo.',
      })),
    } as any;
    const service = new ZavorthGatewayRuntimeService(auth);

    service.attachOperations({
      providerControlPlane,
      aiGatewayGateway,
    });

    const snapshot = service.buildGatewayControlApiSnapshot({
      includeAdvancedProviders: true,
    });
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.contractVersion).toBe(GATEWAY_CONTROL_API_CONTRACT_VERSION);
    expect(snapshot.boundary).toEqual(expect.objectContaining({
      currentCut: 'P2-006h',
    }));
    expect(snapshot.health).toEqual(expect.objectContaining({
      status: 'ready',
      providerControlPlaneAttached: true,
      lastHealthyProvider: 'openai',
    }));
    expect(snapshot.providers.summary).toEqual(expect.objectContaining({
      total: 2,
      ready: 1,
      needsProbe: 1,
    }));
    expect((snapshot.providers.entries[0] as any).apiKey).toBe('[redacted]');
    expect((snapshot.providers.entries[0] as any).nested.accessToken).toBe('[redacted]');
    expect((snapshot.profiles[0] as any).secret).toBe('[redacted]');
    expect(snapshot.models.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        providerId: 'openai',
        model: 'gpt-4o',
        modality: 'chat',
      }),
    ]));
    expect(snapshot.modelPicker).toEqual(expect.objectContaining({
      schemaVersion: 1,
      selected: expect.objectContaining({
        providerLabel: 'OpenAI',
        modelLabel: 'gpt-4o',
        source: 'current-config',
      }),
    }));
    expect(snapshot.combos).toEqual(expect.objectContaining({
      status: 'delegated',
      sourceRoutes: expect.arrayContaining(['/api/combos/test']),
    }));
    expect(snapshot.cache).toEqual(expect.objectContaining({
      status: 'delegated',
      sourceRoutes: expect.arrayContaining(['/api/cache/stats']),
    }));
    expect(snapshot.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'providers.list',
        method: 'GET',
        path: '/api/gateway-control/providers',
        requiresApproval: false,
      }),
      expect.objectContaining({
        id: 'models.list',
        method: 'GET',
        path: '/api/gateway-control/models',
        requiresApproval: false,
      }),
      expect.objectContaining({
        id: 'health.read',
        method: 'GET',
        path: '/api/gateway-control/health',
        requiresApproval: false,
      }),
      expect.objectContaining({
        id: 'combos.list',
        method: 'GET',
        path: '/api/gateway-control/combos',
        requiresApproval: false,
      }),
      expect.objectContaining({
        id: 'cache.stats',
        method: 'GET',
        path: '/api/gateway-control/cache',
        requiresApproval: false,
      }),
      expect.objectContaining({
        id: 'rate-limits.list',
        method: 'GET',
        path: '/api/gateway-control/rate-limits',
        requiresApproval: false,
      }),
      expect.objectContaining({
        id: 'providers.test',
        risk: 'sensitive',
        requiresApproval: true,
      }),
      expect.objectContaining({
        id: 'cache.invalidate',
        path: '/api/gateway-control/cache/invalidate',
        risk: 'write',
        requiresApproval: true,
      }),
      expect.objectContaining({
        id: 'rate-limits.toggle',
        path: '/api/gateway-control/rate-limits/toggle',
        risk: 'write',
        requiresApproval: true,
      }),
    ]));
    for (const operation of GATEWAY_CONTROL_OPERATION_CONTRACTS) {
      expect(snapshot.operations).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: operation.id,
          method: operation.method,
          path: operation.publicPath,
          risk: operation.risk,
          requiresApproval: operation.requiresApproval,
          status: operation.status,
          source: operation.source,
        }),
      ]));
    }
    expect(serialized).not.toContain('sk-test-secret');
    expect(serialized).not.toContain('token-secret');
    expect(serialized).not.toContain('profile-secret');
  });

  it('attaches the C8 AI Gateway native hygiene convergence snapshot to the canonical runtime snapshot', async () => {
    const auth = {
      getStatus: jest.fn(() => ({
        enabled: true,
        source: 'env',
        tokenFile: 'C:/tmp/token.txt',
      })),
    } as any;
    const gateway = {
      buildHydratedSnapshot: jest.fn(async () => ({
        generatedAt: '2026-05-03T18:10:00.000Z',
        summary: { channelsReady: 1, sessionTargets: 1 },
        narrative: { headline: 'Gateway', operatorSummary: 'Gateway ready.' },
      })),
      buildShellSnapshot: jest.fn(() => ({
        generatedAt: '2026-05-03T18:10:00.000Z',
        summary: { channelsReady: 1, sessionTargets: 0 },
        narrative: { headline: 'Gateway shell', operatorSummary: 'Gateway shell pronto.' },
      })),
    } as any;
    const infrastructure = {
      ensureSurfaceDispatcher: jest.fn((runtime: any) => ({
        ...runtime,
        surfaceTaskDispatcher: runtime.surfaceTaskDispatcher || { dispatchTaskMessage: jest.fn() },
      })),
      buildRealtimeInfrastructure: jest.fn((runtime: any) => ({
        runtime,
        realtime: {
          getChatId: jest.fn((sessionId: string) => `web:${sessionId}`),
          buildBusSnapshot: jest.fn(() => ({
            transport: 'sse',
            pollIntervalMs: 2000,
            sessionsTracked: 1,
            listenersAttached: 1,
            activeSessionIds: ['session-1'],
          })),
        },
        gatewaySessionStore: { kind: 'store' },
        gatewaySessionService: { kind: 'service' },
        gatewaySessionReadModel: { kind: 'read-model' },
        gatewayChannelRegistry: { setRuntimeAdapters: jest.fn() },
        gatewayChannelRouter: { kind: 'router' },
      })),
      buildRuntimeGatewayInfrastructure: jest.fn(() => ({
        gateway,
        memoryPlane: { kind: 'memory-plane' },
        sessionPlane: { kind: 'session-plane' },
        sessionTools: { kind: 'session-tools' },
        gatewaySessionTools: { kind: 'gateway-session-tools' },
        toolSurface: { kind: 'tool-surface' },
      })),
    } as any;
    const providerControlPlane = {
      listProviders: jest.fn(() => [
        {
          id: 'AIGateway',
          kind: 'provider',
          label: 'AIGateway',
          effectiveProviderName: 'AIGateway',
          aliases: [],
          visibility: 'public',
          mode: 'hybrid',
          summary: 'Rota local.',
          currentModel: 'qwen-coder',
          requirements: ['AIGateway_BASE_URL'],
          readiness: 'ready',
          ready: true,
          issue: null,
        },
      ]),
      listProfiles: jest.fn(() => []),
      getCurrentConversationalProvider: jest.fn(() => 'AIGateway'),
      getCurrentConversationalModel: jest.fn(() => 'qwen-coder'),
      getCurrentModelForProvider: jest.fn(() => 'qwen-coder'),
      resolveSelection: jest.fn(() => null),
      resolveProfileSelection: jest.fn(() => null),
    } as any;
    const aiGatewayGateway = {
      readStatus: jest.fn(() => ({
        enabled: true,
        ready: true,
        running: true,
        pid: 4512,
        host: '127.0.0.1',
        port: 21128,
        baseUrl: 'http://127.0.0.1:21128/v1',
        upstreamBaseUrl: 'http://127.0.0.1:20128/v1',
        localOnly: true,
        overlayFile: null,
        checkedAt: '2026-05-03T18:10:00.000Z',
        message: 'Gateway proprio do AIGateway ativo.',
      })),
    } as any;
    const activeRun = {
      id: 'run-1',
      traceId: 'trace-1',
      requestId: 'request-1',
      sessionId: 'session-1',
      userId: 'grey',
      channel: 'web',
      title: 'Run C8',
      input: 'teste',
      status: 'completed',
      createdAt: '2026-05-03T18:10:00.000Z',
      updatedAt: '2026-05-03T18:10:00.000Z',
      summary: 'Run C8 pronto.',
      events: [],
      toolExposure: { mode: 'safe', summary: 'safe', tools: [] },
      replyPorts: [],
      modelProfile: {
        providerLabel: 'AIGateway',
        modelLabel: 'qwen-coder',
        routingPolicy: 'gateway',
      },
      approvals: [],
      artifacts: [],
      memorySignals: [],
      metadata: {
        adapterSource: 'universal-agent-runtime',
        runBudget: {
          source: 'RunBudgetPolicy',
          degraded: false,
        },
        llmRuntimeRoute: {
          source: 'LlmRuntimeService',
          providerName: 'AIGateway',
          modelName: 'qwen-coder',
          fallbackUsed: false,
          fallbackAllowed: true,
          attempts: [{ providerName: 'AIGateway', status: 'completed' }],
        },
        providerRouteBudgetCorrelation: {
          source: 'AgentRunService',
          providerName: 'AIGateway',
          modelName: 'qwen-coder',
          routingPolicy: 'gateway',
          budget: {
            source: 'RunBudgetPolicy',
            degraded: false,
          },
        },
      },
    };
    const agentGateway = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-05-03T18:10:00.000Z',
        source: {
          kind: 'universal-agent-runtime',
          label: 'Zavorth Agent Gateway',
        },
        activeRun,
        runs: [activeRun],
        runObservatory: {
          generatedAt: '2026-05-03T18:10:00.000Z',
          query: { limit: 50 },
          totalRuns: 1,
          matchedRuns: 1,
          indexes: {
            runIds: ['run-1'],
            traceIds: ['trace-1'],
            sessionIds: ['session-1'],
            statuses: [{ status: 'completed', count: 1 }],
          },
          runs: [{ run: activeRun, matchedBy: ['recent'] }],
        },
        capabilityLoopGovernance: null,
        runtimePromotionGovernance: {
          schemaVersion: 1,
          generatedAt: '2026-05-03T18:10:00.000Z',
          source: 'RuntimePromotionGovernanceService',
          entries: [],
          officialItemIds: [],
          experimentalItemIds: [],
          blockedItemIds: [],
          prohibitedPublicClaims: [],
          summary: 'fixture',
        },
        workflowJobs: [],
        workflowQueue: {
          kind: 'memory',
          status: 'ready',
          queued: 0,
          running: 0,
          waitingApproval: 0,
          failed: 0,
        },
      })),
    } as any;
    const plane = (id: string, compatibilityBoundary: string | null = null) => ({
      id,
      label: id,
      status: 'ready',
      owner: 'shared',
      sourceFiles: [`src/${id}.ts`],
      capabilities: [],
      integrationContract: 'fixture',
      compatibilityBoundary,
      nextIntegrationSteps: [],
      risks: [],
    });
    const agentGatewayHandoff = {
      buildHandoffSnapshot: jest.fn(async () => ({
        version: 'zavorth-agent-gateway-handoff/1',
        generatedAt: '2026-05-03T18:10:00.000Z',
        stage: 'prepared',
        context: {},
        gateway: {},
        runtime: {},
        runtimeHealth: {},
        planes: [
          plane('gateway-core'),
          plane('legacy-pass-through-plane', 'Legacy ingress remains adapter only.'),
          plane('proxy-transport-plane', 'Proxy/SSE remains adapter only.'),
        ],
        checklist: [],
        blockers: [],
        nextIntegrationSteps: [],
        guardrails: [],
      })),
    } as any;
    const service = new ZavorthGatewayRuntimeService(auth, infrastructure);
    service.attachRuntime({
      webUserId: 'grey',
    } as any);
    service.attachOperations({
      providerControlPlane,
      aiGatewayGateway,
      agentGateway,
      agentGatewayHandoff,
    });

    const snapshot = await service.buildCanonicalSnapshot({
      sessionId: 'session-1',
      chatId: 'web:session-1',
      userId: 'grey',
    });

    expect(agentGateway.buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        activeSessionId: 'session-1',
        runLimit: 50,
      }),
    );
    expect(agentGatewayHandoff.buildHandoffSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        chatId: 'web:session-1',
        userId: 'grey',
      }),
    );
    expect(snapshot.aiGatewayConvergence).toEqual(expect.objectContaining({
      schemaVersion: 1,
      stage: 'C8',
      status: 'ready',
      activeRunId: 'run-1',
    }));
    expect(snapshot.aiGatewayConvergence?.acceptance).toEqual(expect.objectContaining({
      aiGatewayNotIsland: true,
      externalCompatibilityContinues: true,
      providerHealthCorrelatesWithRun: true,
      observabilityUsesRunObservatory: true,
    }));
    expect(snapshot.productization).toEqual(expect.objectContaining({
      schemaVersion: 1,
      stage: 'C9',
      cli: expect.objectContaining({
        sameContract: true,
        command: 'zavorth productization --json',
      }),
    }));
  });
});
