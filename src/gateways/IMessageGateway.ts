import { config } from '../config/index.js';
import type { ChannelAdapterStatus } from '../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from './WebhookGateway.js';

export class IMessageGateway extends WebhookGateway {
  public readonly id = 'imessage';
  public readonly name = 'iMessage';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'local-bridge';

  constructor(options: WebhookGatewayOptions | any) {
    const isOptionsObj = options && typeof options === 'object' && 'eventBus' in options;
    super(isOptionsObj ? {
      ...options,
      outboxDir: options.outboxDir || config.imessageOutboxDir,
      statusFile: options.statusFile || config.imessageStatusFile,
    } : options);
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/imessage',
      doctorCommand: '/channels doctor imessage',
      operatorNextStep: this.resolveConfigured()
        ? 'iMessage bridge configurado.'
        : 'Defina IMESSAGE_BRIDGE_URL ou IMESSAGE_BRIDGE_SCRIPT para ativar.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(
      String((config as any).imessageBridgeUrl || '').trim() ||
      String(config.imessageBridgeScript || '').trim()
    );
  }

  public resolveEnabled(): boolean {
    return Boolean(
      String((config as any).imessageBridgeUrl || '').trim() ||
      String(config.imessageBridgeScript || '').trim()
    );
  }

  protected resolveOutboxDir(): string {
    return config.imessageOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.imessageStatusFile;
  }

  protected extractInboundPayload(webhookPayload: Record<string, unknown>): {
    userId: string;
    chatId: string;
    rawText: string;
    messageId?: string | null;
    isGroup?: boolean;
    fields?: Record<string, unknown>;
  } | null {
    const userId = String(webhookPayload.sender || webhookPayload.from || '');
    const chatId = String(webhookPayload.chatId || webhookPayload.to || 'imessage');
    const rawText = String(webhookPayload.text || '').trim();
    if (!rawText) return null;
    return {
      userId: userId || 'imessage-user',
      chatId: chatId || 'imessage',
      rawText,
      isGroup: false,
    };
  }
}
