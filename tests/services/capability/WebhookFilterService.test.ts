import { WebhookRouteMatcher } from '../../../src/services/WebhookFilterService.js';

describe('WebhookRouteMatcher', () => {
  const matcher = new WebhookRouteMatcher();

  it('matches missing predicate as allow-all', () => {
    expect(matcher.matches(null, { event: 'request.completed', payload: {} })).toBe(true);
  });

  it('matches event eq and payload field', () => {
    const predicate = matcher.parsePredicate({
      all: [
        { field: 'event', eq: 'request.completed' },
        { field: 'payload.status', eq: 'ok' },
      ],
    });
    expect(matcher.matches(predicate, {
      event: 'request.completed',
      payload: { status: 'ok' },
    })).toBe(true);
    expect(matcher.matches(predicate, {
      event: 'request.completed',
      payload: { status: 'fail' },
    })).toBe(false);
  });

  it('supports regex and not', () => {
    const predicate = matcher.parsePredicate({
      all: [
        { field: 'payload.model', regex: 'gpt-4' },
        { not: { field: 'payload.env', eq: 'prod' } },
      ],
    });
    expect(matcher.matches(predicate, {
      event: 'test.ping',
      payload: { model: 'gpt-4o-mini', env: 'dev' },
    })).toBe(true);
    expect(matcher.matches(predicate, {
      event: 'test.ping',
      payload: { model: 'gpt-4o-mini', env: 'prod' },
    })).toBe(false);
  });

  it('supports any-of', () => {
    const predicate = matcher.parsePredicate({
      any: [
        { field: 'payload.provider', eq: 'openai' },
        { field: 'payload.provider', eq: 'anthropic' },
      ],
    });
    expect(matcher.matches(predicate, { event: 'x', payload: { provider: 'anthropic' } })).toBe(true);
    expect(matcher.matches(predicate, { event: 'x', payload: { provider: 'groq' } })).toBe(false);
  });
});
