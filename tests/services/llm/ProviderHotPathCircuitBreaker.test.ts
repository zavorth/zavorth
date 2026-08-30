import { ProviderHotPathCircuitBreaker } from '../../../src/services/llm/ProviderHotPathCircuitBreaker.js';

describe('ProviderHotPathCircuitBreaker', () => {
  beforeEach(() => {
    ProviderHotPathCircuitBreaker.resetInstanceForTests();
  });

  it('opens after threshold failures and skips attempts', async () => {
    const cb = new ProviderHotPathCircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 60_000,
    });

    expect(cb.canAttempt('openai')).toBe(true);
    await cb.recordFailure('openai', new Error('503 overloaded'));
    expect(cb.canAttempt('openai')).toBe(true);
    await cb.recordFailure('openai', new Error('503 overloaded'));
    expect(cb.canAttempt('openai')).toBe(false);

    const snap = cb.snapshot('openai');
    expect(snap[0]?.state).toBe('OPEN');
  });

  it('records success without throwing', async () => {
    const cb = new ProviderHotPathCircuitBreaker({ failureThreshold: 5 });
    await cb.recordSuccess('ollama');
    expect(cb.canAttempt('ollama')).toBe(true);
  });

  it('decays failure count by half on success from CLOSED state', async () => {
    const cb = new ProviderHotPathCircuitBreaker({
      failureThreshold: 4,
      resetTimeout: 60_000,
    });

    await cb.recordFailure('openai', new Error('503'));
    await cb.recordFailure('openai', new Error('503'));
    await cb.recordFailure('openai', new Error('503'));
    expect(cb.canAttempt('openai')).toBe(true);

    await cb.recordSuccess('openai');

    const snap = cb.snapshot('openai');
    expect(snap[0]?.state).toBe('CLOSED');
    expect(snap[0]?.failureCount).toBe(1);

    await cb.recordFailure('openai', new Error('503'));
    await cb.recordFailure('openai', new Error('503'));
    expect(cb.canAttempt('openai')).toBe(true);

    const snap2 = cb.snapshot('openai');
    expect(snap2[0]?.state).toBe('CLOSED');
  });

  it('resets fully on success from HALF_OPEN state', async () => {
    const cb = new ProviderHotPathCircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 1,
    });

    await cb.recordFailure('openai', new Error('503'));
    await cb.recordFailure('openai', new Error('503'));
    expect(cb.canAttempt('openai')).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(cb.canAttempt('openai')).toBe(true);

    await cb.recordSuccess('openai');

    const snap = cb.snapshot('openai');
    expect(snap[0]?.state).toBe('CLOSED');
    expect(snap[0]?.failureCount).toBe(0);
  });
});
