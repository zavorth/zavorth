import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MESSAGE_WINDOW,
  nextMessageWindow,
  windowMessages,
} from '../src/thread/messageWindow';

describe('messageWindow', () => {
  it('returns all messages when under window size', () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({ id: `m${i}` }));
    const result = windowMessages(messages, 80);
    expect(result.visible).toHaveLength(10);
    expect(result.hiddenCount).toBe(0);
    expect(result.canRevealMore).toBe(false);
  });

  it('returns trailing window when over size', () => {
    const messages = Array.from({ length: 100 }, (_, i) => ({ id: `m${i}` }));
    const result = windowMessages(messages, 80);
    expect(result.visible).toHaveLength(80);
    expect(result.hiddenCount).toBe(20);
    expect(result.canRevealMore).toBe(true);
    expect(result.visible[0].id).toBe('m20');
    expect(result.visible[79].id).toBe('m99');
  });

  it('grows window with nextMessageWindow', () => {
    expect(nextMessageWindow(DEFAULT_MESSAGE_WINDOW)).toBe(160);
    expect(nextMessageWindow(10, 5)).toBe(DEFAULT_MESSAGE_WINDOW);
  });
});
