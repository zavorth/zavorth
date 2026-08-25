import fs from 'fs';
import path from 'path';
import { asBoundaryRecord } from '../ChannelBoundaryPayload.js';
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
  readonly messageCharLimit = 4096;
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

  async onMessageReceived(payload: unknown): Promise<void> {
    const source = asBoundaryRecord(payload);
    const userId = String(source.from || source.sender || source.userId || '').trim().toLowerCase();
    const chatId = String(source.threadId || source.messageId || source.id || userId || 'email').trim();
    const rawText = String(source.text || source.body || source.rawText || '').trim();
    const messageId = String(source.messageId || source.id || '').trim() || null;
    const subject = String(source.subject || '').trim() || null;
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

  async sendMessage(outboundPayload: unknown): Promise<void> {
    const source = asBoundaryRecord(outboundPayload);
    const recipients = Array.isArray(source.recipients)
      ? source.recipients.map((entry) => String(entry || '').trim().toLowerCase())
      : [];
    const envelope = buildOutboundChannelEnvelope({
      platform: 'email',
      transport: this.providerHint || config.emailSmtpHost ? 'smtp-configured' : 'local-outbox',
      recipients,
      message: typeof outboundPayload === 'string'
        ? outboundPayload
        : String(source.text || source.message || '').trim(),
      payload: typeof outboundPayload === 'object' && outboundPayload !== null ? source : null,
      now: this.now(),
      fields: {
        recipient: String(source.recipient || source.to || source.chatId || '').trim().toLowerCase() || null,
        subject: String(source.subject || 'Zavorth notification').trim(),
      },
    });
    persistChannelOutboxEnvelope(this.outboxDir, envelope);
  }
}
