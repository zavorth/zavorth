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

type IMessageMacBridgeAdapterRuntime = {
  outboxDir?: string;
  now?: () => Date;
  requireApproval?: boolean;
  readOnly?: boolean;
};

export class IMessageMacBridgeAdapter implements GatewayChannelAdapter {
  id = 'imessage';
  name = 'iMessage macOS Node Host Bridge';
  type = 'async' as const;
  readonly messageCharLimit = 4096;
  private readonly outboxDir: string;
  private readonly now: () => Date;
  private readonly requireApproval: boolean;
  private readonly readOnly: boolean;

  constructor(
    private eventBus: GatewayEventBus,
    private policyManager: ChannelPolicyManager,
    private nodeHostId: string,
    runtime: IMessageMacBridgeAdapterRuntime = {},
  ) {
    this.outboxDir = path.resolve(runtime.outboxDir || process.env.IMESSAGE_OUTBOX_DIR || path.join(config.projectRoot, 'data', 'imessage-bridge', 'outbox'));
    this.now = runtime.now || (() => new Date());
    this.requireApproval = runtime.requireApproval !== false;
    this.readOnly = runtime.readOnly ?? String(process.env.IMESSAGE_READ_ONLY || 'true').trim().toLowerCase() !== 'false';
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
    if (!this.nodeHostId) {
      logger.warn('[ChannelMesh] iMessage Mac bridge offline (missing macOS node host).');
    }
  }

  async shutdown(): Promise<void> {
    this.eventBus.unsubscribe?.('public_ws', this.outboundReplyHandler);
    logger.info('[ChannelMesh] iMessage Mac bridge detached.');
  }

  async onMessageReceived(payload: unknown): Promise<void> {
    const source = asBoundaryRecord(payload);
    const userId = String(source.sender || source.handle || source.userId || source.from || '').trim();
    const chatId = String(source.chatId || source.conversationId || userId || 'imessage').trim();
    const rawText = String(source.text || source.message || source.rawText || '').trim();
    const messageId = String(source.messageId || source.guid || source.id || '').trim() || null;
    const isAllowed = await this.policyManager.verifyAccess('imessage', userId);
    if (!isAllowed) {
      logger.warn(`[Security] Blocked unauthorized iMessage interaction from ${userId}`);
      return;
    }

    await this.eventBus.emit(buildInboundChannelEvent({
      platform: 'imessage',
      userId,
      chatId,
      rawText,
      messageId,
      now: this.now(),
      fields: {
        nodeHostId: this.nodeHostId || null,
      },
    }));
  }

  async sendMessage(outboundPayload: unknown): Promise<void> {
    if (this.readOnly) {
      throw new Error('iMessage Mac bridge is in read-only mode; promote the bridge before sending.');
    }
    const source = asBoundaryRecord(outboundPayload);
    if (this.requireApproval && source.approved !== true) {
      throw new Error('iMessage Mac bridge requires explicit approval before recording a send.');
    }

    const envelope = buildOutboundChannelEnvelope({
      platform: 'imessage',
      transport: this.nodeHostId ? 'mac-bridge-configured' : 'local-outbox',
      recipients: Array.isArray(source.recipients) ? source.recipients : [],
      message: typeof outboundPayload === 'string'
        ? outboundPayload
        : String(source.text || source.message || '').trim(),
      payload: typeof outboundPayload === 'object' && outboundPayload !== null ? source : null,
      now: this.now(),
      fields: {
        nodeHostId: this.nodeHostId || null,
        recipient: String(source.recipient || source.to || source.chatId || '').trim() || null,
        approved: source.approved === true,
      },
    });
    persistChannelOutboxEnvelope(this.outboxDir, envelope);
  }
}
