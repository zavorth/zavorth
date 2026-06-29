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
});
