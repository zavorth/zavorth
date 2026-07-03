import { logger } from '../../../../logger.js';
import { Context } from 'grammy';
import { WelcomeService } from '../../../../services/WelcomeService.js';
import { AntiSpamService } from '../../../../services/AntiSpamService.js';
import { MessageFilterService, type FilterableMessageType } from '../../../../services/MessageFilterService.js';
import { GroupModerationService } from '../../../../services/GroupModerationService.js';
import { GroupStatsService } from '../../../../services/GroupStatsService.js';
import { WarnService } from '../../../../services/WarnService.js';

interface GroupEventDeps {
  welcomeService: WelcomeService;
  antiSpamService: AntiSpamService;
  messageFilterService: MessageFilterService;
  moderationService: GroupModerationService;
  statsService: GroupStatsService;
  warnService: WarnService;
}

/**
 * TelegramGroupEventController — middelware para eventos automaticos de grupo.
 * Trata: boas-vindas, despedida, anti-spam, filtro de tipo de mensagem e rastreamento de stats.
 */
export class TelegramGroupEventController {
  private welcomeService: WelcomeService;
  private antiSpamService: AntiSpamService;
  private messageFilterService: MessageFilterService;
  private moderationService: GroupModerationService;
  private statsService: GroupStatsService;
  private warnService: WarnService;

  constructor(deps: GroupEventDeps) {
    this.welcomeService = deps.welcomeService;
    this.antiSpamService = deps.antiSpamService;
    this.messageFilterService = deps.messageFilterService;
    this.moderationService = deps.moderationService;
    this.statsService = deps.statsService;
    this.warnService = deps.warnService;
  }

  /**
   * Handler para membros novos entrando no grupo.
   * Deve ser registrado em: bot.on('message:new_chat_members')
   */
  public async handleNewMembers(ctx: Context): Promise<void> {
    if (!ctx.message?.new_chat_members || ctx.message.new_chat_members.length === 0) return;
    const chatId = ctx.chat?.id.toString() || '';
    if (!chatId) return;

    const config = await this.welcomeService.getConfig(chatId);
    if (config && !config.welcome_enabled) return;

    const template = config?.welcome_message || this.welcomeService.getDefaultWelcomeMessage();

    for (const member of ctx.message.new_chat_members) {
      if (member.is_bot) continue;
      const rendered = this.welcomeService.renderTemplate(template, {
        name: member.first_name || 'Membro',
        username: member.username,
        group: ctx.chat?.title || 'o grupo',
        id: member.id.toString(),
      });
      try {
        await ctx.reply(rendered);
      } catch (e) {
        logger.error('[GroupEvent] Erro ao enviar boas-vindas:', e);
      }
    }

    // Deletar mensagem de servico se configurado
    if (config?.delete_service_messages && ctx.message?.message_id) {
      await this.moderationService.deleteMessage(chatId, ctx.message.message_id).catch((err) => { logger.warn("[auto-fix] Empty catch block", err); });
    }
  }

  /**
   * Handler para membros saindo do grupo.
   * Deve ser registrado em: bot.on('message:left_chat_member')
   */
  public async handleLeftMember(ctx: Context): Promise<void> {
    const leftMember = ctx.message?.left_chat_member;
    if (!leftMember) return;
    const chatId = ctx.chat?.id.toString() || '';
    if (!chatId) return;

    const config = await this.welcomeService.getConfig(chatId);
    if (config && !config.goodbye_enabled) return;

    const template = config?.goodbye_message || this.welcomeService.getDefaultGoodbyeMessage();
    const rendered = this.welcomeService.renderTemplate(template, {
      name: leftMember.first_name || 'Membro',
      username: leftMember.username,
      group: ctx.chat?.title || 'o grupo',
      id: leftMember.id.toString(),
    });

    try {
      await ctx.reply(rendered);
    } catch (e) {
      logger.error('[GroupEvent] Erro ao enviar despedida:', e);
    }

    // Deletar mensagem de servico se configurado
    if (config?.delete_service_messages && ctx.message?.message_id) {
      await this.moderationService.deleteMessage(chatId, ctx.message.message_id).catch((err) => { logger.warn("[auto-fix] Empty catch block", err); });
    }
  }

  /**
   * Middleware de anti-spam. Retorna true se a mensagem foi tratada (bloqueada).
   * Chamar ANTES do processamento de comandos normais.
   */
  public async processAntiSpam(ctx: Context): Promise<boolean> {
    const chatType = ctx.chat?.type;
    if (chatType !== 'group' && chatType !== 'supergroup') return false;

    const text = ctx.message?.text || ctx.message?.caption || '';
    if (!text) return false;

    const chatId = ctx.chat!.id.toString();
    const userId = ctx.from?.id.toString() || '';

    const result = await this.antiSpamService.analyzeMessage(chatId, userId, text);
    if (result.action === 'none') return false;

    switch (result.action) {
      case 'delete':
        if (ctx.message?.message_id) {
          await this.moderationService.deleteMessage(chatId, ctx.message.message_id);
        }
        try {
          const warnMsg = await ctx.reply(`⚠️ @${ctx.from?.username || ctx.from?.first_name}: ${result.reason}`);
          setTimeout(async () => {
            try { await this.moderationService.deleteMessage(chatId, warnMsg.message_id); } catch (err) { logger.warn("[auto-fix] Empty catch block", err); }
          }, 5000);
        } catch (err) { logger.warn("[auto-fix] Empty catch block", err); }
        return true;

      case 'warn': {
        if (ctx.message?.message_id) {
          await this.moderationService.deleteMessage(chatId, ctx.message.message_id);
        }
        const warnResult = await this.warnService.warn(chatId, userId, result.reason, 'anti-spam');
        let msg = `⚠️ Warn automatico para ${ctx.from?.first_name}: ${result.reason} (${warnResult.warnCount}/${(await this.warnService.getLimitConfig(chatId)).max_warns})`;
        if (warnResult.limitReached) {
          msg += `\n🚨 Limite atingido! Aplicando ${warnResult.limitAction}...`;
          await this.applyAutoAction(ctx, warnResult.limitAction, ctx.from!.id);
        }
        try { await ctx.reply(msg); } catch (err) { logger.warn("[auto-fix] Empty catch block", err); }
        return true;
      }

      case 'mute':
        await this.moderationService.muteUser(ctx.chat!.id, ctx.from!.id, 'anti-spam', 300); // 5 min
        if (ctx.message?.message_id) {
          await this.moderationService.deleteMessage(chatId, ctx.message.message_id);
        }
        try { await ctx.reply(`🔇 ${ctx.from?.first_name} silenciado por 5 minutos. Motivo: ${result.reason}`); } catch (err) { logger.warn("[auto-fix] Empty catch block", err); }
        return true;

      case 'ban':
        await this.moderationService.banUser(ctx.chat!.id, ctx.from!.id, 'anti-spam');
        try { await ctx.reply(`🔨 ${ctx.from?.first_name} banido automaticamente. Motivo: ${result.reason}`); } catch (err) { logger.warn("[auto-fix] Empty catch block", err); }
        return true;
    }

    return false;
  }

  /**
   * Middleware de filtro de tipo de mensagem. Retorna true se a mensagem foi bloqueada.
   */
  public async processMessageFilter(ctx: Context): Promise<boolean> {
    const chatType = ctx.chat?.type;
    if (chatType !== 'group' && chatType !== 'supergroup') return false;

    const chatId = ctx.chat!.id.toString();
    const msg = ctx.message;
    if (!msg) return false;

    const detectedTypes = new Set<FilterableMessageType>();

    if (msg.forward_origin) detectedTypes.add('forward');
    if (msg.sticker) detectedTypes.add('sticker');
    if (msg.animation) detectedTypes.add('gif');
    if (msg.audio) detectedTypes.add('audio');
    if (msg.voice) detectedTypes.add('voice');
    if (msg.video_note) detectedTypes.add('video_note');
    if (msg.document && !msg.animation) detectedTypes.add('document');
    if (msg.photo && msg.photo.length > 0) detectedTypes.add('photo');
    if (msg.contact) detectedTypes.add('contact');
    if (msg.location) detectedTypes.add('location');

    if (detectedTypes.size === 0) return false;

    const blockedTypes = await this.messageFilterService.getBlockedTypes(chatId);
    const shouldBlock = Array.from(detectedTypes).some((type) => blockedTypes.includes(type));
    if (!shouldBlock) return false;

    if (msg.message_id) {
      await this.moderationService.deleteMessage(chatId, msg.message_id);
    }
    return true;
  }

  /**
   * Rastreia uma mensagem para estatisticas do grupo.
   */
  public async trackMessage(ctx: Context): Promise<void> {
    const chatType = ctx.chat?.type;
    if (chatType !== 'group' && chatType !== 'supergroup') return;

    const chatId = ctx.chat!.id.toString();
    const userId = ctx.from?.id.toString() || '';
    if (!userId) return;

    await this.statsService.trackMessage(chatId, userId).catch((err) => { logger.warn("[auto-fix] Empty catch block", err); });
  }

  private async applyAutoAction(ctx: Context, action: string, userId: number): Promise<void> {
    switch (action) {
      case 'ban':
        await this.moderationService.banUser(ctx.chat!.id, userId, 'anti-spam');
        break;
      case 'kick':
        await this.moderationService.kickUser(ctx.chat!.id, userId, 'anti-spam');
        break;
      case 'mute':
        await this.moderationService.muteUser(ctx.chat!.id, userId, 'anti-spam');
        break;
    }
  }
}
