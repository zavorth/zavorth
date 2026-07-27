import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';
import { asErrorLike } from '../../../utils/errorLike.js';

interface FeishuWebhookPayload extends Record<string, unknown> {
  userId?: unknown;
  chatId?: unknown;
  text?: unknown;
  messageId?: unknown;
  event?: unknown;
  message?: unknown;
  sender?: unknown;
  chat?: unknown;
}

export class FeishuGateway extends WebhookGateway {
  public readonly id = 'feishu';
  public readonly name = 'Feishu / Lark';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'webhook';

  constructor(options: WebhookGatewayOptions) {
    super({
      ...options,
      outboxDir: options.outboxDir || config.feishuOutboxDir,
      statusFile: options.statusFile || config.feishuStatusFile,
    });
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/feishu',
      doctorCommand: '/channels doctor feishu',
      operatorNextStep: this.resolveConfigured() ? 'Feishu/Lark webhook configured. Ready to send messages.'
        : 'Set FEISHU_WEBHOOK_URL or LARK_WEBHOOK_URL to enable.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(String(config.feishuWebhookUrl || '').trim());
  }

  public resolveEnabled(): boolean {
    return Boolean(String(config.feishuWebhookUrl || '').trim());
  }

  protected resolveOutboxDir(): string {
    return config.feishuOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.feishuStatusFile;
  }

  protected extractInboundPayload(webhookPayload: Record<string, unknown>): {
    userId: string;
    chatId: string;
    rawText: string;
    messageId?: string | null;
    isGroup?: boolean;
    fields?: Record<string, unknown>;
  } | null {
    const eventType = String(webhookPayload.type || webhookPayload.event_type || '').trim().toLowerCase();

    if (eventType === 'url_verification') {
      return null;
    }

    const event = webhookPayload.event && typeof webhookPayload.event === 'object'
      ? webhookPayload.event as Record<string, unknown>
      : webhookPayload;

    const sender = event.sender && typeof event.sender === 'object'
      ? event.sender as Record<string, unknown>
      : null;
    const payload = webhookPayload as FeishuWebhookPayload;
    const userId = String(
      sender?.sender_id
      || sender?.open_id
      || payload.userId
      || '',
    ).trim();

    const chat = event.chat && typeof event.chat === 'object'
      ? event.chat as Record<string, unknown>
      : null;
    const chatId = String(
      chat?.chat_id
      || payload.chatId
      || 'feishu',
    ).trim();

    const message = event.message && typeof event.message === 'object'
      ? event.message as Record<string, unknown>
      : null;
    const content = message?.content ? String(message.content) : '';
    let rawText = '';
    try {
      const parsed = JSON.parse(content);
      rawText = String(parsed.text || '').trim();
    } catch (error: unknown) {rawText = String(
        message?.content
        || payload.text
        || '',
      ).trim();
    }

    const messageId = String(
      message?.message_id
      || payload.messageId
      || '',
    ).trim() || null;

    if (!rawText) {
      return null;
    }

    return {
      userId: userId || 'feishu-user',
      chatId: chatId || 'feishu',
      rawText,
      messageId,
      isGroup: true,
      fields: {
        chatType: String(chat?.chat_type || 'group'),
        messageType: String(message?.message_type || 'text'),
      },
    };
  }

  public async sendText(text: string): Promise<void> {
    if (!this.resolveConfigured() || !this.fetchImpl) {
      this.sendMessage({ text });
      return;
    }

    const webhookUrl = String(config.feishuWebhookUrl || '').trim();

    try {
      const response = await this.fetchImpl(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          msg_type: 'text',
          content: { text },
        }),
      });

      if (!response.ok) {
        this.recordError(`Feishu webhook error: HTTP ${response.status}`);
        return;
      }

      this.markOutbound();
    } catch (error: unknown) {
      const err = asErrorLike(error);
      this.recordError(`Feishu send failed: ${error instanceof Error ? err.message : String(error)}`);
    }
  }
}
