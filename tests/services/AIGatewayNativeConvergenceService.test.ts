import {
  AIGatewayNativeConvergenceService,
} from '../../src/services/AIGatewayNativeConvergenceService.js';

const generatedAt = '2026-05-03T18:00:00.000Z';

function createActiveRun() {
  return {
    id: 'run-1',
    traceId: 'trace-1',
    requestId: 'request-1',
    sessionId: 'session-1',
    userId: 'grey',
    channel: 'web',
    title: 'Responder via gateway',
    input: 'teste',
    status: 'completed',
    createdAt: generatedAt,
    updatedAt: generatedAt,
    summary: 'Run completed.',
    events: [],
    toolExposure: {
      mode: 'safe',
      summary: 'Tools seguras.',
      tools: [],
    },
    replyPorts: [],
    modelProfile: {
      providerLabel: 'AIGateway',
      modelLabel: 'qwen-coder',
      routingPolicy: 'gateway',
      routeId: 'AIGateway',
      familyId: 'qwen',
      selectionSource: 'current-config',
      readiness: 'ready',
      ready: true,
      fallbackOrder: ['openai'],
      selectionExplanation: ['Model Picker selecionou AIGateway/qwen-coder.'],
    },
    approvals: [],
    artifacts: [],
    memorySignals: [],
    metadata: {
      adapterSource: 'universal-agent-runtime',
      runBudget: {
        source: 'RunBudgetPolicy',
        degraded: false,
        estimatedCostUnits: 2,
        maxEstimatedCostUnits: 8,
      },
      llmRuntimeRoute: {
        source: 'LlmRuntimeService',
        providerName: 'AIGateway',
        modelName: 'qwen-coder',
        primaryProviderName: 'AIGateway',
        requestedProviderName: 'AIGateway',
        fallbackUsed: false,
        fallbackAllowed: true,
        attempts: [{ providerName: 'AIGateway', status: 'completed' }],
      },
      providerRouteBudgetCorrelation: {
        source: 'AgentRunService',
        providerName: 'AIGateway',
        modelName: 'qwen-coder',
        routingPolicy: 'gateway',
        fallbackUsed: false,
        budget: {
          source: 'RunBudgetPolicy',
          degraded: false,
          estimatedCostUnits: 2,
          maxEstimatedCostUnits: 8,
        },
      },
    },
  };
}

function createAgentGatewaySnapshot() {
  const activeRun = createActiveRun();
  return {
    generatedAt,
    source: {
      kind: 'universal-agent-runtime',
      label: 'Zavorth Agent Gateway',
    },
    activeRun,
    runs: [activeRun],
    runObservatory: {
      generatedAt,
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
      generatedAt,
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
  } as any;
}

function createRuntimeSnapshot() {
  return {
    generatedAt,
    auth: { enabled: true },
    health: {
      status: 'ready',
      runtimeAttached: true,
      operationsAttached: true,
      realtimeAttached: true,
      gatewayAvailable: true,
      sessionPlaneAvailable: true,
      authEnabled: true,
      gatewaySource: 'runtime',
      issues: [],
      summary: 'Gateway runtime ready.',
    },
    gatewayControlApi: {
      ok: true,
      contractVersion: '2026-04-27.p2-006h',
      generatedAt,
      boundary: {
        stableEntry: 'ZavorthGatewayRuntimeService.buildGatewayControlApiSnapshot',
        currentCut: 'gateway-control-apih',
        doNotBypass: [],
      },
      health: {
        status: 'ready',
        providerControlPlaneAttached: true,
        AIGateway: {
          enabled: true,
          ready: true,
          running: true,
          pid: 42,
          host: '127.0.0.1',
          port: 21128,
          baseUrl: 'http://127.0.0.1:21128/v1',
          upstreamBaseUrl: 'http://127.0.0.1:20128/v1',
          localOnly: true,
          overlayFile: null,
          checkedAt: generatedAt,
          message: 'Gateway ready.',
        },
        lastHealthyProvider: 'AIGateway',
        issues: [],
      },
      providers: {
        source: 'provider-control-plane',
        includeAdvanced: true,
        currentProvider: 'AIGateway',
        currentModel: 'qwen-coder',
        summary: {
          total: 2,
          ready: 2,
          needsConfig: 0,
          needsProbe: 0,
        },
        entries: [],
      },
      models: {
        source: 'provider-control-plane',
        entries: [],
      },
      modelPicker: {
        schemaVersion: 1,
        generatedAt,
        families: { schemaVersion: 1, generatedAt, families: [] },
        routes: { schemaVersion: 1, generatedAt, routes: [] },
        profiles: [],
        selected: {
          schemaVersion: 1,
          source: 'current-config',
          providerName: 'AIGateway',
          providerLabel: 'AIGateway',
          modelName: 'qwen-coder',
          modelLabel: 'qwen-coder',
          routeId: 'AIGateway',
          familyId: 'qwen',
          vendorId: 'zavorth',
          providerId: 'aigateway',
          routeKind: 'custom_compatible',
          credentialKind: 'local_endpoint',
          credentialRef: 'AIGateway_BASE_URL',
          catalogSource: 'provider_catalog',
          readiness: 'ready',
          ready: true,
          fallbackOrder: ['openai'],
          fallbackRouteIds: ['openai'],
          capabilities: ['chat', 'coding'],
          modalities: ['text'],
          limitations: [],
          identity: {
            familyId: 'qwen',
            vendorId: 'zavorth',
            providerId: 'aigateway',
            routeId: 'AIGateway',
            routeKind: 'custom_compatible',
            modelId: 'qwen-coder',
            credentialRef: 'AIGateway_BASE_URL',
            credentialKind: 'local_endpoint',
            catalogSource: 'provider_catalog',
          },
          explanation: ['fixture'],
        },
      },
      profiles: [],
      combos: {
        status: 'available',
        sourceRoutes: [],
        entries: [],
        warnings: [],
      },
      cache: {
        status: 'available',
        sourceRoutes: [],
        semanticStats: null,
        warnings: [],
      },
      rateLimits: {
        status: 'available',
        sourceRoutes: [],
        entries: [],
        warnings: [],
      },
      operations: [
        {
          id: 'providers.list',
          method: 'GET',
          path: '/api/gateway-control/providers',
          risk: 'read',
          requiresApproval: false,
          status: 'available',
          source: 'provider-control-plane',
          summary: 'fixture',
        },
      ],
      warnings: [],
    },
    controlPlane: {
      preferredTransport: 'ws',
      availableTransports: ['http', 'sse', 'ws'],
      websocketPath: '/api/web/gateway/ws',
      ssePath: '/api/web/events',
      statePath: '/api/web/state',
      historyPath: '/api/web/gateway/sessions/history',
      sendPath: '/api/web/gateway/sessions/send',
      spawnPath: '/api/web/gateway/sessions/spawn',
      heartbeatIntervalMs: 15000,
      reconnectStrategy: 'reuse-session-state',
      sessionId: 'session-1',
      chatId: 'web:session-1',
    },
    sessionBus: {
      transport: 'sse',
      pollIntervalMs: 2000,
      sessionsTracked: 1,
      listenersAttached: 1,
      activeSessionIds: ['session-1'],
    },
    gateway: {
      generatedAt,
      summary: {
        channelsReady: 1,
        sessionTargets: 1,
      },
      narrative: {
        headline: 'Gateway ready.',
        operatorSummary: 'Gateway ready.',
      },
    },
    aiGatewayConvergence: null,
  } as any;
}

function createHandoffSnapshot() {
  const plane = (id: string, compatibilityBoundary: string | null = null) => ({
    id,
    label: id,
    status: 'ready',
    owner: 'shared',
    sourceFiles: [`src/${id}.ts`],
    capabilities: ['fixture'],
    integrationContract: 'fixture',
    compatibilityBoundary,
    nextIntegrationSteps: [],
    risks: [],
  });

  return {
    version: 'zavorth-agent-gateway-handoff/1',
    generatedAt,
    stage: 'prepared',
    context: {},
    gateway: {},
    runtime: {},
    runtimeHealth: createRuntimeSnapshot().health,
    planes: [
      plane('gateway-core'),
      plane('legacy-pass-through-plane', 'Legacy ingress remains adapter only.'),
      plane('compatible-api-surface', 'Legacy route aliases remain aliases only.'),
      plane('provider-auth-plane', 'OAuth aliases stay isolated.'),
      plane('storage-plane', 'Storage compatibility stays behind adapters.'),
      plane('proxy-transport-plane', 'Proxy/SSE remains transport adapter.'),
      plane('session-control-plane', 'Session compatibility stays bounded.'),
      plane('observability-plane'),
    ],
    checklist: [],
    blockers: [],
    nextIntegrationSteps: [],
    guardrails: [],
  } as any;
}

describe('AIGatewayNativeConvergenceService', () => {
  it('marks C8 ready when AI Gateway is backed by Zavorth-native runtime snapshots', () => {
    const service = new AIGatewayNativeConvergenceService({
      now: () => new Date(generatedAt),
    });

    const snapshot = service.buildSnapshot({
      runtimeSnapshot: createRuntimeSnapshot(),
      agentGatewaySnapshot: createAgentGatewaySnapshot(),
      handoffSnapshot: createHandoffSnapshot(),
    });

    expect(snapshot).toEqual(expect.objectContaining({
      schemaVersion: 1,
      stage: 'C8',
      generatedAt,
      status: 'ready',
      activeRunId: 'run-1',
      activeTraceId: 'trace-1',
      handoffPhase: 'prepared',
    }));
    expect(snapshot.acceptance).toEqual({
      aiGatewayNotIsland: true,
      externalCompatibilityContinues: true,
      internalContractsZavorthNative: true,
      legacyResidueNotCanonical: true,
      providerHealthCorrelatesWithRun: true,
      observabilityUsesRunObservatory: true,
    });
    expect(snapshot.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'gateway-handoff-to-agent-gateway', status: 'ready' }),
      expect.objectContaining({ id: 'provider-plane-model-picker', status: 'ready' }),
      expect.objectContaining({ id: 'control-plane-real-snapshots', status: 'ready' }),
      expect.objectContaining({ id: 'proxy-sse-adapter-boundary', status: 'ready' }),
      expect.objectContaining({ id: 'budget-provider-health-correlation', status: 'ready' }),
      expect.objectContaining({ id: 'run-observatory-integration', status: 'ready' }),
    ]));
    expect(snapshot.externalCompatibility).toEqual(expect.objectContaining({
      transports: ['http', 'sse', 'ws'],
      routes: expect.arrayContaining([
        '/api/web/state',
        '/api/web/events',
        '/api/web/gateway/ws',
      ]),
      operations: ['providers.list'],
    }));
    expect(snapshot.blockers).toEqual([]);
  });

  it('keeps the status partial when the active run has not recorded route and budget correlation yet', () => {
    const agentGatewaySnapshot = createAgentGatewaySnapshot();
    agentGatewaySnapshot.activeRun.metadata = {
      adapterSource: 'universal-agent-runtime',
    };
    const service = new AIGatewayNativeConvergenceService({
      now: () => new Date(generatedAt),
    });

    const snapshot = service.buildSnapshot({
      runtimeSnapshot: createRuntimeSnapshot(),
      agentGatewaySnapshot,
      handoffSnapshot: createHandoffSnapshot(),
    });

    expect(snapshot.status).toBe('partial');
    expect(snapshot.acceptance.providerHealthCorrelatesWithRun).toBe(false);
    expect(snapshot.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'budget-provider-health-correlation',
        status: 'partial',
        blockers: expect.arrayContaining([
          'run.metadata.runBudget missing.',
          'run.metadata.providerRouteBudgetCorrelation missing.',
        ]),
      }),
    ]));
  });
});
