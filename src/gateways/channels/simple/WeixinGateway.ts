import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';

interface WeixinWebhookPayload {
  FromUserName?: string;
  userId?: string;
  sender?: string;
  ToUserName?: string;
  chatId?: string;
  Content?: string;
  content?: string;
  text?: string;
  rawText?: string;
  MsgId?: string;
  messageId?: string;
  MsgType?: string;
}

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
      operatorNextStep: this.resolveConfigured() ? 'Weixin/WeChat bridge configured. Ready to send messages.'
        : 'Set WEIXIN_BRIDGE_URL, WEIXIN_BRIDGE_SCRIPT, or WEIXIN_OUTBOX_DIR to enable.',
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
    const p = webhookPayload as WeixinWebhookPayload;
    const userId = String(p.FromUserName || p.userId || p.sender || '').trim();
    const chatId = String(p.ToUserName || p.chatId || 'weixin').trim();
    const rawText = String(p.Content || p.content || p.text || p.rawText || '').trim();
    const messageId = String(p.MsgId || p.messageId || '').trim() || null;

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
        msgType: String(p.MsgType || 'text'),
      },
    };
  }
}
