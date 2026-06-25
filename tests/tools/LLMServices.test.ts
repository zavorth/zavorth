import { LLMRouterService } from '../../src/services/plugins/LLMRouterService';
import { ContextCompressorService } from '../../src/services/plugins/ContextCompressorService';
import { ReasoningEffortService } from '../../src/services/plugins/ReasoningEffortService';
import { PromptCacheService } from '../../src/services/plugins/PromptCacheService';

describe('LLMRouterService', () => {
  const router = new LLMRouterService({ costBudgetDaily: 100 });

  it('routes chat tasks to fast model', () => {
    const r = router.route('chat');
    expect(r.provider).toBeTruthy();
    expect(r.model).toBeTruthy();
    expect(r.max_tokens).toBeGreaterThan(0);
  });

  it('routes code_generation to high-quality model', () => {
    const r = router.route('code_generation', { prefer_quality: true });
    expect(r.reasoning_effort).toBe('high');
  });

  it('routes fast_answer to cheap model', () => {
    const r = router.route('fast_answer');
    expect(r.estimated_cost).toBeLessThan(0.01);
  });

  it('routes by task description', () => {
    const r = router.routeForTask('Write a REST API in TypeScript');
    expect(r.model).toBeTruthy();
  });

  it('routes research tasks', () => {
    const r = router.routeForTask('Research the latest AI papers');
    expect(r.model).toBeTruthy();
  });

  it('excludes providers', () => {
    const r = router.route('chat', { exclude_providers: ['openai'] });
    expect(r.provider).not.toBe('openai');
  });

  it('lists models', () => {
    const r = router.listModels();
    expect(r).toContain('gpt-4o');
    expect(r).toContain('claude-4');
  });

  it('lists routing rules', () => {
    const r = router.listRoutingRules();
    expect(r).toContain('chat');
    expect(r).toContain('code_generation');
  });

  it('gets usage stats', () => {
    router.route('chat');
    router.route('code_generation');
    const r = router.getUsageStats();
    expect(r).toContain('Daily budget');
  });

  it('adds custom model profile', () => {
    router.addModelProfile({
      id: 'custom-model',
      provider: 'custom',
      model: 'custom-v1',
      capabilities: ['chat'],
      cost_per_1k_input: 0.001,
      cost_per_1k_output: 0.002,
      max_context_tokens: 32000,
      supports_streaming: true,
      supports_vision: false,
      supports_function_calling: true,
      reasoning_effort: 'medium',
      latency_tier: 'fast',
      quality_tier: 'standard',
    });
    const r = router.listModels();
    expect(r).toContain('custom-model');
  });
});

describe('ContextCompressorService', () => {
  const compressor = new ContextCompressorService();

  it('does not compress short conversations', () => {
    const turns = [
      { role: 'user' as const, content: 'Hello', timestamp: '2025-01-01T00:00:00Z' },
      { role: 'assistant' as const, content: 'Hi!', timestamp: '2025-01-01T00:00:01Z' },
    ];
    const r = compressor.compress(turns, 'balanced');
    expect(r.compression_ratio).toBe(1.0);
  });

  it('compresses long conversations', () => {
    const turns = Array.from({ length: 100 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i}: ${'word '.repeat(50)}`,
      timestamp: `2025-01-01T00:${String(i).padStart(2, '0')}:00Z`,
    }));
    const r = compressor.compress(turns, 'aggressive');
    expect(r.compressed_turns).toBeLessThan(r.original_turns);
    expect(r.compression_ratio).toBeLessThan(1.0);
  });

  it('compresses for provider token limit', () => {
    const turns = Array.from({ length: 50 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i}: ${'word '.repeat(100)}`,
      timestamp: `2025-01-01T00:${String(i).padStart(2, '0')}:00Z`,
    }));
    const r = compressor.compressForProvider(turns, 4000);
    expect(r.compressed_tokens).toBeLessThanOrEqual(4000 * 1.1);
  });

  it('lists strategies', () => {
    const r = compressor.listStrategies();
    expect(r).toContain('conservative');
    expect(r).toContain('balanced');
    expect(r).toContain('aggressive');
    expect(r).toContain('fact-only');
  });

  it('gets stats', () => {
    const r = compressor.getStats();
    expect(r).toContain('Compressions');
  });
});

describe('ReasoningEffortService', () => {
  const reasoning = new ReasoningEffortService();

  it('gets config for chat', () => {
    const c = reasoning.getConfig('chat');
    expect(c.effort).toBe('low');
    expect(c.chain_of_thought).toBe(false);
  });

  it('gets config for code_generation', () => {
    const c = reasoning.getConfig('code_generation');
    expect(c.effort).toBe('high');
    expect(c.chain_of_thought).toBe(true);
  });

  it('gets config for reasoning', () => {
    const c = reasoning.getConfig('reasoning');
    expect(c.effort).toBe('high');
    expect(c.self_reflection).toBe(true);
  });

  it('suggests effort from description', () => {
    expect(reasoning.suggestEffort('Quick question')).toBe('low');
    expect(reasoning.suggestEffort('Write a complex algorithm')).toBe('high');
    expect(reasoning.suggestEffort('Analyze this data')).toBe('medium');
  });

  it('sets global effort', () => {
    reasoning.setGlobalEffort('high');
    const c = reasoning.getConfig('unknown_task');
    expect(c.effort).toBe('high');
    reasoning.setGlobalEffort('medium');
  });

  it('sets task-specific effort', () => {
    reasoning.setTaskEffort('chat', 'high');
    const c = reasoning.getConfig('chat');
    expect(c.effort).toBe('high');
    reasoning.setTaskEffort('chat', 'low');
  });

  it('lists profiles', () => {
    const r = reasoning.listProfiles();
    expect(r).toContain('chat');
    expect(r).toContain('code_generation');
    expect(r).toContain('research');
  });

  it('gets effort description', () => {
    expect(reasoning.getEffortDescription('low')).toContain('Fast');
    expect(reasoning.getEffortDescription('high')).toContain('Deep');
  });
});

describe('PromptCacheService', () => {
  let service: PromptCacheService;
  let tempDir: string;

  beforeEach(() => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-cache-'));
    service = new PromptCacheService({ storageDir: tempDir });
  });

  afterEach(() => {
    const fs = require('fs');
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('computes hash', () => {
    const h1 = service.computeHash('hello world');
    const h2 = service.computeHash('hello world');
    const h3 = service.computeHash('different text');
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });

  it('misses on first check', () => {
    const r = service.checkCache('test prompt', 'openai', 'gpt-4o');
    expect(r.hit).toBe(false);
  });

  it('hits after adding to cache', () => {
    service.addToCache('test prompt', 'openai', 'gpt-4o', 100);
    const r = service.checkCache('test prompt', 'openai', 'gpt-4o');
    expect(r.hit).toBe(true);
    expect(r.tokens_saved).toBe(100);
  });

  it('finds common prefix', () => {
    const r = service.findCommonPrefix([
      'hello world how are you',
      'hello world what time is it',
      'hello world goodbye',
    ]);
    expect(r).toContain('hello');
    expect(r).toContain('world');
  });

  it('optimizes prompt order', () => {
    service.addToCache('frequently used', 'openai', 'gpt-4o', 50);
    service.checkCache('frequently used', 'openai', 'gpt-4o');
    service.checkCache('frequently used', 'openai', 'gpt-4o');
    const r = service.optimizePromptOrder(['rarely used', 'frequently used']);
    expect(r[0]).toBe('frequently used');
  });

  it('evicts old entries', () => {
    service.addToCache('old prompt', 'openai', 'gpt-4o', 50);
    const r = service.evict(0);
    expect(r).toBeGreaterThanOrEqual(0);
  });

  it('gets stats', () => {
    service.addToCache('test', 'openai', 'gpt-4o', 100);
    service.checkCache('test', 'openai', 'gpt-4o');
    const r = service.getStats();
    expect(r).toContain('Cached prompts');
    expect(r).toContain('Cache hits');
  });

  it('lists cached prompts', () => {
    service.addToCache('test1', 'openai', 'gpt-4o', 100);
    service.addToCache('test2', 'anthropic', 'claude-4', 200);
    const r = service.listCached();
    expect(r).toContain('openai/gpt-4o');
    expect(r).toContain('anthropic/claude-4');
  });
});
