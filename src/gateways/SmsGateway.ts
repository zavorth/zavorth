import { config } from '../config/index.js';
import type { ChannelAdapterStatus } from '../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from './WebhookGateway.js';

export class SmsGateway extends WebhookGateway {
  public readonly id = 'sms';
  public readonly name = 'SMS';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'bot-http';

  constructor(options: WebhookGatewayOptions) {
    super({
      ...options,
      outboxDir: options.outboxDir || config.smsOutboxDir,
      statusFile: options.statusFile || config.smsStatusFile,
    });
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/sms',
      doctorCommand: '/channels doctor sms',
      operatorNextStep: this.resolveConfigured()
        ? 'SMS configurado. Envie mensagens via API HTTP.'
        : 'Defina SMS_SEND_URL ou SMS_API_BASE_URL e SMS_PROVIDER_TOKEN para ativar.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(
      (String(config.smsSendUrl || '').trim() || String(config.smsApiBaseUrl || '').trim())
      && String(config.smsProviderToken || '').trim(),
    );
  }

  public resolveEnabled(): boolean {
    return Boolean(
      String(config.smsSendUrl || '').trim()
      || String(config.smsApiBaseUrl || '').trim()
      || String(config.smsProviderToken || '').trim(),
    );
  }

  protected resolveOutboxDir(): string {
    return config.smsOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.smsStatusFile;
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
      (webhookPayload as any).from
      || (webhookPayload as any).sender
      || (webhookPayload as any).phone
      || (webhookPayload as any).userId
      || '',
    ).trim();
    const chatId = String(
      (webhookPayload as any).to
      || (webhookPayload as any).chatId
      || 'sms',
    ).trim();
    const rawText = String(
      (webhookPayload as any).body
      || (webhookPayload as any).text
      || (webhookPayload as any).content
      || (webhookPayload as any).rawText
      || '',
    ).trim();
    const messageId = String(
      (webhookPayload as any).messageId
      || (webhookPayload as any).sid
      || '',
    ).trim() || null;

    if (!rawText) {
      return null;
    }

    return {
      userId: userId || 'sms-user',
      chatId: chatId || 'sms',
      rawText,
      messageId,
      isGroup: false,
      fields: {
        provider: String((webhookPayload as any).provider || ''),
      },
    };
  }

  public async sendText(to: string, text: string): Promise<void> {
    if (!this.resolveConfigured() || !this.fetchImpl) {
      this.sendMessage({ recipients: [to], text, chatId: to });
      return;
    }

    const sendUrl = String(config.smsSendUrl || config.smsApiBaseUrl || '').trim();
    const providerToken = String(config.smsProviderToken || '').trim();

    try {
      const response = await this.fetchImpl(sendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${providerToken}`,
        },
        body: JSON.stringify({
          to,
          body: text,
        }),
      });

      if (!response.ok) {
        this.recordError(`SMS API error: HTTP ${response.status}`);
        return;
      }

      this.markOutbound();
    } catch (error: any) {
      this.recordError(`SMS send failed: ${error?.message || error}`);
    }
  }
}
