import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';

export class TelegramGateway extends WebhookGateway {
  public readonly id = 'telegram';
  public readonly name = 'Telegram';
  public readonly type = 'async' as const;
  public readonly mode: WebhookGatewayMode = 'bot-http';

  constructor(options: WebhookGatewayOptions | Record<string, unknown>) {
    const isOptionsObj = options && typeof options === 'object' && 'eventBus' in options;
    super(isOptionsObj ? {
      ...options,
      outboxDir: options.outboxDir || config.telegramOutboxDir,
      statusFile: options.statusFile || config.telegramStatusFile,
    } : options);
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/telegram',
      doctorCommand: '/channels doctor telegram',
      operatorNextStep: this.resolveConfigured() ? 'Telegram configured. Ready to send/receive messages.'
        : 'Set TELEGRAM_BOT_TOKEN and TELEGRAM_DEFAULT_CHAT_ID to enable.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(
      String(config.telegramBotToken || '').trim() &&
      String(config.telegramDefaultChatId || '').trim()
    );
  }

  public resolveEnabled(): boolean {
    return Boolean(
      String(config.telegramBotToken || '').trim() ||
      String(config.telegramDefaultChatId || '').trim()
    );
  }

  protected resolveOutboxDir(): string {
    return config.telegramOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.telegramStatusFile;
  }

  protected extractInboundPayload(webhookPayload: Record<string, unknown>): {
    userId: string;
    chatId: string;
    rawText: string;
    messageId?: string | null;
    isGroup?: boolean;
    fields?: Record<string, unknown>;
  } | null {
    const message = webhookPayload.message && typeof webhookPayload.message === 'object'
      ? webhookPayload.message as Record<string, unknown>
      : null;

    if (!message) {
      return null;
    }

    const from = message.from && typeof message.from === 'object'
      ? message.from as Record<string, unknown>
      : null;
    const userId = String(from?.id || from?.username || '');

    const chat = message.chat && typeof message.chat === 'object'
      ? message.chat as Record<string, unknown>
      : null;
    const chatId = String(chat?.id || '');

    const rawText = String(message.text || '').trim();
    const messageId = String(message.message_id || '');

    if (!rawText) {
      return null;
    }

    const isGroup = chat?.type === 'group' || chat?.type === 'supergroup';

    return {
      userId: userId || 'telegram-user',
      chatId: chatId || 'telegram',
      rawText,
      messageId: messageId || null,
      isGroup,
      fields: {
        chatType: String(chat?.type || 'private'),
      },
    };
  }
}
