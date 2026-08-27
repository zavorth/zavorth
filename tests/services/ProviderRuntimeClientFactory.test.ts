import { ProviderRuntimeClientFactory } from '../../src/services/ProviderRuntimeClientFactory.js';
import { ResolvedProviderRuntime } from '../../src/services/ModelSelectionService.js';
import { LocalEncryptedProviderSecretStore } from '../../src/services/ProviderSecretStore.js';
import { asErrorLike } from '../../src/utils/errorLike';

jest.mock('../../src/services/ProviderSecretStore.js', () => {
  return {
    LocalEncryptedProviderSecretStore: {
      getInstance: jest.fn().mockReturnValue({
        getSecret: jest.fn().mockResolvedValue('sk-zavorth-runtime-DO-NOT-LEAK-21I')
      })
    }
  };
});

const originalFetch = globalThis.fetch;

const mockFetchResponse = (body: Record<string, unknown>, status = 200) =>
  jest.fn(async () => ({
    ok: status < 400,
    status,
    json: async () => body,
    text: async () => (status < 400 ? '' : 'Unauthorized'),
  })) as unknown as typeof fetch;

beforeEach(() => {
  globalThis.fetch = mockFetchResponse({
    choices: [{ message: { content: 'Mock response' }, finish_reason: 'stop' }],
  });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('ProviderRuntimeClientFactory', () => {
  const mockResolved: ResolvedProviderRuntime = {
    providerId: 'p-1',
    providerType: 'openai',
    displayName: 'OpenAI Test',
    modelId: 'gpt-4',
    baseUrl: 'https://api.zavorth.test/v1',
    capabilities: ['chat'],
    configured: true,
    runtimeReady: true
  };

  it('creates an invoker that works and holds the secret internally', async () => {
    const factory = ProviderRuntimeClientFactory.getInstance();
    const invoker = await factory.createInvoker(mockResolved);

    expect(typeof invoker.invoke).toBe('function');

    const result = await invoker.invoke({ messages: [{ role: 'user', content: 'hi' }] });
    expect(result.text).toBe('Mock response');
    
    // Check leak
    const jsonStr = JSON.stringify(invoker);
    expect(jsonStr).not.toContain('sk-zavorth-runtime-DO-NOT-LEAK-21I');
    expect((invoker as unknown as { apiKey?: unknown }).apiKey).toBeUndefined();
    expect((invoker as unknown as { rawKey?: unknown }).rawKey).toBeUndefined();
    expect(Object.keys(invoker)).not.toContain('apiKey');
  });

  it('normalizes provider errors and never returns raw error or headers', async () => {
    const factory = ProviderRuntimeClientFactory.getInstance();
    
    // Force the internal mock to use invalid key simulation
    LocalEncryptedProviderSecretStore.getInstance().getSecret = jest.fn().mockResolvedValue('sk-invalid-raw-secret-7a2b');
    globalThis.fetch = mockFetchResponse({}, 401);
    
    const invoker = await factory.createInvoker(mockResolved);
    
    let caught: { message?: string; status?: unknown; headers?: unknown };
    try {
      await invoker.invoke({ messages: [] });
    } catch (error: unknown) { const err = asErrorLike(error);
caught = err;
    }

    expect(caught.message).toBe('invalid_key');
    expect(caught.status).toBeUndefined(); // Normalized error removes HTTP statuses/headers
    expect(caught.headers).toBeUndefined();
    expect(JSON.stringify(caught)).not.toContain('sk-invalid-raw-secret-7a2b'); // Raw key must not leak
  });
});
