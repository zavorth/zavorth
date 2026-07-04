import { ProviderConnectionTestService } from '../../src/services/ProviderConnectionTestService';
import { ProviderConfigService } from '../../src/services/ProviderConfigService';
import { LocalEncryptedProviderSecretStore } from '../../src/services/ProviderSecretStore';
import { safeFetch } from '../../src/security/SafeFetchService';

jest.mock('../../src/services/ProviderConfigService');
jest.mock('../../src/services/ProviderSecretStore');
jest.mock('../../src/security/SafeFetchService', () => ({
  safeFetch: jest.fn(),
}));

describe('ProviderConnectionTestService - Combinatorial Matrix Tests', () => {
  let service: ProviderConnectionTestService;
  let mockSafeFetch: jest.Mock;

  beforeEach(() => {
    service = ProviderConnectionTestService.getInstance();
    mockSafeFetch = safeFetch as jest.Mock;
    mockSafeFetch.mockReset();
  });

  const providerTypes = ['openai', 'anthropic', 'google', 'ollama', 'openai-compatible'];
  const apiKeyStates = ['valid', 'invalid', 'missing', 'empty'];
  const statusCodes = [200, 201, 400, 401, 403, 404, 500, 503, 'timeout', 'network_error'];
  const abortSignals = [false, true];

  for (const providerType of providerTypes) {
    for (const keyState of apiKeyStates) {
      for (const status of statusCodes) {
        for (const aborted of abortSignals) {
          it(`should handle connection test: providerType=${providerType}, keyState=${keyState}, status=${status}, aborted=${aborted}`, async () => {
            const providerId = `test-provider-${providerType}`;
            const requiresApiKey = providerType !== 'ollama';

            // Mock Provider Config
            const mockGetProvider = jest.fn().mockResolvedValue({
              providerId,
              type: providerType,
              baseUrl: providerType === 'ollama' ? 'http://localhost:11434' : 'https://api.example.com',
              requiresApiKey,
              secretRef: requiresApiKey ? `secret-ref-${providerId}` : undefined,
            });
            (ProviderConfigService.getInstance as jest.Mock).mockReturnValue({
              getProvider: mockGetProvider,
            });

            // Mock Secret Store
            let secretValue: string | null = 'sk-test-valid-key';
            if (keyState === 'missing') secretValue = null;
            if (keyState === 'empty') secretValue = '';
            if (keyState === 'invalid') secretValue = 'sk-invalid';

            const mockGetSecret = jest.fn().mockResolvedValue(secretValue);
            (LocalEncryptedProviderSecretStore.getInstance as jest.Mock).mockReturnValue({
              getSecret: mockGetSecret,
            });

            // Mock safeFetch behavior
            if (aborted || status === 'timeout') {
              const abortError = new Error('The user aborted a request.');
              abortError.name = 'AbortError';
              mockSafeFetch.mockRejectedValue(abortError);
            } else if (status === 'network_error') {
              mockSafeFetch.mockRejectedValue(new Error('TypeError: fetch failed'));
            } else {
              mockSafeFetch.mockResolvedValue({
                status: status as number,
                json: jest.fn().mockResolvedValue({}),
                text: jest.fn().mockResolvedValue(''),
              });
            }

            // Run the test
            const result = await service.testConnection(providerId);

            // Assertions
            if (requiresApiKey && (keyState === 'missing' || keyState === 'empty')) {
              expect(result.ok).toBe(false);
              expect(result.status).toBe('missing_key');
            } else if (aborted || status === 'timeout') {
              expect(result.ok).toBe(false);
              expect(result.status).toBe('timeout');
            } else if (status === 'network_error') {
              expect(result.ok).toBe(false);
              expect(result.status).toBe('network_error');
            } else {
              // Status code responses based on provider type logic
              if (providerType === 'openai' || providerType === 'openai-compatible') {
                if (status === 200) {
                  expect(result.ok).toBe(true);
                  expect(result.status).toBe('reachable');
                } else if (status === 401 || status === 403) {
                  expect(result.ok).toBe(false);
                  expect(result.status).toBe('invalid_key');
                } else {
                  expect(result.ok).toBe(false);
                  expect(result.status).toBe('network_error');
                }
              } else if (providerType === 'anthropic') {
                if (status === 401 || status === 403) {
                  expect(result.ok).toBe(false);
                  expect(result.status).toBe('invalid_key');
                } else {
                  expect(result.ok).toBe(true);
                  expect(result.status).toBe('reachable');
                }
              } else if (providerType === 'google') {
                if (status === 200) {
                  expect(result.ok).toBe(true);
                  expect(result.status).toBe('reachable');
                } else if (status === 400 || status === 401 || status === 403) {
                  expect(result.ok).toBe(false);
                  expect(result.status).toBe('invalid_key');
                } else {
                  expect(result.ok).toBe(false);
                  expect(result.status).toBe('network_error');
                }
              } else if (providerType === 'ollama') {
                if (status === 200) {
                  expect(result.ok).toBe(true);
                  expect(result.status).toBe('reachable');
                } else {
                  expect(result.ok).toBe(false);
                  expect(result.status).toBe('network_error');
                }
              }
            }
          });
        }
      }
    }
  }
});
