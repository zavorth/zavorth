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

type IMessageMacBridgeAdapterRuntime = {
  outboxDir?: string;
  now?: () => Date;
  requireApproval?: boolean;
  readOnly?: boolean;
};

export class IMessageMacBridgeAdapter implements GatewayChannelAdapter {
  id = 'imessage';
  name = 'iMessage macOS Node Host Bridge';
  type: 'async' = 'async';
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

  async initialize(): Promise<void> {
    fs.mkdirSync(this.outboxDir, { recursive: true });
    if (!this.nodeHostId) {
      console.warn('[ChannelMesh] iMessage Mac bridge offline (missing macOS node host).');
    }
  }

  async shutdown(): Promise<void> {
    console.log('[ChannelMesh] iMessage Mac bridge detached.');
  }

  async onMessageReceived(payload: any): Promise<void> {
    const userId = String(payload?.sender || payload?.handle || payload?.userId || payload?.from || '').trim();
    const chatId = String(payload?.chatId || payload?.conversationId || userId || 'imessage').trim();
    const rawText = String(payload?.text || payload?.message || payload?.rawText || '').trim();
    const messageId = String(payload?.messageId || payload?.guid || payload?.id || '').trim() || null;
    const isAllowed = await this.policyManager.verifyAccess('imessage', userId);
    if (!isAllowed) {
      console.warn(`[Security] Blocked unauthorized iMessage interaction from ${userId}`);
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

  async sendMessage(outboundPayload: any): Promise<void> {
    if (this.readOnly) {
      throw new Error('iMessage Mac bridge esta em modo read-only; promova a bridge antes de enviar.');
    }
    if (this.requireApproval && outboundPayload?.approved !== true) {
      throw new Error('iMessage Mac bridge exige approval explicito antes de gravar envio.');
    }

    const envelope = buildOutboundChannelEnvelope({
      platform: 'imessage',
      transport: this.nodeHostId ? 'mac-bridge-configured' : 'local-outbox',
      recipients: Array.isArray(outboundPayload?.recipients) ? outboundPayload.recipients : [],
      message: typeof outboundPayload === 'string'
        ? outboundPayload
        : String(outboundPayload?.text || outboundPayload?.message || '').trim(),
      payload: outboundPayload && typeof outboundPayload === 'object' ? outboundPayload : null,
      now: this.now(),
      fields: {
        nodeHostId: this.nodeHostId || null,
        recipient: String(outboundPayload?.recipient || outboundPayload?.to || outboundPayload?.chatId || '').trim() || null,
        approved: outboundPayload?.approved === true,
      },
    });
    persistChannelOutboxEnvelope(this.outboxDir, envelope);
  }
}
