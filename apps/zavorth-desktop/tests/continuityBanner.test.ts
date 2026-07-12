import { describe, expect, it } from 'vitest';
import { buildContinuityBannerModel } from '../src/components/ContinuityBanner';
import {
  buildDesktopPendingTasks,
  isDay1ReturnEligible,
  rememberDesktopSession,
  readRememberedDesktopSession,
  touchDesktopOpenClock,
} from '../src/desktop-state/continuityStorage';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

describe('continuity banner and storage', () => {
  it('prefers continue-session when history exists and no approvals', () => {
    const model = buildContinuityBannerModel({
      pendingApprovals: 0,
      providerReady: true,
      lastSessionId: 's1',
      lastSessionTitle: 'Yesterday',
      day1ReturnEligible: true,
    });
    expect(model?.kind).toBe('continue-session');
    expect(model?.sessionId).toBe('s1');
  });

  it('asks for provider when not ready', () => {
    const model = buildContinuityBannerModel({
      pendingApprovals: 0,
      providerReady: false,
    });
    expect(model?.kind).toBe('setup-provider');
  });

  it('hides when approvals are pending', () => {
    const model = buildContinuityBannerModel({
      pendingApprovals: 2,
      providerReady: true,
      lastSessionId: 's1',
    });
    expect(model).toBeNull();
  });

  it('persists open clock and session memory', () => {
    const storage = memoryStorage();
    const first = touchDesktopOpenClock(storage, new Date('2026-07-10T09:00:00.000Z'));
    expect(first.previousOpenAt).toBeNull();
    const second = touchDesktopOpenClock(storage, new Date('2026-07-11T10:00:00.000Z'));
    expect(second.previousOpenAt).toBe('2026-07-10T09:00:00.000Z');
    rememberDesktopSession({ id: 'abc', title: 'Work' }, storage);
    expect(readRememberedDesktopSession(storage)).toEqual({ id: 'abc', title: 'Work' });
    expect(isDay1ReturnEligible(second.previousOpenAt, second.currentOpenAt)).toBe(true);
  });

  it('projects pending approvals and memory drafts without importing server services', () => {
    expect(buildDesktopPendingTasks(2, 1)).toEqual([
      'Review 2 pending approvals',
      'Review 1 memory draft',
    ]);
    expect(buildDesktopPendingTasks(0, 0)).toEqual([]);
  });
});
