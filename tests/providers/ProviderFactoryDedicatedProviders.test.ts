
import { ProviderFactory } from '../../src/providers/ProviderFactory';

describe('ProviderFactory dedicated provider routing', () => {
  afterEach(() => {
    ProviderFactory.clearCache();
  });

  it.each(['groq', 'xai', 'mistral', 'cerebras', 'together'])(
    'routes %s through its dedicated provider class instead of the generic OpenAI-compatible adapter',
    (providerName) => {
      const target = ProviderFactory.resolveRuntimeTarget(providerName);

      expect(target.providerName).toBe(providerName);
      expect(target.adapterKind).toBe('openai_compatible');
      expect(target.firstClassProvider).toBe(true);
    },
  );
});
