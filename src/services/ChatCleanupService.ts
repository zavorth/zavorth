import { Bot, Context } from 'grammy';
import { logger } from '../logger.js';

export type ClearResult = {
  ok: boolean;
  deleted: number;
  failed: number;
  message: string;
};

/**
 * ChatCleanupService - Tracks and deletes messages sent by the bot.
 * 
 * Telegram API limits:
 *   - Bots can delete messages less than 48 hours old in private chats.
 *   - Bots can delete messages in groups where they are admins.
 *   - deleteMessages batches up to 100 messages per call in groups.
 */
export class ChatCleanupService {
  /** Circular buffer of message IDs sent by the bot */
  private sentMessageIds: Map<string, number[]> = new Map();
  private readonly maxTrackedPerChat: number;

  constructor(maxTrackedPerChat: number = 5000) {
    this.maxTrackedPerChat = maxTrackedPerChat;
  }

  /**
   * Registers a bot-sent message for future cleanup.
   */
  public trackMessage(chatId: string, messageId: number): void {
    if (!this.sentMessageIds.has(chatId)) {
      this.sentMessageIds.set(chatId, []);
    }

    const ids = this.sentMessageIds.get(chatId)!;
    ids.push(messageId);

    // Keep only the last N entries.
    if (ids.length > this.maxTrackedPerChat) {
      ids.splice(0, ids.length - this.maxTrackedPerChat);
    }
  }

  /**
   * Apaga todas as mensagens rastreadas do bot em um chat.
   * Uses batch deleteMessages when available, up to 100 per call.
   */
  public async clearChat(bot: Bot, chatId: string): Promise<ClearResult> {
    const ids = this.sentMessageIds.get(chatId);

    if (!ids || ids.length === 0) {
      return {
        ok: true,
        deleted: 0,
        failed: 0,
        message: 'No tracked message to delete in this chat.',
      };
    }

    let deleted = 0;
    let failed = 0;

    // Delete in batches of 100 (API limit)
    const allIds = [...ids].reverse();
    const batchSize = 100;

    for (let i = 0; i < allIds.length; i += batchSize) {
      const batch = allIds.slice(i, i + batchSize);

      // Tenta batch delete primeiro (funciona em grupos)
      if (batch.length > 1) {
        try {
          await (bot.api.raw as unknown as { deleteMessages: (args: { chat_id: number; message_ids: number[] }) => Promise<unknown> }).deleteMessages({
            chat_id: Number(chatId),
            message_ids: batch,
          });
          deleted += batch.length;
          continue;
        } catch (error: unknown) {// fallback para delete individual
      logger.warn('[Chat Cleanup] delete operation failed', error);
    }
      }

      // Individual delete (for private chats or when batch fails)
      for (const messageId of batch) {
        try {
          await bot.api.deleteMessage(Number(chatId), messageId);
          deleted++;
        } catch (error: unknown) {failed++;
        }
      }

      // Rate limit between batches
      if (i + batchSize < allIds.length) {
        await this.sleep(1000);
      }
    }

    // Clear the buffer after the operation.
    this.sentMessageIds.set(chatId, []);

    const message = deleted > 0
      ? `Cleanup completed. ${deleted} message(s) deleted.${failed > 0 ? ` ${failed} could not be deleted.` : ''}`
      : `No messages can be deleted because they are older than 48h or already removed.`;

    return { ok: true, deleted, failed, message };
  }

  /**
   * Returns how many messages are being tracked in a chat.
   */
  public getTrackedCount(chatId: string): number {
    return this.sentMessageIds.get(chatId)?.length || 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
