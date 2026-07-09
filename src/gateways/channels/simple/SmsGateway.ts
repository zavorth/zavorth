import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';

interface SmsWebhookPayload {
  from?: string;
  sender?: string;
  phone?: string;
  userId?: string;
  to?: string;
  chatId?: string;
  body?: string;
  text?: string;
  content?: string;
  rawText?: string;
  messageId?: string;
  sid?: string;
  provider?: string;
}

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

  protected extractInboundPayload(webhookPayload: SmsWebhookPayload): {
    userId: string;
    chatId: string;
    rawText: string;
    messageId?: string | null;
    isGroup?: boolean;
    fields?: Record<string, unknown>;
  } | null {
    const userId = String(
      webhookPayload.from
      || webhookPayload.sender
      || webhookPayload.phone
      || webhookPayload.userId
      || '',
    ).trim();
    const chatId = String(
      webhookPayload.to
      || webhookPayload.chatId
      || 'sms',
    ).trim();
    const rawText = String(
      webhookPayload.body
      || webhookPayload.text
      || webhookPayload.content
      || webhookPayload.rawText
      || '',
    ).trim();
    const messageId = String(
      webhookPayload.messageId
      || webhookPayload.sid
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
        provider: String(webhookPayload.provider || ''),
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
    } catch (error: any) { const err = error; const e = error;
      const message = error instanceof Error ? error.message : String(error);
      this.recordError(`SMS send failed: ${message}`);
    }
  }
}
