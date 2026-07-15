import { ApplicationCommandOptionType, Events } from 'discord.js';
import type { DiscordSurfacePolicyService } from '../../../../services/DiscordSurfacePolicyService.js';
import { getDiscordSlashCommandManifest } from '../../../../services/SharedSurfaceCommandContract.js';
import type {
  DiscordGatewayClientLike,
  DiscordGatewayInteractionLike,
  DiscordGatewayMessageLike,
} from '../DiscordGatewayTypes.js';
import { errorMessage } from '../../../../utils/errorLike.js';
type DiscordGatewayLogLevel = 'info' | 'warn' | 'error';

type DiscordGatewayLifecycleOptions = {
  token: string;
  readyTimeoutMs: number;
  allowDirectMessages: boolean;
  allowedGuildIds: string[];
  clientFactory: () => DiscordGatewayClientLike;
  discordSurfacePolicyService: DiscordSurfacePolicyService;
  log?: (level: DiscordGatewayLogLevel, message: string) => void;
};

type DiscordGatewayLifecycleCallbacks = {
  onClient?: (client: DiscordGatewayClientLike) => void;
  onReady: (client: DiscordGatewayClientLike) => Promise<void>;
  onMessage: (message: DiscordGatewayMessageLike) => Promise<void>;
  onInteraction: (interaction: DiscordGatewayInteractionLike) => Promise<void>;
  onRuntimeError: (message: string) => void;
  onWarn?: (warning: string) => void;
  onDisconnect: (shardId: number) => void;
};

export class DiscordGatewayLifecycleService {
  private readonly token: string;
  private readonly readyTimeoutMs: number;
  private readonly allowDirectMessages: boolean;
  private readonly allowedGuildIds: string[];
  private readonly clientFactory: () => DiscordGatewayClientLike;
  private readonly discordSurfacePolicyService: DiscordSurfacePolicyService;
  private readonly log?: (level: DiscordGatewayLogLevel, message: string) => void;

  constructor(options: DiscordGatewayLifecycleOptions) {
    this.token = options.token;
    this.readyTimeoutMs = options.readyTimeoutMs;
    this.allowDirectMessages = options.allowDirectMessages;
    this.allowedGuildIds = [...options.allowedGuildIds];
    this.clientFactory = options.clientFactory;
    this.discordSurfacePolicyService = options.discordSurfacePolicyService;
    this.log = options.log;
  }

  public async start(callbacks: DiscordGatewayLifecycleCallbacks): Promise<DiscordGatewayClientLike> {
    const client = this.clientFactory();
    callbacks.onClient?.(client);

    let readyHandled = false;
    let settled = false;
    let readyTimer: NodeJS.Timeout | null = null;

    const readyPromise = new Promise<void>((resolve, reject) => {
      readyTimer = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        reject(new Error(`Discord native gateway timed out while waiting for READY after ${this.readyTimeoutMs} ms.`));
      }, this.readyTimeoutMs);

      client.once(Events.ClientReady, async () => {
        if (settled || readyHandled) {
          return;
        }
        try {
          readyHandled = true;
          settled = true;
          if (readyTimer) {
            clearTimeout(readyTimer);
          }
          await callbacks.onReady(client);
          resolve();
        } catch (error: unknown) {
          if (readyTimer) {
            clearTimeout(readyTimer);
          }
          reject(error);
        }
      });
    });

    this.attachEventHandlers(client, callbacks);

    try {
      await client.login(this.token);
      if (client.isReady?.() && !readyHandled) {
        readyHandled = true;
        settled = true;
        if (readyTimer) {
          clearTimeout(readyTimer);
        }
        await callbacks.onReady(client);
      } else {
        await readyPromise;
      }
      return client;
    } catch (error: unknown) {
      if (readyTimer) {
        clearTimeout(readyTimer);
      }
      client.destroy();
      throw error;
    }
  }

  public async registerSlashCommands(client: DiscordGatewayClientLike): Promise<void> {
    if (!this.discordSurfacePolicyService.shouldRegisterSlashCommands()) {
      this.log?.(
        'info',
        this.discordSurfacePolicyService.isPublicServerMode() &&
          this.discordSurfacePolicyService.getAllowedChannelIds().length === 0
          ? 'Discord slash commands are disabled until DISCORD_ALLOWED_CHANNEL_IDS is configured for public-server mode.'
          : 'Discord slash commands are disabled by policy for this runtime.',
      );
      return;
    }

    const commands = this.buildSlashCommands();
    let registered = false;

    if (this.allowedGuildIds.length > 0 && client.guilds?.fetch) {
      for (const guildId of this.allowedGuildIds) {
        try {
          const guild = await client.guilds.fetch(guildId);
          if (!guild?.commands?.set) {
            continue;
          }
          await guild.commands.set(commands);
          registered = true;
        } catch (error: unknown) {
          this.log?.(
            'warn',
            `Discord native gateway could not register guild slash commands for ${guildId}: ${errorMessage(error)}`,
          );
        }
      }
    }

    const applicationCommands = client.application?.commands;
    const globalCommandSetter =
      this.allowedGuildIds.length === 0 && applicationCommands?.set
        ? applicationCommands.set.bind(applicationCommands)
        : null;

    if (!registered && globalCommandSetter) {
      await globalCommandSetter(commands);
      registered = true;
    }

    if (!registered) {
      this.log?.(
        'warn',
        this.allowedGuildIds.length > 0
          ? 'Discord native gateway skipped global slash registration because this runtime is pinned to specific guild allowlists.'
          : 'Discord native gateway could not register slash commands because the application command API is unavailable.',
      );
    }
  }

  private buildSlashCommands(): Array<Record<string, any>> {
    const manifest = getDiscordSlashCommandManifest({
      commandExposure: this.discordSurfacePolicyService.getCommandExposure(),
      publicServerMode: this.discordSurfacePolicyService.isPublicServerMode(),
    });

    return manifest.map((command) => {
      const normalizedName = String(command.discordSlashName || '')
        .trim()
        .toLowerCase();
      const isOperationalCommand = this.discordSurfacePolicyService.isOperationalCommand(command.commandType);
      return {
        name: normalizedName,
        description: command.description || 'Shared Zavorth command.',
        options: (command.options || []).map((option) => ({
          ...option,
          type:
            option.type === 'boolean'
              ? ApplicationCommandOptionType.Boolean
              : option.type === 'attachment'
                ? ApplicationCommandOptionType.Attachment
                : ApplicationCommandOptionType.String,
        })),
        dm_permission: this.allowDirectMessages,
        default_member_permissions: isOperationalCommand ? '0' : undefined,
      };
    });
  }

  private attachEventHandlers(client: DiscordGatewayClientLike, callbacks: DiscordGatewayLifecycleCallbacks): void {
    client.on(Events.MessageCreate, (message: unknown) => {
      void callbacks.onMessage(message as DiscordGatewayMessageLike).catch((error: unknown) => {
        callbacks.onRuntimeError(
          errorMessage(error, 'Discord native gateway failed while handling an inbound message.'),
        );
      });
    });

    client.on(Events.InteractionCreate, (interaction: unknown) => {
      void callbacks.onInteraction(interaction as DiscordGatewayInteractionLike).catch((error: unknown) => {
        callbacks.onRuntimeError(errorMessage(error, 'Discord native gateway failed while handling an interaction.'));
      });
    });

    client.on(Events.Error, (error: Error) => {
      callbacks.onRuntimeError(errorMessage(error, 'Discord native gateway runtime error.'));
    });

    client.on(Events.Warn, (warning: string) => {
      if (callbacks.onWarn) {
        callbacks.onWarn(warning);
        return;
      }
      this.log?.('warn', `Discord warning: ${warning}`);
    });

    client.on(Events.ShardDisconnect, (_event: unknown, shardId: number) => {
      callbacks.onDisconnect(shardId);
    });
  }
}
