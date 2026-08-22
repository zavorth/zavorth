import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';

interface NostrWebhookPayload {
  pubkey?: string;
  author?: string;
  userId?: string;
  chatId?: string;
  relay?: string;
  content?: string;
  text?: string;
  rawText?: string;
  id?: string;
  eventId?: string;
  messageId?: string;
  kind?: number;
}

export class NostrGateway extends WebhookGateway {
  public readonly id = 'nostr';
  public readonly name = 'Nostr';
  public readonly type = 'async' as const;
  public readonly mode: WebhookGatewayMode = 'local-bridge';

  constructor(options: WebhookGatewayOptions) {
    super({
      ...options,
      outboxDir: options.outboxDir || config.nostrOutboxDir,
      statusFile: options.statusFile || config.nostrStatusFile,
    });
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/nostr',
      doctorCommand: '/channels doctor nostr',
      operatorNextStep: this.resolveConfigured() ? 'Nostr bridge configured. Ready to send notes.'
        : 'Set NOSTR_BRIDGE_URL or NOSTR_OUTBOX_DIR to enable.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(
      String(config.nostrBridgeUrl || '').trim(),
    );
  }

  public resolveEnabled(): boolean {
    return this.resolveConfigured();
  }

  protected resolveOutboxDir(): string {
    return config.nostrOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.nostrStatusFile;
  }

  protected extractInboundPayload(webhookPayload: Record<string, unknown>): {
    userId: string;
    chatId: string;
    rawText: string;
    messageId?: string | null;
    isGroup?: boolean;
    fields?: Record<string, unknown>;
  } | null {
    const payload = webhookPayload as NostrWebhookPayload;

    const userId = String(
      payload.pubkey
      || payload.author
      || payload.userId
      || '',
    ).trim();
    const chatId = String(
      payload.chatId
      || payload.relay
      || 'nostr',
    ).trim();
    const rawText = String(
      payload.content
      || payload.text
      || payload.rawText
      || '',
    ).trim();
    const messageId = String(
      payload.id
      || payload.eventId
      || payload.messageId
      || '',
    ).trim() || null;

    if (!rawText) {
      return null;
    }

    return {
      userId: userId || 'nostr-user',
      chatId: chatId || 'nostr',
      rawText,
      messageId,
      isGroup: false,
      fields: {
        kind: payload.kind ?? 1,
        relay: String(payload.relay || ''),
      },
    };
  }
}
