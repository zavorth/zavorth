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
      webhookPayload['user_id']
      || webhookPayload['sender']
      || webhookPayload['userId']
      || '',
    ).trim();
    const chatId = String(
      webhookPayload['channel']
      || webhookPayload['chatId']
      || 'clickclack',
    ).trim();
    const rawText = String(
      webhookPayload['text']
      || webhookPayload['message']
      || webhookPayload['rawText']
      || '',
    ).trim();
    const messageId = String(
      webhookPayload['messageId']
      || webhookPayload['id']
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
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.recordError(`ClickClack send failed: ${msg}`);
    }
  }
}
