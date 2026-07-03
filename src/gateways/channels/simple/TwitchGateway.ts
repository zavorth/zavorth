import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';

interface TwitchWebhookPayload {
  user?: string;
  chatter?: string;
  userId?: string;
  channel?: string;
  room?: string;
  chatId?: string;
  message?: string;
  text?: string;
  rawText?: string;
  messageId?: string;
  id?: string;
  badges?: string;
}

export class TwitchGateway extends WebhookGateway {
  public readonly id = 'twitch';
  public readonly name = 'Twitch';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'local-bridge';

  constructor(options: WebhookGatewayOptions) {
    super({
      ...options,
      outboxDir: options.outboxDir || config.twitchOutboxDir,
      statusFile: options.statusFile || config.twitchStatusFile,
    });
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/twitch',
      doctorCommand: '/channels doctor twitch',
      operatorNextStep: this.resolveConfigured()
        ? 'Twitch bridge configurado. Pronto para chat e notificacoes.'
        : 'Defina TWITCH_BRIDGE_URL, TWITCH_WEBHOOK_URL ou TWITCH_OUTBOX_DIR para ativar.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(
      String(config.twitchBridgeUrl || '').trim()
      || String(config.twitchWebhookUrl || '').trim(),
    );
  }

  public resolveEnabled(): boolean {
    return this.resolveConfigured();
  }

  protected resolveOutboxDir(): string {
    return config.twitchOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.twitchStatusFile;
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
      (webhookPayload as any).user
      || (webhookPayload as any).chatter
      || (webhookPayload as any).userId
      || '',
    ).trim();
    const chatId = String(
      (webhookPayload as any).channel
      || (webhookPayload as any).room
      || (webhookPayload as any).chatId
      || 'twitch',
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
      userId: userId || 'twitch-user',
      chatId: chatId || 'twitch',
      rawText,
      messageId,
      isGroup: true,
      fields: {
        channel: chatId,
        badges: String((webhookPayload as any).badges || ''),
      },
    };
  }
}
