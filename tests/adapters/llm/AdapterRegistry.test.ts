import { describe, it, expect } from '@jest/globals';
import { AdapterRegistry } from '../../../src/adapters/llm/AdapterRegistry.js';
import { OpenAIAdapter } from '../../../src/adapters/llm/providers/OpenAIAdapter.js';
import { AnthropicAdapter } from '../../../src/adapters/llm/providers/AnthropicAdapter.js';
import { OllamaAdapter } from '../../../src/adapters/llm/providers/OllamaAdapter.js';
import { LMStudioAdapter } from '../../../src/adapters/llm/providers/LMStudioAdapter.js';
import { XAIAdapter } from '../../../src/adapters/llm/providers/XAIAdapter.js';

describe('AdapterRegistry & Pure LLM Adapters', () => {
  it('should register and retrieve adapters by name case-insensitively', () => {
    const registry = new AdapterRegistry();

    const openai = new OpenAIAdapter();
    const anthropic = new AnthropicAdapter();
    const ollama = new OllamaAdapter();
    const lmstudio = new LMStudioAdapter();
    const xai = new XAIAdapter();

    registry.register(openai, true);
    registry.register(anthropic);
    registry.register(ollama);
    registry.register(lmstudio);
    registry.register(xai);

    expect(registry.listNames()).toEqual(['openai', 'anthropic', 'ollama', 'lmstudio', 'xai']);
    expect(registry.get('OpenAI').name).toBe('openai');
    expect(registry.get('ANTHROPIC').name).toBe('anthropic');
    expect(registry.get('ollama').name).toBe('ollama');
    expect(registry.get('lmstudio').name).toBe('lmstudio');
    expect(registry.get('xai').name).toBe('xai');
    expect(registry.getDefault().name).toBe('openai');
  });

  it('should verify adapter capabilities and introspection', async () => {
    const registry = new AdapterRegistry();
    const anthropic = new AnthropicAdapter();
    registry.register(anthropic, true);

    const defaultAdapter = registry.getDefault();
    expect(defaultAdapter.capabilities.streaming).toBe(true);
    expect(defaultAdapter.capabilities.toolCalling).toBe(true);

    const models = await defaultAdapter.listModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].id).toContain('claude');
  });

  it('should throw descriptive error when accessing unregistered adapter', () => {
    const registry = new AdapterRegistry();
    expect(() => registry.get('nonexistent')).toThrow(/LLM Adapter "nonexistent" is not registered/);
  });
});
