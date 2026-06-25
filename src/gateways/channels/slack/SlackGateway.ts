import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';

export class SlackGateway extends WebhookGateway {
  public readonly id = 'slack';
  public readonly name = 'Slack';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'webhook';

  constructor(options: WebhookGatewayOptions | any) {
    const isOptionsObj = options && typeof options === 'object' && 'eventBus' in options;
    super(isOptionsObj ? {
      ...options,
      outboxDir: options.outboxDir || config.slackOutboxDir,
      statusFile: options.statusFile || config.slackStatusFile,
    } : options);
  }

  public async handleWebhookEvent(input: { headers: any; rawBody: string; body: Record<string, unknown> }): Promise<{ statusCode: number; body: unknown }> {
    if (input.body?.type === 'url_verification') {
      return {
        statusCode: 200,
        body: { challenge: input.body.challenge },
      };
    }
    const ok = await this.onMessageReceived(input.body);
    return {
      statusCode: ok ? 200 : 400,
      body: { ok },
    };
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/slack',
      doctorCommand: '/channels doctor slack',
      operatorNextStep: this.resolveConfigured()
        ? 'Slack webhook configurado.'
        : 'Defina SLACK_WEBHOOK_URL para ativar.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(String((config as any).slackWebhookUrl || '').trim());
  }

  public resolveEnabled(): boolean {
    return Boolean(String((config as any).slackWebhookUrl || '').trim());
  }

  protected resolveOutboxDir(): string {
    return config.slackOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.slackStatusFile;
  }

  protected extractInboundPayload(webhookPayload: Record<string, unknown>): {
    userId: string;
    chatId: string;
    rawText: string;
    messageId?: string | null;
    isGroup?: boolean;
    fields?: Record<string, unknown>;
  } | null {
    const userId = String(webhookPayload.user_id || webhookPayload.userId || '');
    const chatId = String(webhookPayload.channel_id || webhookPayload.channelId || 'slack');
    const rawText = String(webhookPayload.text || '').trim();
    if (!rawText) return null;
    return {
      userId: userId || 'slack-user',
      chatId: chatId || 'slack',
      rawText,
      isGroup: true,
    };
  }
}
