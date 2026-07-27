import fs from 'fs';
import os from 'os';
import path from 'path';
import { GroupStatsService } from '../../src/services/GroupStatsService';
import { Database } from '../../src/storage/Database';
import { config } from '../../src/config/index';

describe('GroupStatsService', () => {
  const originalDbPath = config.dbPath;
  let tempDir = '';

  beforeEach(() => {
    jest.useFakeTimers();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-group-stats-'));
    (config as any).dbPath = path.join(tempDir, 'group-stats.db');
  });

  afterEach(() => {
    jest.useRealTimers();
    ((Database as any).instance as Database | null)?.close?.();
    (config as any).dbPath = originalDbPath;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('tracks message dates using the local calendar day', async () => {
    jest.setSystemTime(new Date('2026-03-24T12:00:00-03:00'));
    const service = new GroupStatsService();

    await service.trackMessage('chat-1', 'user-1');

    const db = await Database.getInstance();
    const row = db.get<{ message_date: string }>(
      'SELECT message_date FROM group_message_stats WHERE chat_id = - AND user_id = -',
      ['chat-1', 'user-1'],
    );

    expect(row?.message_date).toBe('2026-03-24');
  });

  it('counts a 7-day window inclusively without leaking into an eighth day', async () => {
    const service = new GroupStatsService();

    for (let day = 17; day <= 24; day += 1) {
      jest.setSystemTime(new Date(`2026-03-${String(day).padStart(2, '0')}T12:00:00-03:00`));
      await service.trackMessage('chat-1', `user-${day}`);
    }

    jest.setSystemTime(new Date('2026-03-24T12:00:00-03:00'));
    await expect(service.getTotalMessages('chat-1', 7)).resolves.toBe(7);
  });
});
