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

type TeamsChannelAdapterRuntime = {
  outboxDir?: string;
  now?: () => Date;
};

export class TeamsChannelAdapter implements GatewayChannelAdapter {
  id = 'teams';
  name = 'Microsoft Teams Graph/Bot Bridge';
  type = 'async' as const;
  readonly messageCharLimit = 4096;
  private readonly outboxDir: string;
  private readonly now: () => Date;

  constructor(
    private eventBus: GatewayEventBus,
    private policyManager: ChannelPolicyManager,
    private providerHint: string,
    runtime: TeamsChannelAdapterRuntime = {},
  ) {
    this.outboxDir = path.resolve(runtime.outboxDir || config.teamsOutboxDir);
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
    if (!this.providerHint && !config.teamsAppId) {
      logger.warn('[ChannelMesh] Teams bridge offline (missing Teams app/tenant configuration).');
    }
  }

  async shutdown(): Promise<void> {
    this.eventBus.unsubscribe?.('public_ws', this.outboundReplyHandler);
    logger.info('[ChannelMesh] Teams bridge detached.');
  }

  async onMessageReceived(payload: unknown): Promise<void> {
    const source = asBoundaryRecord(payload);
    const from = asBoundaryRecord(source.from);
    const conversation = asBoundaryRecord(source.conversation);
    const userId = String(
      source.userId
      || from.id
      || from.aadObjectId
      || source.sender
      || '',
    ).trim();
    const chatId = String(
      source.conversationId
      || conversation.id
      || source.channelId
      || userId
      || 'teams',
    ).trim();
    const rawText = String(source.text || source.message || source.rawText || '').trim();
    const messageId = String(source.id || source.messageId || source.activityId || '').trim() || null;
    const threadId = String(source.replyToId || source.threadId || '').trim() || null;
    const isAllowed = await this.policyManager.verifyAccess('teams', userId);
    if (!isAllowed) {
      logger.warn(`[Security] Blocked unauthorized Teams interaction from ${userId}`);
      return;
    }

    await this.eventBus.emit(buildInboundChannelEvent({
      platform: 'teams',
      userId,
      chatId,
      rawText,
      messageId,
      now: this.now(),
      fields: {
        channelId: chatId,
        threadId,
      },
    }));
  }

  async sendMessage(outboundPayload: unknown): Promise<void> {
    const source = asBoundaryRecord(outboundPayload);
    const envelope = buildOutboundChannelEnvelope({
      platform: 'teams',
      transport: this.providerHint || config.teamsAppId ? 'graph-bot-configured' : 'local-outbox',
      recipients: Array.isArray(source.recipients) ? source.recipients : [],
      message: typeof outboundPayload === 'string'
        ? outboundPayload
        : String(source.text || source.message || '').trim(),
      payload: typeof outboundPayload === 'object' && outboundPayload !== null ? source : null,
      now: this.now(),
      fields: {
        conversationId: String(
          source.conversationId
          || source.chatId
          || source.recipient
          || '',
        ).trim() || null,
        replyToId: String(source.replyToId || source.threadId || '').trim() || null,
      },
    });
    persistChannelOutboxEnvelope(this.outboxDir, envelope);
  }
}
