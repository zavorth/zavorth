import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';

export class EmailGateway extends WebhookGateway {
  public readonly id = 'email';
  public readonly name = 'Email';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'local-bridge';

  constructor(options: WebhookGatewayOptions | any) {
    const isOptionsObj = options && typeof options === 'object' && 'eventBus' in options;
    super(isOptionsObj ? {
      ...options,
      outboxDir: options.outboxDir || config.emailOutboxDir,
      statusFile: options.statusFile || config.emailStatusFile,
    } : options);
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/email',
      doctorCommand: '/channels doctor email',
      operatorNextStep: this.resolveConfigured()
        ? 'Email SMTP/IMAP configurado.'
        : 'Defina EMAIL_SMTP_HOST e/ou EMAIL_IMAP_HOST para ativar.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(
      String(config.emailSmtpHost || '').trim() ||
      String(config.emailImapHost || '').trim()
    );
  }

  public resolveEnabled(): boolean {
    return Boolean(
      String(config.emailSmtpHost || '').trim() ||
      String(config.emailImapHost || '').trim()
    );
  }

  protected resolveOutboxDir(): string {
    return config.emailOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.emailStatusFile;
  }

  protected extractInboundPayload(webhookPayload: Record<string, unknown>): {
    userId: string;
    chatId: string;
    rawText: string;
    messageId?: string | null;
    isGroup?: boolean;
    fields?: Record<string, unknown>;
  } | null {
    const userId = String(webhookPayload.from || webhookPayload.sender || '');
    const chatId = String(webhookPayload.chatId || webhookPayload.to || 'email');
    const rawText = String(webhookPayload.text || '').trim();
    if (!rawText) return null;
    return {
      userId: userId || 'email-user',
      chatId: chatId || 'email',
      rawText,
      isGroup: false,
    };
  }
}
