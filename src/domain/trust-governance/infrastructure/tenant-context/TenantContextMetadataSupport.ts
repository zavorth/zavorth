import type { Task } from '../../../../contracts/TaskContract.js';
import type { TenantContext } from './TenantContextTypes.js';
import {
  asTenantContextRecord,
  createTenantContext,
  normalizeTenantBoundary,
  normalizeTenantStringArray,
  normalizeTenantType,
  optionalTenantString,
} from './TenantContextNormalizationSupport.js';

export function normalizeTenantContextRecord(value: unknown): TenantContext | null {
  const record = asTenantContextRecord(value);
  const tenantId = String(record.tenantId || record.tenant_id || '').trim();
  if (!tenantId) {
    return null;
  }

  return createTenantContext({
    tenantId,
    tenantType: normalizeTenantType(record.tenantType || record.tenant_type),
    boundary: normalizeTenantBoundary(record.boundary),
    platform: String(record.platform || '').trim().toLowerCase() || 'unknown',
    policyProfile: String(record.policyProfile || record.policy_profile || '').trim() || 'runtime-default',
    scopeId: optionalTenantString(record.scopeId || record.scope_id),
    sourceUserId: optionalTenantString(record.sourceUserId || record.source_user_id),
    runtimeUserId: optionalTenantString(record.runtimeUserId || record.runtime_user_id),
    sessionId: optionalTenantString(record.sessionId || record.session_id),
    guildId: optionalTenantString(record.guildId || record.guild_id),
    channelId: optionalTenantString(record.channelId || record.channel_id),
    threadId: optionalTenantString(record.threadId || record.thread_id),
    ownerUserIds: normalizeTenantStringArray(record.ownerUserIds || record.owner_user_ids),
    allowedGuildIds: normalizeTenantStringArray(record.allowedGuildIds || record.allowed_guild_ids),
    allowedChannelIds: normalizeTenantStringArray(record.allowedChannelIds || record.allowed_channel_ids),
    publicServerMode: record.publicServerMode === true || record.public_server_mode === true,
    chatId: optionalTenantString(record.chatId || record.chat_id),
    metadata: asTenantContextRecord(record.metadata),
    isolationMode: String(record.isolationMode || record.isolation_mode || '').trim().toLowerCase() as any,
    onboardingStatus: String(record.onboardingStatus || record.onboarding_status || '').trim().toLowerCase() as any,
  });
}

export function toTenantMetadataRecord(context: TenantContext | null | undefined): Record<string, any> | null {
  if (!context?.tenantId) {
    return null;
  }

  return {
    tenant_id: context.tenantId,
    tenant_type: context.tenantType,
    boundary: context.boundary,
    isolation_mode: context.isolationMode,
    onboarding_status: context.onboardingStatus,
    platform: context.platform,
    policy_profile: context.policyProfile,
    public_server_mode: context.publicServerMode,
    scope_id: context.scopeId,
    source_user_id: context.sourceUserId,
    runtime_user_id: context.runtimeUserId,
    session_id: context.sessionId,
    guild_id: context.guildId,
    channel_id: context.channelId,
    thread_id: context.threadId,
    chat_id: context.chatId,
    owner_user_ids: [...context.ownerUserIds],
    allowed_guild_ids: [...context.allowedGuildIds],
    allowed_channel_ids: [...context.allowedChannelIds],
    metadata: { ...(context.metadata || {}) },
  };
}

export function extractTenantIdFromMetadata(metadata: Record<string, any> | null | undefined): string | null {
  const direct = String(metadata?.tenant_id || '').trim();
  if (direct) {
    return direct;
  }

  const nested = String(metadata?.tenant_context?.tenant_id || metadata?.tenantContext?.tenantId || '').trim();
  return nested || null;
}

export function buildTaskMetadataFromTenantContext(
  context: TenantContext | Record<string, any> | null | undefined,
): Record<string, any> {
  const normalizedContext =
    context && typeof context === 'object' && 'tenantId' in context
      ? (context as TenantContext)
      : normalizeTenantContextRecord(context);
  if (!normalizedContext?.tenantId) {
    return {};
  }

  return {
    tenant_id: normalizedContext.tenantId,
    tenant_type: normalizedContext.tenantType,
    tenant_isolation_mode: normalizedContext.isolationMode,
    tenant_policy_profile: normalizedContext.policyProfile,
    tenant_context: toTenantMetadataRecord(normalizedContext),
  };
}

export function buildPermissionMetadataFromResolvedTask(
  task: Task | null | undefined,
  context: TenantContext | null,
): Record<string, any> {
  if (!task || !context?.tenantId) {
    return {};
  }

  const metadata = asTenantContextRecord(task.metadata);
  return {
    ...buildTaskMetadataFromTenantContext(context),
    task_id: task.task_id,
    traceId: String(metadata.traceId || metadata.trace_id || `task:${task.task_id}`),
    guild_id: context.guildId,
    channel_id: context.channelId,
    thread_id: context.threadId,
  };
}

export function buildPermissionMetadataMatchFromTaskMetadata(
  task: Task | { metadata?: Record<string, any> } | null | undefined,
  resolveFromTask?: (task: Task) => TenantContext | null,
): Record<string, any> | undefined {
  if (!task) {
    return undefined;
  }

  const metadata = (task as { metadata?: Record<string, any> }).metadata;
  const directTenantId = extractTenantIdFromMetadata(metadata);
  if (directTenantId) {
    return {
      tenant_id: directTenantId,
      tenant_policy_profile:
        String(metadata?.tenant_policy_profile || metadata?.tenant_context?.policy_profile || '').trim() || undefined,
    };
  }

  if (resolveFromTask && 'task_id' in (task as any)) {
    const context = resolveFromTask(task as Task);
    if (context?.tenantId) {
      return {
        tenant_id: context.tenantId,
        tenant_policy_profile: context.policyProfile,
      };
    }
  }

  return undefined;
}
