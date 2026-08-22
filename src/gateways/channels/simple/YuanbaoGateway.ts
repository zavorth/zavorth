import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';

export class YuanbaoGateway extends WebhookGateway {
  public readonly id = 'yuanbao';
  public readonly name = 'Yuanbao';
  public readonly type = 'async' as const;
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
      operatorNextStep: this.resolveConfigured() ? 'Yuanbao bridge configured. Ready to send messages.'
        : 'Set YUANBAO_BRIDGE_URL, YUANBAO_BRIDGE_SCRIPT, or YUANBAO_OUTBOX_DIR to enable.',
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
      webhookPayload['userId']
      || webhookPayload['sender']
      || '',
    ).trim();
    const chatId = String(
      webhookPayload['chatId']
      || webhookPayload['conversationId']
      || 'yuanbao',
    ).trim();
    const rawText = String(
      webhookPayload['text']
      || webhookPayload['content']
      || webhookPayload['rawText']
      || '',
    ).trim();
    const messageId = String(
      webhookPayload['messageId']
      || webhookPayload['msgId']
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
