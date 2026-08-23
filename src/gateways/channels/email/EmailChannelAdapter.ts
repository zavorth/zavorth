import fs from 'fs';
import path from 'path';
import { config } from '../../../config/index.js';
import { GatewayChannelAdapter } from '../../../gateway/channels/GatewayChannelAdapter';
import { GatewayEventBus } from '../../../gateway/events/GatewayEventBus';
import {
  buildInboundChannelEvent,
  buildOutboundChannelEnvelope,
  persistChannelOutboxEnvelope,
  extractChannelMeshReplyEvent,
  extractChannelMeshTypingEvent,
} from '../../../channels/contracts/ChannelMessageContract.js';
import { ChannelPolicyManager } from '../../../channels/policies/ChannelPolicyManager';

import { logger } from '../../../logger.js';

type EmailChannelAdapterRuntime = {
  outboxDir?: string;
  now?: () => Date;
};

export class EmailChannelAdapter implements GatewayChannelAdapter {
  id = 'email';
  name = 'Email SMTP/IMAP Bridge';
  type = 'async' as const;
  private readonly outboxDir: string;
  private readonly now: () => Date;

  constructor(
    private eventBus: GatewayEventBus,
    private policyManager: ChannelPolicyManager,
    private providerHint: string,
    runtime: EmailChannelAdapterRuntime = {},
  ) {
    this.outboxDir = path.resolve(runtime.outboxDir || config.emailOutboxDir);
    this.now = runtime.now || (() => new Date());
  }


  private readonly outboundReplyHandler = (event: unknown): void => {
    const reply = extractChannelMeshReplyEvent(event, this.id);
    if (reply) {
      void this.sendMessage({ recipients: [reply.userId], text: reply.text });
      return;
    }
    const typing = extractChannelMeshTypingEvent(event, this.id);
    if (typing) {
      void (this as GatewayChannelAdapter).renewTyping?.(typing.chatId);
    }
  };

  async initialize(): Promise<void> {
    this.eventBus.subscribe('public_ws', this.outboundReplyHandler);
    fs.mkdirSync(this.outboxDir, { recursive: true });
    if (!this.providerHint && !config.emailSmtpHost) {
      logger.warn('[ChannelMesh] Email bridge offline (missing SMTP configuration).');
    }
  }

  async shutdown(): Promise<void> {
    this.eventBus.unsubscribe?.('public_ws', this.outboundReplyHandler);
    logger.info('[ChannelMesh] Email bridge detached.');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async onMessageReceived(payload: any): Promise<void> {
    const userId = String(payload?.from || payload?.sender || payload?.userId || '').trim().toLowerCase();
    const chatId = String(payload?.threadId || payload?.messageId || payload?.id || userId || 'email').trim();
    const rawText = String(payload?.text || payload?.body || payload?.rawText || '').trim();
    const messageId = String(payload?.messageId || payload?.id || '').trim() || null;
    const subject = String(payload?.subject || '').trim() || null;
    const isAllowed = await this.policyManager.verifyAccess('email', userId);
    if (!isAllowed) {
      logger.warn(`[Security] Blocked unauthorized Email interaction from ${userId}`);
      return;
    }

    await this.eventBus.emit(buildInboundChannelEvent({
      platform: 'email',
      userId,
      chatId,
      rawText,
      messageId,
      now: this.now(),
      fields: {
        subject,
      },
    }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async sendMessage(outboundPayload: any): Promise<void> {
    const recipients = Array.isArray(outboundPayload?.recipients)
      ? outboundPayload.recipients.map((entry: unknown) => String(entry || '').trim().toLowerCase())
      : [];
    const envelope = buildOutboundChannelEnvelope({
      platform: 'email',
      transport: this.providerHint || config.emailSmtpHost ? 'smtp-configured' : 'local-outbox',
      recipients,
      message: typeof outboundPayload === 'string'
        ? outboundPayload
        : String(outboundPayload?.text || outboundPayload?.message || '').trim(),
      payload: outboundPayload && typeof outboundPayload === 'object' ? outboundPayload : null,
      now: this.now(),
      fields: {
        recipient: String(outboundPayload?.recipient || outboundPayload?.to || outboundPayload?.chatId || '').trim().toLowerCase() || null,
        subject: String(outboundPayload?.subject || 'Zavorth notification').trim(),
      },
    });
    persistChannelOutboxEnvelope(this.outboxDir, envelope);
  }
}
