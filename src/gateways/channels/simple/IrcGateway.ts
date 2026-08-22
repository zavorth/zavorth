import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';
import { asErrorLike } from '../../../utils/errorLike.js';

export class IrcGateway extends WebhookGateway {
  public readonly id = 'irc';
  public readonly name = 'IRC Bridge';
  public readonly type = 'async' as const;
  public readonly mode: WebhookGatewayMode = 'local-bridge';

  constructor(options: WebhookGatewayOptions) {
    super({
      ...options,
      outboxDir: options.outboxDir || config.ircOutboxDir,
      statusFile: options.statusFile || config.ircStatusFile,
    });
  }

  public describe(): ChannelAdapterStatus {
    const configured = this.resolveConfigured();
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/irc',
      doctorCommand: '/channels doctor irc',
      operatorNextStep: configured ? 'IRC bridge configured. Ready to send and receive messages.'
        : 'Set IRC_BRIDGE_URL or IRC_WEBHOOK_URL to enable.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(
      String(config.ircBridgeUrl || '').trim()
      || String(config.ircWebhookUrl || '').trim(),
    );
  }

  public resolveEnabled(): boolean {
    return Boolean(
      String(config.ircBridgeUrl || '').trim()
      || String(config.ircWebhookUrl || '').trim()
      || String(config.ircScriptPath || '').trim(),
    );
  }

  protected resolveOutboxDir(): string {
    return config.ircOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.ircStatusFile;
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
      webhookPayload.nick
      || webhookPayload.user
      || webhookPayload.userId
      || webhookPayload.from
      || '',
    ).trim();
    const channel = String(
      webhookPayload.channel
      || webhookPayload.target
      || webhookPayload.chatId
      || '',
    ).trim();
    const rawText = String(
      webhookPayload.text
      || webhookPayload.message
      || webhookPayload.rawText
      || '',
    ).trim();
    const messageId = String(
      webhookPayload.messageId
      || webhookPayload.id
      || '',
    ).trim() || null;

    if (!rawText) {
      return null;
    }

    return {
      userId: userId || 'irc-user',
      chatId: channel || 'irc',
      rawText,
      messageId,
      isGroup: channel.startsWith('#'),
      fields: {
        ircChannel: channel || null,
        ircHost: String(webhookPayload.host || '').trim() || null,
      },
    };
  }

  public async sendToChannel(channel: string, text: string): Promise<void> {
    if (!this.resolveConfigured()) {
      this.sendMessage({ recipients: [channel], text, chatId: channel });
      return;
    }

    const bridgeUrl = String(config.ircBridgeUrl || '').trim();
    if (!bridgeUrl || !this.fetchImpl) {
      this.sendMessage({ recipients: [channel], text, chatId: channel });
      return;
    }

    try {
      const response = await this.fetchImpl(`${bridgeUrl.replace(/\/+$/, '')}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ channel, text }),
      });

      if (!response.ok) {
        this.recordError(`IRC bridge error: HTTP ${response.status}`);
        return;
      }

      this.markOutbound();
    } catch (error: unknown) {
      const err = asErrorLike(error);
      this.recordError(`IRC send failed: ${error instanceof Error ? err.message : String(error)}`);
    }
  }
}
