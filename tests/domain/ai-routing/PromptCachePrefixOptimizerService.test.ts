import { PromptCachePrefixOptimizerService } from '../../../src/domain/ai-routing/PromptCachePrefixOptimizerService.js';

describe('PromptCachePrefixOptimizerService', () => {
  let optimizer: PromptCachePrefixOptimizerService;

  beforeEach(() => {
    optimizer = new PromptCachePrefixOptimizerService();
  });

  it('compiles deterministic cached prefix with system prompt, rules, and tool schemas', () => {
    const result = optimizer.buildOptimizedPrompt({
      systemPrompt: 'You are Zavorth, an advanced AI coding agent.',
      engineeringRules: ['Adhere to 100% EN-first codebase.', 'Strict TypeScript with zero any.'],
      toolDefinitionsJson: '{"tools": ["read_file", "write_file"]}',
      conversationHistory: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ],
      currentTurnPrompt: 'Please refactor the auth router.',
    });

    expect(result.cachedPrefix).toContain('You are Zavorth');
    expect(result.cachedPrefix).toContain('Adhere to 100% EN-first codebase');
    expect(result.cachedPrefix).toContain('Available Tool Schemas');
    expect(result.dynamicSuffix).toContain('Please refactor the auth router');
    expect(result.fullCompiledPrompt).toContain(result.cachedPrefix);
    expect(result.fullCompiledPrompt).toContain(result.dynamicSuffix);
  });

  it('computes high cache efficiency score for identical stable prefixes', () => {
    const p1 = optimizer.buildOptimizedPrompt({
      systemPrompt: 'Stable system prompt',
      engineeringRules: ['Rule 1'],
      conversationHistory: [],
      currentTurnPrompt: 'Turn 1',
    });

    const p2 = optimizer.buildOptimizedPrompt({
      systemPrompt: 'Stable system prompt',
      engineeringRules: ['Rule 1'],
      conversationHistory: [{ role: 'user', content: 'Turn 1' }],
      currentTurnPrompt: 'Turn 2',
    });

    const efficiency = optimizer.calculateCacheEfficiencyScore(p1.cachedPrefix, p2.cachedPrefix);
    expect(efficiency).toBe(1.0); // 100% prefix cache match!
  });
});
