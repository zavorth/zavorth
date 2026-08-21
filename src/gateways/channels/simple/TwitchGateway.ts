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
      operatorNextStep: this.resolveConfigured() ? 'Twitch bridge configured. Ready for chat and notifications.'
        : 'set TWITCH_BRIDGE_URL, TWITCH_WEBHOOK_URL or TWITCH_OUTBOX_DIR to activate.',
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
    const p = webhookPayload as TwitchWebhookPayload;
    const userId = String(p.user || p.chatter || p.userId || '').trim();
    const chatId = String(p.channel || p.room || p.chatId || 'twitch').trim();
    const rawText = String(p.message || p.text || p.rawText || '').trim();
    const messageId = String(p.messageId || p.id || '').trim() || null;

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
        badges: String(p.badges || ''),
      },
    };
  }
}
