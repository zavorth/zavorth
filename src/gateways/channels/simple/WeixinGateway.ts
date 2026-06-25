import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';

export class WeixinGateway extends WebhookGateway {
  public readonly id = 'weixin';
  public readonly name = 'Weixin / WeChat';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'local-bridge';

  constructor(options: WebhookGatewayOptions) {
    super({
      ...options,
      outboxDir: options.outboxDir || config.weixinOutboxDir,
      statusFile: options.statusFile || config.weixinStatusFile,
    });
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/weixin',
      doctorCommand: '/channels doctor weixin',
      operatorNextStep: this.resolveConfigured()
        ? 'Weixin/WeChat bridge configurado. Pronto para enviar mensagens.'
        : 'Defina WEIXIN_BRIDGE_URL, WEIXIN_BRIDGE_SCRIPT ou WEIXIN_OUTBOX_DIR para ativar.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(
      String(config.weixinBridgeUrl || '').trim()
      || String(config.weixinBridgeScript || '').trim(),
    );
  }

  public resolveEnabled(): boolean {
    return this.resolveConfigured();
  }

  protected resolveOutboxDir(): string {
    return config.weixinOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.weixinStatusFile;
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
      (webhookPayload as any).FromUserName
      || (webhookPayload as any).userId
      || (webhookPayload as any).sender
      || '',
    ).trim();
    const chatId = String(
      (webhookPayload as any).ToUserName
      || (webhookPayload as any).chatId
      || 'weixin',
    ).trim();
    const rawText = String(
      (webhookPayload as any).Content
      || (webhookPayload as any).content
      || (webhookPayload as any).text
      || (webhookPayload as any).rawText
      || '',
    ).trim();
    const messageId = String(
      (webhookPayload as any).MsgId
      || (webhookPayload as any).messageId
      || '',
    ).trim() || null;

    if (!rawText) {
      return null;
    }

    return {
      userId: userId || 'weixin-user',
      chatId: chatId || 'weixin',
      rawText,
      messageId,
      isGroup: false,
      fields: {
        msgType: String((webhookPayload as any).MsgType || 'text'),
      },
    };
  }
}
