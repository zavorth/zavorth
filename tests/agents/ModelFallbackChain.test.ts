import { describe, it, expect, beforeEach } from '@jest/globals';
import { ModelFallbackChain } from '../../src/agents/ModelFallbackChain.js';

describe('ModelFallbackChain', () => {
  let chain: ModelFallbackChain;

  beforeEach(() => {
    chain = new ModelFallbackChain({
      primary: { provider: 'openai', model: 'gpt-4o' },
      fallbacks: [
        { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
        { provider: 'google', model: 'gemini-2.0-flash' },
      ],
      cooldownMs: 1000,
    });
  });

  const busyWait = (ms: number): void => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) { /* spin */ }
  };

  it('selects primary candidate initially', () => {
    const candidate = chain.selectCandidate();
    expect(candidate).toEqual({ provider: 'openai', model: 'gpt-4o' });
  });

  it('selects fallback after primary failure', () => {
    chain.recordFailure({ provider: 'openai', model: 'gpt-4o' }, 'rate_limit');

    const candidate = chain.selectCandidate();
    expect(candidate).toEqual({ provider: 'anthropic', model: 'claude-sonnet-4-20250514' });
  });

  it('returns null when all candidates in cooldown', () => {
    chain.recordFailure({ provider: 'openai', model: 'gpt-4o' }, 'rate_limit');
    chain.recordFailure({ provider: 'anthropic', model: 'claude-sonnet-4-20250514' }, 'rate_limit');
    chain.recordFailure({ provider: 'google', model: 'gemini-2.0-flash' }, 'rate_limit');

    const candidate = chain.selectCandidate();
    expect(candidate).toBeNull();
  });

  it('resets candidate on success', () => {
    chain.recordFailure({ provider: 'openai', model: 'gpt-4o' }, 'rate_limit');
    chain.recordSuccess({ provider: 'openai', model: 'gpt-4o' });

    const candidate = chain.selectCandidate();
    expect(candidate).toEqual({ provider: 'openai', model: 'gpt-4o' });
  });

  it('adds auth_error to knownBad', () => {
    chain.recordFailure({ provider: 'openai', model: 'gpt-4o' }, 'auth_error');

    const summary = chain.getSummary();
    expect(summary.knownBad).toBe(1);
  });

  it('returns correct summary', () => {
    const summary = chain.getSummary();
    expect(summary.total).toBe(3);
    expect(summary.available).toBe(3);
    expect(summary.inCooldown).toBe(0);
  });

  it('tracks candidates with status', () => {
    chain.recordFailure({ provider: 'openai', model: 'gpt-4o' }, 'rate_limit');

    const candidates = chain.getCandidatesWithStatus();
    expect(candidates[0].available).toBe(false);
    expect(candidates[1].available).toBe(true);
  });

  it('decays failure count by half on success instead of full reset', () => {
    const primary = { provider: 'openai', model: 'gpt-4o' };
    chain.recordFailure(primary, 'rate_limit');
    chain.recordFailure(primary, 'rate_limit');
    chain.recordFailure(primary, 'rate_limit');

    chain.recordSuccess(primary);

    const summaryAfterSuccess = chain.getSummary();
    expect(summaryAfterSuccess.inCooldown).toBe(1);

    busyWait(3500);

    const summaryAfterFullDecay = chain.getSummary();
    expect(summaryAfterFullDecay.available).toBe(3);
  });

  it('removes candidate from cooldown after enough successes', () => {
    const primary = { provider: 'openai', model: 'gpt-4o' };
    chain.recordFailure(primary, 'rate_limit');
    chain.recordFailure(primary, 'rate_limit');
    chain.recordFailure(primary, 'rate_limit');
    chain.recordFailure(primary, 'rate_limit');
    chain.recordFailure(primary, 'rate_limit');

    chain.recordSuccess(primary);
    const afterFirst = chain.getSummary();
    expect(afterFirst.inCooldown).toBe(1);

    chain.recordSuccess(primary);
    const afterSecond = chain.getSummary();
    expect(afterSecond.inCooldown).toBe(1);

    chain.recordSuccess(primary);
    const afterThird = chain.getSummary();
    expect(afterThird.inCooldown).toBe(0);
  });

  it('clears knownBad after success-decay', () => {
    const primary = { provider: 'openai', model: 'gpt-4o' };
    chain.recordFailure(primary, 'auth_error');
    expect(chain.getSummary().knownBad).toBe(1);

    chain.recordSuccess(primary);
    expect(chain.getSummary().knownBad).toBe(0);
  });

  it('isolates cooldown per connectionId', () => {
    const conn1 = { provider: 'openai', model: 'gpt-4o', connectionId: 'conn-1' };
    const conn2 = { provider: 'openai', model: 'gpt-4o', connectionId: 'conn-2' };

    chain.recordFailure(conn1, 'rate_limit');

    expect(chain.isAvailable(conn1)).toBe(false);
    expect(chain.isAvailable(conn2)).toBe(true);
  });

  it('treats candidates without connectionId as shared', () => {
    const shared = { provider: 'openai', model: 'gpt-4o' };
    const withConn = { provider: 'openai', model: 'gpt-4o', connectionId: 'conn-1' };

    chain.recordFailure(shared, 'rate_limit');

    expect(chain.isAvailable(shared)).toBe(false);
    expect(chain.isAvailable(withConn)).toBe(true);
  });

  it('reports shared candidate as available when only specific connection is in cooldown', () => {
    const conn1 = { provider: 'openai', model: 'gpt-4o', connectionId: 'conn-1' };

    chain.recordFailure(conn1, 'rate_limit');

    const candidates = chain.getCandidatesWithStatus();
    const openaiEntry = candidates.find((c) => c.provider === 'openai');
    expect(openaiEntry?.available).toBe(true);
  });
});
