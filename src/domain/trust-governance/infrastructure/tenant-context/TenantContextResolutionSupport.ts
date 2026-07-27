import type { Task } from '../../../../contracts/TaskContract.js';
import type { TenantContext, TenantContextRuntime, TenantResolutionInput } from './TenantContextTypes.js';
import {
  asTenantContextRecord,
  createTenantContext,
  extractWebSessionId,
  normalizeTenantPlatform,
  optionalTenantString,
} from './TenantContextNormalizationSupport.js';
import { normalizeTenantContextRecord } from './TenantContextMetadataSupport.js';

const DISCORD_GUILD_CHAT_PATTERN = /^discord:guild:([^:]+):channel:([^:]+)(?::thread:([^:]+))...$/i;
const DISCORD_DM_CHAT_PATTERN = /^discord:dm:([^:]+)$/i;

export function resolveTenantContext(
  input: TenantResolutionInput,
  runtime: TenantContextRuntime,
): TenantContext | null {
  const platform = normalizeTenantPlatform(input.platform, input.chatId);
  const chatId = String(input.chatId || '').trim();
  const sourceUserId = optionalTenantString(input.sourceUserId);
  const runtimeUserId = optionalTenantString(input.runtimeUserId);
  const sessionId = optionalTenantString(input.sessionId);
  const threadId = optionalTenantString(input.threadId);
  const composerPayload = asTenantContextRecord(input.composerPayload);
  const publicServerMode = input.publicServerMode === true;

  switch (platform) {
    case 'discord':
      return resolveDiscordTenantContext(
        chatId,
        sourceUserId,
        runtimeUserId,
        sessionId,
        composerPayload,
        publicServerMode,
        runtime,
      );
    case 'telegram':
      return resolveTelegramTenantContext(chatId, sourceUserId, runtimeUserId, threadId);
    case 'web':
      return resolveWebTenantContext(chatId, sourceUserId, runtimeUserId, sessionId);
    case 'whatsapp':
      return resolveWhatsAppTenantContext(chatId, sourceUserId, runtimeUserId);
    case 'cli':
      return resolveCliTenantContext(chatId, sourceUserId, runtimeUserId, sessionId);
    default:
      break;
  }

  const fallbackId = sourceUserId || runtimeUserId || chatId;
  if (!fallbackId) {
    return null;
  }

  return createTenantContext({
    tenantId: `${platform || 'unknown'}:context:${fallbackId}`,
    tenantType: 'unknown',
    boundary: 'personal',
    platform: platform || 'unknown',
    policyProfile: 'runtime-default',
    scopeId: chatId || null,
    sourceUserId,
    runtimeUserId,
    sessionId,
    guildId: null,
    channelId: null,
    threadId: null,
    ownerUserIds: [],
    allowedGuildIds: [],
    allowedChannelIds: [],
    publicServerMode,
    chatId: chatId || null,
    metadata: {},
  });
}

export function resolveTenantContextFromTask(
  task: Task | null | undefined,
  runtime: TenantContextRuntime,
): TenantContext | null {
  if (!task) {
    return null;
  }

  const metadata = asTenantContextRecord(task.metadata);
  const existing = normalizeTenantContextRecord(metadata.tenant_context || metadata.tenantContext);
  if (existing) {
    return existing;
  }

  const surfaceIdentity = asTenantContextRecord(metadata.surface_identity);
  return resolveTenantContext(
    {
      platform: String(task.source || surfaceIdentity.source || '').trim() || null,
      chatId: String(task.chat_id || surfaceIdentity.chat_id || '').trim() || null,
      sourceUserId: String(surfaceIdentity.source_user_id || task.user_id || '').trim() || null,
      runtimeUserId: String(surfaceIdentity.runtime_user_id || metadata.runtime_user_id || task.user_id || '').trim() || null,
      sessionId: String(surfaceIdentity.session_id || '').trim() || null,
      threadId: String(surfaceIdentity.thread_id || metadata.telegram_thread_id || '').trim() || null,
      composerPayload: asTenantContextRecord(metadata.composer_payload),
      publicServerMode:
        asTenantContextRecord(metadata.surface_policy).public_server_mode === true ||
        asTenantContextRecord(metadata.surfacePolicy).publicServerMode === true,
    },
    runtime,
  );
}

function resolveDiscordTenantContext(
  chatId: string,
  sourceUserId: string | null,
  runtimeUserId: string | null,
  sessionId: string | null,
  composerPayload: Record<string, any>,
  publicServerMode: boolean,
  runtime: TenantContextRuntime,
): TenantContext | null {
  const discordPayload = asTenantContextRecord(composerPayload.discord);
  const guildMatch = chatId.match(DISCORD_GUILD_CHAT_PATTERN);
  const dmMatch = chatId.match(DISCORD_DM_CHAT_PATTERN);
  const guildId = optionalTenantString(discordPayload.guildId) || (guildMatch ? guildMatch[1] : null);
  const channelId =
    optionalTenantString(discordPayload.channelId) ||
    (guildMatch ? guildMatch[2] : null) ||
    (dmMatch ? dmMatch[1] : null);
  const threadId = optionalTenantString(discordPayload.threadId) || (guildMatch ? guildMatch[3] : null);

  if (guildId) {
    const guildIsAllowlisted = runtime.allowedGuildIds.length === 0 || runtime.allowedGuildIds.includes(guildId);
    const publicServerReady =
      !publicServerMode ||
      (runtime.ownerUserIds.length > 0 && runtime.allowedChannelIds.length > 0 && guildIsAllowlisted);
    return createTenantContext({
      tenantId: `discord:guild:${guildId}`,
      tenantType: 'discord_guild',
      boundary: 'shared',
      platform: 'discord',
      policyProfile: publicServerMode ? 'discord-public-guild' : 'discord-guild',
      scopeId: threadId || channelId || guildId,
      sourceUserId,
      runtimeUserId,
      sessionId,
      guildId,
      channelId,
      threadId,
      ownerUserIds: [...runtime.ownerUserIds],
      allowedGuildIds: [...runtime.allowedGuildIds],
      allowedChannelIds: [...runtime.allowedChannelIds],
      publicServerMode,
      chatId: chatId || channelId || guildId,
      metadata: { composer_payload: composerPayload },
      onboardingStatus: publicServerReady ? 'ready' : 'pending_onboarding',
    });
  }

  const effectiveDmId = sourceUserId || channelId || runtimeUserId;
  if (!effectiveDmId) {
    return null;
  }

  return createTenantContext({
    tenantId: `discord:dm:${effectiveDmId}`,
    tenantType: 'discord_dm',
    boundary: 'personal',
    platform: 'discord',
    policyProfile: 'discord-dm',
    scopeId: channelId || effectiveDmId,
    sourceUserId,
    runtimeUserId,
    sessionId,
    guildId: null,
    channelId,
    threadId,
    ownerUserIds: [...runtime.ownerUserIds],
    allowedGuildIds: [...runtime.allowedGuildIds],
    allowedChannelIds: [...runtime.allowedChannelIds],
    publicServerMode,
    chatId: chatId || channelId || effectiveDmId,
    metadata: { composer_payload: composerPayload },
  });
}

function resolveTelegramTenantContext(
  chatId: string,
  sourceUserId: string | null,
  runtimeUserId: string | null,
  threadId: string | null,
): TenantContext | null {
  const normalizedChatId = optionalTenantString(chatId);
  const isNumericChat = /^-...\d+$/.test(String(normalizedChatId || ''));
  const isGroup = isNumericChat && Number(normalizedChatId) < 0;
  const effectiveUserId = runtimeUserId || sourceUserId || normalizedChatId;

  if (isGroup && normalizedChatId) {
    const tenantId = threadId ? `telegram:chat:${normalizedChatId}:thread:${threadId}`
      : `telegram:chat:${normalizedChatId}`;
    return createTenantContext({
      tenantId,
      tenantType: 'telegram_group',
      boundary: 'shared',
      platform: 'telegram',
      policyProfile: 'telegram-group',
      scopeId: threadId || normalizedChatId,
      sourceUserId,
      runtimeUserId,
      sessionId: null,
      guildId: null,
      channelId: normalizedChatId,
      threadId,
      ownerUserIds: [],
      allowedGuildIds: [],
      allowedChannelIds: [],
      publicServerMode: false,
      chatId: normalizedChatId,
      metadata: {
        telegram_thread_id: threadId,
      },
    });
  }

  if (!effectiveUserId) {
    return null;
  }

  return createTenantContext({
    tenantId: `telegram:user:${effectiveUserId}`,
    tenantType: 'telegram_private',
    boundary: 'personal',
    platform: 'telegram',
    policyProfile: 'telegram-private',
    scopeId: normalizedChatId,
    sourceUserId,
    runtimeUserId,
    sessionId: null,
    guildId: null,
    channelId: normalizedChatId,
    threadId: null,
    ownerUserIds: [],
    allowedGuildIds: [],
    allowedChannelIds: [],
    publicServerMode: false,
    chatId: normalizedChatId,
    metadata: {},
  });
}

function resolveWebTenantContext(
  chatId: string,
  sourceUserId: string | null,
  runtimeUserId: string | null,
  sessionId: string | null,
): TenantContext | null {
  const resolvedSessionId = sessionId || extractWebSessionId(chatId) || sourceUserId || runtimeUserId;
  if (!resolvedSessionId) {
    return null;
  }

  return createTenantContext({
    tenantId: 'internal:web:operator',
    tenantType: 'web_session',
    boundary: 'personal',
    platform: 'web',
    policyProfile: 'web_operator',
    scopeId: resolvedSessionId,
    sourceUserId,
    runtimeUserId,
    sessionId: resolvedSessionId,
    guildId: null,
    channelId: chatId || `web:${resolvedSessionId}`,
    threadId: null,
    ownerUserIds: [],
    allowedGuildIds: [],
    allowedChannelIds: [],
    publicServerMode: false,
    chatId: chatId || `web:${resolvedSessionId}`,
    metadata: {},
    isolationMode: 'internal',
    onboardingStatus: 'internal',
  });
}

function resolveWhatsAppTenantContext(
  chatId: string,
  sourceUserId: string | null,
  runtimeUserId: string | null,
): TenantContext | null {
  const normalizedChatId = optionalTenantString(chatId);
  const isGroup = String(normalizedChatId || '').includes('@g.us');
  const effectiveUserId = runtimeUserId || sourceUserId || normalizedChatId;

  if (isGroup && normalizedChatId) {
    return createTenantContext({
      tenantId: `whatsapp:chat:${normalizedChatId}`,
      tenantType: 'whatsapp_group',
      boundary: 'shared',
      platform: 'whatsapp',
      policyProfile: 'whatsapp-group',
      scopeId: normalizedChatId,
      sourceUserId,
      runtimeUserId,
      sessionId: null,
      guildId: null,
      channelId: normalizedChatId,
      threadId: null,
      ownerUserIds: [],
      allowedGuildIds: [],
      allowedChannelIds: [],
      publicServerMode: false,
      chatId: normalizedChatId,
      metadata: {},
    });
  }

  if (!effectiveUserId) {
    return null;
  }

  return createTenantContext({
    tenantId: `whatsapp:user:${effectiveUserId}`,
    tenantType: 'whatsapp_private',
    boundary: 'personal',
    platform: 'whatsapp',
    policyProfile: 'whatsapp-private',
    scopeId: normalizedChatId,
    sourceUserId,
    runtimeUserId,
    sessionId: null,
    guildId: null,
    channelId: normalizedChatId,
    threadId: null,
    ownerUserIds: [],
    allowedGuildIds: [],
    allowedChannelIds: [],
    publicServerMode: false,
    chatId: normalizedChatId,
    metadata: {},
  });
}

function resolveCliTenantContext(
  chatId: string,
  sourceUserId: string | null,
  runtimeUserId: string | null,
  sessionId: string | null,
): TenantContext | null {
  const effectiveSession = sessionId || sourceUserId || runtimeUserId || chatId;
  if (!effectiveSession) {
    return null;
  }

  return createTenantContext({
    tenantId: `cli:session:${effectiveSession}`,
    tenantType: 'cli_session',
    boundary: 'personal',
    platform: 'cli',
    policyProfile: 'cli-session',
    scopeId: effectiveSession,
    sourceUserId,
    runtimeUserId,
    sessionId: effectiveSession,
    guildId: null,
    channelId: chatId || null,
    threadId: null,
    ownerUserIds: [],
    allowedGuildIds: [],
    allowedChannelIds: [],
    publicServerMode: false,
    chatId: chatId || effectiveSession,
    metadata: {},
  });
}
