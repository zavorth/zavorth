import {
  DEFAULT_RESILIENT_ROUTE_TIMEOUT_MS,
  ResilientRoutePolicyService,
} from '../../src/services/ResilientRoutePolicyService';

describe('ResilientRoutePolicyService', () => {
  it('normalizes an empty policy with stable defaults', () => {
    const policy = new ResilientRoutePolicyService().normalizePolicy();

    expect(policy).toEqual({
      enabled: false,
      fallbackOrder: [],
      timeoutMs: DEFAULT_RESILIENT_ROUTE_TIMEOUT_MS,
      maxAttempts: 3,
      retryableErrorCodes: [
        'timeout',
        'rate_limited',
        'provider_unavailable',
        'server_error',
      ],
    });
  });

  it('rejects invalid timeout and attempt values', () => {
    const service = new ResilientRoutePolicyService();

    expect(() => service.normalizePolicy({ timeoutMs: 0 })).toThrow('invalid_resilience_timeout');
    expect(() => service.normalizePolicy({ maxAttempts: 0 })).toThrow('invalid_resilience_attempts');
  });

  it('deduplicates fallback routes while preserving deterministic order', () => {
    const policy = new ResilientRoutePolicyService().normalizePolicy({
      enabled: true,
      primaryProviderId: 'primary',
      fallbackOrder: [
        { providerId: 'fallback-a', modelId: 'fast' },
        { providerId: 'fallback-a', modelId: 'fast' },
        { providerId: 'fallback-a', modelId: 'deep' },
        { providerId: 'fallback-b' },
      ],
    });

    expect(policy.fallbackOrder).toEqual([
      { providerId: 'fallback-a', modelId: 'fast' },
      { providerId: 'fallback-a', modelId: 'deep' },
      { providerId: 'fallback-b' },
    ]);
  });

  it('classifies retryable and non-retryable errors safely', () => {
    const service = new ResilientRoutePolicyService();
    const policy = service.normalizePolicy({ enabled: true });

    expect(service.isRetryableError('timeout', policy)).toBe(true);
    expect(service.isRetryableError('rate_limited', policy)).toBe(true);
    expect(service.isRetryableError('missing_key', policy)).toBe(false);
    expect(service.isRetryableError('prompt_injection_detected', policy)).toBe(false);
    expect(service.isRetryableError('policy_denied', policy)).toBe(false);
  });

  it('blocks a route before invocation when daily budget is exhausted', () => {
    const service = new ResilientRoutePolicyService();
    const policy = service.normalizePolicy({
      enabled: true,
      dailyBudgetCents: 0,
    });

    expect(service.evaluateBudget(policy)).toEqual({
      decision: 'blocked',
      reason: 'daily_budget_exhausted',
      dailyBudgetCents: 0,
      receiptLine: expect.stringContaining('Cost guard:'),
    });
  });
});
