import type { Context } from 'grammy';
import { normalizeSharedSurfaceCommandCallback } from '../../../../domain/surface/presentation/shared-surface/SharedSurfaceCallbackCommandPolicy.js';
import { logger } from '../../../../logger';
import { asErrorLike } from '../../../../utils/errorLike.js';

export type GatewayCallbackRouterDeps = {
  handleHubCallback: (ctx: Context, data: string) => Promise<void>;
  handlePermissionCallback: (ctx: Context, data: string) => Promise<void>;
  handleEchoApprovalCallback?: (ctx: Context, data: string) => Promise<void>;
  handleMnemosCallback?: (ctx: Context, data: string) => Promise<void>;
  handleExperienceActionCardCallback?: (ctx: Context, data: string) => Promise<void>;
  handleTaskCallback?: (ctx: Context, data: string) => Promise<void>;
  handleStatusAction: (ctx: Context) => Promise<void>;
  handleHelpAction: (ctx: Context) => Promise<void>;
  handleAuditAction: (ctx: Context) => Promise<void>;
  handleModeAction: (ctx: Context) => Promise<void>;
  handleModelsAction: (ctx: Context) => Promise<void>;
  handleSurfaceCommandCallback?: (ctx: Context, commandText: string) => Promise<void>;
  logError?: (message: string) => void;
};

export class GatewayCallbackRouter {
  constructor(private readonly deps: GatewayCallbackRouterDeps) {}

  public async handleCallback(ctx: Context, data: string): Promise<void> {
    try {
      if (data === 'action:delete') {
        try {
          if (ctx.msg?.message_id) {
            await ctx.deleteMessage();
          }
        } catch (error: unknown) {
          // Delete callbacks should still acknowledge stale messages.
          logger.warn('[way Callback r] delete operation failed', error);
        }

        await ctx.answerCallbackQuery();
        return;
      }

      if (data.startsWith('hub:')) {
        await this.deps.handleHubCallback(ctx, data);
        return;
      }

      if (data.startsWith('perm:')) {
        await this.deps.handlePermissionCallback(ctx, data);
        return;
      }

      // Selfmod proposal-time buttons: selfmod:apply:<previewId> | selfmod:reject
      if (data.startsWith('selfmod:') && this.deps.handleSurfaceCommandCallback) {
        const applyMatch = /^selfmod:apply:([a-z0-9_-]{6})$/i.exec(data);
        if (applyMatch) {
          await ctx.answerCallbackQuery();
          await this.deps.handleSurfaceCommandCallback(ctx, `/selfmod apply ${applyMatch[1]}`);
          return;
        }
        if (data === 'selfmod:reject' || data.startsWith('selfmod:reject')) {
          await ctx.answerCallbackQuery({ text: 'Selfmod preview left unused.' });
          await ctx
            .reply(
              'Selfmod proposal rejected — preview left unused.\nNo free-text "Approve" needed; re-run /selfmod when ready.',
            )
            .catch(() => undefined);
          return;
        }
      }

      if (data.startsWith('task:') && this.deps.handleTaskCallback) {
        await this.deps.handleTaskCallback(ctx, data);
        return;
      }

      if (data.startsWith('echo:') && this.deps.handleEchoApprovalCallback) {
        await this.deps.handleEchoApprovalCallback(ctx, data);
        return;
      }

      if (data.startsWith('mnemos:') && this.deps.handleMnemosCallback) {
        await this.deps.handleMnemosCallback(ctx, data);
        return;
      }

      if (data.startsWith('xcard:')) {
        if (!/^xcard:[a-z0-9:-]{1,80}$/i.test(data)) {
          await ctx.answerCallbackQuery({ text: 'Invalid action card.' });
          return;
        }
        if (this.deps.handleExperienceActionCardCallback) {
          await this.deps.handleExperienceActionCardCallback(ctx, data);
          return;
        }
        await ctx.answerCallbackQuery({
          text: 'Action card recebido. Abra /zavorthControl ou use a CLI para decidir.',
        });
        return;
      }

      const sharedSurfaceCommand = normalizeSharedSurfaceCommandCallback(data);
      if (sharedSurfaceCommand && this.deps.handleSurfaceCommandCallback) {
        await ctx.answerCallbackQuery();
        await this.deps.handleSurfaceCommandCallback(ctx, sharedSurfaceCommand);
        return;
      }

      if (data.startsWith('kanban:')) {
        const parts = data.split(':');
        const action = parts[1];
        const cardId = parts[2];
        const { KanbanSQLiteDispatcherService } = await import(
          '../../../../services/plugins/KanbanSQLiteDispatcherService.js'
        );
        const kanban = new KanbanSQLiteDispatcherService();
        try {
          if (action === 'add_prompt') {
            await ctx.reply('Para adicionar um novo card ao Kanban, digite:\n`/triage <titulo da task>`', {
              parse_mode: 'Markdown',
            });
            await ctx.answerCallbackQuery();
          } else if (action === 'view') {
            const card = (kanban as any).db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId) as any;
            if (!card) {
              await ctx.answerCallbackQuery({ text: 'Task nao encontrada.' });
              return;
            }
            const comments = kanban.getComments(cardId);
            const commentsStr =
              comments.map((c: any) => `• ${c.author}: ${c.content}`).join('\n') || 'Sem comentarios.';
            const details =
              `📋 *Task:* ${card.title}\n` +
              `*ID:* \`${card.id}\`\n` +
              `*Status:* ${card.column_name}\n` +
              `*Prioridade:* ${card.priority}\n` +
              `*Descricao:* ${card.description || 'Sem descricao'}\n\n` +
              `💬 *Comentarios/Logs:*\n${commentsStr}`;

            const { InlineKeyboard } = await import('grammy');
            const inlineKeyboard = new InlineKeyboard();
            const cols = ['todo', 'in_progress', 'review', 'done'];
            cols.forEach((col) => {
              if (col !== card.column_name) {
                inlineKeyboard.text(`Move ${col}`, `kanban:move:${cardId}:${col}`);
              }
            });
            inlineKeyboard.row().text('🗑️ Fechar', 'action:delete');

            await ctx.reply(details, {
              parse_mode: 'Markdown',
              reply_markup: inlineKeyboard,
            });
            await ctx.answerCallbackQuery();
          } else if (action === 'move') {
            const destCol = parts[3];
            const result = kanban.moveCard('default_board', cardId, destCol, 'Moved via Telegram Bot');
            await ctx.answerCallbackQuery({ text: result.startsWith('Error:') ? result : 'Status atualizado!' });

            if (!result.startsWith('Error:')) {
              await ctx.reply(`🔄 Task *${cardId}* movida para *${destCol}*!`, { parse_mode: 'Markdown' });
            }
          }
        } finally {
          kanban.close();
        }
        return;
      }

      switch (data) {
        case 'menu_status':
          await ctx.answerCallbackQuery();
          await this.deps.handleStatusAction(ctx);
          return;
        case 'menu_help':
          await ctx.answerCallbackQuery();
          await this.deps.handleHelpAction(ctx);
          return;
        case 'menu_audit':
          await ctx.answerCallbackQuery();
          await this.deps.handleAuditAction(ctx);
          return;
        case 'menu_mode':
          await ctx.answerCallbackQuery();
          await this.deps.handleModeAction(ctx);
          return;
        case 'menu_models':
          await ctx.answerCallbackQuery();
          await this.deps.handleModelsAction(ctx);
          return;
        default:
          await ctx.answerCallbackQuery({ text: 'Comando nao reconhecido.' });
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : String(error);
      this.deps.logError?.(message);
      await ctx.answerCallbackQuery({ text: 'Erro ao processar.' });
    }
  }
}
