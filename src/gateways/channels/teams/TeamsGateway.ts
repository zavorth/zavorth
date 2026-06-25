import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';

export class TeamsGateway extends WebhookGateway {
  public readonly id = 'teams';
  public readonly name = 'Microsoft Teams';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'webhook';

  constructor(options: WebhookGatewayOptions | any) {
    const isOptionsObj = options && typeof options === 'object' && 'eventBus' in options;
    super(isOptionsObj ? {
      ...options,
      outboxDir: options.outboxDir || config.teamsOutboxDir,
      statusFile: options.statusFile || config.teamsStatusFile,
    } : options);
  }

  public async handleWebhookEvent(input: { headers: any; rawBody: string; body: Record<string, unknown> }): Promise<{ statusCode: number; body: unknown }> {
    const ok = await this.onMessageReceived(input.body);
    return {
      statusCode: ok ? 200 : 400,
      body: { ok },
    };
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/teams',
      doctorCommand: '/channels doctor teams',
      operatorNextStep: this.resolveConfigured()
        ? 'Teams webhook configurado.'
        : 'Defina TEAMS_WEBHOOK_URL para ativar.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(String((config as any).teamsWebhookUrl || '').trim());
  }

  public resolveEnabled(): boolean {
    return Boolean(String((config as any).teamsWebhookUrl || '').trim());
  }

  protected resolveOutboxDir(): string {
    return config.teamsOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.teamsStatusFile;
  }

  protected extractInboundPayload(webhookPayload: Record<string, unknown>): {
    userId: string;
    chatId: string;
    rawText: string;
    messageId?: string | null;
    isGroup?: boolean;
    fields?: Record<string, unknown>;
  } | null {
    const userId = String(webhookPayload.from || webhookPayload.userId || '');
    const chatId = String(webhookPayload.conversationId || webhookPayload.chatId || 'teams');
    const rawText = String(webhookPayload.text || '').trim();
    if (!rawText) return null;
    return {
      userId: userId || 'teams-user',
      chatId: chatId || 'teams',
      rawText,
      isGroup: true,
    };
  }
}
