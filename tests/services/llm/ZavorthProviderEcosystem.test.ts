import { UNIVERSAL_PROVIDER_CATALOG } from '../../../src/services/providers/catalog/UniversalProviderCatalog';
import { ZavorthProviderFuzzyResolver } from '../../../src/services/providers/catalog/ZavorthProviderFuzzyResolver';
import { ZavorthUniversalDynamicAdapter } from '../../../src/providers/ZavorthUniversalDynamicAdapter';
import { ProviderFactory } from '../../../src/providers/ProviderFactory';

describe('Universal Provider Ecosystem & Fuzzy Resolver Suite', () => {
  const resolver = new ZavorthProviderFuzzyResolver();

  describe('UniversalProviderCatalog', () => {
    it('reports the real catalog size and covers the declared provider categories', () => {
      expect(UNIVERSAL_PROVIDER_CATALOG).toBeDefined();
      expect(UNIVERSAL_PROVIDER_CATALOG).toHaveLength(65);

      const categories = UNIVERSAL_PROVIDER_CATALOG.map((p) => p.category);
      expect(categories).toContain('cloud');
      expect(categories).toContain('silicon');
      expect(categories).toContain('asian_global');
      expect(categories).toContain('search_rag');
      expect(categories).toContain('local');
      expect(categories).toContain('aggregator');
    });
  });

  describe('ZavorthProviderFuzzyResolver', () => {
    it('resolves exact provider IDs correctly', () => {
      const match = resolver.resolveProviderInput('kimi');
      expect(match.provider.id).toBe('kimi');
      expect(match.provider.envKey).toBe('KIMI_API_KEY');
      expect(match.matchKind).toBe('exact_id');
    });

    it('resolves slash syntax (provider/model)', () => {
      const match = resolver.resolveProviderInput('groq/llama-3.3-70b');
      expect(match.provider.id).toBe('groq');
      expect(match.requestedModel).toBe('llama-3.3-70b');
      expect(match.matchKind).toBe('slash_syntax');
    });

    it('resolves typos universally using distance-based fuzzy matching', () => {
      const testCases = [
        { input: 'gminii', expectedId: 'gemini' },
        { input: 'perplexty', expectedId: 'perplexity' },
        { input: 'claud', expectedId: 'anthropic' },
        { input: 'deepsek', expectedId: 'deepseek' },
        { input: 'groqq', expectedId: 'groq' },
        { input: 'sambanove', expectedId: 'sambanova' },
      ];

      for (const tc of testCases) {
        const match = resolver.resolveProviderInput(tc.input);
        expect(match.provider.id).toBe(tc.expectedId);
        expect(match.matchScore).toBeGreaterThanOrEqual(0.65);
        expect(match.matchKind).toBe('fuzzy_alias');
      }
    });

    it('handles empty input with default fallback', () => {
      const match = resolver.resolveProviderInput('');
      expect(match.provider.id).toBe('gemini');
      expect(match.matchKind).toBe('fallback_default');
    });
  });

  describe('ZavorthUniversalDynamicAdapter', () => {
    it('instantiates custom unlisted provider configurations dynamically', () => {
      const customAdapter = new ZavorthUniversalDynamicAdapter({
        providerId: 'custom_mesh_ai',
        baseUrl: 'https://api.custommesh.ai/v1',
        apiKey: 'sk-test-key-12345',
        defaultModel: 'mesh-model-v1',
        protocol: 'openai_compatible',
      });

      expect(customAdapter.name).toBe('custom_mesh_ai');
    });

    it('handles gemini_native protocol dynamically', () => {
      const customAdapter = new ZavorthUniversalDynamicAdapter({
        providerId: 'custom_gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'AIzaSyFakeKey',
        defaultModel: 'gemini-2.5-flash',
        protocol: 'gemini_native',
      });
      expect(customAdapter.name).toBe('custom_gemini');
    });

    it('handles claude_native protocol dynamically', () => {
      const customAdapter = new ZavorthUniversalDynamicAdapter({
        providerId: 'custom_claude',
        baseUrl: 'https://api.anthropic.com/v1',
        apiKey: 'sk-ant-fake-key',
        defaultModel: 'claude-3-5-sonnet-latest',
        protocol: 'claude_native',
      });
      expect(customAdapter.name).toBe('custom_claude');
    });

    it('handles ollama_native protocol dynamically', () => {
      const customAdapter = new ZavorthUniversalDynamicAdapter({
        providerId: 'custom_ollama',
        baseUrl: 'http://localhost:11434/v1',
        apiKey: 'ollama',
        defaultModel: 'llama3.2',
        protocol: 'ollama_native',
      });
      expect(customAdapter.name).toBe('custom_ollama');
    });
  });

  describe('ProviderFactory Integration', () => {
    it('normalizes provider inputs with fuzzy matching through ProviderFactory', () => {
      const resolvedGemini = ProviderFactory.normalizeProviderName('gminii');
      expect(resolvedGemini).toBe('gemini');

      const resolvedKimi = ProviderFactory.normalizeProviderName('kimi-k3');
      expect(resolvedKimi).toBe('kimi');

      const resolvedPerplexity = ProviderFactory.normalizeProviderName('perplexty');
      expect(resolvedPerplexity).toBe('perplexity');
    });

    it('preserves an explicitly requested model from provider/model syntax', () => {
      const target = ProviderFactory.resolveRuntimeTarget('groq/custom-model');
      expect(target.providerName).toBe('groq');
      expect(target.modelName).toBe('custom-model');
    });

    it('fails closed for unknown providers without an explicit endpoint', () => {
      expect(() => ProviderFactory.resolveRuntimeTarget('provider-that-does-not-exist')).toThrow(
        /not registered/i,
      );
    });

    it('does not expose non-chat provider categories as chat runtimes', () => {
      const target = ProviderFactory.resolveRuntimeTarget('voyage');
      expect(target.runtimeSupported).toBe(false);
      expect(() => ProviderFactory.buildSingleProvider(target)).toThrow(/cannot be used as a chat model/i);
    });
  });
});
