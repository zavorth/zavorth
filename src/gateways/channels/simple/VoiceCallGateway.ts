import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';

export class VoiceCallGateway extends WebhookGateway {
  public readonly id = 'voice-call';
  public readonly name = 'Voice Call';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'local-bridge';

  constructor(options: WebhookGatewayOptions) {
    super({
      ...options,
      outboxDir: options.outboxDir || config.voiceCallOutboxDir,
      statusFile: options.statusFile || config.voiceCallStatusFile,
    });
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/voice-call',
      doctorCommand: '/channels doctor voice-call',
      operatorNextStep: this.resolveConfigured()
        ? 'Voice Call bridge configurado. Pronto para fazer chamadas.'
        : 'Defina VOICE_CALL_BRIDGE_URL, VOICE_CALL_BRIDGE_SCRIPT ou VOICE_CALL_OUTBOX_DIR para ativar.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(
      String(config.voiceCallBridgeUrl || '').trim()
      || String(config.voiceCallBridgeScript || '').trim(),
    );
  }

  public resolveEnabled(): boolean {
    return this.resolveConfigured();
  }

  protected resolveOutboxDir(): string {
    return config.voiceCallOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.voiceCallStatusFile;
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
      (webhookPayload as any).caller
      || (webhookPayload as any).from
      || (webhookPayload as any).userId
      || '',
    ).trim();
    const chatId = String(
      (webhookPayload as any).chatId
      || (webhookPayload as any).callId
      || 'voice-call',
    ).trim();
    const rawText = String(
      (webhookPayload as any).transcript
      || (webhookPayload as any).text
      || (webhookPayload as any).rawText
      || '',
    ).trim();
    const messageId = String(
      (webhookPayload as any).callId
      || (webhookPayload as any).messageId
      || '',
    ).trim() || null;

    if (!rawText) {
      return null;
    }

    return {
      userId: userId || 'voice-user',
      chatId: chatId || 'voice-call',
      rawText,
      messageId,
      isGroup: false,
      fields: {
        callStatus: String((webhookPayload as any).status || ''),
        duration: (webhookPayload as any).duration || null,
      },
    };
  }
}
