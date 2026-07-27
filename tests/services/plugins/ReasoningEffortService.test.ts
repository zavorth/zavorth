import { ReasoningEffortService } from '../../../src/services/plugins/ReasoningEffortService';

describe('ReasoningEffortService', () => {
  let service: ReasoningEffortService;

  beforeEach(() => {
    service = new ReasoningEffortService();
  });

  describe('getConfig() for each task type', () => {
    it('returns low effort config for chat', () => {
      const config = service.getConfig('chat');
      expect(config.effort).toBe('low');
      expect(config.chain_of_thought).toBe(false);
      expect(config.self_reflection).toBe(false);
    });

    it('returns high effort config for code_generation', () => {
      const config = service.getConfig('code_generation');
      expect(config.effort).toBe('high');
      expect(config.chain_of_thought).toBe(true);
      expect(config.self_reflection).toBe(true);
      expect(config.step_by_step).toBe(true);
    });

    it('returns medium effort config for code_review', () => {
      const config = service.getConfig('code_review');
      expect(config.effort).toBe('medium');
      expect(config.chain_of_thought).toBe(true);
    });

    it('returns high effort config for reasoning', () => {
      const config = service.getConfig('reasoning');
      expect(config.effort).toBe('high');
      expect(config.max_tokens).toBe(8192);
      expect(config.temperature).toBe(0.1);
    });

    it('returns low effort config for summarization', () => {
      const config = service.getConfig('summarization');
      expect(config.effort).toBe('low');
      expect(config.max_tokens).toBe(2048);
    });

    it('returns high effort config for research', () => {
      const config = service.getConfig('research');
      expect(config.effort).toBe('high');
      expect(config.max_tokens).toBe(16384);
      expect(config.timeout_ms).toBe(180000);
    });

    it('returns medium effort config for data_analysis', () => {
      const config = service.getConfig('data_analysis');
      expect(config.effort).toBe('medium');
    });

    it('returns medium effort config for tool_planning', () => {
      const config = service.getConfig('tool_planning');
      expect(config.effort).toBe('medium');
      expect(config.timeout_ms).toBe(15000);
    });

    it('returns low effort config for fast_answer', () => {
      const config = service.getConfig('fast_answer');
      expect(config.effort).toBe('low');
      expect(config.max_tokens).toBe(512);
      expect(config.timeout_ms).toBe(10000);
    });

    it('returns medium effort config for creative_writing', () => {
      const config = service.getConfig('creative_writing');
      expect(config.effort).toBe('medium');
      expect(config.temperature).toBe(0.9);
      expect(config.chain_of_thought).toBe(false);
    });
  });

  describe('getConfig() for unknown task types', () => {
    it('returns default config based on global effort for unknown task', () => {
      const config = service.getConfig('unknown_task');
      expect(config.effort).toBe('medium');
    });

    it('uses global effort setting for unknown tasks', () => {
      service.setGlobalEffort('high');
      const config = service.getConfig('unknown_task');
      expect(config.effort).toBe('high');
    });
  });

  describe('suggestEffort()', () => {
    it('suggests low for quick/simple tasks', () => {
      expect(service.suggestEffort('Quick question')).toBe('low');
      expect(service.suggestEffort('Simple hello')).toBe('low');
      expect(service.suggestEffort('Yes or no-')).toBe('low');
    });

    it('suggests high for write/create tasks', () => {
      expect(service.suggestEffort('Write a REST API')).toBe('high');
      expect(service.suggestEffort('Create a new component')).toBe('high');
      expect(service.suggestEffort('Implement authentication')).toBe('high');
    });

    it('suggests medium for analyze/review tasks', () => {
      expect(service.suggestEffort('Analyze this data')).toBe('medium');
      expect(service.suggestEffort('Review this PR')).toBe('medium');
      expect(service.suggestEffort('Compare options')).toBe('medium');
    });

    it('suggests high for reason/debug tasks', () => {
      expect(service.suggestEffort('Debug this issue')).toBe('high');
      expect(service.suggestEffort('Solve this problem')).toBe('high');
      expect(service.suggestEffort('Complex architecture')).toBe('high');
    });

    it('suggests low for summarize/list tasks', () => {
      expect(service.suggestEffort('Summarize this')).toBe('low');
      expect(service.suggestEffort('List all items')).toBe('low');
      expect(service.suggestEffort('What time is it-')).toBe('low');
    });

    it('falls back to global effort for unmatched descriptions', () => {
      expect(service.suggestEffort('xyzzy plugh')).toBe('medium');
    });
  });

  describe('global effort override', () => {
    it('changes global effort', () => {
      service.setGlobalEffort('high');
      const config = service.getConfig('unknown_task');
      expect(config.effort).toBe('high');
    });

    it('affects suggestEffort fallback', () => {
      service.setGlobalEffort('low');
      expect(service.suggestEffort('random unmatched text')).toBe('low');
    });
  });

  describe('task-specific effort override', () => {
    it('overrides effort for specific task', () => {
      service.setTaskEffort('chat', 'high');
      const config = service.getConfig('chat');
      expect(config.effort).toBe('high');
    });

    it('preserves other config values when overriding', () => {
      service.setTaskEffort('chat', 'high');
      const config = service.getConfig('chat');
      expect(config.max_tokens).toBe(2048);
      expect(config.temperature).toBe(0.7);
    });

    it('does not affect other tasks', () => {
      service.setTaskEffort('chat', 'high');
      const codeConfig = service.getConfig('code_generation');
      expect(codeConfig.effort).toBe('high');
    });
  });

  describe('all 10 profiles', () => {
    const taskTypes = [
      'chat', 'code_generation', 'code_review', 'reasoning',
      'summarization', 'research', 'data_analysis', 'tool_planning',
      'fast_answer', 'creative_writing',
    ];

    it.each(taskTypes)('has a valid config for %s', (taskType) => {
      const config = service.getConfig(taskType);
      expect(['low', 'medium', 'high']).toContain(config.effort);
      expect(config.max_tokens).toBeGreaterThan(0);
      expect(config.temperature).toBeGreaterThanOrEqual(0);
      expect(config.temperature).toBeLessThanOrEqual(1);
      expect(typeof config.chain_of_thought).toBe('boolean');
      expect(typeof config.self_reflection).toBe('boolean');
      expect(typeof config.step_by_step).toBe('boolean');
      expect(config.timeout_ms).toBeGreaterThan(0);
    });
  });

  describe('effort descriptions', () => {
    it('returns description for low effort', () => {
      const desc = service.getEffortDescription('low');
      expect(desc).toContain('Fast');
      expect(desc).toContain('concise');
    });

    it('returns description for medium effort', () => {
      const desc = service.getEffortDescription('medium');
      expect(desc).toContain('Balanced');
    });

    it('returns description for high effort', () => {
      const desc = service.getEffortDescription('high');
      expect(desc).toContain('Deep reasoning');
      expect(desc).toContain('chain-of-thought');
    });
  });

  describe('listProfiles()', () => {
    it('lists all profiles', () => {
      const list = service.listProfiles();
      expect(list).toContain('chat');
      expect(list).toContain('code_generation');
      expect(list).toContain('reasoning');
      expect(list).toContain('research');
      expect(list).toContain('fast_answer');
    });

    it('includes override info', () => {
      service.setTaskEffort('chat', 'high');
      const list = service.listProfiles();
      expect(list).toContain('high');
    });

    it('includes config details', () => {
      const list = service.listProfiles();
      expect(list).toContain('tokens:');
      expect(list).toContain('temp:');
      expect(list).toContain('cot:');
    });
  });
});
