import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';
import { asErrorLike } from '../../../utils/errorLike.js';

interface ZaloWebhookPayload extends Record<string, unknown> {
  userId?: unknown;
  chatId?: unknown;
  text?: unknown;
  rawText?: unknown;
  messageId?: unknown;
  msg_id?: unknown;
  sender?: unknown;
  message?: unknown;
}

export class ZaloGateway extends WebhookGateway {
  public readonly id = 'zalo';
  public readonly name = 'Zalo';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'bot-http';

  constructor(options: WebhookGatewayOptions) {
    super({
      ...options,
      outboxDir: options.outboxDir || config.zaloOutboxDir,
      statusFile: options.statusFile || config.zaloStatusFile,
    });
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/zalo',
      doctorCommand: '/channels doctor zalo',
      operatorNextStep: this.resolveConfigured() ? 'Zalo configured. Send messages through the HTTP API.'
        : 'set ZALO_SEND_URL and ZALO_ACCESS_TOKEN to activate.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(
      String(config.zaloSendUrl || '').trim()
      && String(config.zaloAccessToken || '').trim(),
    );
  }

  public resolveEnabled(): boolean {
    return Boolean(
      String(config.zaloSendUrl || '').trim()
      || String(config.zaloAccessToken || '').trim(),
    );
  }

  protected resolveOutboxDir(): string {
    return config.zaloOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.zaloStatusFile;
  }

  protected extractInboundPayload(webhookPayload: Record<string, unknown>): {
    userId: string;
    chatId: string;
    rawText: string;
    messageId?: string | null;
    isGroup?: boolean;
    fields?: Record<string, unknown>;
  } | null {
    const payload = webhookPayload as ZaloWebhookPayload;
    const sender = payload.sender && typeof payload.sender === 'object'
      ? payload.sender as Record<string, unknown>
      : null;
    const userId = String(
      sender?.id
      || payload.userId
      || '',
    ).trim();
    const chatId = String(
      sender?.id
      || payload.chatId
      || 'zalo',
    ).trim();
    const message = payload.message && typeof payload.message === 'object'
      ? payload.message as Record<string, unknown>
      : null;
    const rawText = String(
      message?.text
      || payload.text
      || payload.rawText
      || '',
    ).trim();
    const messageId = String(
      payload.messageId
      || payload.msg_id
      || '',
    ).trim() || null;

    if (!rawText) {
      return null;
    }

    return {
      userId: userId || 'zalo-user',
      chatId: chatId || 'zalo',
      rawText,
      messageId,
      isGroup: false,
      fields: {},
    };
  }

  public async sendText(to: string, text: string): Promise<void> {
    if (!this.resolveConfigured() || !this.fetchImpl) {
      this.sendMessage({ recipients: [to], text, chatId: to });
      return;
    }

    const sendUrl = String(config.zaloSendUrl || '').trim();
    const accessToken = String(config.zaloAccessToken || '').trim();

    try {
      const response = await this.fetchImpl(sendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          access_token: accessToken,
        },
        body: JSON.stringify({
          recipient: { user_id: to },
          message: { text },
        }),
      });

      if (!response.ok) {
        this.recordError(`Zalo API error: HTTP ${response.status}`);
        return;
      }

      this.markOutbound();
    } catch (error: unknown) {
      const err = asErrorLike(error);
      this.recordError(`Zalo send failed: ${error instanceof Error ? err.message : String(error)}`);
    }
  }
}
