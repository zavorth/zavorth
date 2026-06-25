import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';

export class NostrGateway extends WebhookGateway {
  public readonly id = 'nostr';
  public readonly name = 'Nostr';
  public readonly type: 'async' = 'async';
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
      operatorNextStep: this.resolveConfigured()
        ? 'Nostr bridge configurado. Pronto para enviar notas.'
        : 'Defina NOSTR_BRIDGE_URL ou NOSTR_OUTBOX_DIR para ativar.',
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
    const userId = String(
      (webhookPayload as any).pubkey
      || (webhookPayload as any).author
      || (webhookPayload as any).userId
      || '',
    ).trim();
    const chatId = String(
      (webhookPayload as any).chatId
      || (webhookPayload as any).relay
      || 'nostr',
    ).trim();
    const rawText = String(
      (webhookPayload as any).content
      || (webhookPayload as any).text
      || (webhookPayload as any).rawText
      || '',
    ).trim();
    const messageId = String(
      (webhookPayload as any).id
      || (webhookPayload as any).eventId
      || (webhookPayload as any).messageId
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
        kind: (webhookPayload as any).kind || 1,
        relay: String((webhookPayload as any).relay || ''),
      },
    };
  }
}
