import { ModelSelectionService } from '../../src/services/ModelSelectionService.js';
import { ProviderConfigService, ProviderConfig } from '../../src/services/ProviderConfigService.js';

// Mock ProviderConfigService
jest.mock('../../src/services/ProviderConfigService.js', () => {
  return {
    ProviderConfigService: {
      getInstance: jest.fn().mockReturnValue({
        getProviders: jest.fn()
      })
    }
  };
});

describe('ModelSelectionService', () => {
  let mockGetProviders: jest.Mock;

  beforeEach(() => {
    mockGetProviders = ProviderConfigService.getInstance().getProviders as jest.Mock;
    jest.clearAllMocks();
  });

  const baseConfig = {
    providerId: 'p-test',
    type: 'openai-compatible',
    displayName: 'Test',
    enabled: true,
    requiresApiKey: true,
    secretRef: 'secret-123',
    createdAt: 'now',
    updatedAt: 'now'
  };

  it('should select an explicit provider', async () => {
    mockGetProviders.mockResolvedValue([{ ...baseConfig }]);
    const service = ModelSelectionService.getInstance();

    const res = await service.selectProvider({ providerId: 'p-test' });
    expect(res.providerId).toBe('p-test');
    expect(res.configured).toBe(true);
    expect(res.runtimeReady).toBe(true);
  });

  it('should block explicit provider if disabled', async () => {
    mockGetProviders.mockResolvedValue([{ ...baseConfig, enabled: false }]);
    const service = ModelSelectionService.getInstance();

    await expect(service.selectProvider({ providerId: 'p-test' })).rejects.toThrow('provider_disabled');
  });

  it('should return missing_key flag if remote provider has no key', async () => {
    mockGetProviders.mockResolvedValue([{ ...baseConfig, secretRef: undefined }]);
    const service = ModelSelectionService.getInstance();

    const res = await service.selectProvider({ providerId: 'p-test' });
    expect(res.configured).toBe(false);
    expect(res.runtimeReady).toBe(false); // Flag is false, but doesn't throw here (Router will throw)
  });

  it('should allow local openai-compatible without key', async () => {
    mockGetProviders.mockResolvedValue([{ ...baseConfig, requiresApiKey: false, secretRef: undefined }]);
    const service = ModelSelectionService.getInstance();

    const res = await service.selectProvider({ providerId: 'p-test' });
    expect(res.configured).toBe(true);
    expect(res.runtimeReady).toBe(true);
  });

  it('should throw no_suitable_provider_found if trying to find a default but none are ready', async () => {
    mockGetProviders.mockResolvedValue([{ ...baseConfig, secretRef: undefined }]); // Not ready
    const service = ModelSelectionService.getInstance();

    await expect(service.selectProvider({})).rejects.toThrow('no_suitable_provider_found');
  });

  it('should throw capability_not_supported if requested capability is missing', async () => {
    mockGetProviders.mockResolvedValue([{ ...baseConfig, type: 'openai-compatible' }]); // Default doesn't have tool_calling
    const service = ModelSelectionService.getInstance();

    await expect(service.selectProvider({ providerId: 'p-test', capability: 'tool_calling' })).rejects.toThrow('capability_not_supported');
  });

  it('ResolvedProviderRuntime does not contain secret metadata', async () => {
    mockGetProviders.mockResolvedValue([{ ...baseConfig, secretRef: 'sk-zavorth-runtime-DO-NOT-LEAK-21I' }]);
    const service = ModelSelectionService.getInstance();

    const res = await service.selectProvider({ providerId: 'p-test' });

    const jsonStr = JSON.stringify(res);
    expect(jsonStr).not.toContain('secretRef');
    expect(jsonStr).not.toContain('apiKey');
    expect(jsonStr).not.toContain('sk-zavorth-runtime-DO-NOT-LEAK-21I');
    expect((res as any).secretRef).toBeUndefined();
  });
});
