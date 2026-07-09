import { describe, expect, it } from 'vitest';
import { errorMessage } from '../src/lib/errors';

describe('errorMessage', () => {
  it('reads Error.message', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('reads string errors', () => {
    expect(errorMessage('nope')).toBe('nope');
  });

  it('reads object message fields', () => {
    expect(errorMessage({ message: 'failed' })).toBe('failed');
  });

  it('falls back for empty or unknown values', () => {
    expect(errorMessage(null)).toBe('Unexpected error');
    expect(errorMessage(undefined, 'x')).toBe('x');
    expect(errorMessage(42)).toBe('Unexpected error');
  });
});
