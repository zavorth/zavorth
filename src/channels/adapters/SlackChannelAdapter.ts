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

type SlackChannelAdapterRuntime = {
  outboxDir?: string;
  now?: () => Date;
};

export class SlackChannelAdapter implements GatewayChannelAdapter {
  id = 'slack';
  name = 'Slack Enterprise Grid / Workspace';
  type: 'async' = 'async';
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
      console.warn('[ChannelMesh] Slack Channel offline (Missing config)');
      return;
    }
    console.log('[ChannelMesh] Slack SocketMode/Bolt started.');
  }

  async shutdown(): Promise<void> {
    console.log('[ChannelMesh] Slack detached.');
  }

  async onMessageReceived(slackPayload: any): Promise<void> {
    const userId = String(slackPayload?.user || slackPayload?.userId || '').trim();
    const channelId = String(slackPayload?.channel || slackPayload?.channelId || '').trim() || 'slack';
    const rawText = String(slackPayload?.text || slackPayload?.rawText || '').trim();
    const threadTs = String(slackPayload?.threadTs || slackPayload?.thread_ts || '').trim() || null;
    const messageId = String(slackPayload?.ts || slackPayload?.messageId || '').trim() || null;
    const isAllowed = await this.policyManager.verifyAccess('slack', userId);
    if (!isAllowed) {
        console.warn(`[Security] Blocked unauthorized Slack user: ${userId}`);
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
      message: typeof outboundPayload === 'string'
        ? outboundPayload
        : String(outboundPayload?.text || outboundPayload?.message || '').trim(),
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
