import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';

export class DiscordGateway extends WebhookGateway {
  public readonly id = 'discord';
  public readonly name = 'Discord';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'webhook';

  constructor(options: WebhookGatewayOptions | any) {
    const isOptionsObj = options && typeof options === 'object' && 'eventBus' in options;
    super(isOptionsObj ? {
      ...options,
      outboxDir: options.outboxDir || (config as any).discordOutboxDir,
      statusFile: options.statusFile || (config as any).discordStatusFile,
    } : options);
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/discord',
      doctorCommand: '/channels doctor discord',
      operatorNextStep: this.resolveConfigured()
        ? 'Discord webhook configurado.'
        : 'Defina DISCORD_WEBHOOK_URL para ativar.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(String((config as any).discordWebhookUrl || '').trim());
  }

  public resolveEnabled(): boolean {
    return Boolean(String((config as any).discordWebhookUrl || '').trim());
  }

  protected resolveOutboxDir(): string {
    return (config as any).discordOutboxDir;
  }

  protected resolveStatusFile(): string {
    return (config as any).discordStatusFile;
  }

  protected extractInboundPayload(webhookPayload: Record<string, unknown>): {
    userId: string;
    chatId: string;
    rawText: string;
    messageId?: string | null;
    isGroup?: boolean;
    fields?: Record<string, unknown>;
  } | null {
    const username = String(webhookPayload.username || '');
    const rawText = String(webhookPayload.content || webhookPayload.text || '').trim();
    if (!rawText) return null;
    return {
      userId: username || 'discord-user',
      chatId: 'discord',
      rawText,
      isGroup: true,
    };
  }
}
