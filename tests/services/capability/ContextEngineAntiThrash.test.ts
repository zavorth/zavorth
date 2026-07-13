/**
 * Compaction anti-thrash (cooldown + event floor + token floor).
 * Uses a minimal ContextEngine instance.
 */

import { ContextEngine } from '../../../src/context-engine/ContextEngine.js';

describe('ContextEngine anti-thrash compaction', () => {
  it('respects compaction cooldown between passes', () => {
    let nowMs = 1_000_000;
    const engine = new ContextEngine({
      now: () => new Date(nowMs),
    });

    const key = 'chat::user';
    const events = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `msg-${i}`,
      chatId: 'chat',
      userId: 'user',
      createdAt: new Date(nowMs).toISOString(),
    }));

    // force first compact
    (engine as any).compact(key, [...events]);
    expect((engine as any).lastCompactAtBySession.get(key)).toBe(nowMs);
    expect((engine as any).canCompact(key)).toBe(false);

    nowMs += 1_000; // still within 15s cooldown
    expect((engine as any).canCompact(key)).toBe(false);

    nowMs += 20_000;
    expect((engine as any).canCompact(key)).toBe(true);
  });

  it('triggers shouldCompact on token floor without exceeding event floor', () => {
    const engine = new ContextEngine();
    const key = 'tok::user';
    // MAX_WINDOW_EVENTS = 12, COMPACTION_TRIGGER_EVENTS = 24
    // Use 14 events (above window, below event floor) with huge content
    const bulky = 'word '.repeat(800); // ~1600 tokens-ish across events
    const events = Array.from({ length: 14 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: bulky,
      chatId: 'tok',
      userId: 'user',
      createdAt: new Date().toISOString(),
    }));

    expect((engine as any).shouldCompact(key, events)).toBe(true);
  });

  it('does not compact tiny sessions under both floors', () => {
    const engine = new ContextEngine();
    const key = 'tiny::user';
    const events = Array.from({ length: 4 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: 'hi',
      chatId: 'tiny',
      userId: 'user',
      createdAt: new Date().toISOString(),
    }));
    expect((engine as any).shouldCompact(key, events)).toBe(false);
  });
});
