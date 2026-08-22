import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';

interface VoiceCallWebhookPayload {
  caller?: string;
  from?: string;
  userId?: string;
  chatId?: string;
  callId?: string;
  transcript?: string;
  text?: string;
  rawText?: string;
  messageId?: string;
  status?: string;
  duration?: string | number | null;
}

export class VoiceCallGateway extends WebhookGateway {
  public readonly id = 'voice-call';
  public readonly name = 'Voice Call';
  public readonly type = 'async' as const;
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
      operatorNextStep: this.resolveConfigured() ? 'Voice Call bridge configured. Ready to place calls.'
        : 'set VOICE_CALL_BRIDGE_URL, VOICE_CALL_BRIDGE_SCRIPT or VOICE_CALL_OUTBOX_DIR to activate.',
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
    const p = webhookPayload as VoiceCallWebhookPayload;
    const userId = String(p.caller || p.from || p.userId || '').trim();
    const chatId = String(p.chatId || p.callId || 'voice-call').trim();
    const rawText = String(p.transcript || p.text || p.rawText || '').trim();
    const messageId = String(p.callId || p.messageId || '').trim() || null;

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
        callStatus: String(p.status || ''),
        duration: p.duration || null,
      },
    };
  }
}
