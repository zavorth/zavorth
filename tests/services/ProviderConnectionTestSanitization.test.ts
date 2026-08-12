import { ProviderConnectionTestService } from '../../src/services/ProviderConnectionTestService';
import { ProviderConfigService } from '../../src/services/ProviderConfigService';
import { LocalEncryptedProviderSecretStore } from '../../src/services/ProviderSecretStore';

describe('ProviderConnectionTestService Sanitization Test', () => {
  it('never returns raw stack traces, error messages, or auth headers in response', async () => {
    // Mock Provider dependencies
    jest.spyOn(ProviderConfigService.getInstance(), 'getProvider').mockResolvedValue({
      providerId: 'fake-id',
      type: 'openai',
      displayName: 'Test',
      enabled: true,
      requiresApiKey: true,
      baseUrl: 'https://api.openai.com/v1',
      secretRef: 'fake-ref',
      createdAt: '',
      updatedAt: ''
    });

    jest.spyOn(LocalEncryptedProviderSecretStore.getInstance(), 'getSecret').mockResolvedValue('sk-test-secret');

    // Trigger test connection
    const connectionTestSvc = ProviderConnectionTestService.getInstance();
    
    // We mock global.fetch to simulate a backend error containing a stack trace and secret
    global.fetch = jest.fn().mockRejectedValue(new Error(`Failed with raw key: sk-test-secret\nStack: Error at /src/some/file.ts`));

    const result = await connectionTestSvc.testConnection('fake-id');

    expect(result.ok).toBe(false);
    expect(result.status).toBe('network_error');
    
    // Message MUST be sanitized
    const message = result.message;
    expect(message).toBe('Network error occurred while connecting.');
    expect(message).not.toContain('sk-test-secret');
    expect(message).not.toContain('Stack:');
    expect(message).not.toContain('Failed with raw key');
  });
});
