import {
  RunBudgetPolicy,
} from '../../../src/runtime/agent/index.js';
import type {
  UniversalAgentRequest,
  UniversalAgentRun,
} from '../../../src/runtime/agent/index.js';

function createRequest(overrides: Partial<UniversalAgentRequest> = {}): UniversalAgentRequest {
  return {
    userId: 'grey',
    channel: 'web',
    text: 'pedido curto',
    requestedTools: [],
    metadata: {},
    ...overrides,
  };
}

function createRun(overrides: Partial<UniversalAgentRun> = {}): UniversalAgentRun {
  return {
    id: 'agent-run-1',
    traceId: 'trace-1',
    requestId: 'request-1',
    sessionId: 'session-1',
    userId: 'grey',
    channel: 'web',
    title: 'Run',
    input: 'pedido curto',
    workspace: null,
    status: 'running',
    createdAt: '2026-04-27T12:00:00.000Z',
    updatedAt: '2026-04-27T12:00:00.000Z',
    summary: 'Run recebido.',
    events: [],
    toolExposure: {
      mode: 'safe',
      summary: 'Sem tools.',
      tools: [],
    },
    replyPorts: [],
    modelProfile: {
      providerLabel: 'OpenAI',
      modelLabel: 'gpt-4o',
      routingPolicy: 'gateway',
    },
    approvals: [],
    artifacts: [],
    memorySignals: [],
    metadata: {},
    ...overrides,
  };
}

describe('RunBudgetPolicy', () => {
  it('allows runs that fit the minimum budget', () => {
    const policy = new RunBudgetPolicy({
      maxInputChars: 100,
      maxRequestedTools: 4,
      maxExposedTools: 4,
    });

    const decision = policy.evaluate({
      request: createRequest({
        requestedTools: ['read_file'],
      }),
      run: createRun({
        toolExposure: {
          mode: 'safe',
          summary: 'One tool.',
          tools: [
            {
              id: 'read_file',
              label: 'Read file',
              risk: 'safe',
              requiresApproval: false,
            },
          ],
        },
      }),
    });

    expect(decision).toEqual(expect.objectContaining({
      allowed: true,
      degraded: false,
      reason: null,
    }));
    expect(decision.metadata).toEqual(expect.objectContaining({
      source: 'RunBudgetPolicy',
      requestedToolCount: 1,
      exposedToolCount: 1,
      toolExposureGatedByRunBudget: false,
    }));
  });

  it('degrades before execution when cost metadata exceeds the configured limit', () => {
    const policy = new RunBudgetPolicy({
      maxEstimatedCostUnits: 10,
    });

    const decision = policy.evaluate({
      request: createRequest({
        metadata: {
          estimatedCostUnits: 11,
        },
      }),
      run: createRun(),
    });

    expect(decision).toEqual(expect.objectContaining({
      allowed: false,
      degraded: true,
      reason: 'estimated-cost-too-high',
    }));
    expect(decision.summary).toBe('Run degraded by minimum budget before the executor: estimated-cost-too-high.');
    expect(decision.metadata).toEqual(expect.objectContaining({
      estimatedCostUnits: 11,
      maxEstimatedCostUnits: 10,
      toolExposureGatedByRunBudget: false,
    }));
  });
});
