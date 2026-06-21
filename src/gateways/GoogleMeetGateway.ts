import { config } from '../config/index.js';
import type { ChannelAdapterStatus } from '../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from './WebhookGateway.js';

export class GoogleMeetGateway extends WebhookGateway {
  public readonly id = 'google-meet';
  public readonly name = 'Google Meet';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'local-bridge';

  constructor(options: WebhookGatewayOptions) {
    super({
      ...options,
      outboxDir: options.outboxDir || config.googleMeetOutboxDir,
      statusFile: options.statusFile || config.googleMeetStatusFile,
    });
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/google-meet',
      doctorCommand: '/channels doctor google-meet',
      operatorNextStep: this.resolveConfigured()
        ? 'Google Meet bridge configurado. Pronto para interagir em reunioes.'
        : 'Defina GOOGLE_MEET_BRIDGE_URL, GOOGLE_MEET_BRIDGE_SCRIPT ou GOOGLE_MEET_OUTBOX_DIR para ativar.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(
      String(config.googleMeetBridgeUrl || '').trim()
      || String(config.googleMeetBridgeScript || '').trim(),
    );
  }

  public resolveEnabled(): boolean {
    return this.resolveConfigured();
  }

  protected resolveOutboxDir(): string {
    return config.googleMeetOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.googleMeetStatusFile;
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
      (webhookPayload as any).participant
      || (webhookPayload as any).userId
      || '',
    ).trim();
    const chatId = String(
      (webhookPayload as any).meetingId
      || (webhookPayload as any).space
      || (webhookPayload as any).chatId
      || 'google-meet',
    ).trim();
    const rawText = String(
      (webhookPayload as any).text
      || (webhookPayload as any).transcript
      || (webhookPayload as any).rawText
      || '',
    ).trim();
    const messageId = String(
      (webhookPayload as any).messageId
      || '',
    ).trim() || null;

    if (!rawText) {
      return null;
    }

    return {
      userId: userId || 'meet-user',
      chatId: chatId || 'google-meet',
      rawText,
      messageId,
      isGroup: true,
      fields: {
        meetingId: chatId,
      },
    };
  }
}
