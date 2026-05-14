import type { IMessageBroker, MessageAttachment } from '../../contracts/IMessageBroker.js';
import type { ZavorthAgentGateway } from '../../runtime/agent/index.js';
import type { DiscordSurfacePolicyService } from '../../services/DiscordSurfacePolicyService.js';
import {
  evaluateSharedSurfaceCommandCallback,
  isSharedSurfaceOperationalCallbackCommand,
} from '../../domain/surface/application/shared-surface/SharedSurfaceCallbackCommandPolicy.js';
import {
  buildDiscordChatId,
  composeDiscordInboundText,
  extractDiscordAttachments,
  resolveDiscordThreadId,
} from '../DiscordGatewayMessageHelpers.js';
import type {
  DiscordGatewayInteractionLike,
  DiscordGatewayMessageLike,
} from '../DiscordGatewayTypes.js';
import { DiscordGatewayPersistence } from './DiscordGatewayPersistence.js';
import { DiscordGatewayReplyService } from './DiscordGatewayReplyService.js';

type DiscordGatewayInboundServiceOptions = {
  broker: IMessageBroker | null;
  agentGateway?: Pick<ZavorthAgentGateway, 'handle'> | null;
  allowDirectMessages: boolean;
  allowedGuildIds: string[];
  discordSurfacePolicyService: DiscordSurfacePolicyService;
  persistence: DiscordGatewayPersistence;
  replyService: DiscordGatewayReplyService;
};

type DiscordInboundValidationInput = {
  userId: string;
  guildId: string | null;
  channelId: string;
  parentChannelId?: string | null;
  rawText: string;
  attachmentsCount: number;
};

export class DiscordGatewayInboundService {
  private readonly broker: IMessageBroker | null;
  private readonly agentGateway: Pick<ZavorthAgentGateway, 'handle'> | null;
  private readonly allowDirectMessages: boolean;
  private readonly allowedGuildIds: string[];
  private readonly discordSurfacePolicyService: DiscordSurfacePolicyService;
  private readonly persistence: DiscordGatewayPersistence;
  private readonly replyService: DiscordGatewayReplyService;

  constructor(options: DiscordGatewayInboundServiceOptions) {
    this.broker = options.broker;
    this.agentGateway = options.agentGateway || null;
    this.allowDirectMessages = options.allowDirectMessages;
    this.allowedGuildIds = [...options.allowedGuildIds];
    this.discordSurfacePolicyService = options.discordSurfacePolicyService;
    this.persistence = options.persistence;
    this.replyService = options.replyService;
  }

  public async handleInboundMessage(message: DiscordGatewayMessageLike): Promise<void> {
    if (!this.broker) {
      throw new Error('Discord native gateway has no broker attached.');
    }

    const authorId = String(message.author?.id || '').trim();
    const guildId = String(message.guildId || '').trim() || null;
    const channelId = String(message.channelId || '').trim();
    const threadId = resolveDiscordThreadId(message.channel, channelId);
    const content = String(message.content || '').trim();
    const attachments = extractDiscordAttachments(message.attachments);
    const rawText = composeDiscordInboundText(content, attachments);

    if (!authorId || !channelId) {
      return;
    }

    if (message.author?.bot) {
      return;
    }

    const validation = this.validateInboundMessage({
      userId: authorId,
      guildId,
      channelId,
      parentChannelId: message.channel?.parentId,
      rawText,
      attachmentsCount: attachments.length,
    });
    if (!validation.valid) {
      this.persistence.markRejected(validation.reason);
      return;
    }

    this.persistence.markProcessedInbound({
      channelId,
      guildId,
      authorId,
      isDirectMessage: !guildId,
    });

    if (await this.tryHandleNaturalMessageThroughAgentGateway({
      userId: authorId,
      rawText,
      chatId: buildDiscordChatId(guildId, channelId, threadId, message.channel?.parentId),
      channelId,
      threadId,
      guildId,
      messageId: String(message.id || '').trim() || null,
      attachments,
      composerPayload: {
        attachments,
        discord: {
          source: 'message',
          channelId,
          threadId,
          guildId,
        },
      },
      reply: async (text: string, options?: any) => {
        await this.replyService.replyToMessage(message, text, options);
      },
    })) {
      return;
    }

    await this.broker.processMessage({
      platform: 'discord',
      userId: authorId,
      chatId: buildDiscordChatId(guildId, channelId, threadId, message.channel?.parentId),
      isGroup: Boolean(guildId),
      rawText,
      messageId: String(message.id || '').trim() || null,
      channelId,
      threadId,
      transport: 'text',
      attachments,
      composerPayload: {
        attachments,
        discord: {
          source: 'message',
          channelId,
          threadId,
          guildId,
        },
      },
      reply: async (text: string, options?: any) => {
        await this.replyService.replyToMessage(message, text, options);
      },
      editMessage: async (messageId: string, text: string) => {
        await this.replyService.editChannelMessage(message, messageId, text);
      },
    });
  }

  public async handleInteraction(interaction: DiscordGatewayInteractionLike): Promise<void> {
    if (!this.broker) {
      return;
    }

    if (interaction?.isButton?.()) {
      await this.handleComponentInteraction(interaction);
      return;
    }

    if (!interaction?.isChatInputCommand?.()) {
      return;
    }

    const authorId = String(interaction.user?.id || '').trim();
    const guildId = String(interaction.guildId || '').trim() || null;
    const channelId = String(interaction.channelId || '').trim();
    const threadId = resolveDiscordThreadId(interaction.channel, channelId);
    const attachments = extractDiscordAttachments([
      interaction.options?.getAttachment?.('attachment', false) || null,
    ]);
    const commandText = this.buildInteractionCommandText(interaction, attachments);

    if (!authorId || !channelId || !commandText) {
      return;
    }

    const validation = this.validateInboundMessage({
      userId: authorId,
      guildId,
      channelId,
      parentChannelId: interaction.channel?.parentId,
      rawText: commandText,
      attachmentsCount: attachments.length,
    });
    if (!validation.valid) {
      await this.replyService.replyToInteraction(interaction, validation.reason);
      this.persistence.markRejected(validation.reason);
      return;
    }

    this.persistence.markProcessedInbound({
      channelId,
      guildId,
      authorId,
      isDirectMessage: !guildId,
    });

    await this.broker.processMessage({
      platform: 'discord',
      userId: authorId,
      chatId: buildDiscordChatId(guildId, channelId, threadId, interaction.channel?.parentId),
      isGroup: Boolean(guildId),
      rawText: commandText,
      channelId,
      threadId,
      transport: 'slash_command',
      attachments,
      nativeCommand: {
        name: String(interaction.commandName || '').trim().toLowerCase(),
        args: null,
        options: {
          force: interaction.options?.getBoolean?.('force', false) ?? null,
          mode: interaction.options?.getString?.('mode', false) ?? null,
        },
      },
      composerPayload: {
        attachments,
        discord: {
          source: 'slash_command',
          channelId,
          threadId,
          guildId,
        },
      },
      reply: async (text: string, options?: any) => {
        await this.replyService.replyToInteraction(interaction, text, options);
      },
      editMessage: async (_messageId: string, text: string) => {
        await this.replyService.editInteractionReply(interaction, text);
      },
    });
  }

  private async handleComponentInteraction(interaction: DiscordGatewayInteractionLike): Promise<void> {
    const broker = this.broker;
    if (!broker) {
      return;
    }

    const authorId = String(interaction.user?.id || '').trim();
    const guildId = String(interaction.guildId || '').trim() || null;
    const channelId = String(interaction.channelId || '').trim();
    const threadId = resolveDiscordThreadId(interaction.channel, channelId);
    const decision = evaluateSharedSurfaceCommandCallback(interaction.customId);

    if (!authorId || !channelId) {
      return;
    }

    if (!decision.allowed) {
      await this.replyService.replyToInteraction(
        interaction,
        `Essa acao interativa expirou ou exige comando explicito. ${decision.reason}`,
      );
      this.persistence.markRejected(decision.reason);
      return;
    }

    const commandText = decision.commandText;
    if (
      isSharedSurfaceOperationalCallbackCommand(commandText) &&
      !this.discordSurfacePolicyService.canUseOperationalCommand(authorId, {
        isDirectMessage: !guildId,
      })
    ) {
      await this.replyService.replyToInteraction(
        interaction,
        this.discordSurfacePolicyService.formatOperationalCommandDenied(),
      );
      this.persistence.markRejected('Discord component callback denied by operational command policy.');
      return;
    }

    const validation = this.validateInboundMessage({
      userId: authorId,
      guildId,
      channelId,
      parentChannelId: interaction.channel?.parentId,
      rawText: commandText,
      attachmentsCount: 0,
    });
    if (!validation.valid) {
      await this.replyService.replyToInteraction(interaction, validation.reason);
      this.persistence.markRejected(validation.reason);
      return;
    }

    this.persistence.markProcessedInbound({
      channelId,
      guildId,
      authorId,
      isDirectMessage: !guildId,
    });

    await broker.processMessage({
      platform: 'discord',
      userId: authorId,
      chatId: buildDiscordChatId(guildId, channelId, threadId, interaction.channel?.parentId),
      isGroup: Boolean(guildId),
      rawText: commandText,
      messageId: String(interaction.message?.id || '').trim() || null,
      channelId,
      threadId,
      transport: 'interaction',
      attachments: [],
      nativeCommand: {
        name: 'component',
        args: commandText,
        options: {
          customId: String(interaction.customId || ''),
        },
      },
      composerPayload: {
        attachments: [],
        discord: {
          source: 'component',
          customId: String(interaction.customId || ''),
          channelId,
          threadId,
          guildId,
        },
      },
      reply: async (text: string, options?: any) => {
        await this.replyService.replyToInteraction(interaction, text, options);
      },
      editMessage: async (_messageId: string, text: string) => {
        await this.replyService.editInteractionReply(interaction, text);
      },
    });
  }

  private validateInboundMessage(
    input: DiscordInboundValidationInput,
  ): { valid: true } | { valid: false; reason: string } {
    if (!input.channelId) {
      return { valid: false, reason: 'Discord native gateway received a message without channelId.' };
    }

    if (!input.rawText) {
      return { valid: false, reason: 'Discord native gateway ignores empty messages.' };
    }

    if (!input.guildId && !this.allowDirectMessages) {
      return { valid: false, reason: 'Discord native gateway direct messages are disabled.' };
    }

    if (input.guildId && this.allowedGuildIds.length > 0 && !this.allowedGuildIds.includes(input.guildId)) {
      return { valid: false, reason: `Discord native gateway guild ${input.guildId} is not allowlisted.` };
    }

    const policyValidation = this.discordSurfacePolicyService.validateInboundMessage({
      userId: input.userId,
      channelId: input.channelId,
      parentChannelId: input.parentChannelId,
      rawText: input.rawText,
      isDirectMessage: !input.guildId,
      attachmentsCount: input.attachmentsCount,
    });
    if (!policyValidation.valid) {
      return policyValidation;
    }

    return { valid: true };
  }

  private buildInteractionCommandText(
    interaction: DiscordGatewayInteractionLike,
    attachments: MessageAttachment[],
  ): string {
    const commandName = String(interaction.commandName || '').trim().toLowerCase();
    const input = String(interaction.options?.getString?.('input', false) || '').trim();
    const force = interaction.options?.getBoolean?.('force', false) === true;
    const mode = String(interaction.options?.getString?.('mode', false) || '').trim().toLowerCase();

    switch (commandName) {
      case 'task':
      case 'plan':
      case 'auto':
        return composeDiscordInboundText(`/${commandName}${input ? ` ${input}` : ''}`, attachments);
      case 'workflow':
        return mode ? `/workflow ${mode}${input ? ` ${input}` : ''}` : '/workflow';
      case 'status':
      case 'help':
      case 'changes':
      case 'models':
        return `/${commandName}`;
      case 'commands':
        return input ? `/commands ${input}` : '/commands';
      case 'reload':
        return force ? '/reload force' : '/reload';
      case 'autorepair':
        return mode === 'status' ? '/autorepair status' : '/autorepair';
      default:
        return '';
    }
  }

  private async tryHandleNaturalMessageThroughAgentGateway(input: {
    userId: string;
    rawText: string;
    chatId: string;
    channelId: string;
    threadId: string | null;
    guildId: string | null;
    messageId: string | null;
    attachments: MessageAttachment[];
    composerPayload: Record<string, any>;
    reply: (text: string) => Promise<void>;
  }): Promise<boolean> {
    const text = String(input.rawText || '').trim();
    if (!this.agentGateway || !text || text.startsWith('/')) {
      return false;
    }
    if (input.guildId && this.discordSurfacePolicyService.isPublicServerMode()) {
      return false;
    }

    const result = await this.agentGateway.handle({
      userId: input.userId,
      channel: 'discord',
      sessionId: input.threadId || input.chatId,
      text,
      requestedTools: [],
      metadata: {
        transport: 'text',
        messageId: input.messageId,
        channelId: input.channelId,
        threadId: input.threadId,
        guildId: input.guildId,
        attachments: input.attachments,
        composerPayload: input.composerPayload,
        legacyUnifiedGatewayBypassed: true,
      },
    });

    const replyText = String(result.replies[0]?.text || result.run.summary || '').trim();
    if (replyText) {
      await input.reply(replyText);
    }
    return true;
  }
}
