import fs from 'fs';
import path from 'path';
import { config } from '../../../config/index.js';
import { GatewayChannelAdapter } from '../../../gateway/channels/GatewayChannelAdapter';
import { GatewayEventBus } from '../../../gateway/events/GatewayEventBus';
import {
  buildInboundChannelEvent,
  buildOutboundChannelEnvelope,
  extractChannelMeshReplyEvent,
  extractChannelMeshTypingEvent,
  persistChannelOutboxEnvelope,
} from '../../../channels/contracts/ChannelMessageContract.js';
import { ChannelPolicyManager } from '../../../channels/policies/ChannelPolicyManager';

import { logger } from '../../../logger.js';

type SignalChannelAdapterRuntime = {
  outboxDir?: string;
  now?: () => Date;
};

export class SignalChannelAdapter implements GatewayChannelAdapter {
  id = 'signal';
  name = 'Signal signal-cli Bridge';
  type = 'async' as const;
  readonly messageCharLimit = 4096;
  private readonly outboxDir: string;
  private readonly now: () => Date;
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

  constructor(
    private eventBus: GatewayEventBus,
    private policyManager: ChannelPolicyManager,
    private bridgeTarget: string,
    runtime: SignalChannelAdapterRuntime = {},
  ) {
    this.outboxDir = path.resolve(runtime.outboxDir || process.env.SIGNAL_OUTBOX_DIR || path.join(config.projectRoot, 'data', 'signal-bridge', 'outbox'));
    this.now = runtime.now || (() => new Date());
  }

  async initialize(): Promise<void> {
    fs.mkdirSync(this.outboxDir, { recursive: true });
    this.eventBus.subscribe('public_ws', this.outboundReplyHandler);
    if (!this.bridgeTarget) {
      logger.warn('[ChannelMesh] Signal bridge offline (missing signal-cli target).');
    }
  }

  async shutdown(): Promise<void> {
    this.eventBus.unsubscribe?.('public_ws', this.outboundReplyHandler);
    logger.info('[ChannelMesh] Signal bridge detached.');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async onMessageReceived(payload: any): Promise<void> {
    const userId = String(payload?.sender || payload?.source || payload?.userId || payload?.from || '').trim();
    const chatId = String(payload?.groupId || payload?.chatId || userId || 'signal').trim();
    const rawText = String(payload?.message || payload?.text || payload?.rawText || '').trim();
    const messageId = String(payload?.messageId || payload?.id || payload?.timestamp || '').trim() || null;
    const isAllowed = await this.policyManager.verifyAccess('signal', userId);
    if (!isAllowed) {
      logger.warn(`[Security] Blocked unauthorized Signal interaction from ${userId}`);
      return;
    }

    await this.eventBus.emit(buildInboundChannelEvent({
      platform: 'signal',
      userId,
      chatId,
      rawText,
      messageId,
      now: this.now(),
      fields: {
        groupId: payload?.groupId || null,
      },
    }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async sendMessage(outboundPayload: any): Promise<void> {
    const envelope = buildOutboundChannelEnvelope({
      platform: 'signal',
      transport: this.bridgeTarget ? 'signal-cli-configured' : 'local-outbox',
      recipients: Array.isArray(outboundPayload?.recipients) ? outboundPayload.recipients : [],
      message: typeof outboundPayload === 'string'
        ? outboundPayload
        : String(outboundPayload?.text || outboundPayload?.message || '').trim(),
      payload: outboundPayload && typeof outboundPayload === 'object' ? outboundPayload : null,
      now: this.now(),
      fields: {
        recipient: String(outboundPayload?.recipient || outboundPayload?.to || outboundPayload?.chatId || '').trim() || null,
      },
    });
    persistChannelOutboxEnvelope(this.outboxDir, envelope);
  }
}
