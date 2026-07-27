import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';
import { asErrorLike } from '../../../utils/errorLike.js';

export class SynologyChatGateway extends WebhookGateway {
  public readonly id = 'synology-chat';
  public readonly name = 'Synology Chat';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'webhook';

  constructor(options: WebhookGatewayOptions) {
    super({
      ...options,
      outboxDir: options.outboxDir || config.synologyChatOutboxDir,
      statusFile: options.statusFile || config.synologyChatStatusFile,
    });
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/synology-chat',
      doctorCommand: '/channels doctor synology-chat',
      operatorNextStep: this.resolveConfigured() ? 'Synology Chat webhook configured. Ready to send messages.'
        : 'Set SYNOLOGY_CHAT_WEBHOOK_URL to enable.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(String(config.synologyChatWebhookUrl || '').trim());
  }

  public resolveEnabled(): boolean {
    return Boolean(String(config.synologyChatWebhookUrl || '').trim());
  }

  protected resolveOutboxDir(): string {
    return config.synologyChatOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.synologyChatStatusFile;
  }

  protected extractInboundPayload(webhookPayload: Record<string, unknown>): {
    userId: string;
    chatId: string;
    rawText: string;
    messageId?: string | null;
    isGroup?: boolean;
    fields?: Record<string, unknown>;
  } | null {
    const userId = String(
      webhookPayload['user_id']
      || webhookPayload['username']
      || webhookPayload['userId']
      || '',
    ).trim();
    const chatId = String(
      webhookPayload['channel']
      || webhookPayload['chatId']
      || 'synology-chat',
    ).trim();
    const rawText = String(
      webhookPayload['text']
      || webhookPayload['rawText']
      || '',
    ).trim();
    const messageId = String(
      webhookPayload['messageId']
      || '',
    ).trim() || null;

    if (!rawText) {
      return null;
    }

    return {
      userId: userId || 'syno-user',
      chatId: chatId || 'synology-chat',
      rawText,
      messageId,
      isGroup: true,
      fields: {},
    };
  }

  public async sendText(text: string): Promise<void> {
    if (!this.resolveConfigured() || !this.fetchImpl) {
      this.sendMessage({ text });
      return;
    }

    const webhookUrl = String(config.synologyChatWebhookUrl || '').trim();

    try {
      const response = await this.fetchImpl(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        this.recordError(`Synology Chat webhook error: HTTP ${response.status}`);
        return;
      }

      this.markOutbound();
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const msg = error instanceof Error ? err.message : String(error);
      this.recordError(`Synology Chat send failed: ${msg}`);
    }
  }
}
