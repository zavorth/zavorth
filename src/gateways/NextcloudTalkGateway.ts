import { config } from '../config/index.js';
import type { ChannelAdapterStatus } from '../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from './WebhookGateway.js';

export class NextcloudTalkGateway extends WebhookGateway {
  public readonly id = 'nextcloud-talk';
  public readonly name = 'Nextcloud Talk';
  public readonly type: 'async' = 'async';
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
      operatorNextStep: this.resolveConfigured()
        ? 'Nextcloud Talk webhook configurado. Pronto para enviar mensagens.'
        : 'Defina NEXTCLOUD_TALK_WEBHOOK_URL para ativar.',
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
    const userId = String(
      (webhookPayload as any).user_id
      || (webhookPayload as any).actorId
      || (webhookPayload as any).userId
      || '',
    ).trim();
    const chatId = String(
      (webhookPayload as any).token
      || (webhookPayload as any).roomToken
      || (webhookPayload as any).chatId
      || 'nextcloud-talk',
    ).trim();
    const rawText = String(
      (webhookPayload as any).message
      || (webhookPayload as any).text
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
      userId: userId || 'nc-user',
      chatId: chatId || 'nextcloud-talk',
      rawText,
      messageId,
      isGroup: true,
      fields: {
        roomName: String((webhookPayload as any).roomName || ''),
        messageType: String((webhookPayload as any).messageType || 'comment'),
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
    } catch (error: any) {
      this.recordError(`Nextcloud Talk send failed: ${error?.message || error}`);
    }
  }
}
