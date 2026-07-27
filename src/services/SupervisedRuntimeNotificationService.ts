import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import { errorMessage } from '../utils/errorLike.js';
export interface PendingSupervisedRuntimeNotification {
  chatId: string;
  message: string;
  status?: 'success' | 'failed';
  createdAt: string;
  requestedBy?: string;
  reason?: string;
  source?: string;
  attempts?: number;
  lastAttemptAt?: string;
  lastError?: string;
}

export interface FlushPendingNotificationResult {
  delivered: boolean;
  skipped: boolean;
  error?: string;
  notification?: PendingSupervisedRuntimeNotification | null;
}

export class SupervisedRuntimeNotificationService {
  constructor(private readonly notificationFilePath: string = config.supervisedReloadNotificationFile) {}

  public readPending(): PendingSupervisedRuntimeNotification | null {
    if (!fs.existsSync(this.notificationFilePath)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(this.notificationFilePath, 'utf8');
      if (!raw.trim()) {
        return null;
      }

      const parsed = JSON.parse(raw) as PendingSupervisedRuntimeNotification;
      if (!parsed?.chatId || !errorMessage(parsed)) {
        return null;
      }

      return parsed;
    } catch (error: unknown) {logger.warn('[Supervised Runtime Notification] JSON parse failed', error); return null; }
  }

  public async flushPending(
    sendMessage: (chatId: string, message: string) => Promise<void>,
  ): Promise<FlushPendingNotificationResult> {
    const pending = this.readPending();
    if (!pending) {
      return { delivered: false, skipped: true, notification: null };
    }

    try {
      await sendMessage(pending.chatId, pending.message);
      this.clearPending();
      return { delivered: true, skipped: false, notification: pending };
    } catch (error: unknown) {this.persistFailure(pending, errorMessage(error) || String(error || 'Failure ao enviar notificaction pending.'));
      return {
        delivered: false,
        skipped: false,
        error: errorMessage(error) || String(error || 'Failure ao enviar notificaction pending.'),
        notification: pending,
      };
    }
  }

  private clearPending(): void {
    if (!fs.existsSync(this.notificationFilePath)) {
      return;
    }

    fs.unlinkSync(this.notificationFilePath);
  }

  private persistFailure(notification: PendingSupervisedRuntimeNotification, errorMessage: string): void {
    const nextPayload: PendingSupervisedRuntimeNotification = {
      ...notification,
      attempts: (notification.attempts || 0) + 1,
      lastAttemptAt: new Date().toISOString(),
      lastError: errorMessage,
    };

    fs.mkdirSync(path.dirname(this.notificationFilePath), { recursive: true });
    fs.writeFileSync(this.notificationFilePath, JSON.stringify(nextPayload, null, 2), 'utf8');
  }
}
