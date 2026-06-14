import { ProviderConnectionTestService } from '../../src/services/ProviderConnectionTestService';
import { ProviderConfigService } from '../../src/services/ProviderConfigService';
import { LocalEncryptedProviderSecretStore } from '../../src/services/ProviderSecretStore';
import { SecurityAuditLogger } from '../../src/services/SecurityAuditLogger';
import { LogRepository } from '../../src/storage/LogRepository';

describe('Logs/Audit/Console Leak Test (Phase 21H)', () => {
  const testSecret = 'sk-zavorth-audit-leak-test-21H';

  it('never leaks the API key in logs, audit or connection errors', async () => {
    // Spy on consoles
    const logSpy = jest.spyOn(console, 'log').mockImplementation();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Spy on LogRepository
    const logRepoSpy = jest.spyOn(LogRepository.prototype, 'log').mockImplementation();

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

    jest.spyOn(LocalEncryptedProviderSecretStore.getInstance(), 'getSecret').mockResolvedValue(testSecret);

    // Trigger test connection
    const connectionTestSvc = ProviderConnectionTestService.getInstance();
    
    // We mock global.fetch to simulate a backend error containing the testSecret
    global.fetch = jest.fn().mockRejectedValue(new Error(`Failed with key: ${testSecret}`));

    let errorResult: any;
    try {
      errorResult = await connectionTestSvc.testConnection('fake-id');
    } catch (e) {
      errorResult = e;
    }

    // Now check all spies
    const allCalls = [
      ...logSpy.mock.calls,
      ...warnSpy.mock.calls,
      ...errorSpy.mock.calls,
      ...logRepoSpy.mock.calls
    ];

    const stringifiedCalls = JSON.stringify(allCalls);
    expect(stringifiedCalls).not.toContain(testSecret);

    // Also check the result from connectionTestSvc to ensure no leak
    const resultStringified = JSON.stringify(errorResult);
    expect(resultStringified).not.toContain(testSecret);

    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    logRepoSpy.mockRestore();
  });
});
