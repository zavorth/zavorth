import { Bot, Context, InlineKeyboard } from 'grammy';
import type { InlineKeyboardMarkup } from '@grammyjs/types';
import { config } from '../../../config/index.js';
import { AuthGuard } from '../../../gateways/channels/telegram/AuthGuard.js';
import { parseTelegramCommand } from '../../../gateways/channels/telegram/BotGatewayHelpers.js';
import { TelegramChannelContractService } from '../../../gateways/channels/telegram/TelegramChannelContractService.js';
import { DndService } from '../../../services/DndService.js';
import { HostIdentityService } from '../../../services/HostIdentityService.js';

interface TelegramPayloadWithMarkup {
  reply_markup?: InlineKeyboardMarkup;
}

interface TelegramMessageLike {
  chat?: { id: number | string };
  message_id?: number;
}

type LogRepositoryLike = {
  log(level: string, source: string, message: string): void;
};

type ChatCleanupLike = {
  trackMessage(chatId: string, messageId: number): void;
};

type TelegramGroupEventControllerLike = {
  handleNewMembers(ctx: Context): Promise<void> | void;
  handleLeftMember(ctx: Context): Promise<void> | void;
  processAntiSpam(ctx: Context): Promise<boolean>;
  processMessageFilter(ctx: Context): Promise<boolean>;
  trackMessage(ctx: Context): Promise<void> | void;
};

type TelegramMediaControllerLike = {
  handlePhoto(ctx: Context): Promise<void> | void;
  handleVoice(ctx: Context): Promise<void> | void;
  handleVideo(ctx: Context): Promise<void> | void;
  handleDocument(ctx: Context): Promise<void> | void;
};

type TelegramCallbackControllerLike = {
  handleCallback(ctx: Context, data: string): Promise<void> | void;
};

export type TelegramGatewayHandlerRegistrarDependencies = {
  bot: Bot;
  logRepo: LogRepositoryLike;
  chatCleanup: ChatCleanupLike;
  groupEventController: TelegramGroupEventControllerLike;
  mediaController: TelegramMediaControllerLike;
  callbackController: TelegramCallbackControllerLike;
  hostIdentityService: HostIdentityService | undefined;
  telegramChannelContractService?: TelegramChannelContractService;
  processTextMessage(ctx: Context, text: string, inlineData?: Array<{ mimeType: string; data: string }>): Promise<void>;
  processGroupCommand(ctx: Context, text: string): Promise<void>;
  canUseInteractiveGroupAi(ctx: Context): Promise<boolean>;
};

export class TelegramGatewayHandlerRegistrar {
  constructor(private readonly dependencies: TelegramGatewayHandlerRegistrarDependencies) {}

  public registerOutgoingTracker(): void {
    const sendMethods = new Set([
      'sendMessage', 'sendPhoto', 'sendDocument', 'sendVideo',
      'sendAudio', 'sendVoice', 'sendAnimation', 'sendSticker',
      'sendVideoNote', 'sendMediaGroup', 'sendLocation', 'sendContact',
    ]);

    this.dependencies.bot.api.config.use(async (prev, method, payload, signal) => {
      if (
        payload &&
        typeof payload === 'object' &&
        !('reply_markup' in payload) &&
        ['sendMessage', 'sendDocument', 'sendPhoto', 'sendVoice', 'sendVideo', 'sendAudio'].includes(method)
      ) {
        (payload as TelegramPayloadWithMarkup).reply_markup = new InlineKeyboard().text('Apagar', 'action:delete');
      }

      const result = await prev(method, payload, signal);

      if (sendMethods.has(method) && result.ok) {
        const data = result.result as TelegramMessageLike | TelegramMessageLike[];
        const messages = Array.isArray(data) ? data : [data];
        for (const msg of messages) {
          if (msg?.chat?.id && msg?.message_id) {
            this.dependencies.chatCleanup.trackMessage(
              String(msg.chat.id),
              msg.message_id,
            );
          }
        }
      }

      return result;
    });
  }

  public registerMiddlewares(): void {
    this.dependencies.bot.use(async (ctx, next) => {
      if (ctx.from?.id && config.allowedUserIds.includes(ctx.from.id.toString())) {
        DndService.markUserActive();
      }
      return next();
    });

    this.dependencies.bot.use(async (ctx, next) => {
      const channelContractService =
        this.dependencies.telegramChannelContractService || new TelegramChannelContractService();
      const decision = await channelContractService.authorize(ctx);
      if (decision.allowed) {
        return next();
      }

      this.dependencies.logRepo.log(
        'warn',
        'Telegram',
        `Channel Mesh bloqueou Telegram: ${decision.reason} chat=${decision.contract.chatId || 'n/d'} thread=${decision.contract.threadId || 'n/d'} user=${decision.contract.userId || 'n/d'}`,
      );

      if (decision.shouldReply) {
        await ctx.reply(
          'This Telegram chat is not allowed by the Channel Mesh policy. Update `ZAVORTH_CHANNEL_POLICY_TELEGRAM_ALLOWED` or open /zavorthControl to review channels.',
          { parse_mode: 'Markdown' },
        );
      }
    });

    this.dependencies.bot.use(AuthGuard.middleware(this.dependencies.hostIdentityService));
  }

  public registerHandlers(): void {
    this.dependencies.bot.on('message:new_chat_members', async (ctx: Context) => {
      await this.dependencies.groupEventController.handleNewMembers(ctx);
    });

    this.dependencies.bot.on('message:left_chat_member', async (ctx: Context) => {
      await this.dependencies.groupEventController.handleLeftMember(ctx);
    });

    this.dependencies.bot.on('message:text', async (ctx: Context) => {
      const text = ctx.message?.text;
      if (!text) {
        return;
      }

      const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
      if (isGroup) {
        if (parseTelegramCommand(text)) {
          await this.dependencies.processGroupCommand(ctx, text);
          return;
        }

        const blockedBySpam = await this.dependencies.groupEventController.processAntiSpam(ctx);
        if (blockedBySpam) return;

        const blockedByFilter = await this.dependencies.groupEventController.processMessageFilter(ctx);
        if (blockedByFilter) return;

        await this.dependencies.groupEventController.trackMessage(ctx);
        if (await this.dependencies.canUseInteractiveGroupAi(ctx)) {
          await this.dependencies.processTextMessage(ctx, text);
        }
        return;
      }

      await this.dependencies.processTextMessage(ctx, text);
    });

    this.dependencies.bot.on('message:photo', async (ctx: Context) => {
      const blockedBySpam = await this.dependencies.groupEventController.processAntiSpam(ctx);
      if (blockedBySpam) return;

      const blockedByFilter = await this.dependencies.groupEventController.processMessageFilter(ctx);
      if (blockedByFilter) return;

      await this.dependencies.groupEventController.trackMessage(ctx);
      if (!await this.dependencies.canUseInteractiveGroupAi(ctx)) return;
      await this.dependencies.mediaController.handlePhoto(ctx);
    });

    this.dependencies.bot.on(['message:voice', 'message:audio'], async (ctx: Context) => {
      const blockedBySpam = await this.dependencies.groupEventController.processAntiSpam(ctx);
      if (blockedBySpam) return;

      const blockedByFilter = await this.dependencies.groupEventController.processMessageFilter(ctx);
      if (blockedByFilter) return;

      await this.dependencies.groupEventController.trackMessage(ctx);
      if (!await this.dependencies.canUseInteractiveGroupAi(ctx)) return;
      await this.dependencies.mediaController.handleVoice(ctx);
    });

    this.dependencies.bot.on(['message:video', 'message:video_note'], async (ctx: Context) => {
      const blockedBySpam = await this.dependencies.groupEventController.processAntiSpam(ctx);
      if (blockedBySpam) return;

      const blockedByFilter = await this.dependencies.groupEventController.processMessageFilter(ctx);
      if (blockedByFilter) return;

      await this.dependencies.groupEventController.trackMessage(ctx);
      if (!await this.dependencies.canUseInteractiveGroupAi(ctx)) return;
      await this.dependencies.mediaController.handleVideo(ctx);
    });

    this.dependencies.bot.on('message:document', async (ctx: Context) => {
      const blockedBySpam = await this.dependencies.groupEventController.processAntiSpam(ctx);
      if (blockedBySpam) return;

      const blockedByFilter = await this.dependencies.groupEventController.processMessageFilter(ctx);
      if (blockedByFilter) return;

      await this.dependencies.groupEventController.trackMessage(ctx);
      if (!await this.dependencies.canUseInteractiveGroupAi(ctx)) return;
      await this.dependencies.mediaController.handleDocument(ctx);
    });

    this.dependencies.bot.on('message:sticker', async (ctx: Context) => {
      const blockedBySpam = await this.dependencies.groupEventController.processAntiSpam(ctx);
      if (blockedBySpam) return;

      const blockedByFilter = await this.dependencies.groupEventController.processMessageFilter(ctx);
      if (blockedByFilter) return;

      await this.dependencies.groupEventController.trackMessage(ctx);
    });

    this.dependencies.bot.on('message:animation', async (ctx: Context) => {
      const blockedBySpam = await this.dependencies.groupEventController.processAntiSpam(ctx);
      if (blockedBySpam) return;

      const blockedByFilter = await this.dependencies.groupEventController.processMessageFilter(ctx);
      if (blockedByFilter) return;

      await this.dependencies.groupEventController.trackMessage(ctx);
    });

    this.dependencies.bot.on('message:contact', async (ctx: Context) => {
      const blockedBySpam = await this.dependencies.groupEventController.processAntiSpam(ctx);
      if (blockedBySpam) return;

      const blockedByFilter = await this.dependencies.groupEventController.processMessageFilter(ctx);
      if (blockedByFilter) return;

      await this.dependencies.groupEventController.trackMessage(ctx);
    });

    this.dependencies.bot.on('message:location', async (ctx: Context) => {
      const blockedBySpam = await this.dependencies.groupEventController.processAntiSpam(ctx);
      if (blockedBySpam) return;

      const blockedByFilter = await this.dependencies.groupEventController.processMessageFilter(ctx);
      if (blockedByFilter) return;

      await this.dependencies.groupEventController.trackMessage(ctx);
    });

    this.dependencies.bot.catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.dependencies.logRepo.log('error', 'BotGateway', `Unhandled Telegram error: ${message}`);
    });

    this.dependencies.bot.on('callback_query:data', async (ctx) => {
      await this.dependencies.callbackController.handleCallback(ctx, ctx.callbackQuery.data);
    });
  }

  /**
   * Removes all registered handlers to prevent listener leaks on restart.
   */
  public unregisterHandlers(): void {
    const bot = this.dependencies.bot as any;
    bot.off('message:new_chat_members');
    bot.off('message:left_chat_member');
    bot.off('message:text');
    bot.off('callback_query:data');
  }
}
