import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';
import { asErrorLike } from '../../../utils/errorLike.js';

interface GoogleChatWebhookPayload extends Record<string, unknown> {
  userId?: unknown;
  chatId?: unknown;
  text?: unknown;
  messageId?: unknown;
  message?: unknown;
}

export class GoogleChatGateway extends WebhookGateway {
  public readonly id = 'google-chat';
  public readonly name = 'Google Chat';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'webhook';

  constructor(options: WebhookGatewayOptions) {
    super({
      ...options,
      outboxDir: options.outboxDir || config.googleChatOutboxDir,
      statusFile: options.statusFile || config.googleChatStatusFile,
    });
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/google-chat',
      doctorCommand: '/channels doctor google-chat',
      operatorNextStep: this.resolveConfigured()
        ? 'Google Chat webhook configurado. Pronto para enviar mensagens.'
        : 'Defina GOOGLE_CHAT_WEBHOOK_URL para ativar.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(String(config.googleChatWebhookUrl || '').trim());
  }

  public resolveEnabled(): boolean {
    return Boolean(String(config.googleChatWebhookUrl || '').trim());
  }

  protected resolveOutboxDir(): string {
    return config.googleChatOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.googleChatStatusFile;
  }

  protected extractInboundPayload(webhookPayload: Record<string, unknown>): {
    userId: string;
    chatId: string;
    rawText: string;
    messageId?: string | null;
    isGroup?: boolean;
    fields?: Record<string, unknown>;
  } | null {
    const message = webhookPayload.message && typeof webhookPayload.message === 'object'
      ? webhookPayload.message as Record<string, unknown>
      : null;
    if (!message) {
      return null;
    }

    const sender = message.sender && typeof message.sender === 'object'
      ? message.sender as Record<string, unknown>
      : null;
    const payload = webhookPayload as GoogleChatWebhookPayload;
    const userId = String(
      sender?.name
      || sender?.displayName
      || payload.userId
      || '',
    ).trim();
    const space = message.space && typeof message.space === 'object'
      ? message.space as Record<string, unknown>
      : null;
    const chatId = String(
      space?.name
      || space?.displayName
      || payload.chatId
      || 'google-chat',
    ).trim();
    const rawText = String(message.text || payload.text || '').trim();
    const messageId = String(message.name || payload.messageId || '').trim() || null;

    if (!rawText) {
      return null;
    }

    const thread = message.thread && typeof message.thread === 'object'
      ? message.thread as Record<string, unknown>
      : null;

    return {
      userId: userId || 'gchat-user',
      chatId: chatId || 'google-chat',
      rawText,
      messageId,
      isGroup: true,
      fields: {
        spaceType: String(space?.type || 'ROOM'),
        threadName: String(thread?.name || '').trim() || null,
      },
    };
  }

  public async sendText(text: string): Promise<void> {
    if (!this.resolveConfigured() || !this.fetchImpl) {
      this.sendMessage({ text });
      return;
    }

    const webhookUrl = String(config.googleChatWebhookUrl || '').trim();

    try {
      const response = await this.fetchImpl(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        this.recordError(`Google Chat webhook error: HTTP ${response.status}`);
        return;
      }

      this.markOutbound();
    } catch (error: unknown) {
      const err = asErrorLike(error);
      this.recordError(`Google Chat send failed: ${error instanceof Error ? err.message : String(error)}`);
    }
  }
}
