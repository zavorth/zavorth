import { config } from '../config/index.js';

export type DiscordCommandExposure = 'none' | 'minimal' | 'operator';

const MINIMAL_SLASH_COMMANDS = ['task', 'plan', 'auto', 'help', 'commands'] as const;
const OPERATOR_SLASH_COMMANDS = ['status', 'changes', 'models', 'workflow', 'reload', 'autorepair'] as const;
const URL_PATTERN = /https?:\/\/[^\s<>()]+/gi;
const DISCORD_OPERATIONAL_COMMANDS = new Set([
  '/status',
  '/models',
  '/teams',
  '/tenants',
  '/capabilities',
  '/integrations',
  '/connect',
  '/changes',
  '/workflow',
  '/selfupdate',
  '/autorepair',
  '/channels',
  '/doctor',
  '/gateway',
  '/model',
  '/runtime',
  '/tools',
]);

type DiscordSurfacePolicyOptions = {
  commandExposure?: DiscordCommandExposure;
  ownerUserIds?: string[];
  operatorUserIds?: string[];
  allowedChannelIds?: string[];
  publicServerMode?: boolean;
  requireOwnerForOperational?: boolean;
  blockMassMentions?: boolean;
  maxLinksPerMessage?: number;
  allowAttachmentsInPublicServerMode?: boolean;
  maxMessageChars?: number;
  rateLimitWindowMs?: number;
  rateLimitMaxRequests?: number;
  now?: () => number;
};

export class DiscordSurfacePolicyService {
  private readonly commandExposure: DiscordCommandExposure;
  private readonly ownerUserIds: Set<string>;
  private readonly operatorUserIds: Set<string>;
  private readonly allowedChannelIds: Set<string>;
  private readonly publicServerMode: boolean;
  private readonly requireOwnerForOperational: boolean;
  private readonly blockMassMentions: boolean;
  private readonly maxLinksPerMessage: number;
  private readonly allowAttachmentsInPublicServerMode: boolean;
  private readonly maxMessageChars: number;
  private readonly rateLimitWindowMs: number;
  private readonly rateLimitMaxRequests: number;
  private readonly now: () => number;
  private readonly rateLimitEvents = new Map<string, number[]>();

  constructor(options: DiscordSurfacePolicyOptions = {}) {
    this.commandExposure = options.commandExposure || config.discordCommandExposure;
    this.ownerUserIds = new Set(
      (options.ownerUserIds || config.discordOwnerUserIds).map((entry) => String(entry || '').trim()).filter(Boolean),
    );
    this.operatorUserIds = new Set(
      (options.operatorUserIds || config.discordOperatorUserIds)
        .map((entry) => String(entry || '').trim())
        .filter(Boolean),
    );
    this.allowedChannelIds = new Set(
      (options.allowedChannelIds || config.discordAllowedChannelIds)
        .map((entry) => String(entry || '').trim())
        .filter(Boolean),
    );
    this.publicServerMode = options.publicServerMode ?? config.discordPublicServerMode;
    this.requireOwnerForOperational = options.requireOwnerForOperational ?? config.discordRequireOwnerForOperational;
    this.blockMassMentions = options.blockMassMentions ?? config.discordBlockMassMentions;
    const resolvedMaxLinks =
      options.maxLinksPerMessage !== undefined
        ? Number(options.maxLinksPerMessage)
        : Number(config.discordMaxLinksPerMessage || 0);
    this.maxLinksPerMessage = Number.isFinite(resolvedMaxLinks) ? Math.max(0, resolvedMaxLinks) : 0;
    this.allowAttachmentsInPublicServerMode =
      options.allowAttachmentsInPublicServerMode ?? config.discordAllowAttachmentsInPublicServerMode;
    const resolvedMaxMessageChars =
      options.maxMessageChars !== undefined
        ? Number(options.maxMessageChars)
        : Number(config.discordMaxMessageChars || 0);
    this.maxMessageChars = Number.isFinite(resolvedMaxMessageChars) ? Math.max(0, resolvedMaxMessageChars) : 0;
    const resolvedRateLimitWindowMs =
      options.rateLimitWindowMs !== undefined
        ? Number(options.rateLimitWindowMs)
        : Number(config.discordRateLimitWindowMs || 0);
    this.rateLimitWindowMs = Number.isFinite(resolvedRateLimitWindowMs) ? Math.max(0, resolvedRateLimitWindowMs) : 0;
    const resolvedRateLimitMaxRequests =
      options.rateLimitMaxRequests !== undefined
        ? Number(options.rateLimitMaxRequests)
        : Number(config.discordRateLimitMaxRequests || 0);
    this.rateLimitMaxRequests = Number.isFinite(resolvedRateLimitMaxRequests)
      ? Math.max(0, resolvedRateLimitMaxRequests)
      : 0;
    this.now = options.now || (() => Date.now());
  }

  public getCommandExposure(): DiscordCommandExposure {
    return this.commandExposure;
  }

  public getAllowedChannelIds(): string[] {
    return [...this.allowedChannelIds];
  }

  public getOwnerUserIds(): string[] {
    return [...this.ownerUserIds];
  }

  public isPublicServerMode(): boolean {
    return this.publicServerMode;
  }

  public getBlockMassMentions(): boolean {
    return this.blockMassMentions;
  }

  public getMaxLinksPerMessage(): number {
    return this.maxLinksPerMessage;
  }

  public requiresOwnerForOperational(): boolean {
    return this.requireOwnerForOperational;
  }

  public shouldRegisterSlashCommands(): boolean {
    if (this.commandExposure === 'none') {
      return false;
    }

    if (this.publicServerMode && this.allowedChannelIds.size === 0) {
      return false;
    }

    return true;
  }

  public buildSlashCommandNames(): string[] {
    if (this.commandExposure === 'none') {
      return [];
    }

    if (this.publicServerMode) {
      return [...MINIMAL_SLASH_COMMANDS];
    }

    if (this.commandExposure === 'minimal') {
      return [...MINIMAL_SLASH_COMMANDS];
    }

    return [...MINIMAL_SLASH_COMMANDS, ...OPERATOR_SLASH_COMMANDS];
  }

  public isOperationalCommand(commandType: string): boolean {
    return DISCORD_OPERATIONAL_COMMANDS.has(
      String(commandType || '')
        .trim()
        .toLowerCase(),
    );
  }

  public isOperator(userId: string): boolean {
    return this.operatorUserIds.has(String(userId || '').trim());
  }

  public isOwner(userId: string): boolean {
    return this.ownerUserIds.has(String(userId || '').trim());
  }

  public canUseOperationalCommand(
    userId: string,
    options: {
      isDirectMessage?: boolean;
    } = {},
  ): boolean {
    if (this.publicServerMode) {
      return this.isOwner(userId) && options.isDirectMessage === true;
    }

    if (this.isOwner(userId)) {
      return true;
    }

    if (this.requireOwnerForOperational) {
      return false;
    }

    return this.isOperator(userId);
  }

  public shouldBypassPublicRateLimit(userId: string): boolean {
    return this.isOwner(userId);
  }

  public isChannelAllowed(channelId: string, parentChannelId?: string | null): boolean {
    if (this.allowedChannelIds.size === 0) {
      return true;
    }

    const normalizedChannelId = String(channelId || '').trim();
    const normalizedParentChannelId = String(parentChannelId || '').trim();
    return (
      (normalizedChannelId.length > 0 && this.allowedChannelIds.has(normalizedChannelId)) ||
      (normalizedParentChannelId.length > 0 && this.allowedChannelIds.has(normalizedParentChannelId))
    );
  }

  public validateInboundMessage(input: {
    userId?: string | null;
    channelId: string;
    parentChannelId?: string | null;
    rawText: string;
    isDirectMessage?: boolean;
    attachmentsCount?: number;
  }): { valid: true } | { valid: false; reason: string } {
    if (!input.isDirectMessage && this.publicServerMode && this.allowedChannelIds.size === 0) {
      return {
        valid: false,
        reason:
          'Discord is in public server mode and requires DISCORD_ALLOWED_CHANNEL_IDS before accepting traffic.',
      };
    }

    if (!input.isDirectMessage && !this.isChannelAllowed(input.channelId, input.parentChannelId)) {
      return {
        valid: false,
        reason: this.formatChannelDenied(),
      };
    }

    const rawText = String(input.rawText || '').trim();
    if (
      this.maxMessageChars > 0 &&
      rawText.length > this.maxMessageChars &&
      !this.isOwner(String(input.userId || ''))
    ) {
      return {
        valid: false,
        reason: `This message exceeds the safe limit for this Discord channel. Current limit: ${this.maxMessageChars} characters.`,
      };
    }

    if (
      this.publicServerMode &&
      !this.allowAttachmentsInPublicServerMode &&
      Number(input.attachmentsCount || 0) > 0 &&
      !this.isOwner(String(input.userId || ''))
    ) {
      return {
        valid: false,
        reason: 'Attachments are blocked by default on this runtime public Discord.',
      };
    }

    if (!input.isDirectMessage && this.blockMassMentions && /@(?:everyone|here)\b/i.test(rawText)) {
      return {
        valid: false,
        reason: 'Messages with @everyone or @here are blocked on this Discord server.',
      };
    }

    if (!input.isDirectMessage && this.maxLinksPerMessage > 0) {
      const linkCount = rawText.match(URL_PATTERN)?.length || 0;
      if (linkCount > this.maxLinksPerMessage) {
        return {
          valid: false,
          reason: `This message has too many links for this Discord channel. Current limit: ${this.maxLinksPerMessage}.`,
        };
      }
    }

    if (this.shouldRateLimit(String(input.userId || '').trim())) {
      return {
        valid: false,
        reason: 'You reached the temporary limit for this Discord channel. Wait a bit before trying again.',
      };
    }

    return { valid: true };
  }

  public formatChannelDenied(): string {
    return 'This Discord channel is not enabled for Zavorth. Use an operator-allowlisted channel.';
  }

  public formatOperationalCommandDenied(): string {
    return 'This operational command is not exposed in this Discord channel. Use Telegram, the authenticated web surface, or an owner-only Discord DM.';
  }

  private shouldRateLimit(userId: string): boolean {
    if (!userId || this.rateLimitWindowMs <= 0 || this.rateLimitMaxRequests <= 0) {
      return false;
    }

    if (this.shouldBypassPublicRateLimit(userId)) {
      return false;
    }

    const now = this.now();
    const windowStart = now - this.rateLimitWindowMs;
    const entries = (this.rateLimitEvents.get(userId) || []).filter((timestamp) => timestamp >= windowStart);
    entries.push(now);
    this.rateLimitEvents.set(userId, entries);
    return entries.length > this.rateLimitMaxRequests;
  }
}
