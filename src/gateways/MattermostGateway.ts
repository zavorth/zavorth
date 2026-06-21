import { config } from '../config/index.js';
import type { ChannelAdapterStatus } from '../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from './WebhookGateway.js';

export class MattermostGateway extends WebhookGateway {
  public readonly id = 'mattermost';
  public readonly name = 'Mattermost';
  public readonly type: 'async' = 'async';
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
      operatorNextStep: this.resolveConfigured()
        ? 'Mattermost webhook configurado. Pronto para enviar mensagens.'
        : 'Defina MATTERMOST_WEBHOOK_URL para ativar.',
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
      (webhookPayload as any).user_id
      || (webhookPayload as any).user_name
      || (webhookPayload as any).userId
      || '',
    ).trim();
    const chatId = String(
      (webhookPayload as any).channel_id
      || (webhookPayload as any).channel_name
      || (webhookPayload as any).chatId
      || 'mattermost',
    ).trim();
    const rawText = String(
      (webhookPayload as any).text
      || (webhookPayload as any).rawText
      || '',
    ).trim();
    const messageId = String(
      (webhookPayload as any).post_id
      || (webhookPayload as any).messageId
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
        channelName: String((webhookPayload as any).channel_name || ''),
        teamId: String((webhookPayload as any).team_id || ''),
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
    } catch (error: any) {
      this.recordError(`Mattermost send failed: ${error?.message || error}`);
    }
  }
}
