import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';
import { asErrorLike } from '../../../utils/errorLike.js';

interface MattermostWebhookPayload {
  user_id?: string;
  user_name?: string;
  userId?: string;
  channel_id?: string;
  channel_name?: string;
  chatId?: string;
  text?: string;
  rawText?: string;
  post_id?: string;
  messageId?: string;
  team_id?: string;
}

export class MattermostGateway extends WebhookGateway {
  public readonly id = 'mattermost';
  public readonly name = 'Mattermost';
  public readonly type = 'async' as const;
  public readonly mode: WebhookGatewayMode = 'webhook';

  constructor(options: WebhookGatewayOptions) {
    super({
      ...options,
      outboxDir: options.outboxDir || config.mattermostOutboxDir,
      statusFile: options.statusFile || config.mattermostStatusFile,
    });
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/mattermost',
      doctorCommand: '/channels doctor mattermost',
      operatorNextStep: this.resolveConfigured() ? 'Mattermost webhook configured. Ready to send messages.'
        : 'Set MATTERMOST_WEBHOOK_URL to enable.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(String(config.mattermostWebhookUrl || '').trim());
  }

  public resolveEnabled(): boolean {
    return Boolean(String(config.mattermostWebhookUrl || '').trim());
  }

  protected resolveOutboxDir(): string {
    return config.mattermostOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.mattermostStatusFile;
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
      (webhookPayload as MattermostWebhookPayload).user_id
      || (webhookPayload as MattermostWebhookPayload).user_name
      || (webhookPayload as MattermostWebhookPayload).userId
      || '',
    ).trim();
    const chatId = String(
      (webhookPayload as MattermostWebhookPayload).channel_id
      || (webhookPayload as MattermostWebhookPayload).channel_name
      || (webhookPayload as MattermostWebhookPayload).chatId
      || 'mattermost',
    ).trim();
    const rawText = String(
      (webhookPayload as MattermostWebhookPayload).text
      || (webhookPayload as MattermostWebhookPayload).rawText
      || '',
    ).trim();
    const messageId = String(
      (webhookPayload as MattermostWebhookPayload).post_id
      || (webhookPayload as MattermostWebhookPayload).messageId
      || '',
    ).trim() || null;

    if (!rawText) {
      return null;
    }

    return {
      userId: userId || 'mm-user',
      chatId: chatId || 'mattermost',
      rawText,
      messageId,
      isGroup: true,
      fields: {
        channelName: String((webhookPayload as MattermostWebhookPayload).channel_name || ''),
        teamId: String((webhookPayload as MattermostWebhookPayload).team_id || ''),
      },
    };
  }

  public async sendText(text: string): Promise<void> {
    if (!this.resolveConfigured() || !this.fetchImpl) {
      this.sendMessage({ text });
      return;
    }

    const webhookUrl = String(config.mattermostWebhookUrl || '').trim();

    try {
      const response = await this.fetchImpl(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        this.recordError(`Mattermost webhook error: HTTP ${response.status}`);
        return;
      }

      this.markOutbound();
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : String(error);
      this.recordError(`Mattermost send failed: ${message}`);
    }
  }
}
