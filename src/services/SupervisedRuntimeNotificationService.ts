import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

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
      if (!parsed?.chatId || !parsed?.message) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
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
    } catch (error: any) {
      this.persistFailure(pending, error?.message || String(error || 'Falha ao enviar notificacao pendente.'));
      return {
        delivered: false,
        skipped: false,
        error: error?.message || String(error || 'Falha ao enviar notificacao pendente.'),
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
