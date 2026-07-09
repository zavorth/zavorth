import { Bot, Context } from 'grammy';
import { logger } from '../logger.js';

export type ClearResult = {
  ok: boolean;
  deleted: number;
  failed: number;
  message: string;
};

/**
 * ChatCleanupService — Rastreia e apaga mensagens enviadas pelo bot.
 * 
 * Limitações da API do Telegram:
 *   - Bots só podem apagar mensagens com menos de 48 horas em chats privados.
 *   - Bots podem apagar qualquer mensagem em grupos onde são admins.
 *   - deleteMessages (batch) apaga até 100 por chamada em grupos.
 */
export class ChatCleanupService {
  /** Buffer circular de IDs de mensagens enviadas pelo bot */
  private sentMessageIds: Map<string, number[]> = new Map();
  private readonly maxTrackedPerChat: number;

  constructor(maxTrackedPerChat: number = 5000) {
    this.maxTrackedPerChat = maxTrackedPerChat;
  }

  /**
   * Registra uma mensagem enviada pelo bot para futura limpeza.
   */
  public trackMessage(chatId: string, messageId: number): void {
    if (!this.sentMessageIds.has(chatId)) {
      this.sentMessageIds.set(chatId, []);
    }

    const ids = this.sentMessageIds.get(chatId)!;
    ids.push(messageId);

    // Manter apenas os últimos N
    if (ids.length > this.maxTrackedPerChat) {
      ids.splice(0, ids.length - this.maxTrackedPerChat);
    }
  }

  /**
   * Apaga todas as mensagens rastreadas do bot em um chat.
   * Usa batch deleteMessages quando possível (até 100 por chamada).
   */
  public async clearChat(bot: Bot, chatId: string): Promise<ClearResult> {
    const ids = this.sentMessageIds.get(chatId);

    if (!ids || ids.length === 0) {
      return {
        ok: true,
        deleted: 0,
        failed: 0,
        message: 'Nenhuma mensagem rastreada para apagar neste chat.',
      };
    }

    let deleted = 0;
    let failed = 0;

    // Apagar em lotes de 100 (limite da API)
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
        } catch (error: any) {
      // fallback para delete individual
      logger.warn('[Chat Cleanup] delete operation failed', error);
    }
      }

      // Delete individual (para chats privados ou quando batch falha)
      for (const messageId of batch) {
        try {
          await bot.api.deleteMessage(Number(chatId), messageId);
          deleted++;
        } catch (error: any) {
          failed++;
        }
      }

      // Rate limit entre lotes
      if (i + batchSize < allIds.length) {
        await this.sleep(1000);
      }
    }

    // Limpar o buffer após a operação
    this.sentMessageIds.set(chatId, []);

    const message = deleted > 0
      ? `Limpeza concluida. ${deleted} mensagem(ns) apagada(s).${failed > 0 ? ` ${failed} nao puderam ser apagadas.` : ''}`
      : `Nenhuma mensagem pode ser apagada (todas com mais de 48h ou ja removidas).`;

    return { ok: true, deleted, failed, message };
  }

  /**
   * Retorna quantas mensagens estão sendo rastreadas em um chat.
   */
  public getTrackedCount(chatId: string): number {
    return this.sentMessageIds.get(chatId)?.length || 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
