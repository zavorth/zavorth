import type { ChannelType } from 'discord.js';

import type { IMessageBroker, MessageAttachment } from '../../../contracts/IMessageBroker.js';
import type { LogRepository } from '../../../storage/LogRepository.js';
import type { DiscordSurfacePolicyService } from '../../../services/DiscordSurfacePolicyService.js';
import type { ZavorthAgentGateway } from '../../../runtime/agent/index.js';

export type DiscordGatewayRecentChannel = {
  channelId: string;
  guildId: string | null;
  authorId: string | null;
  isDirectMessage: boolean;
  observedAt: string;
};

export type DiscordGatewayState = {
  startedAt: string | null;
  processedCount: number;
  rejectedCount: number;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastRejectedAt: string | null;
  lastError: string | null;
  recentChannels: DiscordGatewayRecentChannel[];
};

export type DiscordGatewayStatusSnapshot = {
  mode: 'native';
  enabled: boolean;
  started: boolean;
  startedAt: string | null;
  updatedAt: string;
  allowDirectMessages: boolean;
  allowedGuildIds: string[];
  allowedChannelIds: string[];
  commandExposure: 'none' | 'minimal' | 'operator';
  publicServerMode: boolean;
  pendingInbox: number;
  pendingOutbox: number;
  processedCount: number;
  rejectedCount: number;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastRejectedAt: string | null;
  lastError: string | null;
  recentChannelCount: number;
};

export type DiscordGatewayMessageLike = {
  id?: string;
  author?: {
    id?: string;
    bot?: boolean;
  };
  channelId?: string;
  guildId?: string | null;
  content?: string | null;
  attachments?: unknown;
  channel?: {
    id?: string;
    parentId?: string | null;
    type?: ChannelType | number | string;
    send?: (payload: { content: string; allowedMentions?: { parse: string[] }; components?: unknown[] }) => Promise<unknown>;
    messages?: {
      fetch?: (messageId: string) => Promise<{
        edit?: (payload: { content: string; allowedMentions?: { parse: string[] }; components?: unknown[] }) => Promise<unknown>;
      } | null>;
    };
  };
  reply?: (payload: { content: string; allowedMentions?: { parse: string[] }; components?: unknown[] }) => Promise<unknown>;
};

export type DiscordGatewayInteractionLike = {
  isChatInputCommand?: () => boolean;
  isButton?: () => boolean;
  /** String select menu (type 3) interaction. */
  isStringSelectMenu?: () => boolean;
  customId?: string;
  /** Selected values from a string select menu. */
  values?: string[];
  message?: {
    id?: string | null;
  };
  commandName?: string;
  user?: {
    id?: string;
    bot?: boolean;
  };
  guildId?: string | null;
  channelId?: string;
  channel?: DiscordGatewayMessageLike['channel'];
  options?: {
    getString?: (name: string, required?: boolean) => string | null;
    getBoolean?: (name: string, required?: boolean) => boolean | null;
    getAttachment?: (name: string, required?: boolean) => unknown;
  };
  reply?: (payload: { content: string; allowedMentions?: { parse: string[] }; components?: unknown[] }) => Promise<unknown>;
  followUp?: (payload: { content: string; allowedMentions?: { parse: string[] }; components?: unknown[] }) => Promise<unknown>;
  editReply?: (payload: { content: string; allowedMentions?: { parse: string[] }; components?: unknown[] }) => Promise<unknown>;
  replied?: boolean;
  deferred?: boolean;
};

export type DiscordGatewayClientLike = {
  login(token: string): Promise<string>;
  destroy(): void;
  on(event: string, listener: (...args: never[]) => void): unknown;
  once(event: string, listener: (...args: never[]) => void): unknown;
  isReady?: () => boolean;
  user?: {
    id?: string;
    tag?: string;
  } | null;
  application?: {
    commands?: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      set?: (commands: Array<Record<string, any>>) => Promise<unknown>;
    };
  } | null;
  channels?: {
    fetch?: (channelId: string) => Promise<{
      send?: (payload: { content: string; allowedMentions?: { parse: string[] }; components?: unknown[] }) => Promise<unknown>;
    } | null>;
  };
  guilds?: {
    fetch?: (guildId: string) => Promise<{
      commands?: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        set?: (commands: Array<Record<string, any>>) => Promise<unknown>;
      };
    } | null>;
  };
};

export type DiscordGatewayOptions = {
  broker?: IMessageBroker;
  agentGateway?: Pick<ZavorthAgentGateway, 'handle'> | null;
  logRepo?: LogRepository | null;
  token?: string;
  enabled?: boolean;
  allowedGuildIds?: string[];
  allowDirectMessages?: boolean;
  stateFilePath?: string;
  statusFilePath?: string;
  readyTimeoutMs?: number;
  now?: () => Date;
  clientFactory?: () => DiscordGatewayClientLike;
  discordSurfacePolicyService?: DiscordSurfacePolicyService;
};

export type DiscordGatewayAttachment = MessageAttachment;

export const MAX_RECENT_CHANNELS = 20;
export const MAX_DISCORD_MESSAGE_LENGTH = 1900;
