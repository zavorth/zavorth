import { describe, it, expect, beforeEach } from '@jest/globals';
import { InterjectionQueue } from '../../../src/runtime/agent/InterjectionQueue.js';

describe('InterjectionQueue (Mid-Turn Live Steering)', () => {
  beforeEach(() => {
    InterjectionQueue.clear();
  });

  it('should enqueue, peek, and dequeue live operator directives', () => {
    expect(InterjectionQueue.hasPending()).toBe(false);

    InterjectionQueue.enqueue('Focus on authentication tests first');
    InterjectionQueue.enqueue('Change HTTP port to 3000');

    expect(InterjectionQueue.hasPending()).toBe(true);
    expect(InterjectionQueue.peekAll().length).toBe(2);

    const items = InterjectionQueue.dequeueAll();
    expect(items.length).toBe(2);
    expect(items[0].text).toBe('Focus on authentication tests first');
    expect(items[1].text).toBe('Change HTTP port to 3000');
    expect(InterjectionQueue.hasPending()).toBe(false);
  });

  it('should format dequeued interjections into a structured user steering message', () => {
    const item1 = InterjectionQueue.enqueue('Prioritize TypeScript strict mode');
    const item2 = InterjectionQueue.enqueue('Avoid external cloud dependencies');

    const dequeued = InterjectionQueue.dequeueAll();
    const message = InterjectionQueue.formatAsMessage(dequeued);

    expect(message).not.toBeNull();
    expect(message?.role).toBe('user');
    expect(message?.content).toContain('<operator_steering_note>');
    expect(message?.content).toContain('Prioritize TypeScript strict mode');
    expect(message?.content).toContain('Avoid external cloud dependencies');
  });

  it('should return null when formatting an empty list', () => {
    const message = InterjectionQueue.formatAsMessage([]);
    expect(message).toBeNull();
  });
});
