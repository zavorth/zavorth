import { buildDashboardCommandCenterViewModel } from '../../../src/ai-gateway/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterAdapter.js';
import { buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(dashboard)/control/command-center/projections/zavorthAgentGatewayRuntimeProjection.js';
import {
  ProviderArenaService,
  ZavorthAgentGateway,
  type UniversalAgentRun,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-provider-arena-${++index}`;
}

function createRun(): UniversalAgentRun {
  return {
    id: 'run-cc-provider-arena',
    traceId: 'trace-cc-provider-arena',
    requestId: 'request-cc-provider-arena',
    sessionId: 'session-cc-provider-arena',
    userId: 'grey',
    channel: 'web',
    title: 'Provider Arena',
    input: 'compare provider',
    status: 'completed',
    createdAt: '2026-05-03T23:59:00.000Z',
    updatedAt: '2026-05-03T23:59:00.000Z',
    summary: 'Provider arena ready.',
    events: [],
    toolExposure: {
      mode: 'safe',
      summary: 'safe',
      tools: [],
    },
    replyPorts: [],
    modelProfile: {
      providerLabel: 'AI Gateway',
      modelLabel: 'Claude Sonnet 4.5',
      routingPolicy: 'gateway',
      routeId: 'aigateway',
      ready: true,
    },
    approvals: [],
    artifacts: [],
    memorySignals: [],
    metadata: {
      runBudget: {
        source: 'RunBudgetPolicy',
        degraded: false,
        estimatedCostUnits: 2,
        maxEstimatedCostUnits: 10,
      },
      llmRuntimeRoute: {
        source: 'LlmRuntimeService',
        requestedProviderName: 'aigateway',
        primaryProviderName: 'aigateway',
        providerName: 'aigateway',
        modelName: 'claude-sonnet-4.5',
        fallbackAllowed: true,
        fallbackUsed: false,
        providerChain: ['aigateway', 'openai'],
        attempts: [
          {
            providerName: 'aigateway',
            modelName: 'claude-sonnet-4.5',
            status: 'succeeded',
            fallback: false,
          },
        ],
        request: {
          messageCount: 1,
          toolCount: 0,
          inputChars: 16,
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
        budget: {
          source: 'RunBudgetPolicy',
          degraded: false,
          estimatedCostUnits: 2,
          maxEstimatedCostUnits: 10,
        },
      },
    },
  };
}

describe('Command Center Provider Arena Wave 34', () => {
  it('projects providerArena metadata into the dashboard view model', () => {
    const run = createRun();
    run.metadata.providerArena = new ProviderArenaService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    const viewModel = buildDashboardCommandCenterViewModel({
      runtime: {
        status: 'ready',
      },
      wsStatus: 'connected',
      agentRun: {
        id: run.id,
        status: 'completed',
        metadata: run.metadata,
      },
    });

    expect(viewModel.providerArena).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.wave-34',
      summary: expect.objectContaining({
        hasProviderEvidence: true,
        decisionSource: 'learned',
      }),
      policy: expect.objectContaining({
        noProviderExecutionPerformed: true,
        doesNotOverrideModelPicker: true,
      }),
    }));
    expect(viewModel.providerArena?.candidates[0]).toEqual(expect.objectContaining({
      providerLabel: 'aigateway',
      healthStatus: 'healthy',
    }));
  });

  it('maps gateway snapshots with Provider Arena into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-04T00:01:00.000Z'),
      idFactory: createIdFactory(),
      executor: ({ run }) => ({
        status: 'completed',
        summary: 'ok',
        replyText: 'ok',
        metadata: {
          llmRuntimeRoute: {
            source: 'LlmRuntimeService',
            requestedProviderName: 'aigateway',
            primaryProviderName: 'aigateway',
            providerName: 'aigateway',
            modelName: 'claude-sonnet-4.5',
            fallbackAllowed: true,
            fallbackUsed: false,
            providerChain: ['aigateway', 'openai'],
            attempts: [
              {
                providerName: 'aigateway',
                modelName: 'claude-sonnet-4.5',
                status: 'succeeded',
                fallback: false,
              },
            ],
            request: {
              messageCount: 1,
              toolCount: 0,
              inputChars: run.input.length,
            },
          },
        },
      }),
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-provider-arena-live',
      text: 'compare provider',
      modelProfile: {
        providerLabel: 'AI Gateway',
        modelLabel: 'Claude Sonnet 4.5',
        routingPolicy: 'gateway',
        routeId: 'aigateway',
        ready: true,
      },
    });
    const projection = buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.providerArena).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.wave-34',
      summary: expect.objectContaining({
        routeObserved: true,
        budgetObserved: true,
      }),
      policy: expect.objectContaining({
        noProviderExecutionPerformed: true,
      }),
    }));
    expect(projection.providerArena?.comparison.decisionSource).toBe('learned');
  });
});
