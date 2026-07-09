import { describe, expect, it } from 'vitest';
import {
  MAX_QUEUE_LENGTH,
  canSubmitNow,
  clearQueue,
  createQueueId,
  dequeuePrompt,
  enqueuePrompt,
  nextAutoSubmit,
  peekQueue,
  removeQueuedPrompt,
  type QueuedPrompt,
} from '../src/composer/composerQueue';

function makeQueue(n: number, prefix = 'item'): QueuedPrompt[] {
  let q: QueuedPrompt[] = [];
  for (let i = 0; i < n; i++) {
    q = enqueuePrompt(q, `${prefix}-${i}`, 1_000 + i, () => `id-${i}`);
  }
  return q;
}

describe('createQueueId', () => {
  it('creates unique ids', () => {
    const a = createQueueId(() => 100, () => 'aaa');
    const b = createQueueId(() => 100, () => 'aaa');
    expect(a).not.toBe(b);
    expect(a.startsWith('q-')).toBe(true);
  });
});

describe('enqueuePrompt', () => {
  it('appends a trimmed prompt with createdAt', () => {
    const q = enqueuePrompt([], '  hello world  ', 42, () => 'fixed-id');
    expect(q).toEqual([{ id: 'fixed-id', text: 'hello world', createdAt: 42 }]);
  });

  it('rejects empty text', () => {
    const base = makeQueue(1);
    expect(enqueuePrompt(base, '')).toBe(base);
    expect(enqueuePrompt(base, '   ')).toBe(base);
    expect(enqueuePrompt(base, '\n\t')).toBe(base);
  });

  it('does not mutate the original queue array', () => {
    const base: QueuedPrompt[] = [];
    const next = enqueuePrompt(base, 'x', 1, () => 'a');
    expect(base).toEqual([]);
    expect(next).toHaveLength(1);
  });

  it('trims oldest when exceeding MAX_QUEUE_LENGTH', () => {
    const q = makeQueue(MAX_QUEUE_LENGTH);
    expect(q).toHaveLength(MAX_QUEUE_LENGTH);
    const next = enqueuePrompt(q, 'overflow', 9999, () => 'overflow-id');
    expect(next).toHaveLength(MAX_QUEUE_LENGTH);
    expect(next[0]?.text).toBe('item-1'); // oldest item-0 dropped
    expect(next[next.length - 1]).toEqual({
      id: 'overflow-id',
      text: 'overflow',
      createdAt: 9999,
    });
  });

  it('can drop multiple oldest items if somehow over cap', () => {
    // Simulate oversized queue then enqueue
    const oversized: QueuedPrompt[] = Array.from({ length: 25 }, (_, i) => ({
      id: `x-${i}`,
      text: `t-${i}`,
      createdAt: i,
    }));
    const next = enqueuePrompt(oversized, 'new', 100, () => 'new-id');
    expect(next).toHaveLength(MAX_QUEUE_LENGTH);
    expect(next[next.length - 1]?.id).toBe('new-id');
  });
});

describe('dequeuePrompt', () => {
  it('returns null next for empty queue', () => {
    expect(dequeuePrompt([])).toEqual({ next: null, remaining: [] });
  });

  it('pops the front item FIFO', () => {
    const q = makeQueue(3);
    const first = dequeuePrompt(q);
    expect(first.next?.text).toBe('item-0');
    expect(first.remaining.map((x) => x.text)).toEqual(['item-1', 'item-2']);

    const second = dequeuePrompt(first.remaining);
    expect(second.next?.text).toBe('item-1');
    expect(second.remaining.map((x) => x.text)).toEqual(['item-2']);
  });

  it('does not mutate the original queue', () => {
    const q = makeQueue(2);
    const copy = [...q];
    dequeuePrompt(q);
    expect(q).toEqual(copy);
  });
});

describe('removeQueuedPrompt', () => {
  it('removes by id', () => {
    const q = makeQueue(3);
    const next = removeQueuedPrompt(q, 'id-1');
    expect(next.map((x) => x.id)).toEqual(['id-0', 'id-2']);
  });

  it('returns same contents when id missing', () => {
    const q = makeQueue(2);
    const next = removeQueuedPrompt(q, 'missing');
    expect(next).toEqual(q);
    expect(next).not.toBe(q);
  });
});

describe('clearQueue', () => {
  it('returns empty array', () => {
    const q = makeQueue(5);
    expect(clearQueue(q)).toEqual([]);
    expect(q).toHaveLength(5);
  });
});

describe('peekQueue', () => {
  it('returns first item without removing', () => {
    const q = makeQueue(2);
    expect(peekQueue(q)?.text).toBe('item-0');
    expect(q).toHaveLength(2);
  });

  it('returns null for empty', () => {
    expect(peekQueue([])).toBeNull();
  });
});

describe('canSubmitNow', () => {
  it('returns send when not busy', () => {
    expect(canSubmitNow(false, 0)).toBe('send');
    expect(canSubmitNow(false, MAX_QUEUE_LENGTH)).toBe('send');
  });

  it('returns queue when busy and under cap', () => {
    expect(canSubmitNow(true, 0)).toBe('queue');
    expect(canSubmitNow(true, MAX_QUEUE_LENGTH - 1)).toBe('queue');
  });

  it('returns blocked when busy and queue is full', () => {
    expect(canSubmitNow(true, MAX_QUEUE_LENGTH)).toBe('blocked');
    expect(canSubmitNow(true, MAX_QUEUE_LENGTH + 5)).toBe('blocked');
  });
});

describe('nextAutoSubmit', () => {
  it('holds queue while busy', () => {
    const q = makeQueue(2);
    const result = nextAutoSubmit(true, q);
    expect(result.prompt).toBeNull();
    expect(result.remaining).toBe(q);
  });

  it('dequeues when idle with items', () => {
    const q = makeQueue(2);
    const result = nextAutoSubmit(false, q);
    expect(result.prompt?.text).toBe('item-0');
    expect(result.remaining).toHaveLength(1);
  });
});
