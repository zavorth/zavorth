import { describe, it, expect } from '@jest/globals';
import { AnthropicAdapter } from '../../../src/adapters/llm/providers/AnthropicAdapter.js';

describe('AnthropicAdapter', () => {
  it('should instantiate with Claude defaults', () => {
    const adapter = new AnthropicAdapter({ apiKey: 'test-key' });
    expect(adapter.id).toBe('anthropic');
    expect(adapter.name).toContain('Anthropic');
  });

  it('should list Claude 3.5/3.7 models with extended context window', async () => {
    const adapter = new AnthropicAdapter();
    const models = await adapter.listModels();
    expect(models.length).toBeGreaterThanOrEqual(2);
    expect(models.some((m) => m.id.includes('claude-3-7-sonnet'))).toBe(true);
    expect(models[0].contextWindow).toBe(200000);
  });
});
