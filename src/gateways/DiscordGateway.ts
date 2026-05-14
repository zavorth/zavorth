import path from 'path';
import { Client, GatewayIntentBits, Partials } from 'discord.js';

import { config } from '../config/index.js';
import { type LiveChannelBroadcastGatewayContract, PlatformKey } from '../contracts/PlatformContract.js';
import { DiscordSurfacePolicyService } from '../services/DiscordSurfacePolicyService.js';
import { chunkDiscordMessage } from './DiscordGatewayMessageHelpers.js';
import type {
  DiscordGatewayClientLike,
  DiscordGatewayInteractionLike,
  DiscordGatewayMessageLike,
  DiscordGatewayOptions,
  DiscordGatewayStatusSnapshot,
} from './DiscordGatewayTypes.js';
import { DiscordGatewayInboundService } from './discord-gateway/DiscordGatewayInboundService.js';
import { DiscordGatewayLifecycleService } from './discord-gateway/DiscordGatewayLifecycleService.js';
import { DiscordGatewayPersistence } from './discord-gateway/DiscordGatewayPersistence.js';
import { DiscordGatewayReplyService } from './discord-gateway/DiscordGatewayReplyService.js';

export type { DiscordGatewayStatusSnapshot } from './DiscordGatewayTypes.js';

export class DiscordGateway implements LiveChannelBroadcastGatewayContract {
  public readonly platform: PlatformKey = 'discord';
  public readonly supportsRoleAwareBroadcast = false;

  private readonly enabled: boolean;
  private readonly token: string;
  private readonly lifecycleService: DiscordGatewayLifecycleService;
  private readonly persistence: DiscordGatewayPersistence;
  private readonly inboundService: DiscordGatewayInboundService;
  private readonly logGatewayEvent: (level: 'info' | 'warn' | 'error', message: string) => void;
  private client: DiscordGatewayClientLike | null = null;
  private started = false;

  constructor(options: DiscordGatewayOptions = {}) {
    this.token = String(options.token ?? config.discordBotToken ?? '').trim();
    this.enabled = options.enabled ?? Boolean(this.token);

    const allowedGuildIds = Array.from(
      new Set(
        (options.allowedGuildIds || config.discordAllowedGuildIds)
          .map((entry) => String(entry || '').trim())
          .filter(Boolean),
      ),
    );
    const allowDirectMessages = options.allowDirectMessages ?? config.discordAllowDms;
    const stateFilePath = options.stateFilePath || config.discordBridgeStateFile;
    const statusFilePath = options.statusFilePath || config.discordBridgeStatusFile;
    const runtimeDir = path.dirname(stateFilePath);
    const now = options.now || (() => new Date());
    const readyTimeoutMs = Math.max(5_000, Number(options.readyTimeoutMs || 15_000));
    const discordSurfacePolicyService =
      options.discordSurfacePolicyService || new DiscordSurfacePolicyService();
    const clientFactory =
      options.clientFactory ||
      (() =>
        new Client({
          intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.MessageContent,
          ],
          partials: [Partials.Channel],
        }) as unknown as DiscordGatewayClientLike);

    this.logGatewayEvent = (level, message) => {
      options.logRepo?.log(level, 'DiscordGateway', message);
    };
    this.persistence = new DiscordGatewayPersistence({
      enabled: this.enabled,
      allowDirectMessages,
      allowedGuildIds,
      stateFilePath,
      statusFilePath,
      runtimeDir,
      now,
      getStarted: () => this.started,
      discordSurfacePolicyService,
      log: this.logGatewayEvent,
    });
    this.persistence.ensureRuntimeDirs();
    const replyService = new DiscordGatewayReplyService({
      persistence: this.persistence,
    });
    this.inboundService = new DiscordGatewayInboundService({
      broker: options.broker ?? null,
      agentGateway: options.agentGateway ?? null,
      allowDirectMessages,
      allowedGuildIds,
      discordSurfacePolicyService,
      persistence: this.persistence,
      replyService,
    });
    this.lifecycleService = new DiscordGatewayLifecycleService({
      token: this.token,
      readyTimeoutMs,
      allowDirectMessages,
      allowedGuildIds,
      clientFactory,
      discordSurfacePolicyService,
      log: this.logGatewayEvent,
    });

    this.persistence.writeStatus();
  }

  public async start(): Promise<void> {
    if (this.started || !this.enabled) {
      this.persistence.writeStatus();
      return;
    }

    if (!this.token) {
      this.persistence.recordError('Discord native gateway is enabled but DISCORD_BOT_TOKEN is missing.');
      return;
    }

    try {
      this.client = await this.lifecycleService.start({
        onClient: (client) => {
          this.client = client;
        },
        onReady: async (client) => {
          this.client = client;
          await this.handleReady(client);
        },
        onMessage: async (message) => {
          await this.inboundService.handleInboundMessage(message);
        },
        onInteraction: async (interaction) => {
          await this.inboundService.handleInteraction(interaction);
        },
        onRuntimeError: (message) => {
          this.persistence.recordError(message);
        },
        onWarn: (warning) => {
          this.logGatewayEvent('warn', `Discord warning: ${warning}`);
        },
        onDisconnect: (shardId) => {
          this.started = false;
          this.persistence.recordError(`Discord shard ${shardId} disconnected.`);
        },
      });
    } catch (error: any) {
      this.started = false;
      this.persistence.recordError(error?.message || 'Discord native gateway failed during login.');
      this.client?.destroy();
      this.client = null;
      throw error;
    }
  }

  public async stop(): Promise<void> {
    this.started = false;
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
    this.persistence.writeStatus();
  }

  public isStarted(): boolean {
    return this.started;
  }

  public async simulateIncomingMessage(message: DiscordGatewayMessageLike): Promise<void> {
    await this.inboundService.handleInboundMessage(message);
  }

  public async simulateInteraction(interaction: DiscordGatewayInteractionLike): Promise<void> {
    await this.inboundService.handleInteraction(interaction);
  }

  public getIdentityHints(): { linkedBy: string; verificationMethod: string } {
    return {
      linkedBy: 'discord-native-gateway',
      verificationMethod: 'discord-bot-token',
    };
  }

  public resolveBroadcastRecipients(roles: string[] = []): string[] {
    return this.persistence.resolveBroadcastRecipients(roles);
  }

  public async broadcast(message: string, roles: string[] = []): Promise<void> {
    const normalizedMessage = String(message || '').trim();
    if (!normalizedMessage || !this.started || !this.client?.channels?.fetch) {
      return;
    }

    for (const channelId of this.resolveBroadcastRecipients(roles)) {
      try {
        const channel = await this.client.channels.fetch(channelId);
        if (!channel?.send) {
          continue;
        }

        for (const chunk of chunkDiscordMessage(normalizedMessage)) {
          await channel.send({
            content: chunk,
            allowedMentions: { parse: [] },
          });
        }

        this.persistence.markOutbound();
      } catch (error: any) {
        this.persistence.recordError(
          `Discord native broadcast failed for channel ${channelId}: ${error?.message || error}`,
        );
      }
    }

    this.persistence.writeStatus();
  }

  public readStatus(): DiscordGatewayStatusSnapshot | null {
    return this.persistence.readStatus();
  }

  private async handleReady(client: DiscordGatewayClientLike): Promise<void> {
    if (this.started) {
      return;
    }

    this.started = true;
    this.persistence.markReady();
    await this.lifecycleService.registerSlashCommands(client);
    this.persistence.writeStatus();
    this.logGatewayEvent(
      'info',
      `Discord native gateway online${client.user?.tag ? ` as ${client.user.tag}` : ''}.`,
    );
  }
}
