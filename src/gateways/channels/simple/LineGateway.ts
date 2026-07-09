import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';
import { asErrorLike } from '../../../utils/errorLike.js';

export class LineGateway extends WebhookGateway {
  public readonly id = 'line';
  public readonly name = 'LINE Messaging API';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'line';

  constructor(options: WebhookGatewayOptions) {
    super({
      ...options,
      outboxDir: options.outboxDir || config.lineOutboxDir,
      statusFile: options.statusFile || config.lineStatusFile,
    });
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/line',
      doctorCommand: '/channels doctor line',
      operatorNextStep: this.resolveConfigured()
        ? 'LINE configurado. Webhook pronto para receber eventos.'
        : 'Defina LINE_CHANNEL_ACCESS_TOKEN para ativar.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(String(config.lineChannelAccessToken || '').trim());
  }

  public resolveEnabled(): boolean {
    return Boolean(String(config.lineChannelAccessToken || '').trim());
  }

  protected resolveOutboxDir(): string {
    return config.lineOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.lineStatusFile;
  }

  protected extractInboundPayload(webhookPayload: Record<string, unknown>): {
    userId: string;
    chatId: string;
    rawText: string;
    messageId?: string | null;
    isGroup?: boolean;
    fields?: Record<string, unknown>;
  } | null {
    const events = Array.isArray(webhookPayload.events) ? webhookPayload.events : [];
    if (events.length === 0) {
      return null;
    }

    const event = events[0] as Record<string, unknown>;
    const eventType = String(event.type || '').trim().toLowerCase();
    if (eventType !== 'message') {
      return null;
    }

    const message = event.message && typeof event.message === 'object'
      ? event.message as Record<string, unknown>
      : null;
    const messageType = String(message?.type || '').trim().toLowerCase();
    if (messageType !== 'text') {
      return null;
    }

    const source = event.source && typeof event.source === 'object'
      ? event.source as Record<string, unknown>
      : null;
    const userId = String(source?.userId || '').trim();
    const sourceType = String(source?.type || '').trim().toLowerCase();
    const chatId = String(
      source?.groupId
      || source?.roomId
      || source?.userId
      || config.lineDefaultTargetId
      || '',
    ).trim();
    const rawText = String(message?.text || '').trim();
    const messageId = String(event.messageId || '').trim() || null;

    if (!rawText) {
      return null;
    }

    return {
      userId: userId || 'line-user',
      chatId: chatId || 'line',
      rawText,
      messageId,
      isGroup: sourceType === 'group' || sourceType === 'room',
      fields: {
        sourceType,
        replyToken: String(event.replyToken || '').trim() || null,
      },
    };
  }

  public async replyText(replyToken: string, text: string): Promise<void> {
    if (!this.resolveConfigured() || !this.fetchImpl) {
      this.sendMessage({ text, replyToken });
      return;
    }

    const accessToken = String(config.lineChannelAccessToken || '').trim();

    try {
      const response = await this.fetchImpl('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          replyToken,
          messages: [{ type: 'text', text }],
        }),
      });

      if (!response.ok) {
        this.recordError(`LINE API error: HTTP ${response.status}`);
        return;
      }

      this.markOutbound();
    } catch (error: unknown) {
      const err = asErrorLike(error);
      this.recordError(`LINE reply failed: ${error instanceof Error ? err.message : String(error)}`);
    }
  }

  public async pushText(to: string, text: string): Promise<void> {
    if (!this.resolveConfigured() || !this.fetchImpl) {
      this.sendMessage({ recipients: [to], text });
      return;
    }

    const accessToken = String(config.lineChannelAccessToken || '').trim();

    try {
      const response = await this.fetchImpl('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          to,
          messages: [{ type: 'text', text }],
        }),
      });

      if (!response.ok) {
        this.recordError(`LINE API error: HTTP ${response.status}`);
        return;
      }

      this.markOutbound();
    } catch (error: unknown) {
      const err = asErrorLike(error);
      this.recordError(`LINE push failed: ${error instanceof Error ? err.message : String(error)}`);
    }
  }
}
