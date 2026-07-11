import fs from 'fs';
import path from 'path';
import { config } from '../../../config/index.js';
import { IMessageBroker } from '../../../contracts/IMessageBroker.js';
import {
  type LiveChannelBroadcastGatewayContract,
  PlatformKey,
} from '../../../contracts/PlatformContract.js';
import { logger } from '../../../logger.js';
import {
  buildDiscordChatId,
} from './DiscordGatewayMessageHelpers.js';

export interface DiscordGatewayStubMessage {
  userId: string;
  chatId?: string;
  channelId?: string;
  guildId?: string | null;
  rawText: string;
  isGroup?: boolean;
  messageId?: string | null;
  threadId?: string | null;
}

export type DiscordGatewayStatusSnapshot = {
  mode: 'stub' | 'native';
  enabled: boolean;
  started: boolean;
  recipientsConfigured: number;
  allowedGuildIds: string[];
  allowedChannelIds: string[];
  allowDirectMessages: boolean;
  transport: 'stub' | 'local';
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastRejectedAt: string | null;
  lastError: string | null;
  updatedAt: string;
};

type DiscordGatewayStubRuntime = {
  outboxDir?: string;
  statusFile?: string;
  allowedGuildIds?: string[];
  allowedChannelIds?: string[];
  allowDirectMessages?: boolean;
  now?: () => Date;
};

function redactSecrets(text: string): string {
  return String(text || '')
    .replace(/((?:api[_-]?key|token|secret|password|bot)\s*[:=]\s*)\S+/gi, '$1[redacted]')
    .replace(/\b(xox[baprs]-[A-Za-z0-9-]+)\b/g, '[redacted]')
    .replace(/\b([A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27})\b/g, '[redacted]');
}

export class DiscordGateway implements LiveChannelBroadcastGatewayContract {
  public readonly platform: PlatformKey = 'discord';
  public readonly supportsRoleAwareBroadcast = false;

  private broker: IMessageBroker | null;
  private started = false;
  private lastInboundAt: string | null = null;
  private lastOutboundAt: string | null = null;
  private lastRejectedAt: string | null = null;
  private lastError: string | null = null;
  private readonly outboxDir: string;
  private readonly statusFile: string;
  private readonly allowedGuildIds: string[];
  private readonly allowedChannelIds: string[];
  private readonly allowDirectMessages: boolean;
  private readonly now: () => Date;

  constructor(broker?: IMessageBroker, runtime: DiscordGatewayStubRuntime = {}) {
    this.broker = broker ?? null;
    this.outboxDir = path.resolve(
      runtime.outboxDir
      || config.discordOutboxDir
      || path.join(config.runtimeDir || 'data/runtime', 'discord', 'outbox'),
    );
    this.statusFile = path.resolve(
      runtime.statusFile
      || config.discordStatusFile
      || path.join(config.runtimeDir || 'data/runtime', 'discord-status.json'),
    );
    this.allowedGuildIds = (runtime.allowedGuildIds || config.discordAllowedGuildIds || [])
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
    this.allowedChannelIds = (runtime.allowedChannelIds || config.discordAllowedChannelIds || [])
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
    this.allowDirectMessages = runtime.allowDirectMessages ?? Boolean(config.discordAllowDms);
    this.now = runtime.now || (() => new Date());
  }

  public attachBroker(broker: IMessageBroker): void {
    this.broker = broker;
  }

  public async start(): Promise<void> {
    this.started = true;
    this.lastError = null;
    this.ensureRuntimePaths();
    this.writeStatus();
  }

  public async stop(): Promise<void> {
    this.started = false;
    this.writeStatus();
  }

  public isStarted(): boolean {
    return this.started;
  }

  public readStatus(): DiscordGatewayStatusSnapshot | null {
    if (!fs.existsSync(this.statusFile)) {
      return null;
    }
    try {
      return JSON.parse(fs.readFileSync(this.statusFile, 'utf8')) as DiscordGatewayStatusSnapshot;
    } catch (error: unknown) {
      logger.warn('[DiscordGateway.stub] JSON parse failed', error);
      return null;
    }
  }

  public resolveBroadcastRecipients(): string[] {
    if (this.allowedChannelIds.length > 0) {
      return [...this.allowedChannelIds];
    }
    return this.allowedGuildIds.map((guildId) => `guild:${guildId}`);
  }

  public async simulateIncomingMessage(message: DiscordGatewayStubMessage): Promise<void> {
    if (!this.broker) {
      throw new Error('DiscordGateway stub has no broker attached.');
    }

    const userId = String(message.userId || '').trim();
    const channelId = String(message.channelId || message.chatId || '').trim();
    const guildId = message.guildId === undefined
      ? (message.isGroup === false ? null : String(this.allowedGuildIds[0] || 'guild-stub'))
      : (String(message.guildId || '').trim() || null);
    const rawText = String(message.rawText || '').trim();
    const threadId = String(message.threadId || '').trim() || null;
    const chatId = String(message.chatId || '').trim()
      || buildDiscordChatId(guildId, channelId || 'discord', threadId);

    const validation = this.validateInbound({
      userId,
      channelId: channelId || chatId,
      guildId,
      rawText,
    });
    if (!validation.valid) {
      this.lastRejectedAt = this.now().toISOString();
      this.lastError = validation.reason;
      this.writeStatus();
      throw new Error(validation.reason);
    }

    this.lastInboundAt = this.now().toISOString();
    this.lastError = null;
    this.writeStatus();

    await this.broker.processMessage({
      platform: 'discord',
      userId: userId || 'discord-user',
      chatId,
      channelId: channelId || chatId,
      threadId,
      messageId: String(message.messageId || '').trim() || null,
      isGroup: Boolean(guildId) || Boolean(message.isGroup),
      rawText,
      transport: 'text',
      reply: async (text: string) => {
        this.writeEnvelope(text, channelId || chatId, {
          kind: 'reply',
          guildId,
          threadId,
        });
      },
      editMessage: async () => {},
    });
  }

  public async broadcast(message: string): Promise<void> {
    if (!this.started) {
      this.lastError = 'Discord stub has not started yet.';
      this.writeStatus();
      throw new Error(this.lastError);
    }

    const recipients = this.resolveBroadcastRecipients();
    if (recipients.length === 0) {
      this.lastError = 'Discord stub has no configured allowlisted channels or guilds.';
      this.writeStatus();
      throw new Error(this.lastError);
    }

    for (const recipient of recipients) {
      this.writeEnvelope(message, recipient, { kind: 'broadcast' });
    }
  }

  public getIdentityHints(): { linkedBy: string; verificationMethod: string } {
    return {
      linkedBy: 'discord-gateway-stub',
      verificationMethod: 'discord-stub-outbox',
    };
  }

  public doctorSnapshot(): {
    channelId: 'discord';
    mode: 'stub';
    enabled: boolean;
    configured: boolean;
    allowlistConfigured: boolean;
    outboxDir: string;
    statusFile: string;
    summary: string;
  } {
    const recipients = this.resolveBroadcastRecipients();
    const enabled = Boolean(String(config.discordBotToken || '').trim()) || recipients.length > 0 || this.started;
    const allowlistConfigured = recipients.length > 0;
    return {
      channelId: 'discord',
      mode: 'stub',
      enabled,
      configured: allowlistConfigured || Boolean(String(config.discordBotToken || '').trim()),
      allowlistConfigured,
      outboxDir: this.outboxDir,
      statusFile: this.statusFile,
      summary: allowlistConfigured
        ? 'Discord spine stub ready for mock inbound/outbound with allowlist.'
        : 'Discord spine stub needs DISCORD_ALLOWED_CHANNEL_IDS or DISCORD_ALLOWED_GUILD_IDS.',
    };
  }

  private validateInbound(input: {
    userId: string;
    channelId: string;
    guildId: string | null;
    rawText: string;
  }): { valid: true } | { valid: false; reason: string } {
    if (!input.rawText) {
      return { valid: false, reason: 'Discord stub ignores empty messages.' };
    }
    if (!input.channelId) {
      return { valid: false, reason: 'Discord stub requires chatId or channelId.' };
    }
    if (!input.guildId && !this.allowDirectMessages) {
      return { valid: false, reason: 'Discord stub direct messages are disabled.' };
    }
    if (input.guildId && this.allowedGuildIds.length > 0 && !this.allowedGuildIds.includes(input.guildId)) {
      return { valid: false, reason: `Discord stub guild ${input.guildId} is not allowlisted.` };
    }
    if (
      this.allowedChannelIds.length > 0
      && !this.allowedChannelIds.includes(input.channelId)
      && !input.channelId.startsWith('discord:')
    ) {
      return { valid: false, reason: `Discord stub channel ${input.channelId} is not allowlisted.` };
    }
    return { valid: true };
  }

  private writeEnvelope(
    message: string,
    recipient: string,
    extra: {
      kind?: 'reply' | 'broadcast' | 'edit';
      guildId?: string | null;
      threadId?: string | null;
    } = {},
  ): void {
    try {
      this.ensureRuntimePaths();
      const createdAt = this.now().toISOString();
      const envelope = {
        id: `discord-${Date.now()}`,
        createdAt,
        platform: 'discord',
        transport: 'stub',
        recipient,
        message: redactSecrets(message),
        kind: extra.kind || 'reply',
        guildId: extra.guildId || null,
        threadId: extra.threadId || null,
        secretValuesSerialized: false,
      };
      const targetFile = path.join(
        this.outboxDir,
        `${createdAt.replace(/[:.]/g, '-')}-${envelope.id}.json`,
      );
      fs.writeFileSync(targetFile, JSON.stringify(envelope, null, 2), 'utf8');
      this.lastOutboundAt = createdAt;
      this.lastError = null;
      this.writeStatus();
    } catch (error: unknown) {
      logger.warn('[DiscordGateway.stub] filesystem operation failed', error);
      this.lastError = 'Discord stub outbox write failed.';
      this.writeStatus();
    }
  }

  private ensureRuntimePaths(): void {
    fs.mkdirSync(this.outboxDir, { recursive: true });
    fs.mkdirSync(path.dirname(this.statusFile), { recursive: true });
  }

  private writeStatus(): void {
    this.ensureRuntimePaths();
    const recipients = this.resolveBroadcastRecipients();
    const snapshot: DiscordGatewayStatusSnapshot = {
      mode: 'stub',
      enabled: Boolean(String(config.discordBotToken || '').trim()) || recipients.length > 0 || this.started,
      started: this.started,
      recipientsConfigured: recipients.length,
      allowedGuildIds: [...this.allowedGuildIds],
      allowedChannelIds: [...this.allowedChannelIds],
      allowDirectMessages: this.allowDirectMessages,
      transport: 'stub',
      lastInboundAt: this.lastInboundAt,
      lastOutboundAt: this.lastOutboundAt,
      lastRejectedAt: this.lastRejectedAt,
      lastError: this.lastError,
      updatedAt: this.now().toISOString(),
    };
    fs.writeFileSync(this.statusFile, JSON.stringify(snapshot, null, 2), 'utf8');
  }
}
