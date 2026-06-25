import { Context } from 'grammy';
import { GroupModerationService } from '../../../../services/GroupModerationService.js';
import { WarnService, type WarnLimitAction } from '../../../../services/WarnService.js';

export type TelegramGroupAdminTargetSelection = {
  targetId: number | null;
  tokens: string[];
  usedReply: boolean;
};

type TelegramGroupAdminWarnFlowServiceDeps = {
  warnService: WarnService;
  moderationService: GroupModerationService;
};

export class TelegramGroupAdminWarnFlowService {
  constructor(private readonly deps: TelegramGroupAdminWarnFlowServiceDeps) {}

  public async handleWarn(
    ctx: Context,
    selection: TelegramGroupAdminTargetSelection,
    chatId: string,
    telegramChatId: number,
    performedBy: string,
  ): Promise<void> {
    if (!selection.targetId) {
      await ctx.reply(
        'Aviso: responda a uma mensagem ou informe o ID. Ex: `/warn 123456 motivo`',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    const reasonParts = selection.usedReply ? selection.tokens : selection.tokens.slice(1);
    const reason = reasonParts.join(' ') || 'Sem motivo especificado';
    const result = await this.deps.warnService.warn(
      chatId,
      selection.targetId.toString(),
      reason,
      performedBy,
    );
    const limitConfig = await this.deps.warnService.getLimitConfig(chatId);

    let message =
      `Usuario ${selection.targetId} recebeu uma advertencia ` +
      `(${result.warnCount}/${limitConfig.max_warns}).\nMotivo: ${reason}`;

    if (result.limitReached) {
      message += `\n\n**Limite atingido.** Aplicando ${result.limitAction}...`;
      await this.applyLimitAction(telegramChatId, selection.targetId, performedBy, result.limitAction);
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });
  }

  public async handleWarns(ctx: Context, targetId: number | null, chatId: string): Promise<void> {
    if (!targetId) {
      await ctx.reply('Aviso: responda a uma mensagem ou informe o ID.');
      return;
    }

    const warns = await this.deps.warnService.getWarns(chatId, targetId.toString());
    if (warns.length === 0) {
      await ctx.reply(`Usuario ${targetId} nao tem advertencias.`);
      return;
    }

    const config = await this.deps.warnService.getLimitConfig(chatId);
    const lines = warns.map((warn, index) => {
      return `${index + 1}. [ID:${warn.id}] ${warn.reason} (${warn.created_at})`;
    });

    await ctx.reply(
      `**Warns de ${targetId}** (${warns.length}/${config.max_warns}):\n${lines.join('\n')}`,
      { parse_mode: 'Markdown' },
    );
  }

  public async handleClearWarns(ctx: Context, targetId: number | null, chatId: string): Promise<void> {
    if (!targetId) {
      await ctx.reply('Aviso: responda a uma mensagem ou informe o ID.');
      return;
    }

    const removed = await this.deps.warnService.clearWarns(chatId, targetId.toString());
    await ctx.reply(`${removed} advertencia(s) removida(s) do usuario ${targetId}.`);
  }

  private async applyLimitAction(
    telegramChatId: number,
    userId: number,
    performedBy: string,
    action: WarnLimitAction,
  ): Promise<void> {
    switch (action) {
      case 'ban':
        await this.deps.moderationService.banUser(telegramChatId, userId, performedBy);
        break;
      case 'kick':
        await this.deps.moderationService.kickUser(telegramChatId, userId, performedBy);
        break;
      case 'mute':
        await this.deps.moderationService.muteUser(telegramChatId, userId, performedBy);
        break;
    }
  }
}
