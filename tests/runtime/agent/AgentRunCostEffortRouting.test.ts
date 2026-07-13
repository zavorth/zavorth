import {
  applyCostEffortRouteToLlmOptions,
  classifyAgentRunCostEffortRoute,
} from '../../../src/runtime/agent/AgentRunCostEffortRouting.js';
import type { UniversalAgentRequest, UniversalAgentRun } from '../../../src/runtime/agent/UniversalAgentRuntimeTypes.js';

function makeRun(overrides: Partial<UniversalAgentRun> = {}): UniversalAgentRun {
  return {
    runId: 'run-1',
    sessionId: 'session-1',
    userId: 'user-1',
    channel: 'web',
    status: 'running',
    createdAt: '2026-07-12T00:00:00.000Z',
    updatedAt: '2026-07-12T00:00:00.000Z',
    text: 'hello',
    events: [],
    approvals: [],
    toolExposure: { tools: [] },
    modelProfile: {
      providerLabel: 'zavorth',
      modelLabel: 'current model',
      routingPolicy: 'unknown',
    },
    metadata: {},
    ...overrides,
  } as UniversalAgentRun;
}

function makeRequest(overrides: Partial<UniversalAgentRequest> = {}): UniversalAgentRequest {
  return {
    userId: 'user-1',
    channel: 'web',
    text: 'hello',
    metadata: {},
    ...overrides,
  };
}

describe('AgentRunCostEffortRouting', () => {
  const previousBackgroundModel = process.env.ZAVORTH_BACKGROUND_MODEL;
  const previousBackgroundProvider = process.env.ZAVORTH_BACKGROUND_PROVIDER;

  afterEach(() => {
    if (previousBackgroundModel === undefined) delete process.env.ZAVORTH_BACKGROUND_MODEL;
    else process.env.ZAVORTH_BACKGROUND_MODEL = previousBackgroundModel;
    if (previousBackgroundProvider === undefined) delete process.env.ZAVORTH_BACKGROUND_PROVIDER;
    else process.env.ZAVORTH_BACKGROUND_PROVIDER = previousBackgroundProvider;
  });

  it('classifies useFastModel kernel hints as background', () => {
    const run = makeRun({
      metadata: {
        intentDecision: {
          hints: { useFastModel: true, trivialChat: true },
        },
      },
    });
    const route = classifyAgentRunCostEffortRoute(run, makeRequest());
    expect(route.class).toBe('background');
    expect(route.useFastModel).toBe(true);
  });

  it('maps effort levels to provider reasoning_effort', () => {
    const run = makeRun({
      metadata: { effortLevel: 'ultra' },
    });
    const route = classifyAgentRunCostEffortRoute(run, makeRequest({ text: 'deep review' }));
    expect(route.effortLevel).toBe('ultra-code');
    expect(route.providerReasoningEffort).toBe('xhigh');
    expect(route.class).toBe('premium');
  });

  it('applies background model from env when not user-pinned (empty stack)', () => {
    process.env.ZAVORTH_BACKGROUND_MODEL = 'gemini-2.5-flash';
    process.env.ZAVORTH_BACKGROUND_PROVIDER = 'gemini';

    const run = makeRun({
      metadata: {
        intentDecision: { hints: { useFastModel: true } },
      },
    });
    const route = classifyAgentRunCostEffortRoute(run, makeRequest());
    const options = applyCostEffortRouteToLlmOptions({}, route);

    // Env is user config when stack is empty
    expect(options.costRouteClass).toBe('background');
    if (route.suggestedModelName) {
      expect(options.modelName).toBe('gemini-2.5-flash');
      expect(options.providerName).toBe('gemini');
    }
  });

  it('picks secondary model from user stack for background when no env', () => {
    delete process.env.ZAVORTH_BACKGROUND_MODEL;
    delete process.env.ZAVORTH_BACKGROUND_PROVIDER;
    const { resolveCheapUserStackHop } = require('../../../src/services/llm/UserStackCostRoute.js');
    const pick = resolveCheapUserStackHop({
      selection: {
        providerId: 'ollama',
        modelId: 'llama3.2',
        routeId: null,
        familyId: null,
        secondaryModelId: 'qwen2.5',
        fallbackProviderIds: ['deepseek:deepseek-chat'],
        source: 'preference',
        configured: true,
      },
    });
    expect(pick.modelName).toBe('qwen2.5');
    expect(pick.providerName).toBe('ollama');
    expect(pick.source).toBe('secondary_model');
  });

  it('does not override an explicit user model', () => {
    process.env.ZAVORTH_BACKGROUND_MODEL = 'gemini-2.5-flash';
    const run = makeRun({
      metadata: {
        intentDecision: { hints: { useFastModel: true } },
      },
    });
    const request = makeRequest({
      metadata: { modelName: 'gpt-4o', providerName: 'openai' },
    });
    const route = classifyAgentRunCostEffortRoute(run, request);
    expect(route.userModelPinned).toBe(true);

    const options = applyCostEffortRouteToLlmOptions(
      { modelName: 'gpt-4o', providerName: 'openai' },
      route,
    );
    expect(options.modelName).toBe('gpt-4o');
    expect(options.providerName).toBe('openai');
  });
});
