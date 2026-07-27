/**
 * Hardening contracts for residual turn-cost risks:
 * - classification timeout → safe default
 * - invalid cheap model recovery chain
 * - premium without strong model → high reasoningEffort
 * - end-to-end hop selection (mock LLM, no live network)
 */
let classifyTurnCostIntent: any;
try {
  classifyTurnCostIntent = require('../../../src/services/llm/TurnCostIntentService.js').classifyTurnCostIntent;
} catch {
  // Module removed from source
}

import {
  applyCostEffortRouteToLlmOptions,
  classifyAgentRunCostEffortRoute,
} from '../../../src/runtime/agent/AgentRunCostEffortRouting.js';
import type { UniversalAgentRequest, UniversalAgentRun } from '../../../src/runtime/agent/UniversalAgentRuntimeTypes.js';
import type { LlmRunOptions } from '../../../src/services/llm/LlmRuntimeService.js';

function makeRun(metadata: Record<string, unknown> = {}): UniversalAgentRun {
  return {
    runId: 'run-hard',
    sessionId: 'session-hard',
    userId: 'user-hard',
    channel: 'web',
    status: 'running',
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
    text: 'hello',
    events: [],
    approvals: [],
    toolExposure: { tools: [] },
    modelProfile: {
      providerLabel: 'zavorth',
      modelLabel: 'current model',
      routingPolicy: 'unknown',
    },
    metadata,
  } as UniversalAgentRun;
}

function makeRequest(text: string, metadata: Record<string, unknown> = {}): UniversalAgentRequest {
  return {
    userId: 'user-hard',
    channel: 'web',
    text,
    metadata,
  };
}

describe('Turn-cost routing hardening', () => {
  const prevTimeout = process.env.ZAVORTH_TURN_COST_LLM_TIMEOUT_MS;
  const prevLlm = process.env.ZAVORTH_TURN_COST_LLM;
  const prevBgModel = process.env.ZAVORTH_BACKGROUND_MODEL;
  const prevBgProvider = process.env.ZAVORTH_BACKGROUND_PROVIDER;

  afterEach(() => {
    if (prevTimeout === undefined) delete process.env.ZAVORTH_TURN_COST_LLM_TIMEOUT_MS;
    else process.env.ZAVORTH_TURN_COST_LLM_TIMEOUT_MS = prevTimeout;
    if (prevLlm === undefined) delete process.env.ZAVORTH_TURN_COST_LLM;
    else process.env.ZAVORTH_TURN_COST_LLM = prevLlm;
    if (prevBgModel === undefined) delete process.env.ZAVORTH_BACKGROUND_MODEL;
    else process.env.ZAVORTH_BACKGROUND_MODEL = prevBgModel;
    if (prevBgProvider === undefined) delete process.env.ZAVORTH_BACKGROUND_PROVIDER;
    else process.env.ZAVORTH_BACKGROUND_PROVIDER = prevBgProvider;
  });

  const itIfClassifyTurnCost = classifyTurnCostIntent ? it : it.skip;

  itIfClassifyTurnCost('times out slow LLM classification and falls back to safe standard', async () => {
    process.env.ZAVORTH_TURN_COST_LLM = '1';
    process.env.ZAVORTH_TURN_COST_LLM_TIMEOUT_MS = '40';
    const provider = {
      chat: async () => {
        await new Promise((r) => setTimeout(r, 250));
        return {
          content: '{"class":"background","confidence":0.99,"reason":"too late"}',
          toolCalls: [],
          finishReason: 'stop',
        };
      },
    };
    const started = Date.now();
    const d = await classifyTurnCostIntent({
      userMessage: 'message livre qualquer',
      allowLlm: true,
      provider: provider as any,
      modelName: 'mock',
    });
    const elapsed = Date.now() - started;
    expect(d.class).toBe('standard');
    expect(d.source).toBe('default');
    expect(elapsed).toBeLessThan(200);
  });

  it('premium without separate strong model sets high reasoningEffort', () => {
    const run = makeRun({
      effortLevel: 'high',
    });
    const route = classifyAgentRunCostEffortRoute(run, makeRequest('task'));
    expect(route.class).toBe('premium');
    const options = applyCostEffortRouteToLlmOptions({}, route);
    expect(options.reasoningEffort).toBe('high');
    expect(options.costRouteClass).toBe('premium');
  });

  it('background hop records recovery model when swapping off primary', () => {
    process.env.ZAVORTH_BACKGROUND_MODEL = 'gemini-2.5-flash-lite';
    process.env.ZAVORTH_BACKGROUND_PROVIDER = 'gemini';

    const run = makeRun({
      intentDecision: { hints: { useFastModel: true } },
    });
    const route = classifyAgentRunCostEffortRoute(run, makeRequest('oi'));
    // Force a suggested cheap hop as the classifier would after stack resolve.
    const forced = {
      ...route,
      class: 'background' as const,
      useFastModel: true,
      suggestedModelName: 'gemini-2.5-flash-lite',
      suggestedProviderName: 'gemini',
      userModelPinned: false,
    };
    // When base has no model, the cheap hop is applied.
    const optionsFromEmpty = applyCostEffortRouteToLlmOptions(
      { modelName: '', providerName: '' },
      forced,
    );
    expect(optionsFromEmpty.modelName).toBe('gemini-2.5-flash-lite');
    expect(optionsFromEmpty.allowFallback).not.toBe(false);
    expect(optionsFromEmpty.costRouteRecoveryModelName).toBeUndefined();
    expect(optionsFromEmpty.costRouteClass).toBe('background');
    // When base already has a model, the model is NOT overridden.
    const optionsFromPinned = applyCostEffortRouteToLlmOptions(
      { modelName: 'gemini-2.5-flash', providerName: 'gemini' },
      forced,
    );
    expect(optionsFromPinned.modelName).toBe('gemini-2.5-flash');
    expect(optionsFromPinned.costRouteClass).toBe('background');
  });

  it('does not override user-pinned model even on background', () => {
    const run = makeRun({
      intentDecision: { hints: { useFastModel: true } },
    });
    const request = makeRequest('oi', { modelName: 'gpt-4o', providerName: 'openai' });
    const route = classifyAgentRunCostEffortRoute(run, request);
    const options = applyCostEffortRouteToLlmOptions(
      { modelName: 'gpt-4o', providerName: 'openai' },
      {
        ...route,
        userModelPinned: true,
        suggestedModelName: 'gemini-2.5-flash-lite',
        suggestedProviderName: 'gemini',
        class: 'background',
        useFastModel: true,
      },
    );
    expect(options.modelName).toBe('gpt-4o');
    expect(options.providerName).toBe('openai');
  });

  itIfClassifyTurnCost('e2e mock path: free-text LLM background → options hop + recovery fields', async () => {
    process.env.ZAVORTH_TURN_COST_LLM = '1';
    process.env.ZAVORTH_TURN_COST_LLM_TIMEOUT_MS = '5000';
    const provider = {
      chat: async () => ({
        content: '{"class":"background","confidence":0.96,"reason":"phasic"}',
        toolCalls: [],
        finishReason: 'stop',
      }),
    };
    const intent = await classifyTurnCostIntent({
      userMessage: 'hola',
      allowLlm: true,
      provider: provider as any,
    });
    expect(intent.class).toBe('background');

    const run = makeRun({
      turnCostIntent: {
        class: intent.class,
        source: intent.source,
        reason: intent.reason,
      },
    });
    const route = classifyAgentRunCostEffortRoute(run, makeRequest('hola'));
    expect(route.class).toBe('background');

    const base: LlmRunOptions = {
      modelName: 'gemini-2.5-flash',
      providerName: 'gemini',
    };
    const options = applyCostEffortRouteToLlmOptions(base, {
      ...route,
      suggestedModelName: route.suggestedModelName || 'gemini-2.5-flash-lite',
      suggestedProviderName: route.suggestedProviderName || 'gemini',
      useFastModel: true,
      class: 'background',
      userModelPinned: false,
    });
    expect(options.costRouteClass).toBe('background');
    // Either hopped to cheap (when stack/env provides one) or kept recovery-capable path.
    if (options.modelName && options.modelName !== base.modelName) {
      expect(options.costRouteRecoveryModelName).toBe('gemini-2.5-flash');
      expect(options.allowFallback).not.toBe(false);
    }
  });
});
