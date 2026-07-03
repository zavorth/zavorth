import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';

export class WeComGateway extends WebhookGateway {
  public readonly id = 'wecom';
  public readonly name = 'WeCom';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'webhook';

  constructor(options: WebhookGatewayOptions) {
    super({
      ...options,
      outboxDir: options.outboxDir || config.wecomOutboxDir,
      statusFile: options.statusFile || config.wecomStatusFile,
    });
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/wecom',
      doctorCommand: '/channels doctor wecom',
      operatorNextStep: this.resolveConfigured()
        ? 'WeCom webhook configurado. Pronto para enviar mensagens.'
        : 'Defina WECOM_WEBHOOK_URL para ativar.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(String(config.wecomWebhookUrl || '').trim());
  }

  public resolveEnabled(): boolean {
    return Boolean(String(config.wecomWebhookUrl || '').trim());
  }

  protected resolveOutboxDir(): string {
    return config.wecomOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.wecomStatusFile;
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
      webhookPayload['FromUserName']
      || webhookPayload['userId']
      || '',
    ).trim();
    const chatId = String(
      webhookPayload['ChatId']
      || webhookPayload['chatId']
      || 'wecom',
    ).trim();
    const rawText = String(
      webhookPayload['Content']
      || webhookPayload['text']
      || webhookPayload['rawText']
      || '',
    ).trim();
    const messageId = String(
      webhookPayload['MsgId']
      || webhookPayload['messageId']
      || '',
    ).trim() || null;

    if (!rawText) {
      return null;
    }

    return {
      userId: userId || 'wecom-user',
      chatId: chatId || 'wecom',
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

    const webhookUrl = String(config.wecomWebhookUrl || '').trim();

    try {
      const response = await this.fetchImpl(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          msgtype: 'text',
          text: { content: text },
        }),
      });

      if (!response.ok) {
        this.recordError(`WeCom webhook error: HTTP ${response.status}`);
        return;
      }

      this.markOutbound();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.recordError(`WeCom send failed: ${msg}`);
    }
  }
}
