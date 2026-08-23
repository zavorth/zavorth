import { describe, expect, it } from 'vitest';
import { nextPollBackoffMs, pickPtySession } from '../src/shell/ptySessionSelection';
import type { PtyRegistryEntry } from '../src/apiClient';

function entry(sessionId: string, extra: PtyRegistryEntry = {}): PtyRegistryEntry {
  return { sessionId, ...extra };
}

describe('pickPtySession', () => {
  it('prefers an alive session owned by the requested kind prefix', () => {
    const sessions = [
      entry('agent:ws-9', { status: 'running', processAlive: true }),
      entry('shell:ws-1:abc', { status: 'running', processAlive: true }),
    ];
    expect(pickPtySession(sessions, 'shell:ws-1')?.sessionId).toBe('shell:ws-1:abc');
  });

  it('falls back to the first running workspace session', () => {
    const sessions = [
      entry('agent:ws-9', { status: 'running', processAlive: true }),
      entry('other:x', { status: 'exited' }),
    ];
    expect(pickPtySession(sessions, 'shell:missing')?.sessionId).toBe('agent:ws-9');
  });

  it('returns null when no sessions exist or ids are unusable', () => {
    expect(pickPtySession([], 'shell:ws')).toBeNull();
    expect(pickPtySession([entry('', {})], 'shell:ws')).toBeNull();
  });
});

describe('nextPollBackoffMs', () => {
  it('grows exponentially from the base interval and caps at 5 seconds', () => {
    expect(nextPollBackoffMs(0)).toBe(200);
    expect(nextPollBackoffMs(1)).toBe(400);
    expect(nextPollBackoffMs(2)).toBe(800);
    expect(nextPollBackoffMs(3)).toBe(1600);
    expect(nextPollBackoffMs(4)).toBe(3200);
    expect(nextPollBackoffMs(5)).toBe(5000);
    expect(nextPollBackoffMs(50)).toBe(5000);
    expect(nextPollBackoffMs(Number.NaN)).toBe(200);
    expect(nextPollBackoffMs(-3)).toBe(200);
  });
});
