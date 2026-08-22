import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';
import { asErrorLike } from '../../../utils/errorLike.js';

interface NextcloudTalkWebhookPayload {
  user_id?: string;
  actorId?: string;
  userId?: string;
  token?: string;
  roomToken?: string;
  chatId?: string;
  message?: string;
  text?: string;
  rawText?: string;
  messageId?: string;
  id?: string;
  roomName?: string;
  messageType?: string;
}

export class NextcloudTalkGateway extends WebhookGateway {
  public readonly id = 'nextcloud-talk';
  public readonly name = 'Nextcloud Talk';
  public readonly type = 'async' as const;
  public readonly mode: WebhookGatewayMode = 'webhook';

  constructor(options: WebhookGatewayOptions) {
    super({
      ...options,
      outboxDir: options.outboxDir || config.nextcloudTalkOutboxDir,
      statusFile: options.statusFile || config.nextcloudTalkStatusFile,
    });
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/nextcloud-talk',
      doctorCommand: '/channels doctor nextcloud-talk',
      operatorNextStep: this.resolveConfigured() ? 'Nextcloud Talk webhook configured. Ready to send messages.'
        : 'Set NEXTCLOUD_TALK_WEBHOOK_URL to enable.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(String(config.nextcloudTalkWebhookUrl || '').trim());
  }

  public resolveEnabled(): boolean {
    return Boolean(String(config.nextcloudTalkWebhookUrl || '').trim());
  }

  protected resolveOutboxDir(): string {
    return config.nextcloudTalkOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.nextcloudTalkStatusFile;
  }

  protected extractInboundPayload(webhookPayload: Record<string, unknown>): {
    userId: string;
    chatId: string;
    rawText: string;
    messageId?: string | null;
    isGroup?: boolean;
    fields?: Record<string, unknown>;
  } | null {
    const payload = webhookPayload as NextcloudTalkWebhookPayload;
    const userId = String(
      payload.user_id
      || payload.actorId
      || payload.userId
      || '',
    ).trim();
    const chatId = String(
      payload.token
      || payload.roomToken
      || payload.chatId
      || 'nextcloud-talk',
    ).trim();
    const rawText = String(
      payload.message
      || payload.text
      || payload.rawText
      || '',
    ).trim();
    const messageId = String(
      payload.messageId
      || payload.id
      || '',
    ).trim() || null;

    if (!rawText) {
      return null;
    }

    return {
      userId: userId || 'nc-user',
      chatId: chatId || 'nextcloud-talk',
      rawText,
      messageId,
      isGroup: true,
      fields: {
        roomName: String(payload.roomName || ''),
        messageType: String(payload.messageType || 'comment'),
      },
    };
  }

  public async sendText(text: string): Promise<void> {
    if (!this.resolveConfigured() || !this.fetchImpl) {
      this.sendMessage({ text });
      return;
    }

    const webhookUrl = String(config.nextcloudTalkWebhookUrl || '').trim();

    try {
      const response = await this.fetchImpl(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok) {
        this.recordError(`Nextcloud Talk webhook error: HTTP ${response.status}`);
        return;
      }

      this.markOutbound();
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const errorMessage = error instanceof Error ? err.message : String(error);
      this.recordError(`Nextcloud Talk send failed: ${errorMessage}`);
    }
  }
}
