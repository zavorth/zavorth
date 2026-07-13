import {
  resolveUserStackProviderChain,
  uniqueProvidersFromHops,
  modelsForProvider,
  parseProviderModelEntry,
} from '../../../src/services/llm/UserStackProviderChain.js';
import type { UserProviderSelection } from '../../../src/services/UserSelectionResolver.js';

describe('UserStackProviderChain', () => {
  const selection: UserProviderSelection = {
    providerId: 'ollama',
    modelId: 'llama3.2',
    routeId: null,
    familyId: null,
    secondaryModelId: 'qwen2.5',
    fallbackProviderIds: ['deepseek:deepseek-chat', 'mistral'],
    source: 'preference',
    configured: true,
  };

  it('builds primary → secondary → user fallbacks without inventing vendors', () => {
    const hops = resolveUserStackProviderChain({
      selection,
      normalizeProviderName: (n) => n.toLowerCase(),
    });
    expect(hops.map((h) => `${h.providerName}/${h.modelName || '*'}`)).toEqual([
      'ollama/llama3.2',
      'ollama/qwen2.5',
      'deepseek/deepseek-chat',
      'mistral/*',
    ]);
    expect(uniqueProvidersFromHops(hops)).toEqual(['ollama', 'deepseek', 'mistral']);
  });

  it('respects requested provider/model', () => {
    const hops = resolveUserStackProviderChain({
      selection,
      requestedProviderName: 'xai',
      requestedModelName: 'grok-2',
      normalizeProviderName: (n) => n.toLowerCase(),
    });
    expect(hops[0]).toMatchObject({ providerName: 'xai', modelName: 'grok-2' });
  });

  it('parses provider:model entries', () => {
    expect(parseProviderModelEntry('deepseek:deepseek-chat')).toEqual({
      provider: 'deepseek',
      model: 'deepseek-chat',
    });
    expect(parseProviderModelEntry('ollama')).toEqual({
      provider: 'ollama',
      model: null,
    });
  });

  it('lists models per provider from hops', () => {
    const hops = resolveUserStackProviderChain({
      selection,
      normalizeProviderName: (n) => n.toLowerCase(),
    });
    expect(modelsForProvider(hops, 'ollama')).toEqual(['llama3.2', 'qwen2.5']);
  });

  it('does not invent openai when selection is empty', () => {
    const hops = resolveUserStackProviderChain({
      selection: {
        providerId: null,
        modelId: null,
        routeId: null,
        familyId: null,
        secondaryModelId: null,
        fallbackProviderIds: [],
        source: 'none',
        configured: false,
      },
    });
    expect(hops).toEqual([]);
  });
});
