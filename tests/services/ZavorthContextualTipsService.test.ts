import { describe, it, expect } from '@jest/globals';
import {
  ZavorthContextualTipsService,
  CONTEXTUAL_TIP_FLAGS,
  type ContextualTipFlag,
} from '../../src/services/ZavorthContextualTipsService.js';
import type { Database } from '../../src/storage/Database.js';

describe('ZavorthContextualTipsService', () => {
  function makeMockDb() {
    const store = new Map<string, string>();
    return {
      run: (sql: string, params-: any[]) => {
        if (sql.includes('INSERT OR REPLACE') || sql.includes('INSERT INTO')) {
          const [flag, seenAt] = params || [];
          store.set(flag, seenAt);
        } else if (sql.includes('DELETE FROM')) {
          store.clear();
        }
      },
      get: <T>(sql: string, params-: any[]): T | undefined => {
        if (sql.includes('SELECT flag')) {
          const [flag] = params || [];
          if (store.has(flag)) {
            return { flag } as unknown as T;
          }
        }
        return undefined;
      },
      all: <T>(sql: string): T[] => {
        if (sql.includes('SELECT flag')) {
          return Array.from(store.keys()).map((flag) => ({ flag } as unknown as T));
        }
        return [];
      },
    } as unknown as Database;
  }

  function fakeNow() {
    return () => new Date('2026-06-24T05:00:00.000Z');
  }

  it('getTipIfUnseen returns tip on first call and null on subsequent calls', async () => {
    const mockDb = makeMockDb();
    const service = new ZavorthContextualTipsService({
      db: mockDb,
      now: fakeNow(),
    });

    const flag = CONTEXTUAL_TIP_FLAGS.FIRST_LOOP_USE;
    const firstCall = await service.getTipIfUnseen(flag);

    expect(firstCall).not.toBeNull();
    expect(firstCall?.flag).toBe(flag);
    expect(firstCall?.emoji).toBe('💡');
    expect(firstCall?.message).toContain('Dica: use `/loop --grill`');

    const secondCall = await service.getTipIfUnseen(flag);
    expect(secondCall).toBeNull();
  });

  it('markSeen persists the flag and makes isSeen return true', async () => {
    const mockDb = makeMockDb();
    const service = new ZavorthContextualTipsService({
      db: mockDb,
      now: fakeNow(),
    });

    const flag = CONTEXTUAL_TIP_FLAGS.FIRST_LOOP_GRILL;
    expect(await service.isSeen(flag)).toBe(false);

    await service.markSeen(flag);
    expect(await service.isSeen(flag)).toBe(true);
  });

  it('resetAll clears all flags', async () => {
    const mockDb = makeMockDb();
    const service = new ZavorthContextualTipsService({
      db: mockDb,
      now: fakeNow(),
    });

    const flag1 = CONTEXTUAL_TIP_FLAGS.FIRST_LOOP_USE;
    const flag2 = CONTEXTUAL_TIP_FLAGS.FIRST_LOOP_GRILL;

    await service.markSeen(flag1);
    await service.markSeen(flag2);

    expect(await service.getAllSeenFlags()).toEqual([flag1, flag2]);

    await service.resetAll();
    expect(await service.getAllSeenFlags()).toEqual([]);
  });

  it('formatTip formats the tip with emoji and message', async () => {
    const mockDb = makeMockDb();
    const service = new ZavorthContextualTipsService({
      db: mockDb,
      now: fakeNow(),
    });

    const formatted = await service.formatTip({
      flag: CONTEXTUAL_TIP_FLAGS.FIRST_LOOP_USE,
      emoji: '💡',
      message: 'Hello World',
    });

    expect(formatted).toBe('💡 Hello World');
  });

  it('all defined tips are valid and exist in TIP_MESSAGES', async () => {
    const mockDb = makeMockDb();
    const service = new ZavorthContextualTipsService({
      db: mockDb,
      now: fakeNow(),
    });

    for (const flag of Object.values(CONTEXTUAL_TIP_FLAGS)) {
      const tip = await service.getTipIfUnseen(flag);
      // reset db to inspect each
      await service.resetAll();
      expect(tip).not.toBeNull();
      expect(tip?.flag).toBe(flag);
      expect(tip?.message).toBeTruthy();
      expect(tip?.emoji).toBeTruthy();
    }
  });
});
