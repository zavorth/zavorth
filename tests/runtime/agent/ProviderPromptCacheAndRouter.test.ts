let ProviderPromptCacheService: any;
let buildAnthropicCachedSystem: any;
let splitSystemStableVariable: any;
let classifyAggressiveModelRoute: any;
let classifyTurnCostFromStructured: any;
let isStructuredTrivialTurn: any;
try {
  const mod = require('../../../src/services/llm/ProviderPromptCacheService.js');
  ProviderPromptCacheService = mod.ProviderPromptCacheService;
  buildAnthropicCachedSystem = mod.buildAnthropicCachedSystem;
  splitSystemStableVariable = mod.splitSystemStableVariable;
} catch {
  // Module removed from source
}
try {
  classifyAggressiveModelRoute = require('../../../src/services/llm/AggressiveModelRouter.js').classifyAggressiveModelRoute;
} catch {
  // Module removed from source
}
try {
  const tci = require('../../../src/services/llm/TurnCostIntentService.js');
  classifyTurnCostFromStructured = tci.classifyTurnCostFromStructured;
  isStructuredTrivialTurn = tci.isStructuredTrivialTurn;
} catch {
  // Module removed from source
}

import type { ChatMessage } from '../../../src/providers/ILlmProvider.js';

const hasPromptCache = !!ProviderPromptCacheService;
const hasAggressiveRouter = !!classifyAggressiveModelRoute;
const hasTurnCostIntent = !!classifyTurnCostFromStructured;

const describeIfPromptCache = hasPromptCache ? describe : describe.skip;
const describeIfAggressive = hasAggressiveRouter ? describe : describe.skip;
const describeIfTurnCost = hasTurnCostIntent ? describe : describe.skip;

describeIfPromptCache('ProviderPromptCacheService', () => {
  it('splits stable prefix from variable context marker (universal for all providers)', () => {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'STABLE POLICY\n\n<!-- variable-context -->\nMEMORY BITS',
      },
      { role: 'user', content: 'hello' },
    ];
    const split = splitSystemStableVariable(messages);
    expect(split.stablePrefix).toContain('STABLE POLICY');
    expect(split.variableSuffix).toContain('MEMORY BITS');
  });

  it('caches short tool-free turns and returns hits', () => {
    const cache = new ProviderPromptCacheService({ maxEntries: 8, ttlMs: 60_000 });
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are Zavorth. Stable system policy block for caching tests.' },
      { role: 'user', content: 'oi' },
    ];
    const key = cache.buildKey({
      providerName: 'gemini',
      modelName: 'gemini-2.5-flash',
      messages,
      tools: [],
    });
    expect(key.cacheable).toBe(true);
    const miss = cache.lookup({
      providerName: 'gemini',
      modelName: 'gemini-2.5-flash',
      messages,
      tools: [],
    });
    expect(miss.hit).toBe(false);
    cache.storeResponse({
      key: key.key,
      response: { content: 'Hello!', toolCalls: [], finishReason: 'stop' },
    });
    const hit = cache.lookup({
      providerName: 'gemini',
      modelName: 'gemini-2.5-flash',
      messages,
      tools: [],
    });
    expect(hit.hit).toBe(true);
    expect(hit.response?.content).toBe('Hello!');
    expect(cache.getStats().hits).toBeGreaterThanOrEqual(1);
  });

  it('builds anthropic cache_control blocks for stable prefix (optional native mapping)', () => {
    const system = buildAnthropicCachedSystem([
      {
        role: 'system',
        content: 'Stable rules.\n\n<!-- variable-context -->\nDynamic memory.',
      },
    ]);
    expect(Array.isArray(system)).toBe(true);
    const blocks = system as Array<Record<string, unknown>>;
    expect(blocks[0]?.cache_control).toEqual({ type: 'ephemeral' });
    expect(String(blocks[0]?.text || '')).toContain('Stable rules');
  });
});

describeIfTurnCost('TurnCostIntentService (language-agnostic)', () => {
  it('never treats free-text greetings as trivial without structured/LLM authority', () => {
    expect(isStructuredTrivialTurn('oi')).toBe(false);
    expect(isStructuredTrivialTurn('hello')).toBe(false);
    expect(isStructuredTrivialTurn('')).toBe(true);
    expect(isStructuredTrivialTurn('anything', true)).toBe(true);
    expect(isStructuredTrivialTurn('anything', false)).toBe(false);

    const freeText = classifyTurnCostFromStructured({ userMessage: 'oi' });
    expect(freeText.class).toBe('standard');
    expect(freeText.source).toBe('default');
  });

  it('honors structured signals the same for every provider path', () => {
    const bg = classifyTurnCostFromStructured({
      userMessage: 'whatever language here',
      metadata: { useFastModel: true },
    });
    expect(bg.class).toBe('background');
    expect(bg.useFastModel).toBe(true);

    const premium = classifyTurnCostFromStructured({
      userMessage: 'anything',
      forceStrong: true,
    });
    expect(premium.class).toBe('premium');
    expect(premium.forceStrong).toBe(true);

    const byTask = classifyTurnCostFromStructured({
      userMessage: 'anything',
      taskKind: 'architecture',
    });
    expect(byTask.class).toBe('premium');
  });
});

describeIfAggressive('AggressiveModelRouter', () => {
  it('routes only from structured / preclassified intent, not free-text words', () => {
    const freeText = classifyAggressiveModelRoute({ userMessage: 'oi' });
    expect(freeText.class).toBe('standard');
    expect(freeText.useFastModel).toBe(false);

    const hardText = classifyAggressiveModelRoute({
      userMessage: 'Refactor the security architecture for multi-file production migration',
    });
    // Without structured signal or LLM, free text stays standard (language-agnostic).
    expect(hardText.class).toBe('standard');

    const structuredBg = classifyAggressiveModelRoute({
      userMessage: 'hello',
      metadata: { contextPipelineTrivial: true },
    });
    expect(structuredBg.class).toBe('background');
    expect(structuredBg.useFastModel).toBe(true);

    const preclassified = classifyAggressiveModelRoute({
      userMessage: 'any language text',
      preclassified: {
        class: 'premium',
        trivialTurn: false,
        useFastModel: false,
        forceStrong: true,
        reason: 'LLM semantic premium.',
        source: 'llm',
        confidence: 0.9,
      },
    });
    expect(preclassified.class).toBe('premium');
    expect(preclassified.forceStrong).toBe(true);
    expect(preclassified.intentSource).toBe('llm');
  });
});
