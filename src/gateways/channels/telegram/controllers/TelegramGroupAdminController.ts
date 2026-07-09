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

import { safeParseInt } from '../../../../ai-gateway/shared/utils/safeParseInt.js';

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

    const parsed = safeParseInt(tokens[0] || '', NaN);
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
      await ctx.reply('Warning: this command only works in groups.');
      return;
    }

    const targetId = this.getTargetUserId(ctx, args);
    if (targetId === null) {
      await ctx.reply('Warning: reply to a message or provide the user ID. Example: `/ban 123456`', {
        parse_mode: 'Markdown',
      });
      return;
    }

    const result = await this.moderationService.banUser(ctx.chat!.id, targetId, ctx.from?.id.toString() || '');
    await ctx.reply(
      result.success ? `User ${targetId} was **banned** from the group.` : `Failed to ban: ${result.error}`,
      { parse_mode: 'Markdown' },
    );
  }

  public async handleKick(ctx: Context, args: string): Promise<void> {
    if (!this.isGroupChat(ctx)) {
      await ctx.reply('Warning: this command only works in groups.');
      return;
    }

    const targetId = this.getTargetUserId(ctx, args);
    if (targetId === null) {
      await ctx.reply('Warning: reply to a message or provide the user ID. Example: `/kick 123456`', {
        parse_mode: 'Markdown',
      });
      return;
    }

    const result = await this.moderationService.kickUser(ctx.chat!.id, targetId, ctx.from?.id.toString() || '');
    await ctx.reply(
      result.success ? `User ${targetId} was **kicked** from the group.` : `Failed to kick: ${result.error}`,
      { parse_mode: 'Markdown' },
    );
  }

  public async handleMute(ctx: Context, args: string): Promise<void> {
    if (!this.isGroupChat(ctx)) {
      await ctx.reply('Warning: this command only works in groups.');
      return;
    }

    const { targetId, tokens, usedReply } = this.getTargetSelection(ctx, args);
    if (targetId === null) {
      await ctx.reply('Warning: reply to a message or provide the user ID. Example: `/mute 123456 30m`', {
        parse_mode: 'Markdown',
      });
      return;
    }

    const durationStr = usedReply ? (tokens[0] || '') : (tokens[1] || '');
    const hasDurationToken = Boolean(durationStr);
    const duration = hasDurationToken ? this.parseDuration(durationStr) : null;

    if (hasDurationToken && duration === null) {
      await ctx.reply(
        'Warning: invalid duration. Use formats like `30m`, `2h`, `1d`, or reply without a duration for a permanent mute.',
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
    const timeLabel = duration ? this.formatDuration(duration) : 'permanently';

    await ctx.reply(
      result.success
        ? `User ${targetId} was **muted** ${timeLabel}.`
        : `Failed to mute: ${result.error}`,
      { parse_mode: 'Markdown' },
    );
  }

  public async handleUnmute(ctx: Context, args: string): Promise<void> {
    if (!this.isGroupChat(ctx)) {
      await ctx.reply('Warning: this command only works in groups.');
      return;
    }

    const targetId = this.getTargetUserId(ctx, args);
    if (targetId === null) {
      await ctx.reply('Warning: reply to a message or provide the user ID.');
      return;
    }

    const result = await this.moderationService.unmuteUser(ctx.chat!.id, targetId, ctx.from?.id.toString() || '');
    await ctx.reply(
      result.success ? `User ${targetId} was **unmuted**.` : `Failed: ${result.error}`,
      { parse_mode: 'Markdown' },
    );
  }

  public async handleWarn(ctx: Context, args: string): Promise<void> {
    if (!this.isGroupChat(ctx)) {
      await ctx.reply('Warning: this command only works in groups.');
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
      await ctx.reply('Warning: this command only works in groups.');
      return;
    }

    await this.warnCommands.handleWarns(ctx, this.getTargetUserId(ctx, args), ctx.chat!.id.toString());
  }

  public async handleClearWarns(ctx: Context, args: string): Promise<void> {
    if (!this.isGroupChat(ctx)) {
      await ctx.reply('Warning: this command only works in groups.');
      return;
    }

    await this.warnCommands.handleClearWarns(ctx, this.getTargetUserId(ctx, args), ctx.chat!.id.toString());
  }

  public async handleRegras(ctx: Context, args: string): Promise<void> {
    if (!this.isGroupChat(ctx)) {
      await ctx.reply('Warning: this command only works in groups.');
      return;
    }

    const chatId = ctx.chat!.id.toString();
    if (args.trim()) {
      await this.welcomeService.setGroupRules(chatId, args.trim());
      await ctx.reply('Group rules updated successfully.');
      return;
    }

    const rules = await this.welcomeService.getGroupRules(chatId);
    if (!rules) {
      await ctx.reply('No rules have been defined. Use `/regras <text>` to save the group rules.', {
        parse_mode: 'Markdown',
      });
      return;
    }

    await ctx.reply(`Group Rules\n\n${rules}`);
  }

  public async handleStats(ctx: Context): Promise<void> {
    if (!this.isGroupChat(ctx)) {
      await ctx.reply('Warning: this command only works in groups.');
      return;
    }

    const chatId = ctx.chat!.id.toString();
    const total7 = await this.statsService.getTotalMessages(chatId, 7);
    const total30 = await this.statsService.getTotalMessages(chatId, 30);
    const topMembers = await this.statsService.getTopMembers(chatId, 7, 5);

    let message = `**Group Statistics**\n\n`;
    message += `Last 7 days: **${total7}** messages\n`;
    message += `Last 30 days: **${total30}** messages\n\n`;

    if (topMembers.length > 0) {
      message += `**Top members (7 days):**\n`;
      topMembers.forEach((member, index) => {
        message += `${index + 1}. User ${member.user_id}: ${member.message_count} msgs\n`;
      });
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });
  }

  public async handleSetWelcome(ctx: Context, args: string): Promise<void> {
    if (!this.isGroupChat(ctx)) {
      await ctx.reply('Warning: this command only works in groups.');
      return;
    }

    const chatId = ctx.chat!.id.toString();
    if (!args.trim()) {
      const config = await this.welcomeService.getConfig(chatId);
      const current = config?.welcome_message || this.welcomeService.getDefaultWelcomeMessage();
      await ctx.reply(
        `Current welcome message:\n\n${current}\n\nUse \`/setwelcome <message>\` to change it.\nVariables: {name}, {username}, {group}`,
        { parse_mode: 'Markdown' },
      );
      return;
    }

    await this.welcomeService.setWelcomeMessage(chatId, args.trim());
    await ctx.reply('Welcome message updated.');
  }

  public async handleSetBye(ctx: Context, args: string): Promise<void> {
    if (!this.isGroupChat(ctx)) {
      await ctx.reply('Warning: this command only works in groups.');
      return;
    }

    const chatId = ctx.chat!.id.toString();
    if (!args.trim()) {
      const config = await this.welcomeService.getConfig(chatId);
      const current = config?.goodbye_message || this.welcomeService.getDefaultGoodbyeMessage();
      await ctx.reply(
        `Current goodbye message:\n\n${current}\n\nUse \`/setbye <message>\` to change it.`,
        { parse_mode: 'Markdown' },
      );
      return;
    }

    await this.welcomeService.setGoodbyeMessage(chatId, args.trim());
    await ctx.reply('Goodbye message updated.');
  }

  public async handleAntiSpam(ctx: Context, args: string): Promise<void> {
    if (!this.isGroupChat(ctx)) {
      await ctx.reply('Warning: this command only works in groups.');
      return;
    }

    await this.protectionCommands.handleAntiSpam(ctx, args, ctx.chat!.id.toString());
  }

  public async handleFilter(ctx: Context, args: string): Promise<void> {
    if (!this.isGroupChat(ctx)) {
      await ctx.reply('Warning: this command only works in groups.');
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

    const amount = safeParseInt(match[1], 0);
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
