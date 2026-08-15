import {
  PROVIDER_ARENA_CONTRACT_VERSION,
  ProviderArenaService,
  type UniversalAgentRun,
} from '../../../src/runtime/agent/index.js';

function createRun(overrides: Partial<UniversalAgentRun> = {}): UniversalAgentRun {
  return {
    id: 'run-provider-arena-1',
    traceId: 'trace-provider-arena-1',
    requestId: 'request-provider-arena-1',
    sessionId: 'session-provider-arena-1',
    userId: 'grey',
    channel: 'cli',
    title: 'Provider arena run',
    input: 'compare provider route',
    status: 'completed',
    createdAt: '2026-05-03T23:58:00.000Z',
    updatedAt: '2026-05-03T23:58:00.000Z',
    summary: 'Provider route observed.',
    events: [],
    toolExposure: {
      mode: 'safe',
      summary: 'read-only tools',
      tools: [],
    },
    replyPorts: [],
    modelProfile: {
      providerLabel: 'AI Gateway',
      modelLabel: 'Claude Sonnet 4.5',
      routingPolicy: 'gateway',
      routeId: 'aigateway',
      familyId: 'frontier-coding',
      selectionSource: 'current-config',
      readiness: 'ready',
      ready: true,
      fallbackOrder: ['aigateway', 'openai', 'gemini'],
      selectionExplanation: ['config atual'],
      supportsTools: true,
    },
    approvals: [],
    artifacts: [],
    memorySignals: [],
    metadata: {
      modelPickerSelection: {
        source: 'current-config',
        providerName: 'aigateway',
        providerLabel: 'AI Gateway',
        modelName: 'claude-sonnet-4.5',
        modelLabel: 'Claude Sonnet 4.5',
        routeId: 'aigateway',
        familyId: 'frontier-coding',
        readiness: 'ready',
        ready: true,
        fallbackOrder: ['aigateway', 'openai', 'gemini'],
        explanation: ['config atual'],
      },
      runBudget: {
        source: 'RunBudgetPolicy',
        degraded: false,
        estimatedCostUnits: 2,
        maxEstimatedCostUnits: 10,
        inputChars: 22,
        requestedToolCount: 0,
        exposedToolCount: 0,
      },
      llmRuntimeRoute: {
        source: 'LlmRuntimeService',
        requestedProviderName: 'aigateway',
        primaryProviderName: 'aigateway',
        providerName: 'aigateway',
        modelName: 'claude-sonnet-4.5',
        fallbackAllowed: true,
        fallbackUsed: false,
        providerChain: ['aigateway', 'openai', 'gemini'],
        attempts: [
          {
            providerName: 'aigateway',
            modelName: 'claude-sonnet-4.5',
            status: 'succeeded',
            fallback: false,
            durationMs: 700,
          },
        ],
        request: {
          messageCount: 1,
          toolCount: 0,
          inputChars: 22,
        },
      },
      providerRouteBudgetCorrelation: {
        source: 'AgentRunService',
        routeSource: 'LlmRuntimeService',
        providerName: 'aigateway',
        modelName: 'claude-sonnet-4.5',
        primaryProviderName: 'aigateway',
        requestedProviderName: 'aigateway',
        routingPolicy: 'gateway',
        fallbackUsed: false,
        fallbackAllowed: true,
        providerAttemptCount: 1,
        unavailableProviderCount: 0,
        modelPicker: {
          routeId: 'aigateway',
          source: 'current-config',
          ready: true,
          fallbackOrder: ['aigateway', 'openai', 'gemini'],
        },
        budget: {
          source: 'RunBudgetPolicy',
          degraded: false,
          estimatedCostUnits: 2,
          maxEstimatedCostUnits: 10,
        },
      },
    },
    ...overrides,
  };
}

describe('ProviderArenaService Provider Arena', () => {
  it('builds a read-only provider arena from route, budget and observatory receipts', () => {
    const snapshot = new ProviderArenaService({
      now: () => new Date('2026-05-03T23:59:00.000Z'),
    }).buildSnapshot({
      run: createRun(),
    });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: PROVIDER_ARENA_CONTRACT_VERSION,
      source: 'ProviderArenaService',
      summary: expect.objectContaining({
        hasProviderEvidence: true,
        routeObserved: true,
        budgetObserved: true,
        decisionSource: 'learned',
      }),
      policy: expect.objectContaining({
        noProviderExecutionPerformed: true,
        usesRunObservatoryReceipts: true,
        doesNotOverrideModelPicker: true,
        secretsSerialized: false,
      }),
    }));
    expect(snapshot.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        routeId: 'aigateway',
        providerLabel: 'AI Gateway',
        ready: true,
        healthStatus: 'healthy',
      }),
      expect.objectContaining({
        routeId: 'openai',
        source: 'fallback',
      }),
    ]));
    expect(snapshot.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'run-observatory',
        observatoryReceiptId: 'receipt:run-provider-arena-1:provider-route',
      }),
      expect.objectContaining({
        kind: 'policy',
      }),
    ]));
  });

  it('surfaces fallback evidence and recommends investigation when primary route fell back', () => {
    const run = createRun({
      metadata: {
        ...createRun().metadata,
        llmRuntimeRoute: {
          source: 'LlmRuntimeService',
          requestedProviderName: 'aigateway',
          primaryProviderName: 'aigateway',
          providerName: 'openai',
          modelName: 'gpt-5.1',
          fallbackAllowed: true,
          fallbackUsed: true,
          providerChain: ['aigateway', 'openai'],
          attempts: [
            {
              providerName: 'aigateway',
              modelName: 'claude-sonnet-4.5',
              status: 'skipped_unavailable',
              fallback: false,
            },
            {
              providerName: 'openai',
              modelName: 'gpt-5.1',
              status: 'succeeded',
              fallback: true,
              durationMs: 1100,
            },
          ],
          request: {
            messageCount: 1,
            toolCount: 0,
            inputChars: 22,
          },
        },
        providerRouteBudgetCorrelation: {
          source: 'AgentRunService',
          routeSource: 'LlmRuntimeService',
          providerName: 'openai',
          modelName: 'gpt-5.1',
          primaryProviderName: 'aigateway',
          requestedProviderName: 'aigateway',
          routingPolicy: 'fallback',
          fallbackUsed: true,
          fallbackAllowed: true,
          providerAttemptCount: 2,
          unavailableProviderCount: 1,
          modelPicker: {
            routeId: 'aigateway',
            source: 'current-config',
            ready: true,
            fallbackOrder: ['aigateway', 'openai'],
          },
          budget: {
            source: 'RunBudgetPolicy',
            degraded: false,
            estimatedCostUnits: 3,
            maxEstimatedCostUnits: 10,
          },
        },
      },
    });
    const snapshot = new ProviderArenaService().buildSnapshot({
      run,
      generatedAt: '2026-05-04T00:00:00.000Z',
    });

    expect(snapshot.summary.fallbackUsed).toBe(true);
    expect(snapshot.policy.fallbackVisible).toBe(true);
    expect(snapshot.nextSafeAction).toContain('the primary provider');
    expect(snapshot.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        routeId: 'openai',
        healthStatus: 'healthy',
      }),
    ]));
  });
});
