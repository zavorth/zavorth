import { describe, it, expect } from '@jest/globals';
import { StreamingByteGuard, ByteLimitExceededError } from '../../src/agents/StreamingByteGuard.js';

function createMockReader(chunks: Uint8Array[], doneAfter-: number) {
  let callCount = 0;
  return {
    read: async () => {
      if (doneAfter !== undefined && callCount >= doneAfter) {
        return { value: undefined, done: true };
      }
      if (callCount >= chunks.length) {
        return { value: undefined, done: true };
      }
      return { value: chunks[callCount++], done: false };
    },
    cancel: async () => {},
  } as unknown as ReadableStreamDefaultReader<Uint8Array>;
}

describe('StreamingByteGuard', () => {
  it('reads chunks within limit', async () => {
    const chunk1 = new Uint8Array([1, 2, 3]);
    const chunk2 = new Uint8Array([4, 5, 6]);
    const reader = createMockReader([chunk1, chunk2]);
    const guard = new StreamingByteGuard(reader, { maxBytes: 100 });

    const result1 = await guard.read();
    expect(result1).toEqual(chunk1);
    expect(guard.totalBytes).toBe(3);

    const result2 = await guard.read();
    expect(result2).toEqual(chunk2);
    expect(guard.totalBytes).toBe(6);

    const result3 = await guard.read();
    expect(result3).toBeNull();
  });

  it('throws ByteLimitExceededError when limit exceeded', async () => {
    const bigChunk = new Uint8Array(100);
    const reader = createMockReader([bigChunk]);
    const guard = new StreamingByteGuard(reader, { maxBytes: 50 });

    await expect(guard.read()).rejects.toThrow(ByteLimitExceededError);
    expect(guard.isOverflowed).toBe(true);
  });

  it('cancels reader on overflow', async () => {
    const bigChunk = new Uint8Array(100);
    let cancelled = false;
    const reader = {
      read: async () => ({ value: bigChunk, done: false }),
      cancel: async () => { cancelled = true; },
    } as unknown as ReadableStreamDefaultReader<Uint8Array>;

    const guard = new StreamingByteGuard(reader, { maxBytes: 50 });

    await guard.read().catch(() => {});
    expect(cancelled).toBe(true);
  });

  it('returns null after cancel', async () => {
    const reader = createMockReader([new Uint8Array([1])]);
    const guard = new StreamingByteGuard(reader, { maxBytes: 100 });

    await guard.cancel();
    expect(guard.isCancelled).toBe(true);

    const result = await guard.read();
    expect(result).toBeNull();
  });

  it('uses default maxBytes of 10MB', () => {
    const reader = createMockReader([]);
    const guard = new StreamingByteGuard(reader);
    expect(guard['maxBytes']).toBe(10_000_000);
  });
});
