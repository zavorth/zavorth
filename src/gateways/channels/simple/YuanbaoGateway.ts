import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';

export class YuanbaoGateway extends WebhookGateway {
  public readonly id = 'yuanbao';
  public readonly name = 'Yuanbao';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'local-bridge';

  constructor(options: WebhookGatewayOptions) {
    super({
      ...options,
      outboxDir: options.outboxDir || config.yuanbaoOutboxDir,
      statusFile: options.statusFile || config.yuanbaoStatusFile,
    });
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/yuanbao',
      doctorCommand: '/channels doctor yuanbao',
      operatorNextStep: this.resolveConfigured()
        ? 'Yuanbao bridge configurado. Pronto para enviar mensagens.'
        : 'Defina YUANBAO_BRIDGE_URL, YUANBAO_BRIDGE_SCRIPT ou YUANBAO_OUTBOX_DIR para ativar.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(
      String(config.yuanbaoBridgeUrl || '').trim()
      || String(config.yuanbaoBridgeScript || '').trim(),
    );
  }

  public resolveEnabled(): boolean {
    return this.resolveConfigured();
  }

  protected resolveOutboxDir(): string {
    return config.yuanbaoOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.yuanbaoStatusFile;
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
      (webhookPayload as any).userId
      || (webhookPayload as any).sender
      || '',
    ).trim();
    const chatId = String(
      (webhookPayload as any).chatId
      || (webhookPayload as any).conversationId
      || 'yuanbao',
    ).trim();
    const rawText = String(
      (webhookPayload as any).text
      || (webhookPayload as any).content
      || (webhookPayload as any).rawText
      || '',
    ).trim();
    const messageId = String(
      (webhookPayload as any).messageId
      || (webhookPayload as any).msgId
      || '',
    ).trim() || null;

    if (!rawText) {
      return null;
    }

    return {
      userId: userId || 'yuanbao-user',
      chatId: chatId || 'yuanbao',
      rawText,
      messageId,
      isGroup: false,
      fields: {},
    };
  }
}
