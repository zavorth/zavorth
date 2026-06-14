import { ModelSelectionService } from '../../src/services/ModelSelectionService.js';
import { ProviderConfigService } from '../../src/services/ProviderConfigService.js';
import { ProviderRuntimeClientFactory } from '../../src/services/ProviderRuntimeClientFactory.js';
import { ProviderSecretStore } from '../../src/services/ProviderSecretStore.js';
import { ProviderInvocationService } from '../../src/services/ProviderInvocationService.js';
import { SecurityAuditLogger } from '../../src/services/SecurityAuditLogger.js';

// Mock Config & Store
jest.mock('../../src/services/ProviderConfigService.js', () => {
  return {
    ProviderConfigService: {
      getInstance: jest.fn().mockReturnValue({
        getProviders: jest.fn()
      })
    }
  };
});

jest.mock('../../src/services/ProviderSecretStore.js', () => {
  return {
    ProviderSecretStore: {
      getInstance: jest.fn().mockReturnValue({
        getSecret: jest.fn()
      })
    }
  };
});

describe('ProviderRuntimeSecretLeak Check', () => {
  const LEAK_MARKER = 'sk-zavorth-runtime-DO-NOT-LEAK-21I';
  let loggerSpy: jest.SpyInstance;

  beforeEach(() => {
    loggerSpy = jest.spyOn(SecurityAuditLogger.prototype, 'logWorkspaceEvent').mockResolvedValue(undefined);
    jest.clearAllMocks();
  });

  afterEach(() => {
    loggerSpy.mockRestore();
  });

  it('proves that the marker does not leak into audit, logs, or resolved objects', async () => {
    const mockGetProviders = ProviderConfigService.getInstance().getProviders as jest.Mock;
    mockGetProviders.mockResolvedValue([{
      providerId: 'p-leak-test',
      type: 'openai-compatible',
      displayName: 'Leak Test',
      enabled: true,
      requiresApiKey: true,
      secretRef: 'internal-ref-never-leak',
      defaultModel: 'test-model'
    }]);

    const mockGetSecret = ProviderSecretStore.getInstance().getSecret as jest.Mock;
    mockGetSecret.mockResolvedValue(LEAK_MARKER); // THIS IS THE ONLY PLACE IT CAN EXIST

    // 1. Selector should not return the secretRef or the marker
    const selector = ModelSelectionService.getInstance();
    const resolved = await selector.selectProvider({ providerId: 'p-leak-test' });
    expect(JSON.stringify(resolved)).not.toContain(LEAK_MARKER);
    expect(JSON.stringify(resolved)).not.toContain('internal-ref-never-leak');

    // 2. Factory invoker should not return headers or secret
    const factory = ProviderRuntimeClientFactory.getInstance();
    const invoker = await factory.createInvoker(resolved);
    expect(JSON.stringify(invoker)).not.toContain(LEAK_MARKER);
    expect(JSON.stringify(invoker)).not.toContain('apiKey');

    // 3. Invocation should not leak the marker into the result or audit
    const invocationSvc = ProviderInvocationService.getInstance();
    const result = await invocationSvc.invoke({ providerId: 'p-leak-test' }, []);
    expect(JSON.stringify(result)).not.toContain(LEAK_MARKER);

    // 4. Audit logger should not have received the marker
    loggerSpy.mock.calls.forEach(call => {
      expect(JSON.stringify(call)).not.toContain(LEAK_MARKER);
    });
  });
});
