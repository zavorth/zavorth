import fs from 'fs';
import path from 'path';
import { config } from '../../config/index.js';
import { GatewayChannelAdapter } from '../../gateway/channels/GatewayChannelAdapter';
import { GatewayEventBus } from '../../gateway/events/GatewayEventBus';
import {
  buildInboundChannelEvent,
  buildOutboundChannelEnvelope,
  persistChannelOutboxEnvelope,
} from '../contracts/ChannelMessageContract.js';
import { ChannelPolicyManager } from '../policies/ChannelPolicyManager';
import { SecurityAuditLogger } from '../../services/SecurityAuditLogger.js';
import { LogRepository } from '../../storage/LogRepository.js';

type WhatsAppChannelAdapterRuntime = {
  outboxDir?: string;
  now?: () => Date;
  auditLogger?: SecurityAuditLogger;
  logRepo?: LogRepository;
};

export class WhatsAppChannelAdapter implements GatewayChannelAdapter {
  id = 'whatsapp';
  name = 'WhatsApp Cloud API';
  type: 'async' = 'async';
  private readonly outboxDir: string;
  private readonly now: () => Date;
  private readonly auditLogger: SecurityAuditLogger;

  constructor(
    private eventBus: GatewayEventBus, 
    private policyManager: ChannelPolicyManager,
    private apiKey: string,
    runtime: WhatsAppChannelAdapterRuntime = {},
  ) {
    this.outboxDir = path.resolve(runtime.outboxDir || config.whatsappOutboxDir);
    this.now = runtime.now || (() => new Date());
    this.auditLogger = runtime.auditLogger || new SecurityAuditLogger(runtime.logRepo || new LogRepository());
  }

  async initialize(): Promise<void> {
    fs.mkdirSync(this.outboxDir, { recursive: true });
    if (!this.apiKey) {
      console.warn('[ChannelMesh] WhatsApp Channel offline (Missing config)');
      return;
    }
    console.log('[ChannelMesh] WhatsApp API Webhooks listening.');
  }

  async shutdown(): Promise<void> {
    console.log('[ChannelMesh] WhatsApp bounds detached.');
  }

  async onMessageReceived(webhookPayload: any): Promise<void> {
    // Discard messages from the bot itself to prevent loops
    if (webhookPayload?.fromMe === true || webhookPayload?.isMe === true || webhookPayload?.sentByBot === true) {
      return;
    }

    const userId = String(webhookPayload?.fromNumber || webhookPayload?.from || webhookPayload?.userId || '').trim();
    const chatId = String(webhookPayload?.chatId || webhookPayload?.fromNumber || webhookPayload?.from || '').trim() || 'whatsapp';
    const rawText = String(webhookPayload?.text || webhookPayload?.rawText || '').trim();
    const messageId = String(webhookPayload?.messageId || webhookPayload?.id || '').trim() || null;

    // Use verifyChatAccess to check permissions for this conversation
    const isAllowed = await this.policyManager.verifyChatAccess('whatsapp', chatId, userId);
    if (!isAllowed) {
      console.warn(`[Security] Blocked unauthorized WhatsApp interaction from ${userId} in chat ${chatId}`);
      
      let reason: 'unauthorized_group' | 'unauthorized_user' | 'blocked_user' = 'unauthorized_user';
      const policy = this.policyManager.getPolicy('whatsapp');
      if (policy) {
        if (policy.blockedList.includes(userId) || policy.blockedList.includes(chatId)) {
          reason = 'blocked_user';
        } else if (chatId.endsWith('@g.us')) {
          reason = 'unauthorized_group';
        }
      }
      this.auditLogger.logChannelAccessDecision({
        event: 'channel_message_blocked',
        decision: 'blocked',
        channel: 'whatsapp',
        chatId,
        isGroup: chatId.endsWith('@g.us'),
        channelUserId: userId,
        channelUserIdAllowed: false,
        reason,
        triggerType: 'none',
      });
      return;
    }

    // Apply mention filter in group chats
    if (chatId.endsWith('@g.us')) {
      let hasMention = false;

      // 1. Mention via metadata
      const botId = String(webhookPayload?.botId || webhookPayload?.myUserId || '').trim();
      if (Array.isArray(webhookPayload?.mentionedIds)) {
        if (botId && webhookPayload.mentionedIds.includes(botId)) {
          hasMention = true;
        }
      } else if (webhookPayload?.isMentioned === true) {
        hasMention = true;
      }

      // 2. Reply to bot
      if (webhookPayload?.quotedMessage?.fromMe === true || webhookPayload?.isReplyToBot === true || webhookPayload?.quotedMessage?.fromMe === 'true') {
        hasMention = true;
      }

      // 3. Textual wake word
      if (/\bzavorth\b/i.test(rawText)) {
        hasMention = true;
      }
      for (const alias of normalizeBotAliases(webhookPayload)) {
        if (messageMentionsAlias(rawText, alias)) {
          hasMention = true;
          break;
        }
      }

      if (!hasMention) {
        // Discard silently
        this.auditLogger.logChannelAccessDecision({
          event: 'channel_message_blocked',
          decision: 'blocked',
          channel: 'whatsapp',
          chatId,
          isGroup: true,
          channelUserId: userId,
          channelUserIdAllowed: false,
          reason: 'group_message_without_trigger',
          triggerType: 'none',
        });
        return;
      }
    }

    // Verify if the user is authorized/trusted
    const isUserAllowed = await this.policyManager.verifyUserAccess('whatsapp', userId);
    const policy = this.policyManager.getPolicy('whatsapp');
    const groupToolPolicy = policy?.groupToolPolicy;

    let triggerType: 'dm' | 'wake_word' | 'mention' | 'reply_to_bot' | 'none' = 'dm';
    if (chatId.endsWith('@g.us')) {
      const botId = String(webhookPayload?.botId || webhookPayload?.myUserId || '').trim();
      if (webhookPayload?.quotedMessage?.fromMe === true || webhookPayload?.isReplyToBot === true || webhookPayload?.quotedMessage?.fromMe === 'true') {
        triggerType = 'reply_to_bot';
      } else if (Array.isArray(webhookPayload?.mentionedIds) && botId && webhookPayload.mentionedIds.includes(botId)) {
        triggerType = 'mention';
      } else if (webhookPayload?.isMentioned === true) {
        triggerType = 'mention';
      } else if (/\bzavorth\b/i.test(rawText)) {
        triggerType = 'wake_word';
      } else if (normalizeBotAliases(webhookPayload).some((alias) => messageMentionsAlias(rawText, alias))) {
        triggerType = 'wake_word';
      } else {
        triggerType = 'mention';
      }
    }

    this.auditLogger.logChannelAccessDecision({
      event: 'channel_message_accepted',
      decision: 'allowed',
      channel: 'whatsapp',
      chatId,
      isGroup: chatId.endsWith('@g.us'),
      channelUserId: userId,
      channelUserIdAllowed: isUserAllowed,
      triggerType,
    });

    await this.eventBus.emit(buildInboundChannelEvent({
      platform: 'whatsapp',
      userId,
      chatId,
      rawText,
      messageId,
      now: this.now(),
      fields: {
        channelUserIdAllowed: isUserAllowed,
        groupToolPolicy,
        chatId,
        channelUserId: userId,
      },
    }));
  }

  async sendMessage(outboundPayload: any): Promise<void> {
    const envelope = buildOutboundChannelEnvelope({
      platform: 'whatsapp',
      transport: this.apiKey ? 'cloud-api-configured' : 'local-outbox',
      recipients: Array.isArray(outboundPayload?.recipients) ? outboundPayload.recipients : [],
      message: typeof outboundPayload === 'string'
        ? outboundPayload
        : String(outboundPayload?.text || outboundPayload?.message || '').trim(),
      payload: outboundPayload && typeof outboundPayload === 'object' ? outboundPayload : null,
      now: this.now(),
      fields: {
        chatId: String(outboundPayload?.chatId || outboundPayload?.to || '').trim() || null,
        messageId: String(outboundPayload?.messageId || '').trim() || null,
      },
    });
    persistChannelOutboxEnvelope(this.outboxDir, envelope);
  }
}

function normalizeBotAliases(payload: any): string[] {
  const aliases = Array.isArray(payload?.botAliases)
    ? payload.botAliases
    : Array.isArray(payload?.botNames)
      ? payload.botNames
      : [];
  return Array.from(new Set(
    ['zavorth', ...aliases]
      .map((alias) => String(alias || '').trim().toLowerCase())
      .filter(Boolean),
  ));
}

function messageMentionsAlias(text: string, alias: string): boolean {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)@?${escaped}(\\b|\\s|[:,.!?])`, 'i').test(text);
}
