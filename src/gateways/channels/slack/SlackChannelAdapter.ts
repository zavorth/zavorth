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

import { truncateSlackText } from '../../../utils/text.js';
import { logger } from '../../../logger.js';


type SlackChannelAdapterRuntime = {
  outboxDir?: string;
  now?: () => Date;
};

export class SlackChannelAdapter implements GatewayChannelAdapter {
  id = 'slack';
  name = 'Slack Enterprise Grid / Workspace';
  type = 'async' as const;
  readonly messageCharLimit = 4000;
  private readonly outboxDir: string;
  private readonly now: () => Date;

  constructor(
    private eventBus: GatewayEventBus,
    private policyManager: ChannelPolicyManager,
    private botToken: string,
    runtime: SlackChannelAdapterRuntime = {},
  ) {
    this.outboxDir = path.resolve(runtime.outboxDir || config.slackOutboxDir);
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
    if (!this.botToken) {
      logger.warn('[ChannelMesh] Slack Channel offline (Missing config)');
      return;
    }
    logger.info('[ChannelMesh] Slack SocketMode/Bolt started.');
  }

  async shutdown(): Promise<void> {
    this.eventBus.unsubscribe?.('public_ws', this.outboundReplyHandler);
    logger.info('[ChannelMesh] Slack detached.');
  }

  async onMessageReceived(slackPayload: unknown): Promise<void> {
    const source = asBoundaryRecord(slackPayload);
    const userId = String(source.user || source.userId || '').trim();
    const channelId = String(source.channel || source.channelId || '').trim() || 'slack';
    const rawText = String(source.text || source.rawText || '').trim();
    const threadTs = String(source.threadTs || source.thread_ts || '').trim() || null;
    const messageId = String(source.ts || source.messageId || '').trim() || null;
    const isAllowed = await this.policyManager.verifyAccess('slack', userId);
    if (!isAllowed) {
        logger.warn(`[Security] Blocked unauthorized Slack user: ${userId}`);
        return;
    }

    await this.eventBus.emit(buildInboundChannelEvent({
      platform: 'slack',
      userId,
      chatId: channelId,
      rawText,
      messageId,
      now: this.now(),
      fields: {
        channelId,
        threadTs,
      },
    }));
  }

  async sendMessage(outboundPayload: unknown): Promise<void> {
    const source = asBoundaryRecord(outboundPayload);
    const envelope = buildOutboundChannelEnvelope({
      platform: 'slack',
      transport: this.botToken ? 'native-configured' : 'local-outbox',
      recipients: Array.isArray(source.recipients) ? source.recipients : [],
      message: truncateSlackText(
        typeof outboundPayload === 'string'
          ? outboundPayload
          : String(source.text || source.message || '').trim(),
        8000
      ),
      payload: typeof outboundPayload === 'object' && outboundPayload !== null ? source : null,
      now: this.now(),
      fields: {
        channelId: String(source.channelId || source.channel || '').trim() || null,
        threadTs: String(source.threadTs || source.thread_ts || '').trim() || null,
      },
    });
    persistChannelOutboxEnvelope(this.outboxDir, envelope);
  }
}
