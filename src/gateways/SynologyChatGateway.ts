import { config } from '../config/index.js';
import type { ChannelAdapterStatus } from '../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from './WebhookGateway.js';

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
      operatorNextStep: this.resolveConfigured()
        ? 'Synology Chat webhook configurado. Pronto para enviar mensagens.'
        : 'Defina SYNOLOGY_CHAT_WEBHOOK_URL para ativar.',
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
      (webhookPayload as any).user_id
      || (webhookPayload as any).username
      || (webhookPayload as any).userId
      || '',
    ).trim();
    const chatId = String(
      (webhookPayload as any).channel
      || (webhookPayload as any).chatId
      || 'synology-chat',
    ).trim();
    const rawText = String(
      (webhookPayload as any).text
      || (webhookPayload as any).rawText
      || '',
    ).trim();
    const messageId = String(
      (webhookPayload as any).messageId
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
    } catch (error: any) {
      this.recordError(`Synology Chat send failed: ${error?.message || error}`);
    }
  }
}
