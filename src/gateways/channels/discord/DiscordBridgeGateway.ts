import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../../../config/index.js';
import { IMessageBroker } from '../../../contracts/IMessageBroker.js';
import { type LiveChannelBroadcastGatewayContract, PlatformKey } from '../../../contracts/PlatformContract.js';
import type { ZavorthAgentGateway } from '../../../runtime/agent/index.js';
import { LogRepository } from '../../../storage/LogRepository.js';
import { logger } from '../../../logger.js';

const DISCORD_BRIDGE_PROTOCOL = 'ZAVORTH_DISCORD_BRIDGE_V1' as const;
const MAX_PROCESSED_MESSAGE_IDS = 300;

export interface DiscordBridgeInboundEnvelope {
  protocol: typeof DISCORD_BRIDGE_PROTOCOL;
  eventId: string;
  createdAt: string;
  author: {
    id: string;
    username?: string | null;
    displayName?: string | null;
  };
  channel: {
    id: string;
    guildId?: string | null;
    name?: string | null;
    type?: 'guild_text' | 'dm' | string | null;
  };
  message: {
    id: string;
    content: string;
    attachments?: Array<Record<string, unknown>>;
  };
  metadata?: Record<string, unknown>;
  signature: string;
}

export interface DiscordBridgeOutboundEnvelope {
  protocol: typeof DISCORD_BRIDGE_PROTOCOL;
  eventId: string;
  createdAt: string;
  kind: 'reply' | 'edit' | 'broadcast';
  target: {
    chatId: string;
    channelId: string | null;
    guildId: string | null;
    messageId: string | null;
    roles?: string[];
  };
  payload: {
    text: string;
    components?: unknown[];
  };
  correlation?: {
    inboundEventId?: string | null;
    inboundMessageId?: string | null;
  };
  metadata?: Record<string, unknown>;
}

type DiscordBridgeState = {
  startedAt: string | null;
  processedCount: number;
  rejectedCount: number;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastRejectedAt: string | null;
  lastError: string | null;
  processedMessageIds: Array<{ messageId: string; processedAt: string }>;
};

export type DiscordBridgeStatusSnapshot = {
  mode: 'bridge';
  enabled: boolean;
  started: boolean;
  startedAt: string | null;
  updatedAt: string;
  allowDirectMessages: boolean;
  allowedGuildIds: string[];
  pendingInbox: number;
  pendingOutbox: number;
  processedCount: number;
  rejectedCount: number;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastRejectedAt: string | null;
  lastError: string | null;
};

type DiscordBridgeGatewayOptions = {
  broker?: IMessageBroker;
  agentGateway?: Pick<ZavorthAgentGateway, 'handle'> | null;
  logRepo?: LogRepository | null;
  enabled?: boolean;
  secret?: string;
  secretFilePath?: string;
  inboxDir?: string;
  processedDir?: string;
  rejectedDir?: string;
  outboxDir?: string;
  stateFilePath?: string;
  statusFilePath?: string;
  allowedGuildIds?: string[];
  allowDirectMessages?: boolean;
  pollIntervalMs?: number;
  maxAgeMs?: number;
  maxTextLength?: number;
  now?: () => Date;
};

export function signDiscordBridgeEnvelope(
  secret: string,
  envelope: Omit<DiscordBridgeInboundEnvelope, 'signature'>,
): string {
  const canonical = [
    `protocol=${envelope.protocol}`,
    `eventId=${envelope.eventId}`,
    `createdAt=${envelope.createdAt}`,
    `authorId=${envelope.author.id}`,
    `channelId=${envelope.channel.id}`,
    `guildId=${String(envelope.channel.guildId || '')}`,
    `messageId=${envelope.message.id}`,
    `content=${envelope.message.content}`,
  ].join('\n');

  return crypto.createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');
}

export class DiscordBridgeGateway implements LiveChannelBroadcastGatewayContract {
  public readonly platform: PlatformKey = 'discord';
  public readonly supportsRoleAwareBroadcast = true;

  private broker: IMessageBroker | null;
  private readonly agentGateway: Pick<ZavorthAgentGateway, 'handle'> | null;
  private readonly logRepo: LogRepository | null;
  private readonly enabled: boolean;
  private readonly secret: string;
  private readonly secretFilePath: string;
  private readonly inboxDir: string;
  private readonly processedDir: string;
  private readonly rejectedDir: string;
  private readonly outboxDir: string;
  private readonly stateFilePath: string;
  private readonly statusFilePath: string;
  private readonly runtimeDir: string;
  private readonly allowedGuildIds: string[];
  private readonly allowDirectMessages: boolean;
  private readonly pollIntervalMs: number;
  private readonly maxAgeMs: number;
  private readonly maxTextLength: number;
  private readonly now: () => Date;
  private started = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private processing = false;

  constructor(options: DiscordBridgeGatewayOptions = {}) {
    this.broker = options.broker ?? null;
    this.agentGateway = options.agentGateway ?? null;
    this.logRepo = options.logRepo ?? null;
    this.enabled = options.enabled ?? config.discordBridgeEnabled;
    this.secretFilePath = options.secretFilePath || config.discordBridgeSecretFile;
    this.secret = this.enabled
      ? (options.secret || DiscordBridgeGateway.resolveSecret(this.secretFilePath))
      : String(options.secret || process.env.DISCORD_BRIDGE_SECRET || '').trim();
    this.inboxDir = options.inboxDir || config.discordBridgeInboxDir;
    this.processedDir = options.processedDir || config.discordBridgeProcessedDir;
    this.rejectedDir = options.rejectedDir || config.discordBridgeRejectedDir;
    this.outboxDir = options.outboxDir || config.discordBridgeOutboxDir;
    this.stateFilePath = options.stateFilePath || config.discordBridgeStateFile;
    this.statusFilePath = options.statusFilePath || config.discordBridgeStatusFile;
    this.runtimeDir = path.dirname(this.stateFilePath);
    this.allowedGuildIds = Array.from(
      new Set((options.allowedGuildIds || config.discordAllowedGuildIds).map((item) => String(item || '').trim()).filter(Boolean)),
    );
    this.allowDirectMessages = options.allowDirectMessages ?? config.discordBridgeAllowDms;
    this.pollIntervalMs = Math.max(500, options.pollIntervalMs ?? config.discordBridgePollIntervalMs);
    this.maxAgeMs = Math.max(30_000, options.maxAgeMs ?? config.discordBridgeMaxAgeMs);
    this.maxTextLength = Math.max(50, options.maxTextLength ?? config.discordBridgeMaxTextLength);
    this.now = options.now || (() => new Date());

    for (const dir of [this.inboxDir, this.processedDir, this.rejectedDir, this.outboxDir, this.runtimeDir]) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.writeStatus();
  }

  public static resolveSecret(secretFilePath: string = config.discordBridgeSecretFile): string {
    const explicitSecret = String(process.env.DISCORD_BRIDGE_SECRET || '').trim();
    if (explicitSecret) {
      return explicitSecret;
    }

    const filePath = String(secretFilePath || '').trim() || config.discordBridgeSecretFile;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, crypto.randomBytes(32).toString('hex'), 'utf8');
    }

    const fileSecret = fs.readFileSync(filePath, 'utf8').trim();
    if (fileSecret) {
      return fileSecret;
    }

    const regenerated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(filePath, regenerated, 'utf8');
    return regenerated;
  }

  public attachBroker(broker: IMessageBroker): void {
    this.broker = broker;
  }

  public getIdentityHints(): { linkedBy: string; verificationMethod: string } {
    return {
      linkedBy: 'discord-bridge',
      verificationMethod: 'discord-bridge-signature',
    };
  }

  public async start(): Promise<void> {
    if (this.started || !this.enabled) {
      this.writeStatus();
      return;
    }

    this.started = true;
    this.patchState((state) => ({
      ...state,
      startedAt: state.startedAt || this.now().toISOString(),
      lastError: null,
    }));
    this.writeStatus();
    await this.processInboxOnce();
    this.timer = setInterval(() => {
      void this.processInboxOnce();
    }, this.pollIntervalMs);
    this.timer.unref?.();
  }

  public async stop(): Promise<void> {
    this.started = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.writeStatus();
  }

  public isStarted(): boolean {
    return this.started;
  }

  public readStatus(): DiscordBridgeStatusSnapshot | null {
    if (!fs.existsSync(this.statusFilePath)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(this.statusFilePath, 'utf8')) as DiscordBridgeStatusSnapshot;
    } catch (error) { logger.warn('[Discord Bridge way] JSON parse failed', error); return null; }
  }

  public async processInboxOnce(): Promise<void> {
    if (!this.enabled) {
      this.writeStatus();
      return;
    }
    if (this.processing) {
      return;
    }

    this.processing = true;
    try {
      const files = fs.readdirSync(this.inboxDir)
        .filter((entry) => entry.toLowerCase().endsWith('.json'))
        .sort((left, right) => left.localeCompare(right));

      for (const fileName of files) {
        await this.processInboxFile(path.join(this.inboxDir, fileName));
      }
    } finally {
      this.processing = false;
      this.writeStatus();
    }
  }

  public async ingestEnvelope(
    envelope: DiscordBridgeInboundEnvelope,
  ): Promise<{ accepted: true; chatId: string } | { accepted: false; reason: string }> {
    if (!this.enabled) {
      return { accepted: false, reason: 'Discord bridge is disabled.' };
    }
    if (!this.broker) {
      return { accepted: false, reason: 'Discord bridge has no broker attached.' };
    }

    const validation = this.validateEnvelope(envelope);
    if (!validation.valid) {
      this.patchState((state) => ({
        ...state,
        rejectedCount: state.rejectedCount + 1,
        lastRejectedAt: this.now().toISOString(),
        lastError: validation.reason,
      }));
      this.writeStatus();
      return { accepted: false, reason: validation.reason };
    }

    if (this.hasProcessedMessageId(envelope.message.id)) {
      const reason = `Discord bridge rejected replay for message ${envelope.message.id}.`;
      this.patchState((state) => ({
        ...state,
        rejectedCount: state.rejectedCount + 1,
        lastRejectedAt: this.now().toISOString(),
        lastError: reason,
      }));
      this.writeStatus();
      return { accepted: false, reason };
    }

    const chatId = this.buildChatId(envelope);
    try {
      if (await this.tryHandleNaturalMessageThroughAgentGateway(envelope, chatId)) {
        this.markProcessedEnvelope(envelope);
        return { accepted: true, chatId };
      }

      await this.broker.processMessage({
        platform: 'discord',
        userId: envelope.author.id,
        chatId,
        isGroup: Boolean(envelope.channel.guildId),
        rawText: String(envelope.message.content || '').trim(),
        reply: async (text: string, options?: any) => {
          await this.queueOutbound({
            protocol: DISCORD_BRIDGE_PROTOCOL,
            eventId: crypto.randomUUID(),
            createdAt: this.now().toISOString(),
            kind: 'reply',
            target: {
              chatId,
              channelId: envelope.channel.id,
              guildId: String(envelope.channel.guildId || '').trim() || null,
              messageId: envelope.message.id,
            },
            payload: {
              text: String(text || '').trim(),
              ...(Array.isArray(options?.components) && options.components.length > 0
                ? { components: options.components }
                : {}),
            },
            correlation: {
              inboundEventId: envelope.eventId,
              inboundMessageId: envelope.message.id,
            },
            metadata: {
              authorId: envelope.author.id,
            },
          });
        },
        editMessage: async (messageId: string, text: string) => {
          await this.queueOutbound({
            protocol: DISCORD_BRIDGE_PROTOCOL,
            eventId: crypto.randomUUID(),
            createdAt: this.now().toISOString(),
            kind: 'edit',
            target: {
              chatId,
              channelId: envelope.channel.id,
              guildId: String(envelope.channel.guildId || '').trim() || null,
              messageId: String(messageId || '').trim() || envelope.message.id,
            },
            payload: {
              text: String(text || '').trim(),
            },
            correlation: {
              inboundEventId: envelope.eventId,
              inboundMessageId: envelope.message.id,
            },
            metadata: {
              authorId: envelope.author.id,
            },
          });
        },
      });

      this.rememberProcessedMessageId(envelope.message.id);
      this.patchState((state) => ({
        ...state,
        processedCount: state.processedCount + 1,
        lastInboundAt: this.now().toISOString(),
        lastError: null,
      }));
      this.writeStatus();
      return { accepted: true, chatId };
    } catch (error: any) {
      const reason = error?.message || 'Discord bridge failed while delegating to the broker.';
      this.patchState((state) => ({
        ...state,
        rejectedCount: state.rejectedCount + 1,
        lastRejectedAt: this.now().toISOString(),
        lastError: reason,
      }));
      this.writeStatus();
      return { accepted: false, reason };
    }
  }

  public async broadcast(message: string, roles: string[] = []): Promise<void> {
    const normalizedMessage = String(message || '').trim();
    if (!normalizedMessage || !this.enabled || !this.started) {
      return;
    }

    await this.queueOutbound({
      protocol: DISCORD_BRIDGE_PROTOCOL,
      eventId: crypto.randomUUID(),
      createdAt: this.now().toISOString(),
      kind: 'broadcast',
      target: {
        chatId: 'discord:broadcast',
        channelId: null,
        guildId: null,
        messageId: null,
        roles: Array.from(new Set((roles || []).map((role) => String(role || '').trim()).filter(Boolean))),
      },
      payload: {
        text: normalizedMessage,
      },
    });
  }

  private async processInboxFile(filePath: string): Promise<void> {
    let outcome: { accepted: true; chatId: string } | { accepted: false; reason: string };
    try {
      const raw = await fs.promises.readFile(filePath, 'utf8');
      const envelope = JSON.parse(raw) as DiscordBridgeInboundEnvelope;
      outcome = await this.ingestEnvelope(envelope);
    } catch (error: any) {
      outcome = {
        accepted: false,
        reason: error?.message || 'Discord bridge failed while parsing the inbox envelope.',
      };
    }

    const destinationDir = outcome.accepted ? this.processedDir : this.rejectedDir;
    await this.moveFile(filePath, destinationDir);
    if (!outcome.accepted) {
      this.logRepo?.log('warn', 'DiscordBridgeGateway', outcome.reason);
    }
  }

  private async queueOutbound(envelope: DiscordBridgeOutboundEnvelope): Promise<void> {
    if (!String(envelope.payload.text || '').trim()) {
      return;
    }

    const filename = `${envelope.createdAt.replace(/[:.]/g, '-')}_${envelope.kind}_${envelope.eventId}.json`;
    await this.writeJsonAtomic(this.outboxDir, filename, envelope);
    this.patchState((state) => ({
      ...state,
      lastOutboundAt: this.now().toISOString(),
    }));
    this.writeStatus();
  }

  private async tryHandleNaturalMessageThroughAgentGateway(
    envelope: DiscordBridgeInboundEnvelope,
    chatId: string,
  ): Promise<boolean> {
    const text = String(envelope.message.content || '').trim();
    if (!this.agentGateway || !text || text.startsWith('/')) {
      return false;
    }
    if (envelope.channel.guildId && config.discordPublicServerMode) {
      return false;
    }

    const result = await this.agentGateway.handle({
      userId: envelope.author.id,
      channel: 'discord',
      sessionId: chatId,
      text,
      requestedTools: [],
      metadata: {
        transport: 'text',
        bridge: true,
        eventId: envelope.eventId,
        messageId: envelope.message.id,
        channelId: envelope.channel.id,
        guildId: String(envelope.channel.guildId || '').trim() || null,
        attachments: envelope.message.attachments || [],
        legacyUnifiedGatewayBypassed: true,
      },
    });

    const replyText = String(result.replies[0]?.text || result.run.summary || '').trim();
    if (replyText) {
      await this.queueOutbound({
        protocol: DISCORD_BRIDGE_PROTOCOL,
        eventId: crypto.randomUUID(),
        createdAt: this.now().toISOString(),
        kind: 'reply',
        target: {
          chatId,
          channelId: envelope.channel.id,
          guildId: String(envelope.channel.guildId || '').trim() || null,
          messageId: envelope.message.id,
        },
        payload: {
          text: replyText,
        },
        correlation: {
          inboundEventId: envelope.eventId,
          inboundMessageId: envelope.message.id,
        },
        metadata: {
          authorId: envelope.author.id,
          source: 'ZavorthAgentGateway',
        },
      });
    }
    return true;
  }

  private validateEnvelope(
    envelope: DiscordBridgeInboundEnvelope,
  ): { valid: true } | { valid: false; reason: string } {
    if (!envelope || typeof envelope !== 'object') {
      return { valid: false, reason: 'Discord bridge envelope is missing.' };
    }

    if (envelope.protocol !== DISCORD_BRIDGE_PROTOCOL) {
      return { valid: false, reason: `Discord bridge protocol mismatch: ${String(envelope.protocol || '')}` };
    }

    const createdAtMs = Date.parse(String(envelope.createdAt || ''));
    if (!Number.isFinite(createdAtMs)) {
      return { valid: false, reason: 'Discord bridge envelope has an invalid createdAt.' };
    }

    const ageMs = Date.now() - createdAtMs;
    if (ageMs < -60_000 || ageMs > this.maxAgeMs) {
      return { valid: false, reason: 'Discord bridge envelope expired or came from the future.' };
    }

    const { signature: _signature, ...unsignedEnvelope } = envelope;
    const expectedSignature = signDiscordBridgeEnvelope(this.secret, unsignedEnvelope);
    if (!this.safeCompare(String(envelope.signature || ''), expectedSignature)) {
      return { valid: false, reason: 'Discord bridge signature is invalid.' };
    }

    const authorId = String(envelope.author?.id || '').trim();
    const channelId = String(envelope.channel?.id || '').trim();
    const messageId = String(envelope.message?.id || '').trim();
    const content = String(envelope.message?.content || '').trim();
    if (!authorId || !channelId || !messageId || !content) {
      return { valid: false, reason: 'Discord bridge envelope is missing required fields.' };
    }

    if ((envelope.message.attachments || []).length > 0) {
      return { valid: false, reason: 'Discord bridge does not accept attachments in this first phase.' };
    }

    if (content.length > this.maxTextLength) {
      return { valid: false, reason: `Discord bridge text exceeds ${this.maxTextLength} characters.` };
    }

    const guildId = String(envelope.channel?.guildId || '').trim();
    if (!guildId && !this.allowDirectMessages) {
      return { valid: false, reason: 'Discord bridge direct messages are disabled.' };
    }

    if (guildId && this.allowedGuildIds.length > 0 && !this.allowedGuildIds.includes(guildId)) {
      return { valid: false, reason: `Discord bridge guild ${guildId} is not allowlisted.` };
    }

    return { valid: true };
  }

  private buildChatId(envelope: DiscordBridgeInboundEnvelope): string {
    const guildId = String(envelope.channel.guildId || '').trim();
    const channelId = String(envelope.channel.id || '').trim();
    if (guildId) {
      return `discord:guild:${guildId}:channel:${channelId}`;
    }
    return `discord:dm:${channelId}`;
  }

  private safeCompare(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(String(left || ''), 'utf8');
    const rightBuffer = Buffer.from(String(right || ''), 'utf8');
    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
  }

  private hasProcessedMessageId(messageId: string): boolean {
    const safeMessageId = String(messageId || '').trim();
    if (!safeMessageId) {
      return false;
    }

    return this.readState().processedMessageIds.some((entry) => entry.messageId === safeMessageId);
  }

  private rememberProcessedMessageId(messageId: string): void {
    const safeMessageId = String(messageId || '').trim();
    if (!safeMessageId) {
      return;
    }

    this.patchState((state) => ({
      ...state,
      processedMessageIds: [
        { messageId: safeMessageId, processedAt: this.now().toISOString() },
        ...state.processedMessageIds.filter((entry) => entry.messageId !== safeMessageId),
      ].slice(0, MAX_PROCESSED_MESSAGE_IDS),
    }));
  }

  private markProcessedEnvelope(envelope: DiscordBridgeInboundEnvelope): void {
    this.rememberProcessedMessageId(envelope.message.id);
    this.patchState((state) => ({
      ...state,
      processedCount: state.processedCount + 1,
      lastInboundAt: this.now().toISOString(),
      lastError: null,
    }));
    this.writeStatus();
  }

  private readState(): DiscordBridgeState {
    if (!fs.existsSync(this.stateFilePath)) {
      return {
        startedAt: null,
        processedCount: 0,
        rejectedCount: 0,
        lastInboundAt: null,
        lastOutboundAt: null,
        lastRejectedAt: null,
        lastError: null,
        processedMessageIds: [],
      };
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(this.stateFilePath, 'utf8')) as Partial<DiscordBridgeState>;
      return {
        startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : null,
        processedCount: Number(parsed.processedCount || 0) || 0,
        rejectedCount: Number(parsed.rejectedCount || 0) || 0,
        lastInboundAt: typeof parsed.lastInboundAt === 'string' ? parsed.lastInboundAt : null,
        lastOutboundAt: typeof parsed.lastOutboundAt === 'string' ? parsed.lastOutboundAt : null,
        lastRejectedAt: typeof parsed.lastRejectedAt === 'string' ? parsed.lastRejectedAt : null,
        lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
        processedMessageIds: Array.isArray(parsed.processedMessageIds)
          ? parsed.processedMessageIds
              .map((entry) => ({
                messageId: String((entry as any)?.messageId || '').trim(),
                processedAt: String((entry as any)?.processedAt || '').trim() || this.now().toISOString(),
              }))
              .filter((entry) => entry.messageId)
              .slice(0, MAX_PROCESSED_MESSAGE_IDS)
          : [],
      };
    } catch (error) {
    logger.warn('[Discord Bridge way] parsing failed', error);
    return {
        startedAt: null,
        processedCount: 0,
        rejectedCount: 0,
        lastInboundAt: null,
        lastOutboundAt: null,
        lastRejectedAt: null,
        lastError: null,
        processedMessageIds: [],
      };
  }
  }

  private patchState(mutator: (state: DiscordBridgeState) => DiscordBridgeState): DiscordBridgeState {
    const nextState = mutator(this.readState());
    fs.mkdirSync(path.dirname(this.stateFilePath), { recursive: true });
    fs.writeFileSync(this.stateFilePath, JSON.stringify(nextState, null, 2), 'utf8');
    return nextState;
  }

  private writeStatus(): DiscordBridgeStatusSnapshot {
    const state = this.readState();
    const snapshot: DiscordBridgeStatusSnapshot = {
      mode: 'bridge',
      enabled: this.enabled,
      started: this.started,
      startedAt: state.startedAt,
      updatedAt: this.now().toISOString(),
      allowDirectMessages: this.allowDirectMessages,
      allowedGuildIds: [...this.allowedGuildIds],
      pendingInbox: this.countJsonFiles(this.inboxDir),
      pendingOutbox: this.countJsonFiles(this.outboxDir),
      processedCount: state.processedCount,
      rejectedCount: state.rejectedCount,
      lastInboundAt: state.lastInboundAt,
      lastOutboundAt: state.lastOutboundAt,
      lastRejectedAt: state.lastRejectedAt,
      lastError: state.lastError,
    };

    fs.mkdirSync(path.dirname(this.statusFilePath), { recursive: true });
    fs.writeFileSync(this.statusFilePath, JSON.stringify(snapshot, null, 2), 'utf8');
    return snapshot;
  }

  private countJsonFiles(dir: string): number {
    if (!fs.existsSync(dir)) {
      return 0;
    }
    return fs.readdirSync(dir).filter((entry) => entry.toLowerCase().endsWith('.json')).length;
  }

  private async moveFile(filePath: string, destinationDir: string): Promise<void> {
    const baseName = path.basename(filePath);
    const destinationPath = path.join(destinationDir, baseName);
    await fs.promises.mkdir(destinationDir, { recursive: true });
    await fs.promises.rename(filePath, destinationPath).catch(async () => {
      const raw = await fs.promises.readFile(filePath);
      await fs.promises.writeFile(destinationPath, raw);
      await fs.promises.unlink(filePath).catch(() => undefined);
    });
  }

  private async writeJsonAtomic(dir: string, filename: string, payload: unknown): Promise<void> {
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.mkdir(this.runtimeDir, { recursive: true });
    const tmpPath = path.join(this.runtimeDir, `${filename}.tmp`);
    const finalPath = path.join(dir, filename);
    await fs.promises.writeFile(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
    await fs.promises.rename(tmpPath, finalPath);
  }
}
