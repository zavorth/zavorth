import { ProviderFallbackPolicyService } from '../../src/services/ProviderFallbackPolicyService.js';
import { ProviderInvocationService } from '../../src/services/ProviderInvocationService.js';
import { ProviderConfigService } from '../../src/services/ProviderConfigService.js';
import { SecurityAuditLogger } from '../../src/services/SecurityAuditLogger.js';

jest.mock('../../src/services/ProviderInvocationService.js', () => {
  return {
    ProviderInvocationService: {
      getInstance: jest.fn().mockReturnValue({
        invoke: jest.fn()
      })
    }
  };
});

jest.mock('../../src/services/ProviderConfigService.js', () => {
  return {
    ProviderConfigService: {
      getInstance: jest.fn().mockReturnValue({
        getProviders: jest.fn()
      })
    }
  };
});

describe('ProviderFallbackPolicyService', () => {
  let mockInvoke: jest.Mock;
  let mockGetProviders: jest.Mock;
  let loggerSpy: jest.SpyInstance;

  beforeEach(() => {
    mockInvoke = ProviderInvocationService.getInstance().invoke as jest.Mock;
    mockGetProviders = ProviderConfigService.getInstance().getProviders as jest.Mock;
    loggerSpy = jest.spyOn(SecurityAuditLogger.prototype, 'logWorkspaceEvent').mockResolvedValue(undefined);
    mockInvoke.mockReset();
    mockGetProviders.mockReset();
    loggerSpy.mockClear();
  });

  afterEach(() => {
    loggerSpy.mockRestore();
  });

  it('invokes initial provider and returns if successful', async () => {
    mockInvoke.mockResolvedValue({ text: 'success' });

    const service = ProviderFallbackPolicyService.getInstance();
    const res = await service.invokeWithFallback({ providerId: 'p-1', allowFallback: true }, []);

    expect(res.text).toBe('success');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(res.fallbackUsed).toBe(false);
    expect(res.routingAttempts?.map(attempt => attempt.status)).toEqual(['succeeded']);
    expect(loggerSpy).toHaveBeenCalledWith(expect.objectContaining({ event: 'provider_route_attempt_started' }));
    expect(loggerSpy).toHaveBeenCalledWith(expect.objectContaining({ event: 'provider_route_attempt_succeeded' }));
  });

  it('does not fallback if allowFallback is false', async () => {
    mockInvoke.mockRejectedValue(new Error('timeout'));

    const service = ProviderFallbackPolicyService.getInstance();
    await expect(service.invokeWithFallback({ providerId: 'p-1', allowFallback: false }, [])).rejects.toThrow('timeout');

    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('does not fallback if error is missing_key', async () => {
    mockInvoke.mockRejectedValue(new Error('missing_key'));

    const service = ProviderFallbackPolicyService.getInstance();
    await expect(service.invokeWithFallback({ providerId: 'p-1', allowFallback: true }, [])).rejects.toThrow('missing_key');

    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('falls back to the next available and configured provider', async () => {
    mockGetProviders.mockResolvedValue([
      { providerId: 'p-1', enabled: true, requiresApiKey: true, secretRef: 'key' },
      { providerId: 'p-2', enabled: true, requiresApiKey: true, secretRef: 'key' }
    ]);

    mockInvoke
      .mockRejectedValueOnce(new Error('timeout')) // First fails
      .mockResolvedValueOnce({ text: 'fallback-success' }); // Second succeeds

    const service = ProviderFallbackPolicyService.getInstance();
    const res = await service.invokeWithFallback({ providerId: 'p-1', allowFallback: true }, []);

    expect(res.text).toBe('fallback-success');
    expect(mockInvoke).toHaveBeenCalledTimes(2);

    expect(loggerSpy).toHaveBeenCalledWith(expect.objectContaining({ event: 'provider_runtime_fallback_attempted' }));
    expect(loggerSpy).toHaveBeenCalledWith(expect.objectContaining({ event: 'provider_runtime_fallback_succeeded' }));
  });

  it('respects explicit resilient fallback order and returns routing receipt metadata', async () => {
    mockGetProviders.mockResolvedValue([
      { providerId: 'p-1', enabled: true, requiresApiKey: true, secretRef: 'key' },
      { providerId: 'p-2', enabled: true, requiresApiKey: true, secretRef: 'key' },
      { providerId: 'p-3', enabled: true, requiresApiKey: true, secretRef: 'key' }
    ]);

    mockInvoke
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ text: 'fallback-success' });

    const service = ProviderFallbackPolicyService.getInstance();
    const res = await service.invokeWithFallback({
      providerId: 'p-1',
      allowFallback: true,
      workspaceId: 'workspace-1',
      resiliencePolicy: {
        enabled: true,
        fallbackOrder: [
          { providerId: 'p-3', modelId: 'fallback-model' },
          { providerId: 'p-2' }
        ],
        timeoutMs: 5000,
        maxAttempts: 3,
        retryableErrorCodes: ['timeout']
      }
    }, []);

    expect(res.text).toBe('fallback-success');
    expect(res.fallbackUsed).toBe(true);
    expect(res.budgetDecision).toBe('allowed');
    expect(res.routingReceiptId).toContain('provider-route:workspace-1:');
    expect(res.routingAttempts?.map(attempt => attempt.providerId)).toEqual(['p-1', 'p-3']);
    expect(mockInvoke.mock.calls[1][0]).toMatchObject({
      providerId: 'p-3',
      modelId: 'fallback-model'
    });
  });

  it('blocks before invocation when resilient daily budget is exthere isusted', async () => {
    const service = ProviderFallbackPolicyService.getInstance();

    await expect(service.invokeWithFallback({
      providerId: 'p-1',
      allowFallback: true,
      workspaceId: 'workspace-1',
      resiliencePolicy: {
        enabled: true,
        fallbackOrder: [{ providerId: 'p-2' }],
        timeoutMs: 5000,
        maxAttempts: 2,
        dailyBudgetCents: 0,
        retryableErrorCodes: ['timeout']
      }
    }, [])).rejects.toThrow('budget_blocked');

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith(expect.objectContaining({
      event: 'provider_route_budget_blocked'
    }));
  });

  it('does not fallback for policy and security errors', async () => {
    mockGetProviders.mockResolvedValue([
      { providerId: 'p-1', enabled: true, requiresApiKey: true, secretRef: 'key' },
      { providerId: 'p-2', enabled: true, requiresApiKey: true, secretRef: 'key' }
    ]);
    mockInvoke.mockRejectedValue(new Error('policy_denied'));

    const service = ProviderFallbackPolicyService.getInstance();
    await expect(service.invokeWithFallback({
      providerId: 'p-1',
      allowFallback: true,
      resiliencePolicy: {
        enabled: true,
        fallbackOrder: [{ providerId: 'p-2' }],
        timeoutMs: 5000,
        maxAttempts: 2,
        retryableErrorCodes: ['timeout', 'policy_denied']
      }
    }, [])).rejects.toThrow('policy_denied');

    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('skips fallbacks that are not configured', async () => {
    mockGetProviders.mockResolvedValue([
      { providerId: 'p-1', enabled: true, requiresApiKey: true, secretRef: 'key' },
      { providerId: 'p-2', enabled: true, requiresApiKey: true, secretRef: undefined }, // Should skip
      { providerId: 'p-3', enabled: true, requiresApiKey: false } // Should try
    ]);

    mockInvoke
      .mockRejectedValueOnce(new Error('timeout')) // First fails
      .mockResolvedValueOnce({ text: 'fallback-success' }); // Third succeeds

    const service = ProviderFallbackPolicyService.getInstance();
    const res = await service.invokeWithFallback({ providerId: 'p-1', allowFallback: true }, []);

    expect(res.text).toBe('fallback-success');

    // It should have tried p-3
    expect(mockInvoke.mock.calls[1][0].providerId).toBe('p-3');
  });
});
