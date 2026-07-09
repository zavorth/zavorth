import { asErrorLike, errorMessage } from '../../src/utils/errorLike';

describe('errorLike', () => {
  it('wraps strings and objects', () => {
    expect(asErrorLike('boom').message).toBe('boom');
    expect(asErrorLike({ message: 'x', code: 1 }).code).toBe(1);
    expect(asErrorLike(null).message).toBe('Unexpected error');
  });

  it('wraps primitives and empty strings', () => {
    expect(asErrorLike(42).message).toBe('42');
    expect(asErrorLike(false).message).toBe('false');
    expect(asErrorLike('   ').message).toBe('Unexpected error');
  });

  it('reads messages with fallback', () => {
    expect(errorMessage(new Error('nope'))).toBe('nope');
    // empty object normalizes to a guaranteed non-empty message
    expect(errorMessage({})).toBe('Unexpected error');
    expect(errorMessage({}, 'fallback')).toBe('Unexpected error');
    expect(errorMessage('direct')).toBe('direct');
    expect(errorMessage(null, 'fallback')).toBe('Unexpected error');
  });

  it('always returns a string message from asErrorLike', () => {
    expect(typeof asErrorLike(new Error('x')).message).toBe('string');
    expect(typeof asErrorLike({}).message).toBe('string');
    expect(typeof asErrorLike(undefined).message).toBe('string');
    expect(asErrorLike(new Error('')).message.length).toBeGreaterThan(0);
  });
});
