import { describe, expect, it } from 'vitest';
import {
  enqueuePrompt,
  nextAutoSubmit,
  type QueuedPrompt,
} from '../src/composer/composerQueue';
import { deriveComposerStatus } from '../src/composer/composerStatus';
import { buildContextMeter } from '../src/composer/contextMeter';

function makeQueue(texts: string[]): QueuedPrompt[] {
  let q: QueuedPrompt[] = [];
  texts.forEach((text, i) => {
    q = enqueuePrompt(q, text, 1000 + i, () => `id-${i}`);
  });
  return q;
}

describe('nextAutoSubmit', () => {
  it('returns null prompt and same remaining while busy', () => {
    const queue = makeQueue(['a', 'b']);
    const result = nextAutoSubmit(true, queue);
    expect(result.prompt).toBeNull();
    expect(result.remaining).toBe(queue);
    expect(result.remaining).toHaveLength(2);
  });

  it('returns null prompt for empty queue when not busy', () => {
    const result = nextAutoSubmit(false, []);
    expect(result).toEqual({ prompt: null, remaining: [] });
  });

  it('dequeues first prompt when not busy', () => {
    const queue = makeQueue(['first', 'second', 'third']);
    const result = nextAutoSubmit(false, queue);
    expect(result.prompt?.text).toBe('first');
    expect(result.prompt?.id).toBe('id-0');
    expect(result.remaining.map((item) => item.text)).toEqual(['second', 'third']);
  });

  it('does not mutate the original queue', () => {
    const queue = makeQueue(['x', 'y']);
    const copy = [...queue];
    nextAutoSubmit(false, queue);
    expect(queue).toEqual(copy);
  });

  it('returns only the head once per call (FIFO chain)', () => {
    let queue = makeQueue(['a', 'b', 'c']);
    const first = nextAutoSubmit(false, queue);
    queue = first.remaining;
    const second = nextAutoSubmit(false, queue);
    expect(first.prompt?.text).toBe('a');
    expect(second.prompt?.text).toBe('b');
    expect(second.remaining.map((item) => item.text)).toEqual(['c']);
  });
});

describe('composer UI status wiring helpers', () => {
  it('maps busy tool messages to tools phase', () => {
    const snap = deriveComposerStatus({
      busy: true,
      pendingApprovals: 0,
      activeToolCount: 2,
    });
    expect(snap.phase).toBe('tools');
  });

  it('maps streaming assistant to writing phase', () => {
    const snap = deriveComposerStatus({
      busy: true,
      pendingApprovals: 0,
      streamingAssistant: true,
    });
    expect(snap.phase).toBe('writing');
  });

  it('maps justCompleted to done phase for brief UI flash', () => {
    const snap = deriveComposerStatus({
      busy: false,
      pendingApprovals: 0,
      justCompleted: true,
    });
    expect(snap.phase).toBe('done');
    expect(snap.phase === 'idle').toBe(false);
  });
});

describe('context meter wiring', () => {
  it('builds a labeled meter from message contents', () => {
    const meter = buildContextMeter({
      messages: [{ content: 'a'.repeat(4000) }],
      limitTokens: 128_000,
    });
    expect(meter.usedTokens).toBe(1000);
    expect(meter.label).toContain('/');
    expect(meter.level).toBe('ok');
  });
});
