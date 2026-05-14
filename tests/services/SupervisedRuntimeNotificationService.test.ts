import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  SupervisedRuntimeNotificationService,
  type PendingSupervisedRuntimeNotification,
} from '../../src/services/SupervisedRuntimeNotificationService';

describe('SupervisedRuntimeNotificationService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    jest.restoreAllMocks();
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  function createFixture(notification: Partial<PendingSupervisedRuntimeNotification> = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-runtime-notify-'));
    tempDirs.push(root);
    const notificationFile = path.join(root, 'pending.json');
    const payload: PendingSupervisedRuntimeNotification = {
      chatId: '1657675475',
      message: 'Zavorth supervisionado online.',
      status: 'success',
      createdAt: '2026-03-31T23:59:00.000Z',
      ...notification,
    };
    fs.writeFileSync(notificationFile, JSON.stringify(payload, null, 2), 'utf8');
    return {
      notificationFile,
      payload,
      service: new SupervisedRuntimeNotificationService(notificationFile),
    };
  }

  it('delivers and clears a pending startup notification', async () => {
    const { notificationFile, payload, service } = createFixture();
    const sendMessage = jest.fn().mockResolvedValue(undefined);

    const result = await service.flushPending(sendMessage);

    expect(result.delivered).toBe(true);
    expect(result.skipped).toBe(false);
    expect(sendMessage).toHaveBeenCalledWith(payload.chatId, payload.message);
    expect(fs.existsSync(notificationFile)).toBe(false);
  });

  it('keeps the notification on disk and tracks the failure when delivery fails', async () => {
    const { notificationFile, service } = createFixture();
    const sendMessage = jest.fn().mockRejectedValue(new Error('telegram offline'));

    const result = await service.flushPending(sendMessage);

    expect(result.delivered).toBe(false);
    expect(result.skipped).toBe(false);
    const updated = JSON.parse(fs.readFileSync(notificationFile, 'utf8'));
    expect(updated.attempts).toBe(1);
    expect(updated.lastError).toContain('telegram offline');
  });
});
