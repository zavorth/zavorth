import {
  applyCostEffortRouteToLlmOptions,
  classifyAgentRunCostEffortRoute,
} from '../../../src/runtime/agent/AgentRunCostEffortRouting';
import type { UniversalAgentRequest, UniversalAgentRun } from '../../../src/runtime/agent/UniversalAgentRuntimeTypes';

function buildRun(metadata: Record<string, unknown>): UniversalAgentRun {
  return {
    id: 'run-1',
    traceId: 'trace-1',
    requestId: 'req-1',
    sessionId: 'session-1',
    userId: 'user-1',
    channel: 'test',
    title: 't',
    input: 'hello',
    workspace: null,
    status: 'running',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    summary: null,
    events: [],
    toolExposure: { mode: 'safe', summary: '', tools: [] },
    replyPorts: [],
    modelProfile: {},
    approvals: [],
    steering: [],
    artifacts: [],
    memorySignals: [],
    metadata,
  } as unknown as UniversalAgentRun;
}

function buildRequest(metadata: Record<string, unknown>): UniversalAgentRequest {
  return {
    text: 'hello',
    metadata,
  } as unknown as UniversalAgentRequest;
}

function withNaturalFirstRoute(budgetHint: string): Record<string, unknown> {
  return {
    naturalFirstRoute: {
      route: 'llm-reply',
      cost: { tier: 'standard', budgetHint, reason: 'test' },
    },
  };
}

describe('AgentRunCostEffortRouting budget hint consumption', () => {
  it('routes minimal-context turns through the background class', () => {
    const run = buildRun(withNaturalFirstRoute('minimal-context'));
    const route = classifyAgentRunCostEffortRoute(run, buildRequest({}));
    expect(route.budgetHint).toBe('minimal-context');
    expect(route.class).toBe('background');
    expect(route.reason).toContain('minimal-context');
  });

  it('keeps governed-runtime turns on the standard route', () => {
    const run = buildRun(withNaturalFirstRoute('governed-runtime'));
    const route = classifyAgentRunCostEffortRoute(run, buildRequest({}));
    expect(route.budgetHint).toBe('governed-runtime');
    expect(route.class).toBe('standard');
  });

  it('never overrides an explicit effort signal with the budget hint', () => {
    const run = buildRun({
      ...withNaturalFirstRoute('minimal-context'),
      effortLevel: 'high',
    });
    const route = classifyAgentRunCostEffortRoute(run, buildRequest({}));
    expect(route.effortLevel).toBe('high');
    expect(route.class).toBe('premium');
  });

  it('ignores unknown budget hints from unstructured metadata', () => {
    const route = classifyAgentRunCostEffortRoute(
      buildRun(withNaturalFirstRoute('turbo-mythical')),
      buildRequest({}),
    );
    expect(route.budgetHint).toBeNull();
    expect(route.class).toBe('standard');
  });

  it('caps provider reasoning effort to low for minimal-context turns without an explicit effort', () => {
    const run = buildRun(withNaturalFirstRoute('minimal-context'));
    const route = classifyAgentRunCostEffortRoute(run, buildRequest({}));
    const options = applyCostEffortRouteToLlmOptions({}, route);
    expect(options.reasoningEffort).toBe('low');
    expect(options.costRouteClass).toBe('background');
  });

  it('preserves a caller-pinned reasoning effort over the minimal-context cap', () => {
    const run = buildRun(withNaturalFirstRoute('minimal-context'));
    const route = classifyAgentRunCostEffortRoute(run, buildRequest({}));
    const options = applyCostEffortRouteToLlmOptions({ reasoningEffort: 'high' }, route);
    expect(options.reasoningEffort).toBe('high');
  });

  it('leaves reasoning effort untouched for non-minimal budget hints', () => {
    const run = buildRun(withNaturalFirstRoute('workspace-context'));
    const route = classifyAgentRunCostEffortRoute(run, buildRequest({}));
    const options = applyCostEffortRouteToLlmOptions({}, route);
    expect(options.reasoningEffort).toBeUndefined();
    expect(options.costRouteClass).toBe('standard');
  });
});
