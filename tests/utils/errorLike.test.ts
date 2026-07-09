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
    expect(errorMessage({}, 'fallback')).toBe('fallback');
    expect(errorMessage('direct')).toBe('direct');
  });
});
