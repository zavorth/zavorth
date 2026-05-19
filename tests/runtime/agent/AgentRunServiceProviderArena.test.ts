import {
  AgentRunService,
  PROVIDER_ARENA_CONTRACT_VERSION,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-provider-arena-${++index}`;
}

describe('AgentRunService Provider Arena Provider Arena', () => {
  it('attaches providerArena after LLM route correlation and run budget', async () => {
    const service = new AgentRunService({
      now: () => new Date('2026-05-03T23:58:00.000Z'),
      idFactory: createIdFactory(),
      executor: ({ run }) => ({
        status: 'completed',
        summary: 'Resposta com rota observada.',
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
                durationMs: 900,
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

    const result = await service.run({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-agent-provider-arena',
      text: 'compare rota do provider',
      modelProfile: {
        providerLabel: 'AI Gateway',
        modelLabel: 'Claude Sonnet 4.5',
        routingPolicy: 'gateway',
        routeId: 'aigateway',
        ready: true,
      },
    });

    const snapshot = result.run.metadata.providerArena as any;
    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: PROVIDER_ARENA_CONTRACT_VERSION,
      summary: expect.objectContaining({
        routeObserved: true,
        budgetObserved: true,
        decisionSource: 'learned',
      }),
      policy: expect.objectContaining({
        noProviderExecutionPerformed: true,
        usesRunObservatoryReceipts: true,
        doesNotOverrideModelPicker: true,
      }),
    }));
    expect(result.run.metadata.providerRouteBudgetCorrelation).toEqual(expect.objectContaining({
      source: 'AgentRunService',
      providerName: 'aigateway',
    }));
    expect(snapshot.candidates[0]).toEqual(expect.objectContaining({
      providerLabel: 'aigateway',
      healthStatus: 'healthy',
    }));
  });
});
