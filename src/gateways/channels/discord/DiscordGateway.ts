import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';

export class DiscordGateway extends WebhookGateway {
  public readonly id = 'discord';
  public readonly name = 'Discord';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'webhook';

  constructor(options: WebhookGatewayOptions) {
    const isOptionsObj = options && typeof options === 'object' && 'eventBus' in options;
    super(isOptionsObj ? {
      ...options,
      outboxDir: options.outboxDir || config.discordOutboxDir,
      statusFile: options.statusFile || config.discordStatusFile,
    } : options);
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/discord',
      doctorCommand: '/channels doctor discord',
      operatorNextStep: this.resolveConfigured()
        ? 'Discord live path ready (Bot API and/or webhook).'
        : 'Defina DISCORD_BOT_TOKEN (+ channel allowlist) ou DISCORD_WEBHOOK_URL.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(
      String(config.discordBotToken || '').trim()
      || String(config.discordWebhookUrl || '').trim(),
    );
  }

  public resolveEnabled(): boolean {
    return this.resolveConfigured()
      || Boolean(String(config.discordBridgeEnabled || '').trim());
  }

  protected resolveOutboxDir(): string {
    return config.discordOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.discordStatusFile;
  }

  public override doctorSnapshot() {
    const base = super.doctorSnapshot();
    return {
      ...base,
      installHint: this.resolveConfigured()
        ? 'Discord configured. Prefer Bot API channel messages; webhook is fallback.'
        : 'Set DISCORD_BOT_TOKEN + DISCORD_ALLOWED_CHANNEL_IDS and/or DISCORD_WEBHOOK_URL.',
      allowlist: {
        ...base.allowlist,
        guildAllowlistConfigured: Array.isArray(config.discordAllowedGuildIds) && config.discordAllowedGuildIds.length > 0,
        channelAllowlistConfigured: Array.isArray(config.discordAllowedChannelIds) && config.discordAllowedChannelIds.length > 0,
      },
    };
  }

  protected extractInboundPayload(webhookPayload: Record<string, unknown>): {
    userId: string;
    chatId: string;
    rawText: string;
    messageId?: string | null;
    isGroup?: boolean;
    fields?: Record<string, unknown>;
  } | null {
    // Interaction (slash command) envelope
    const data = webhookPayload.data && typeof webhookPayload.data === 'object'
      ? webhookPayload.data as Record<string, unknown>
      : null;
    const member = webhookPayload.member && typeof webhookPayload.member === 'object'
      ? webhookPayload.member as Record<string, unknown>
      : null;
    const author = webhookPayload.author && typeof webhookPayload.author === 'object'
      ? webhookPayload.author as Record<string, unknown>
      : member?.user && typeof member.user === 'object'
        ? member.user as Record<string, unknown>
        : null;

    const userId = String(
      author?.id
      || webhookPayload.user_id
      || webhookPayload.userId
      || webhookPayload.username
      || '',
    ).trim();
    const chatId = String(
      webhookPayload.channel_id
      || webhookPayload.channelId
      || (Array.isArray(config.discordAllowedChannelIds) ? config.discordAllowedChannelIds[0] : '')
      || 'discord',
    ).trim();
    const rawText = String(
      webhookPayload.content
      || webhookPayload.text
      || data?.name
      || (Array.isArray(data?.options) ? JSON.stringify(data?.options) : '')
      || '',
    ).trim();
    if (!rawText) return null;

    return {
      userId: userId || 'discord-user',
      chatId: chatId || 'discord',
      rawText,
      messageId: String(webhookPayload.id || webhookPayload.messageId || '').trim() || null,
      isGroup: true,
      fields: {
        guildId: String(webhookPayload.guild_id || webhookPayload.guildId || '').trim() || null,
        username: String(author?.username || webhookPayload.username || '').trim() || null,
      },
    };
  }
}
