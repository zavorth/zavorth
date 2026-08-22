import fs from 'fs';
import path from 'path';
import { config } from '../../../config/index.js';
import { GatewayChannelAdapter } from '../../../gateway/channels/GatewayChannelAdapter';
import { GatewayEventBus } from '../../../gateway/events/GatewayEventBus';
import {
  buildInboundChannelEvent,
  buildOutboundChannelEnvelope,
  persistChannelOutboxEnvelope,
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

  async initialize(): Promise<void> {
    fs.mkdirSync(this.outboxDir, { recursive: true });
    if (!this.botToken) {
      logger.warn('[ChannelMesh] Slack Channel offline (Missing config)');
      return;
    }
    logger.info('[ChannelMesh] Slack SocketMode/Bolt started.');
  }

  async shutdown(): Promise<void> {
    logger.info('[ChannelMesh] Slack detached.');
  }

  async onMessageReceived(slackPayload: any): Promise<void> {
    const userId = String(slackPayload?.user || slackPayload?.userId || '').trim();
    const channelId = String(slackPayload?.channel || slackPayload?.channelId || '').trim() || 'slack';
    const rawText = String(slackPayload?.text || slackPayload?.rawText || '').trim();
    const threadTs = String(slackPayload?.threadTs || slackPayload?.thread_ts || '').trim() || null;
    const messageId = String(slackPayload?.ts || slackPayload?.messageId || '').trim() || null;
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

  async sendMessage(outboundPayload: any): Promise<void> {
    const envelope = buildOutboundChannelEnvelope({
      platform: 'slack',
      transport: this.botToken ? 'native-configured' : 'local-outbox',
      recipients: Array.isArray(outboundPayload?.recipients) ? outboundPayload.recipients : [],
      message: truncateSlackText(
        typeof outboundPayload === 'string'
          ? outboundPayload
          : String(outboundPayload?.text || outboundPayload?.message || '').trim(),
        8000
      ),
      payload: outboundPayload && typeof outboundPayload === 'object' ? outboundPayload : null,
      now: this.now(),
      fields: {
        channelId: String(outboundPayload?.channelId || outboundPayload?.channel || '').trim() || null,
        threadTs: String(outboundPayload?.threadTs || outboundPayload?.thread_ts || '').trim() || null,
      },
    });
    persistChannelOutboxEnvelope(this.outboxDir, envelope);
  }
}
