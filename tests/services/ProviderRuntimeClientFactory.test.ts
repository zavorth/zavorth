import { ProviderRuntimeClientFactory } from '../../src/services/ProviderRuntimeClientFactory.js';
import { ResolvedProviderRuntime } from '../../src/services/ModelSelectionService.js';
import { ProviderSecretStore, LocalEncryptedProviderSecretStore } from '../../src/services/ProviderSecretStore.js';
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

describe('ProviderRuntimeClientFactory', () => {
  const mockResolved: ResolvedProviderRuntime = {
    providerId: 'p-1',
    providerType: 'openai',
    displayName: 'OpenAI Test',
    modelId: 'gpt-4',
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
    expect((invoker as any).apiKey).toBeUndefined();
    expect((invoker as any).rawKey).toBeUndefined();
    expect(Object.keys(invoker)).not.toContain('apiKey');
  });

  it('normalizes provider errors and never returns raw error or headers', async () => {
    const factory = ProviderRuntimeClientFactory.getInstance();
    
    // Force the internal mock to use invalid key simulation
    LocalEncryptedProviderSecretStore.getInstance().getSecret = jest.fn().mockResolvedValue('invalid_key');
    
    const invoker = await factory.createInvoker(mockResolved);
    
    let caught: any;
    try {
      await invoker.invoke({ messages: [] });
    } catch (error: unknown) { const err = asErrorLike(error);
caught = e;
    }

    expect(caught.message).toBe('invalid_key');
    expect(caught.status).toBeUndefined(); // Normalized error removes HTTP statuses/headers
    expect(caught.headers).toBeUndefined();
    expect(JSON.stringify(caught)).not.toContain('invalid_key'); // Besides the message
  });
});
