import type {
  TenantBoundary,
  TenantContext,
  TenantIsolationMode,
  TenantOnboardingStatus,
  TenantType,
} from '../../../../contracts/TenantContext.js';

export type TenantContextServiceOptions = {
  ownerUserIds?: string[];
  allowedGuildIds?: string[];
  allowedChannelIds?: string[];
};

export type TenantResolutionInput = {
  platform?: string | null;
  chatId?: string | null;
  sourceUserId?: string | null;
  runtimeUserId?: string | null;
  sessionId?: string | null;
  threadId?: string | null;
  composerPayload?: Record<string, any> | null;
  publicServerMode?: boolean | null;
};

export type TenantContextRuntime = {
  ownerUserIds: string[];
  allowedGuildIds: string[];
  allowedChannelIds: string[];
};

export type TenantContextCreateInput = Omit<
  TenantContext,
  'isolationMode' | 'onboardingStatus' | 'publicServerMode' | 'chatId' | 'metadata'
> &
  Partial<
    Pick<TenantContext, 'isolationMode' | 'onboardingStatus' | 'publicServerMode' | 'chatId' | 'metadata'>
  >;

export type TenantOnboardingContext = {
  boundary: TenantBoundary;
  platform: string;
  publicServerMode: boolean;
  guildId: string | null;
  channelId: string | null;
  allowedGuildIds: string[];
  allowedChannelIds: string[];
  isolationMode: TenantIsolationMode;
};

export type {
  TenantBoundary,
  TenantContext,
  TenantIsolationMode,
  TenantOnboardingStatus,
  TenantType,
};
