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

type TeamsChannelAdapterRuntime = {
  outboxDir?: string;
  now?: () => Date;
};

export class TeamsChannelAdapter implements GatewayChannelAdapter {
  id = 'teams';
  name = 'Microsoft Teams Graph/Bot Bridge';
  type: 'async' = 'async';
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

  async initialize(): Promise<void> {
    fs.mkdirSync(this.outboxDir, { recursive: true });
    if (!this.providerHint && !config.teamsAppId) {
      console.warn('[ChannelMesh] Teams bridge offline (missing Teams app/tenant configuration).');
    }
  }

  async shutdown(): Promise<void> {
    console.log('[ChannelMesh] Teams bridge detached.');
  }

  async onMessageReceived(payload: any): Promise<void> {
    const userId = String(
      payload?.userId
      || payload?.from?.id
      || payload?.from?.aadObjectId
      || payload?.sender
      || '',
    ).trim();
    const chatId = String(
      payload?.conversationId
      || payload?.conversation?.id
      || payload?.channelId
      || userId
      || 'teams',
    ).trim();
    const rawText = String(payload?.text || payload?.message || payload?.rawText || '').trim();
    const messageId = String(payload?.id || payload?.messageId || payload?.activityId || '').trim() || null;
    const threadId = String(payload?.replyToId || payload?.threadId || '').trim() || null;
    const isAllowed = await this.policyManager.verifyAccess('teams', userId);
    if (!isAllowed) {
      console.warn(`[Security] Blocked unauthorized Teams interaction from ${userId}`);
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

  async sendMessage(outboundPayload: any): Promise<void> {
    const envelope = buildOutboundChannelEnvelope({
      platform: 'teams',
      transport: this.providerHint || config.teamsAppId ? 'graph-bot-configured' : 'local-outbox',
      recipients: Array.isArray(outboundPayload?.recipients) ? outboundPayload.recipients : [],
      message: typeof outboundPayload === 'string'
        ? outboundPayload
        : String(outboundPayload?.text || outboundPayload?.message || '').trim(),
      payload: outboundPayload && typeof outboundPayload === 'object' ? outboundPayload : null,
      now: this.now(),
      fields: {
        conversationId: String(
          outboundPayload?.conversationId
          || outboundPayload?.chatId
          || outboundPayload?.recipient
          || '',
        ).trim() || null,
        replyToId: String(outboundPayload?.replyToId || outboundPayload?.threadId || '').trim() || null,
      },
    });
    persistChannelOutboxEnvelope(this.outboxDir, envelope);
  }
}
