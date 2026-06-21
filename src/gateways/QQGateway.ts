import { config } from '../config/index.js';
import type { ChannelAdapterStatus } from '../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from './WebhookGateway.js';

export class QQGateway extends WebhookGateway {
  public readonly id = 'qq';
  public readonly name = 'QQ Bot';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'bot-http';

  constructor(options: WebhookGatewayOptions) {
    super({
      ...options,
      outboxDir: options.outboxDir || config.qqOutboxDir,
      statusFile: options.statusFile || config.qqStatusFile,
    });
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/qq',
      doctorCommand: '/channels doctor qq',
      operatorNextStep: this.resolveConfigured()
        ? 'QQ Bot configurado. Pronto para enviar e receber mensagens.'
        : 'Defina QQ_BOT_WEBHOOK_URL e/ou QQ_SEND_URL para ativar.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(
      String(config.qqBotWebhookUrl || '').trim()
      || String(config.qqSendUrl || '').trim(),
    );
  }

  public resolveEnabled(): boolean {
    return Boolean(
      String(config.qqBotWebhookUrl || '').trim()
      || String(config.qqSendUrl || '').trim(),
    );
  }

  protected resolveOutboxDir(): string {
    return config.qqOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.qqStatusFile;
  }

  protected extractInboundPayload(webhookPayload: Record<string, unknown>): {
    userId: string;
    chatId: string;
    rawText: string;
    messageId?: string | null;
    isGroup?: boolean;
    fields?: Record<string, unknown>;
  } | null {
    const author = webhookPayload.author && typeof webhookPayload.author === 'object'
      ? webhookPayload.author as Record<string, unknown>
      : null;
    const userId = String(
      author?.id
      || author?.user_openid
      || (webhookPayload as any).user_id
      || (webhookPayload as any).userId
      || '',
    ).trim();
    const chatId = String(
      (webhookPayload as any).group_openid
      || (webhookPayload as any).channel_id
      || (webhookPayload as any).guild_id
      || (webhookPayload as any).chatId
      || 'qq',
    ).trim();
    const rawText = String(
      (webhookPayload as any).content
      || (webhookPayload as any).text
      || (webhookPayload as any).rawText
      || '',
    ).trim();
    const messageId = String(
      (webhookPayload as any).id
      || (webhookPayload as any).messageId
      || '',
    ).trim() || null;
    const groupId = String(
      (webhookPayload as any).group_openid
      || '',
    ).trim();

    if (!rawText) {
      return null;
    }

    return {
      userId: userId || 'qq-user',
      chatId: chatId || 'qq',
      rawText,
      messageId,
      isGroup: Boolean(groupId),
      fields: {
        qqGroupId: groupId || null,
        qqChannelId: String((webhookPayload as any).channel_id || '').trim() || null,
        qqGuildId: String((webhookPayload as any).guild_id || '').trim() || null,
      },
    };
  }

  public async sendText(targetId: string, text: string, options: { groupOpenId?: string } = {}): Promise<void> {
    const sendUrl = String(config.qqSendUrl || '').trim();
    if (!sendUrl || !this.fetchImpl) {
      this.sendMessage({ recipients: [targetId], text, chatId: targetId });
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        content: text,
        msg_type: 0,
      };
      if (options.groupOpenId) {
        payload.group_openid = options.groupOpenId;
      } else {
        payload.openid = targetId;
      }

      const response = await this.fetchImpl(sendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.recordError(`QQ Bot API error: HTTP ${response.status}`);
        return;
      }

      this.markOutbound();
    } catch (error: any) {
      this.recordError(`QQ send failed: ${error?.message || error}`);
    }
  }
}
