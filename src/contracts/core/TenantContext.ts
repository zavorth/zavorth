export type TenantBoundary = 'personal' | 'shared';

export type TenantType =
  | 'discord_guild'
  | 'discord_dm'
  | 'telegram_group'
  | 'telegram_private'
  | 'web_session'
  | 'whatsapp_group'
  | 'whatsapp_private'
  | 'cli_session'
  | 'unknown';

export type TenantIsolationMode = 'tenant' | 'internal' | 'private';

export type TenantOnboardingStatus = 'internal' | 'ready' | 'pending_onboarding';

export type TenantPolicyProfile =
  | 'discord-public-guild'
  | 'discord-guild'
  | 'discord-dm'
  | 'telegram-group'
  | 'telegram-private'
  | 'web_operator'
  | 'whatsapp-group'
  | 'whatsapp-private'
  | 'cli-session'
  | 'runtime-default'
  | 'unknown';

export interface TenantContext {
  tenantId: string;
  tenantType: TenantType;
  boundary: TenantBoundary;
  isolationMode: TenantIsolationMode;
  onboardingStatus: TenantOnboardingStatus;
  platform: string;
  policyProfile: TenantPolicyProfile | string;
  publicServerMode: boolean;
  scopeId: string | null;
  sourceUserId: string | null;
  runtimeUserId: string | null;
  sessionId: string | null;
  guildId: string | null;
  channelId: string | null;
  threadId: string | null;
  chatId: string | null;
  ownerUserIds: string[];
  allowedGuildIds: string[];
  allowedChannelIds: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
}
