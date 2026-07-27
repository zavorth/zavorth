/**
 * Regression matrix for language-agnostic turn-cost routing + model stack hops.
 * Covers shapes future users actually hit (1 model, multi-hop, pin, LLM off, parse noise).
 */
let classifyTurnCostFromStructured: any;
let classifyTurnCostIntent: any;
let parseLlmCostDecision: any;
let classifyAggressiveModelRoute: any;
try {
  const tci = require('../../../src/services/llm/TurnCostIntentService.js');
  classifyTurnCostFromStructured = tci.classifyTurnCostFromStructured;
  classifyTurnCostIntent = tci.classifyTurnCostIntent;
  parseLlmCostDecision = tci.parseLlmCostDecision;
} catch {
  // Module removed from source
}
try {
  classifyAggressiveModelRoute = require('../../../src/services/llm/AggressiveModelRouter.js').classifyAggressiveModelRoute;
} catch {
  // Module removed from source
}

import { resolveCheapUserStackHop } from '../../../src/services/llm/UserStackCostRoute.js';
import { resolveUserStackProviderChain } from '../../../src/services/llm/UserStackProviderChain.js';
import type { UserProviderSelection } from '../../../src/services/UserSelectionResolver.js';
import {
  applyCostEffortRouteToLlmOptions,
  classifyAgentRunCostEffortRoute,
} from '../../../src/runtime/agent/AgentRunCostEffortRouting.js';
import type { UniversalAgentRequest, UniversalAgentRun } from '../../../src/runtime/agent/UniversalAgentRuntimeTypes.js';

function selection(partial: Partial<UserProviderSelection>): UserProviderSelection {
  return {
    providerId: partial.providerId ?? 'gemini',
    modelId: partial.modelId ?? 'gemini-2.5-flash',
    routeId: null,
    familyId: null,
    secondaryModelId: partial.secondaryModelId ?? null,
    fallbackProviderIds: partial.fallbackProviderIds ?? [],
    source: partial.source ?? 'preference',
    configured: partial.configured ?? true,
  };
}

function makeRun(metadata: Record<string, unknown> = {}): UniversalAgentRun {
  return {
    runId: 'run-future',
    sessionId: 'session-future',
    userId: 'user-future',
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
    userId: 'user-future',
    channel: 'web',
    text,
    metadata,
  };
}

const hasTurnCostIntent = !!classifyTurnCostFromStructured;
const hasAggressiveRouter = !!classifyAggressiveModelRoute;

describe('Future-user turn cost routing matrix', () => {
  const prevTurnCostLlm = process.env.ZAVORTH_TURN_COST_LLM;
  const prevBgModel = process.env.ZAVORTH_BACKGROUND_MODEL;
  const prevBgProvider = process.env.ZAVORTH_BACKGROUND_PROVIDER;

  afterEach(() => {
    if (prevTurnCostLlm === undefined) delete process.env.ZAVORTH_TURN_COST_LLM;
    else process.env.ZAVORTH_TURN_COST_LLM = prevTurnCostLlm;
    if (prevBgModel === undefined) delete process.env.ZAVORTH_BACKGROUND_MODEL;
    else process.env.ZAVORTH_BACKGROUND_MODEL = prevBgModel;
    if (prevBgProvider === undefined) delete process.env.ZAVORTH_BACKGROUND_PROVIDER;
    else process.env.ZAVORTH_BACKGROUND_PROVIDER = prevBgProvider;
  });

  const describeIfTurnCost = hasTurnCostIntent ? describe : describe.skip;

  describeIfTurnCost('language-agnostic free text', () => {
    it.each([
      'oi',
      'hello',
      'hola',
      'OK??',
      'salut',
      'fix the bug',
      'liste os files',
    ])('does not map free-text %j via structured path alone', (text) => {
      const d = classifyTurnCostFromStructured({ userMessage: text });
      expect(d.source).toBe('default');
      expect(d.class).toBe('standard');
      expect(d.useFastModel).toBe(false);
    });

    it('empty message is background without language heuristics', () => {
      const d = classifyTurnCostFromStructured({ userMessage: '   ' });
      expect(d.class).toBe('background');
      expect(d.source).toBe('empty');
    });
  });

  describeIfTurnCost('structured authority (same for every provider/user)', () => {
    it('honors useFastModel / forceStrong / effort / taskKind codes', () => {
      expect(classifyTurnCostFromStructured({
        userMessage: 'qualquer',
        metadata: { useFastModel: true },
      }).class).toBe('background');

      expect(classifyTurnCostFromStructured({
        userMessage: 'qualquer',
        forceStrong: true,
      }).class).toBe('premium');

      expect(classifyTurnCostFromStructured({
        userMessage: 'qualquer',
        effortLevel: 'high',
      }).class).toBe('premium');

      expect(classifyTurnCostFromStructured({
        userMessage: 'qualquer',
        taskKind: 'architecture',
      }).class).toBe('premium');

      expect(classifyTurnCostFromStructured({
        userMessage: 'qualquer',
        taskKind: 'code',
      }).class).toBe('standard');
    });
  });

  describeIfTurnCost('LLM off / LLM mock', () => {
    it('ZAVORTH_TURN_COST_LLM=0 never calls provider and stays default for free text', async () => {
      process.env.ZAVORTH_TURN_COST_LLM = '0';
      let called = 0;
      const provider = {
        chat: async () => {
          called += 1;
          return { content: '{"class":"background","confidence":0.99,"reason":"should not run"}', toolCalls: [], finishReason: 'stop' };
        },
      };
      const d = await classifyTurnCostIntent({
        userMessage: 'oi',
        allowLlm: true,
        provider: provider as any,
      });
      expect(called).toBe(0);
      expect(d.class).toBe('standard');
      expect(d.source).toBe('default');
    });

    it('uses LLM semantic class when enabled and provider returns JSON', async () => {
      process.env.ZAVORTH_TURN_COST_LLM = '1';
      const provider = {
        chat: async () => ({
          content: '{"class":"background","confidence":0.95,"reason":"social"}',
          toolCalls: [],
          finishReason: 'stop',
        }),
      };
      const d = await classifyTurnCostIntent({
        userMessage: 'qualquer language aqui',
        allowLlm: true,
        provider: provider as any,
        modelName: 'mock-model',
      });
      expect(d.class).toBe('background');
      expect(d.source).toBe('llm');
      expect(d.useFastModel).toBe(true);
    });

    it('falls back to standard when LLM returns garbage even after retries', async () => {
      process.env.ZAVORTH_TURN_COST_LLM = '1';
      const provider = {
        chat: async () => ({
          content: 'not-json-at-all',
          toolCalls: [],
          finishReason: 'stop',
        }),
      };
      const d = await classifyTurnCostIntent({
        userMessage: 'alguma coisa',
        allowLlm: true,
        provider: provider as any,
      });
      expect(d.class).toBe('standard');
      expect(d.source).toBe('default');
    });

    it('skips LLM for very long free text (structural, not language)', async () => {
      process.env.ZAVORTH_TURN_COST_LLM = '1';
      let called = 0;
      const provider = {
        chat: async () => {
          called += 1;
          return { content: '{"class":"premium","confidence":1,"reason":"x"}', toolCalls: [], finishReason: 'stop' };
        },
      };
      const longText = 'x'.repeat(1_300);
      const d = await classifyTurnCostIntent({
        userMessage: longText,
        allowLlm: true,
        provider: provider as any,
      });
      expect(called).toBe(0);
      expect(d.class).toBe('standard');
    });
  });

  describeIfTurnCost('parse robustness for future model quirks', () => {
    it.each([
      ['fenced', '```json\n{"class":"premium","confidence":0.9,"reason":"hard"}\n```', 'premium'],
      ['trailing prose', 'Here:\n{"class":"standard","confidence":0.8,"reason":"ok"}\nok', 'standard'],
      ['category alias', '{"category":"conversation","confidence":0.9,"reason":"hi"}', 'background'],
      ['smart quotes', '{?class?: ?background?, ?confidence?: 0.9, ?reason?: ?ok?}', 'background'],
    ] as const)('%s', (_label, raw, expected) => {
      expect(parseLlmCostDecision(raw)?.class).toBe(expected);
    });
  });

  describe('model stack shapes', () => {
    it('1 provider + 1 model -> primary_only (no invented cheap hop)', () => {
      const pick = resolveCheapUserStackHop({
        selection: selection({ secondaryModelId: null, fallbackProviderIds: [] }),
        env: {} as NodeJS.ProcessEnv,
        preferEnvBackground: false,
      });
      expect(pick.source).toBe('primary_only');
      expect(pick.modelName).toBeNull();
    });

    it('secondary model is used for background hop', () => {
      const sel = selection({
        modelId: 'gemini-2.5-flash',
        secondaryModelId: 'gemini-2.5-flash-lite',
      });
      const hops = resolveUserStackProviderChain({ selection: sel, env: {} as NodeJS.ProcessEnv });
      expect(hops.map((h) => h.source)).toEqual(['primary', 'secondary_model']);
      const pick = resolveCheapUserStackHop({
        selection: sel,
        env: {} as NodeJS.ProcessEnv,
        preferEnvBackground: false,
      });
      expect(pick.modelName).toBe('gemini-2.5-flash-lite');
      expect(pick.source).toBe('secondary_model');
    });

    it('multi-provider fallbacks pick a cheaper non-primary hop', () => {
      const pick = resolveCheapUserStackHop({
        selection: selection({
          providerId: 'anthropic',
          modelId: 'claude-sonnet',
          secondaryModelId: null,
          fallbackProviderIds: ['openai:gpt-4o', 'ollama:llama3.2'],
        }),
        env: {} as NodeJS.ProcessEnv,
        preferEnvBackground: false,
      });
      expect(pick.providerName).toBe('ollama');
      expect(pick.modelName).toBe('llama3.2');
    });

    it('never invents off-stack background vendor', () => {
      const pick = resolveCheapUserStackHop({
        selection: selection({
          secondaryModelId: 'gemini-2.5-flash-lite',
          fallbackProviderIds: [],
        }),
        env: {
          ZAVORTH_BACKGROUND_MODEL: 'secret-foreign',
          ZAVORTH_BACKGROUND_PROVIDER: 'foreign-corp',
        } as NodeJS.ProcessEnv,
      });
      expect(pick.providerName).not.toBe('foreign-corp');
      expect(pick.modelName).not.toBe('secret-foreign');
    });
  });

  describe('agent-run integration', () => {
    it('uses preclassified turnCostIntent from pipeline (no free-text regex)', () => {
      const run = makeRun({
        intentDecision: { hints: { useFastModel: true } },
      });
      const route = classifyAgentRunCostEffortRoute(run, makeRequest('oi em qualquer language'));
      expect(route.class).toBe('background');
      expect(route.useFastModel).toBe(true);
    });

    it('premium preclassified forces strong class', () => {
      const run = makeRun({
        effortLevel: 'high',
      });
      const route = classifyAgentRunCostEffortRoute(run, makeRequest('qualquer'));
      expect(route.class).toBe('premium');
      expect(route.useFastModel).toBe(false);
    });

    it('user-pinned model is not overridden by background hop', () => {
      process.env.ZAVORTH_BACKGROUND_MODEL = 'gemini-2.5-flash-lite';
      process.env.ZAVORTH_BACKGROUND_PROVIDER = 'gemini';
      const run = makeRun({
        intentDecision: { hints: { useFastModel: true } },
      });
      const request = makeRequest('oi', { modelName: 'gpt-4o', providerName: 'openai' });
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

  const describeIfAggressive = hasAggressiveRouter ? describe : describe.skip;

  describeIfAggressive('AggressiveModelRouter composition', () => {
    it('background preclassified suggests cheap hop only when stack allows', () => {
      delete process.env.ZAVORTH_BACKGROUND_MODEL;
      delete process.env.ZAVORTH_BACKGROUND_PROVIDER;
      const freeTextNoStack = classifyAggressiveModelRoute({
        userMessage: 'oi',
        userModelPinned: false,
      });
      expect(freeTextNoStack.class).toBe('standard');

      const withIntent = classifyAggressiveModelRoute({
        userMessage: 'oi',
        userModelPinned: false,
        preclassified: {
          class: 'background',
          trivialTurn: true,
          useFastModel: true,
          forceStrong: false,
          reason: 'llm',
          source: 'llm',
          confidence: 0.9,
        },
      });
      expect(withIntent.class).toBe('background');
      expect(withIntent.useFastModel).toBe(true);
    });
  });
});
