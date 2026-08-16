import { describe, it, expect } from '@jest/globals';
import { OpenAICompatibleAdapter } from '../../../src/adapters/llm/providers/OpenAICompatibleAdapter.js';

describe('OpenAICompatibleAdapter', () => {
  it('should instantiate with clean defaults', () => {
    const adapter = new OpenAICompatibleAdapter({
      id: 'custom-groq',
      name: 'Groq Fast LPU',
      baseUrl: 'https://api.groq.com/openai/v1',
      defaultModel: 'llama-3.3-70b-versatile',
    });

    expect(adapter.id).toBe('custom-groq');
    expect(adapter.name).toBe('Groq Fast LPU');
  });

  it('should validate missing apiKey for remote endpoints', async () => {
    const adapter = new OpenAICompatibleAdapter({
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
    });

    const status = await adapter.validateConfig();
    expect(status.valid).toBe(false);
  });
});
