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
});
