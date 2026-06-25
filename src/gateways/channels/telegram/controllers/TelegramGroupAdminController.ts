import { Context } from 'grammy';
import { WarnService } from '../../../../services/WarnService.js';
import { GroupModerationService } from '../../../../services/GroupModerationService.js';
import { GroupStatsService } from '../../../../services/GroupStatsService.js';
import { WelcomeService } from '../../../../services/WelcomeService.js';
import { AntiSpamService } from '../../../../services/AntiSpamService.js';
import { MessageFilterService } from '../../../../services/MessageFilterService.js';
import {
  TelegramGroupAdminWarnFlowService,
  type TelegramGroupAdminTargetSelection,
} from '../../../../gateways/channels/telegram/controllers/TelegramGroupAdminWarnFlowService.js';
import { TelegramGroupAdminProtectionService } from '../../../../gateways/channels/telegram/controllers/TelegramGroupAdminProtectionService.js';

interface GroupAdminDeps {
  warnService: WarnService;
  moderationService: GroupModerationService;
  statsService: GroupStatsService;
  welcomeService: WelcomeService;
  antiSpamService: AntiSpamService;
  messageFilterService: MessageFilterService;
}

export class TelegramGroupAdminController {
  private readonly moderationService: GroupModerationService;
  private readonly statsService: GroupStatsService;
  private readonly welcomeService: WelcomeService;
  private readonly warnCommands: TelegramGroupAdminWarnFlowService;
  private readonly protectionCommands: TelegramGroupAdminProtectionService;

  constructor(deps: GroupAdminDeps) {
    this.moderationService = deps.moderationService;
    this.statsService = deps.statsService;
    this.welcomeService = deps.welcomeService;
    this.warnCommands = new TelegramGroupAdminWarnFlowService({
      warnService: deps.warnService,
      moderationService: deps.moderationService,
    });
    this.protectionCommands = new TelegramGroupAdminProtectionService({
      antiSpamService: deps.antiSpamService,
      messageFilterService: deps.messageFilterService,
    });
  }

  private isGroupChat(ctx: Context): boolean {
    return ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
  }

  private getTargetSelection(ctx: Context, args: string): TelegramGroupAdminTargetSelection {
    const tokens = args.trim().split(/\s+/).filter(Boolean);

    if (ctx.message?.reply_to_message?.from?.id) {
      return {
        targetId: ctx.message.reply_to_message.from.id,
        tokens,
        usedReply: true,
      };
    }

    const parsed = parseInt(tokens[0] || '', 10);
    return {
      targetId: Number.isNaN(parsed) ? null : parsed,
      tokens,
      usedReply: false,
    };
  }

  private getTargetUserId(ctx: Context, args: string): number | null {
    return this.getTargetSelection(ctx, args).targetId;
  }

  public async handleBan(ctx: Context, args: string): Promise<void> {
    if (!this.isGroupChat(ctx)) {
      await ctx.reply('Aviso: este comando so funciona em grupos.');
      return;
    }

    const targetId = this.getTargetUserId(ctx, args);
    if (targetId === null) {
      await ctx.reply('Aviso: responda a uma mensagem ou informe o ID do usuario. Ex: `/ban 123456`', {
        parse_mode: 'Markdown',
      });
      return;
    }

    const result = await this.moderationService.banUser(ctx.chat!.id, targetId, ctx.from?.id.toString() || '');
    await ctx.reply(
      result.success ? `Usuario ${targetId} foi **banido** do grupo.` : `Falha ao banir: ${result.error}`,
      { parse_mode: 'Markdown' },
    );
  }

  public async handleKick(ctx: Context, args: string): Promise<void> {
    if (!this.isGroupChat(ctx)) {
      await ctx.reply('Aviso: este comando so funciona em grupos.');
      return;
    }

    const targetId = this.getTargetUserId(ctx, args);
    if (targetId === null) {
      await ctx.reply('Aviso: responda a uma mensagem ou informe o ID do usuario. Ex: `/kick 123456`', {
        parse_mode: 'Markdown',
      });
      return;
    }

    const result = await this.moderationService.kickUser(ctx.chat!.id, targetId, ctx.from?.id.toString() || '');
    await ctx.reply(
      result.success ? `Usuario ${targetId} foi **expulso** do grupo.` : `Falha ao expulsar: ${result.error}`,
      { parse_mode: 'Markdown' },
    );
  }

  public async handleMute(ctx: Context, args: string): Promise<void> {
    if (!this.isGroupChat(ctx)) {
      await ctx.reply('Aviso: este comando so funciona em grupos.');
      return;
    }

    const { targetId, tokens, usedReply } = this.getTargetSelection(ctx, args);
    if (targetId === null) {
      await ctx.reply('Aviso: responda a uma mensagem ou informe o ID do usuario. Ex: `/mute 123456 30m`', {
        parse_mode: 'Markdown',
      });
      return;
    }

    const durationStr = usedReply ? (tokens[0] || '') : (tokens[1] || '');
    const hasDurationToken = Boolean(durationStr);
    const duration = hasDurationToken ? this.parseDuration(durationStr) : null;

    if (hasDurationToken && duration === null) {
      await ctx.reply(
        'Aviso: Duracao invalida. Use formatos como `30m`, `2h`, `1d` ou responda sem tempo para mute permanente.',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    const result = await this.moderationService.muteUser(
      ctx.chat!.id,
      targetId,
      ctx.from?.id.toString() || '',
      duration ?? undefined,
    );
    const timeLabel = duration ? this.formatDuration(duration) : 'permanentemente';

    await ctx.reply(
      result.success
        ? `Usuario ${targetId} foi **silenciado** ${timeLabel}.`
        : `Falha ao silenciar: ${result.error}`,
      { parse_mode: 'Markdown' },
    );
  }

  public async handleUnmute(ctx: Context, args: string): Promise<void> {
    if (!this.isGroupChat(ctx)) {
      await ctx.reply('Aviso: este comando so funciona em grupos.');
      return;
    }

    const targetId = this.getTargetUserId(ctx, args);
    if (targetId === null) {
      await ctx.reply('Aviso: responda a uma mensagem ou informe o ID do usuario.');
      return;
    }

    const result = await this.moderationService.unmuteUser(ctx.chat!.id, targetId, ctx.from?.id.toString() || '');
    await ctx.reply(
      result.success ? `Usuario ${targetId} foi **dessilenciado**.` : `Falha: ${result.error}`,
      { parse_mode: 'Markdown' },
    );
  }

  public async handleWarn(ctx: Context, args: string): Promise<void> {
    if (!this.isGroupChat(ctx)) {
      await ctx.reply('Aviso: este comando so funciona em grupos.');
      return;
    }

    await this.warnCommands.handleWarn(
      ctx,
      this.getTargetSelection(ctx, args),
      ctx.chat!.id.toString(),
      ctx.chat!.id,
      ctx.from?.id.toString() || 'system',
    );
  }

  public async handleWarns(ctx: Context, args: string): Promise<void> {
    if (!this.isGroupChat(ctx)) {
      await ctx.reply('Aviso: este comando so funciona em grupos.');
      return;
    }

    await this.warnCommands.handleWarns(ctx, this.getTargetUserId(ctx, args), ctx.chat!.id.toString());
  }

  public async handleClearWarns(ctx: Context, args: string): Promise<void> {
    if (!this.isGroupChat(ctx)) {
      await ctx.reply('Aviso: este comando so funciona em grupos.');
      return;
    }

    await this.warnCommands.handleClearWarns(ctx, this.getTargetUserId(ctx, args), ctx.chat!.id.toString());
  }

  public async handleRegras(ctx: Context, args: string): Promise<void> {
    if (!this.isGroupChat(ctx)) {
      await ctx.reply('Aviso: este comando so funciona em grupos.');
      return;
    }

    const chatId = ctx.chat!.id.toString();
    if (args.trim()) {
      await this.welcomeService.setGroupRules(chatId, args.trim());
      await ctx.reply('Regras do grupo atualizadas com sucesso!');
      return;
    }

    const rules = await this.welcomeService.getGroupRules(chatId);
    if (!rules) {
      await ctx.reply('Nenhuma regra definida. Use `/regras <texto>` para salvar as regras do grupo.', {
        parse_mode: 'Markdown',
      });
      return;
    }

    await ctx.reply(`Regras do Grupo\n\n${rules}`);
  }

  public async handleStats(ctx: Context): Promise<void> {
    if (!this.isGroupChat(ctx)) {
      await ctx.reply('Aviso: este comando so funciona em grupos.');
      return;
    }

    const chatId = ctx.chat!.id.toString();
    const total7 = await this.statsService.getTotalMessages(chatId, 7);
    const total30 = await this.statsService.getTotalMessages(chatId, 30);
    const topMembers = await this.statsService.getTopMembers(chatId, 7, 5);

    let message = `**Estatisticas do Grupo**\n\n`;
    message += `Ultimos 7 dias: **${total7}** mensagens\n`;
    message += `Ultimos 30 dias: **${total30}** mensagens\n\n`;

    if (topMembers.length > 0) {
      message += `**Top membros (7 dias):**\n`;
      topMembers.forEach((member, index) => {
        message += `${index + 1}. User ${member.user_id}: ${member.message_count} msgs\n`;
      });
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });
  }

  public async handleSetWelcome(ctx: Context, args: string): Promise<void> {
    if (!this.isGroupChat(ctx)) {
      await ctx.reply('Aviso: este comando so funciona em grupos.');
      return;
    }

    const chatId = ctx.chat!.id.toString();
    if (!args.trim()) {
      const config = await this.welcomeService.getConfig(chatId);
      const current = config?.welcome_message || this.welcomeService.getDefaultWelcomeMessage();
      await ctx.reply(
        `Mensagem de boas-vindas atual:\n\n${current}\n\nUse \`/setwelcome <mensagem>\` para alterar.\nVariaveis: {name}, {username}, {group}`,
        { parse_mode: 'Markdown' },
      );
      return;
    }

    await this.welcomeService.setWelcomeMessage(chatId, args.trim());
    await ctx.reply('Mensagem de boas-vindas atualizada!');
  }

  public async handleSetBye(ctx: Context, args: string): Promise<void> {
    if (!this.isGroupChat(ctx)) {
      await ctx.reply('Aviso: este comando so funciona em grupos.');
      return;
    }

    const chatId = ctx.chat!.id.toString();
    if (!args.trim()) {
      const config = await this.welcomeService.getConfig(chatId);
      const current = config?.goodbye_message || this.welcomeService.getDefaultGoodbyeMessage();
      await ctx.reply(
        `Mensagem de despedida atual:\n\n${current}\n\nUse \`/setbye <mensagem>\` para alterar.`,
        { parse_mode: 'Markdown' },
      );
      return;
    }

    await this.welcomeService.setGoodbyeMessage(chatId, args.trim());
    await ctx.reply('Mensagem de despedida atualizada!');
  }

  public async handleAntiSpam(ctx: Context, args: string): Promise<void> {
    if (!this.isGroupChat(ctx)) {
      await ctx.reply('Aviso: este comando so funciona em grupos.');
      return;
    }

    await this.protectionCommands.handleAntiSpam(ctx, args, ctx.chat!.id.toString());
  }

  public async handleFilter(ctx: Context, args: string): Promise<void> {
    if (!this.isGroupChat(ctx)) {
      await ctx.reply('Aviso: este comando so funciona em grupos.');
      return;
    }

    await this.protectionCommands.handleFilter(ctx, args, ctx.chat!.id.toString());
  }

  private parseDuration(value: string): number | null {
    if (!value) {
      return null;
    }

    const match = value.match(/^(\d+)(s|m|h|d)$/i);
    if (!match) {
      return null;
    }

    const amount = parseInt(match[1], 10);
    switch (match[2].toLowerCase()) {
      case 's':
        return amount;
      case 'm':
        return amount * 60;
      case 'h':
        return amount * 3600;
      case 'd':
        return amount * 86400;
      default:
        return null;
    }
  }

  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `por ${seconds}s`;
    }
    if (seconds < 3600) {
      return `por ${Math.floor(seconds / 60)}m`;
    }
    if (seconds < 86400) {
      return `por ${Math.floor(seconds / 3600)}h`;
    }
    return `por ${Math.floor(seconds / 86400)}d`;
  }
}
