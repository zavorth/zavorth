import { countTokens, countMessagesTokens } from '../../src/utils/tokenCounter';

describe('tokenCounter', () => {
  it('correctly counts tokens for standard text', () => {
    // "hello" is usually 1 token
    expect(countTokens('hello')).toBe(1);
    expect(countTokens('')).toBe(0);
    // "Hello, world!" is usually 3-4 tokens
    expect(countTokens('Hello, world!')).toBeGreaterThanOrEqual(3);
  });

  it('correctly counts tokens for ChatML messages list', () => {
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello' }
    ];
    // Each message has 4 tokens overhead, plus primed assistant response (3 tokens)
    // "You are a helpful assistant." is 6 tokens
    // "Hello" is 1 token
    // Total tokens: 4 (overhead) + 6 (system) + 4 (overhead) + 1 (user) + 3 (priming) = 18 tokens
    const total = countMessagesTokens(messages);
    expect(total).toBe(18);
  });
});
