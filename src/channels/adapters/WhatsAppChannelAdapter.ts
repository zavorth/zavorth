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

type WhatsAppChannelAdapterRuntime = {
  outboxDir?: string;
  now?: () => Date;
};

export class WhatsAppChannelAdapter implements GatewayChannelAdapter {
  id = 'whatsapp';
  name = 'WhatsApp Cloud API';
  type: 'async' = 'async';
  private readonly outboxDir: string;
  private readonly now: () => Date;

  constructor(
    private eventBus: GatewayEventBus, 
    private policyManager: ChannelPolicyManager,
    private apiKey: string,
    runtime: WhatsAppChannelAdapterRuntime = {},
  ) {
    this.outboxDir = path.resolve(runtime.outboxDir || config.whatsappOutboxDir);
    this.now = runtime.now || (() => new Date());
  }

  async initialize(): Promise<void> {
    fs.mkdirSync(this.outboxDir, { recursive: true });
    if (!this.apiKey) {
      console.warn('[ChannelMesh] WhatsApp Channel offline (Missing config)');
      return;
    }
    console.log('[ChannelMesh] WhatsApp API Webhooks listening.');
  }

  async shutdown(): Promise<void> {
    console.log('[ChannelMesh] WhatsApp bounds detached.');
  }

  async onMessageReceived(webhookPayload: any): Promise<void> {
    const userId = String(webhookPayload?.fromNumber || webhookPayload?.from || webhookPayload?.userId || '').trim();
    const chatId = String(webhookPayload?.chatId || webhookPayload?.fromNumber || webhookPayload?.from || '').trim() || 'whatsapp';
    const rawText = String(webhookPayload?.text || webhookPayload?.rawText || '').trim();
    const messageId = String(webhookPayload?.messageId || webhookPayload?.id || '').trim() || null;
    const isAllowed = await this.policyManager.verifyAccess('whatsapp', userId);
    if (!isAllowed) {
      console.warn(`[Security] Blocked unauthorized WhatsApp interaction from ${userId}`);
      return;
    }

    await this.eventBus.emit(buildInboundChannelEvent({
      platform: 'whatsapp',
      userId,
      chatId,
      rawText,
      messageId,
      now: this.now(),
    }));
  }

  async sendMessage(outboundPayload: any): Promise<void> {
    const envelope = buildOutboundChannelEnvelope({
      platform: 'whatsapp',
      transport: this.apiKey ? 'cloud-api-configured' : 'local-outbox',
      recipients: Array.isArray(outboundPayload?.recipients) ? outboundPayload.recipients : [],
      message: typeof outboundPayload === 'string'
        ? outboundPayload
        : String(outboundPayload?.text || outboundPayload?.message || '').trim(),
      payload: outboundPayload && typeof outboundPayload === 'object' ? outboundPayload : null,
      now: this.now(),
      fields: {
        chatId: String(outboundPayload?.chatId || outboundPayload?.to || '').trim() || null,
        messageId: String(outboundPayload?.messageId || '').trim() || null,
      },
    });
    persistChannelOutboxEnvelope(this.outboxDir, envelope);
  }
}
