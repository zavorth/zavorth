import { LLMRouterService } from '../../../src/services/plugins/LLMRouterService';

describe('LLMRouterService', () => {
  let service: LLMRouterService;

  beforeEach(() => {
    service = new LLMRouterService();
  });

  describe('route()', () => {
    it('routes chat tasks to default chat model', () => {
      const result = service.route('chat');
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-5.2-mini');
      expect(result.max_tokens).toBe(4096);
      expect(result.temperature).toBe(0.7);
      expect(result.reasoning_effort).toBe('low');
    });

    it('routes code_generation tasks', () => {
      const result = service.route('code_generation');
      expect(result.provider).toBe('anthropic');
      expect(result.model).toBe('claude-4');
      expect(result.max_tokens).toBe(8192);
      expect(result.reasoning_effort).toBe('high');
    });

    it('routes research tasks', () => {
      const result = service.route('research');
      expect(result.provider).toBe('google');
      expect(result.model).toBe('gemini-2.5-pro');
      expect(result.max_tokens).toBe(16384);
      expect(result.reasoning_effort).toBe('high');
    });

    it('routes code_review tasks', () => {
      const result = service.route('code_review');
      expect(result.model).toBe('claude-4-sonnet');
      expect(result.reasoning_effort).toBe('medium');
    });

    it('routes summarization tasks to cheapest model', () => {
      const result = service.route('summarization');
      expect(result.model).toBe('gemini-2.5-flash');
      expect(result.max_tokens).toBe(2048);
    });

    it('routes translation tasks', () => {
      const result = service.route('translation');
      expect(result.model).toBe('gpt-5.2-mini');
    });

    it('routes data_analysis tasks', () => {
      const result = service.route('data_analysis');
      expect(result.model).toBe('claude-4-sonnet');
    });

    it('routes creative_writing tasks', () => {
      const result = service.route('creative_writing');
      expect(result.model).toBe('claude-4');
      expect(result.temperature).toBe(0.9);
    });

    it('routes tool_planning tasks', () => {
      const result = service.route('tool_planning');
      expect(result.model).toBe('claude-4-sonnet');
      expect(result.temperature).toBe(0.1);
    });

    it('routes vision tasks', () => {
      const result = service.route('vision');
      expect(result.model).toBe('gpt-5.2');
    });

    it('routes audio tasks', () => {
      const result = service.route('audio');
      expect(result.model).toBe('gemini-2.5-pro');
    });

    it('routes fast_answer tasks', () => {
      const result = service.route('fast_answer');
      expect(result.model).toBe('llama-3.3-70b-versatile');
      expect(result.max_tokens).toBe(1024);
    });

    it('falls back to chat for unknown task types', () => {
      const result = service.route('unknown_task_xyz');
      expect(result.model).toBe('gpt-5.2-mini');
    });

    it('includes estimated_cost in result', () => {
      const result = service.route('chat');
      expect(result.estimated_cost).toBeGreaterThanOrEqual(0);
    });

    it('includes reason string', () => {
      const result = service.route('chat');
      expect(result.reason).toContain('chat');
      expect(result.reason).toContain('gpt-5.2-mini');
    });

    it('includes fallback_chain', () => {
      const result = service.route('chat');
      expect(Array.isArray(result.fallback_chain)).toBe(true);
      expect(result.fallback_chain.length).toBeGreaterThan(0);
    });

    it('routes with prefer_speed option', () => {
      const result = service.route('chat', { prefer_speed: true });
      expect(result).toBeDefined();
      expect(result.provider).toBeDefined();
    });

    it('routes with prefer_quality option', () => {
      const result = service.route('chat', { prefer_quality: true });
      expect(result).toBeDefined();
    });

    it('routes with required_capabilities', () => {
      const result = service.route('chat', { required_capabilities: ['vision'] });
      expect(result).toBeDefined();
    });

    it('routes with context_tokens_needed', () => {
      const result = service.route('chat', { context_tokens_needed: 50000 });
      expect(result).toBeDefined();
    });
  });

  describe('route with provider exclusion', () => {
    it('excludes a provider from routing', () => {
      const result = service.route('code_generation', { exclude_providers: ['anthropic'] });
      expect(result.provider).not.toBe('anthropic');
    });

    it('excludes multiple providers', () => {
      const result = service.route('chat', { exclude_providers: ['openai', 'anthropic'] });
      expect(result.provider).not.toBe('openai');
      expect(result.provider).not.toBe('anthropic');
    });
  });

  describe('routeForTask()', () => {
    it('routes code description to code_generation', () => {
      const result = service.routeForTask('Write a function to parse JSON');
      expect(result.model).toBe('claude-4');
    });

    it('routes code review description to code_review', () => {
      const result = service.routeForTask('Review this code for bugs');
      expect(result.model).toBe('claude-4-sonnet');
    });

    it('routes reasoning description', () => {
      const result = service.routeForTask('Analyze this logical argument');
      expect(result.reasoning_effort).toBe('high');
    });

    it('routes summarization description', () => {
      const result = service.routeForTask('Summarize this article for me');
      expect(result.model).toBe('gemini-2.5-flash');
    });

    it('routes translation description', () => {
      const result = service.routeForTask('Translate this text to Spanish');
      expect(result.model).toBe('gpt-5.2-mini');
    });

    it('routes research description', () => {
      const result = service.routeForTask('Research the latest AI trends');
      expect(result.model).toBe('gemini-2.5-pro');
    });

    it('routes data analysis description', () => {
      const result = service.routeForTask('Find patterns in this CSV data');
      expect(result.model).toBe('claude-4-sonnet');
    });

    it('routes creative writing description', () => {
      const result = service.routeForTask('Write a story about space');
      expect(result.model).toBe('claude-4');
    });

    it('routes vision description', () => {
      const result = service.routeForTask('Describe this image');
      expect(result.model).toBe('gpt-5.2');
    });

    it('routes audio description', () => {
      const result = service.routeForTask('Transcribe this audio file');
      expect(result.model).toBe('gemini-2.5-pro');
    });

    it('routes quick question to fast_answer', () => {
      const result = service.routeForTask('Quick question about Python');
      expect(result.model).toBe('llama-3.3-70b-versatile');
    });

    it('defaults to chat for unmatched descriptions', () => {
      const result = service.routeForTask('Hello, how are you?');
      expect(result.model).toBe('gpt-5.2-mini');
    });

    it('passes options through to route()', () => {
      const result = service.routeForTask('Write code', { prefer_speed: true });
      expect(result).toBeDefined();
    });
  });

  describe('cost budget tracking', () => {
    it('tracks cost after routing', () => {
      service.route('code_generation');
      const stats = service.getUsageStats();
      expect(stats).toContain('Used today');
    });

    it('accumulates cost across multiple routes', () => {
      service.route('chat');
      service.route('chat');
      const stats = service.getUsageStats();
      expect(stats).toContain('2 calls');
    });

    it('reports daily budget', () => {
      const stats = service.getUsageStats();
      expect(stats).toContain('$10.00');
    });

    it('accepts custom daily budget', () => {
      const custom = new LLMRouterService({ costBudgetDaily: 50.0 });
      const stats = custom.getUsageStats();
      expect(stats).toContain('$50.00');
    });
  });

  describe('model profile management', () => {
    it('adds a custom model profile', () => {
      service.addModelProfile({
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
      const models = service.listModels();
      expect(models).toContain('custom-model');
    });

    it('listModels includes all default models', () => {
      const models = service.listModels();
      expect(models).toContain('gpt-5.2');
      expect(models).toContain('claude-4');
      expect(models).toContain('gemini-2.5-pro');
      expect(models).toContain('deepseek-v3');
      expect(models).toContain('llama-3.3-70b');
    });
  });

  describe('custom routing rules', () => {
    it('adds a custom routing rule', () => {
      service.addRoutingRule({
        task_pattern: 'custom_task',
        preferred_model: 'gpt-5.2',
        fallback_models: ['claude-4'],
        max_tokens: 4096,
        temperature: 0.5,
        reasoning_effort: 'medium',
        cost_budget_per_call: 0.05,
      });
      const result = service.route('custom_task');
      expect(result.model).toBe('gpt-5.2');
    });

    it('listRoutingRules includes all default rules', () => {
      const rules = service.listRoutingRules();
      expect(rules).toContain('chat');
      expect(rules).toContain('code_generation');
      expect(rules).toContain('research');
    });
  });

  describe('usage stats', () => {
    it('starts with zero usage', () => {
      const stats = service.getUsageStats();
      expect(stats).toContain('Used today: $0.0000');
    });

    it('tracks per-model stats', () => {
      service.route('chat');
      service.route('code_generation');
      const stats = service.getUsageStats();
      expect(stats).toContain('Per Model:');
    });

    it('reports tokens used', () => {
      service.route('chat');
      const stats = service.getUsageStats();
      expect(stats).toContain('tokens');
    });
  });

  describe('fallback chains', () => {
    it('includes fallback models for chat', () => {
      const result = service.route('chat');
      expect(result.fallback_chain).toContain('claude-4-sonnet');
      expect(result.fallback_chain).toContain('gemini-2.5-flash');
    });

    it('includes fallback models for code_generation', () => {
      const result = service.route('code_generation');
      expect(result.fallback_chain).toContain('gpt-5.2');
      expect(result.fallback_chain).toContain('qwen-3-235b');
    });

    it('includes fallback models for research', () => {
      const result = service.route('research');
      expect(result.fallback_chain).toContain('claude-4');
      expect(result.fallback_chain).toContain('gpt-5.2');
    });
  });
});
