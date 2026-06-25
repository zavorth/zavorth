import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';

export class ClickClackGateway extends WebhookGateway {
  public readonly id = 'clickclack';
  public readonly name = 'ClickClack';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'webhook';

  constructor(options: WebhookGatewayOptions) {
    super({
      ...options,
      outboxDir: options.outboxDir || config.clickclackOutboxDir,
      statusFile: options.statusFile || config.clickclackStatusFile,
    });
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/clickclack',
      doctorCommand: '/channels doctor clickclack',
      operatorNextStep: this.resolveConfigured()
        ? 'ClickClack webhook configurado. Pronto para enviar mensagens.'
        : 'Defina CLICKCLACK_WEBHOOK_URL para ativar.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(String(config.clickclackWebhookUrl || '').trim());
  }

  public resolveEnabled(): boolean {
    return Boolean(String(config.clickclackWebhookUrl || '').trim());
  }

  protected resolveOutboxDir(): string {
    return config.clickclackOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.clickclackStatusFile;
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
      || (webhookPayload as any).sender
      || (webhookPayload as any).userId
      || '',
    ).trim();
    const chatId = String(
      (webhookPayload as any).channel
      || (webhookPayload as any).chatId
      || 'clickclack',
    ).trim();
    const rawText = String(
      (webhookPayload as any).text
      || (webhookPayload as any).message
      || (webhookPayload as any).rawText
      || '',
    ).trim();
    const messageId = String(
      (webhookPayload as any).messageId
      || (webhookPayload as any).id
      || '',
    ).trim() || null;

    if (!rawText) {
      return null;
    }

    return {
      userId: userId || 'cc-user',
      chatId: chatId || 'clickclack',
      rawText,
      messageId,
      isGroup: false,
      fields: {},
    };
  }

  public async sendText(text: string): Promise<void> {
    if (!this.resolveConfigured() || !this.fetchImpl) {
      this.sendMessage({ text });
      return;
    }

    const webhookUrl = String(config.clickclackWebhookUrl || '').trim();

    try {
      const response = await this.fetchImpl(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        this.recordError(`ClickClack webhook error: HTTP ${response.status}`);
        return;
      }

      this.markOutbound();
    } catch (error: any) {
      this.recordError(`ClickClack send failed: ${error?.message || error}`);
    }
  }
}
