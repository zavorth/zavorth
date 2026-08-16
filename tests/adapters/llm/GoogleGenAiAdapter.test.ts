import { describe, it, expect } from '@jest/globals';
import { GoogleGenAiAdapter } from '../../../src/adapters/llm/providers/GoogleGenAiAdapter.js';

describe('GoogleGenAiAdapter', () => {
  it('should instantiate with Gemini defaults', () => {
    const adapter = new GoogleGenAiAdapter({ apiKey: 'test-gemini-key' });
    expect(adapter.id).toBe('google');
    expect(adapter.name).toContain('Google Gemini');
  });

  it('should list Gemini models with 1M+ context window', async () => {
    const adapter = new GoogleGenAiAdapter();
    const models = await adapter.listModels();
    expect(models.length).toBeGreaterThanOrEqual(2);
    expect(models.some((m) => m.id.includes('gemini-2.5-flash'))).toBe(true);
    expect(models[0].contextWindow).toBeGreaterThanOrEqual(1000000);
  });
});
