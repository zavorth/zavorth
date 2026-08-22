import type {
  TenantBoundary,
  TenantContext,
  TenantContextCreateInput,
  TenantIsolationMode,
  TenantOnboardingContext,
  TenantOnboardingStatus,
  TenantType,
} from './TenantContextTypes.js';

export function asTenantContextRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function optionalTenantString(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

export function normalizeTenantStringArray(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  return Array.from(
    new Set(
      values
        .map((entry) => String(entry || '').trim())
        .filter(Boolean),
    ),
  );
}

export function normalizeTenantPlatform(platform: unknown, chatId: string | null | undefined): string {
  const normalized = String(platform || '').trim().toLowerCase();
  if (normalized) {
    return normalized;
  }

  const chat = String(chatId || '').trim().toLowerCase();
  if (chat.startsWith('discord:')) {
    return 'discord';
  }
  if (chat.startsWith('web:')) {
    return 'web';
  }
  if (chat.startsWith('whatsapp:')) {
    return 'whatsapp';
  }
  if (chat.startsWith('cli:')) {
    return 'cli';
  }
  return 'telegram';
}

export function extractWebSessionId(chatId: string): string | null {
  const normalized = String(chatId || '').trim();
  if (!normalized.toLowerCase().startsWith('web:')) {
    return null;
  }
  return optionalTenantString(normalized.substring(4));
}

export function normalizeTenantType(value: unknown): TenantType {
  const normalized = String(value || '').trim().toLowerCase();
  switch (normalized) {
    case 'discord_guild':
    case 'discord_dm':
    case 'telegram_group':
    case 'telegram_private':
    case 'web_session':
    case 'whatsapp_group':
    case 'whatsapp_private':
    case 'cli_session':
      return normalized;
    default:
      return 'unknown';
  }
}

export function normalizeTenantBoundary(value: unknown): TenantBoundary {
  return String(value || '').trim().toLowerCase() === 'shared' ? 'shared' : 'personal';
}

export function normalizeTenantIsolationMode(
  value: unknown,
  boundary: TenantBoundary,
): TenantIsolationMode {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'tenant' || normalized === 'internal' || normalized === 'private') {
    return normalized;
  }
  return boundary === 'shared' ? 'tenant' : 'private';
}

export function normalizeTenantOnboardingStatus(
  value: unknown,
  context: TenantOnboardingContext,
): TenantOnboardingStatus {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'internal' || normalized === 'ready' || normalized === 'pending_onboarding') {
    return normalized;
  }

  if (context.isolationMode === 'internal') {
    return 'internal';
  }

  if (context.boundary !== 'shared') {
    return 'internal';
  }

  const platform = String(context.platform || '').trim().toLowerCase();
  if (platform === 'discord') {
    if (context.publicServerMode) {
      if (!context.guildId) {
        return 'pending_onboarding';
      }
      if (context.allowedGuildIds.length > 0 && !context.allowedGuildIds.includes(context.guildId)) {
        return 'pending_onboarding';
      }
      if (context.allowedChannelIds.length === 0) {
        return 'pending_onboarding';
      }
      if (context.channelId && !context.allowedChannelIds.includes(context.channelId)) {
        return 'pending_onboarding';
      }
    }
    return 'ready';
  }

  return 'ready';
}

export function createTenantContext(input: TenantContextCreateInput): TenantContext {
  const normalizedIsolationMode = normalizeTenantIsolationMode(input.isolationMode, input.boundary);
  return {
    ...input,
    isolationMode: normalizedIsolationMode,
    onboardingStatus: normalizeTenantOnboardingStatus(input.onboardingStatus, {
      boundary: input.boundary,
      platform: input.platform,
      publicServerMode: input.publicServerMode === true,
      guildId: input.guildId,
      channelId: input.channelId,
      allowedGuildIds: input.allowedGuildIds,
      allowedChannelIds: input.allowedChannelIds,
      isolationMode: normalizedIsolationMode,
    }),
    publicServerMode: input.publicServerMode === true,
    chatId: input.chatId ?? input.channelId ?? input.scopeId ?? null,
    metadata: asTenantContextRecord(input.metadata),
  };
}

export function isSharedTenantBoundary(context: TenantContext | null | undefined): boolean {
  return context?.boundary === 'shared';
}

export function shouldIsolateTenantContext(context: TenantContext | null | undefined): boolean {
  if (!context?.tenantId) {
    return false;
  }
  return context.boundary === 'shared' || context.isolationMode === 'tenant';
}
