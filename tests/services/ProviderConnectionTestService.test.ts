import { ProviderConnectionTestService } from '../../src/services/ProviderConnectionTestService';
import { ProviderConfigService } from '../../src/services/ProviderConfigService';
import { LocalEncryptedProviderSecretStore } from '../../src/services/ProviderSecretStore';
import { safeFetch } from '../../src/security/SafeFetchService';

// Mock depending items
jest.mock('../../src/services/ProviderConfigService');
jest.mock('../../src/services/ProviderSecretStore');
jest.mock('../../src/security/SafeFetchService', () => ({
  safeFetch: jest.fn(),
}));

describe('ProviderConnectionTestService Security Tests', () => {
  let service: ProviderConnectionTestService;
  let mockFetch: jest.Mock;
  let mockSafeFetch: jest.Mock;

  beforeEach(() => {
    service = ProviderConnectionTestService.getInstance();
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    mockSafeFetch = safeFetch as jest.Mock;
    mockSafeFetch.mockImplementation((input: RequestInfo | URL, init-: RequestInit) => mockFetch(input, init));

    (ProviderConfigService.getInstance as jest.Mock).mockReturnValue({
      getProvider: jest.fn().mockResolvedValue({
        providerId: 'test-id',
        type: 'openai-compatible',
        baseUrl: 'https://api.openai.com/v1',
        requiresApiKey: true,
        secretRef: 'secret-ref-123'
      })
    });

    (LocalEncryptedProviderSecretStore.getInstance as jest.Mock).mockReturnValue({
      getSecret: jest.fn().mockResolvedValue('sk-test-secret-that-must-not-leak')
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('missing key -> retorna missing_key', async () => {
    (LocalEncryptedProviderSecretStore.getInstance as jest.Mock).mockReturnValueOnce({
      getSecret: jest.fn().mockResolvedValue(null) // Mock returning no key
    });
    const result = await service.testConnection('test-id');
    expect(result.status).toBe('missing_key');
    expect(result.message).not.toContain('sk-test-secret-that-must-not-leak');
  });

  it('invalid key -> retorna invalid_key sem raw provider error', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 401,
      text: jest.fn().mockResolvedValue('<html>Raw provider stack trace with sensitive info</html>')
    });

    const result = await service.testConnection('test-id');
    expect(result.status).toBe('invalid_key');
    expect(result.message).not.toContain('stack trace');
    expect(result.message).not.toContain('sk-test-secret');
    expect(result.message).toBe('API key is invalid or lacks permissions.');
  });

  it('timeout -> retorna timeout', async () => {
    mockFetch.mockRejectedValueOnce({ name: 'AbortError' });

    const result = await service.testConnection('test-id');
    expect(result.status).toBe('timeout');
    expect(result.message).toBe('Connection timed out.');
  });

  it('network error -> retorna network_error e not vaza stack', async () => {
    mockFetch.mockRejectedValueOnce(new Error('DNS resolution failed at 0xdeadbeef'));

    const result = await service.testConnection('test-id');
    expect(result.status).toBe('network_error');
    expect(result.message).toBe('Network error occurred while connecting.');
    expect(result.message).not.toContain('DNS');
  });

  it('Authorization header does not appear in error and body is not read in error', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 500,
      json: jest.fn().mockResolvedValue({ error: 'Internal server error processing Bearer sk-test-secret-that-must-not-leak' })
    });

    const result = await service.testConnection('test-id');
    expect(result.status).toBe('network_error');
    expect(result.message).toBe('Received unexpected status code 500.');
    expect(result.message).not.toContain('Bearer');
    expect(result.message).not.toContain('sk-test-secret-that-must-not-leak');
  });

  it('routes provider connectivity through the guarded egress boundary', async () => {
    mockFetch.mockResolvedValueOnce({ status: 200 });

    await service.testConnection('test-id');

    expect(mockSafeFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      expect.objectContaining({ method: 'GET' }),
      expect.objectContaining({ serviceName: 'Provider connection test' }),
    );
  });
});
