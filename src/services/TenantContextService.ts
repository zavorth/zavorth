import { config } from '../config/index.js';
import type {
  TenantBoundary,
  TenantContext,
  TenantType,
} from '../contracts/TenantContext.js';
import type { PermissionRequest } from '../contracts/PermissionRequest.js';
import type { MessageChannel } from '../contracts/PlatformContract.js';
import type { Task } from '../contracts/TaskContract.js';
import type { SurfaceTaskDispatchInput } from './SurfaceRuntime.js';
import {
  asTenantContextRecord,
  isSharedTenantBoundary,
  normalizeTenantStringArray,
  shouldIsolateTenantContext,
} from '../domain/trust-governance/infrastructure/tenant-context/TenantContextNormalizationSupport.js';
import {
  buildPermissionMetadataFromResolvedTask,
  buildPermissionMetadataMatchFromTaskMetadata,
  buildTaskMetadataFromTenantContext,
  extractTenantIdFromMetadata,
  normalizeTenantContextRecord,
  toTenantMetadataRecord,
} from '../domain/trust-governance/infrastructure/tenant-context/TenantContextMetadataSupport.js';
import {
  resolveTenantContext,
  resolveTenantContextFromTask,
} from '../domain/trust-governance/infrastructure/tenant-context/TenantContextResolutionSupport.js';
import { matchesResolvedTaskTenant } from '../domain/trust-governance/infrastructure/tenant-context/TenantContextMatchSupport.js';
import type {
  TenantContextRuntime,
  TenantContextServiceOptions,
  TenantResolutionInput,
} from '../domain/trust-governance/infrastructure/tenant-context/TenantContextTypes.js';

export type { TenantBoundary, TenantContext, TenantType };

export class TenantContextService {
  private readonly runtime: TenantContextRuntime;

  constructor(options: TenantContextServiceOptions = {}) {
    this.runtime = {
      ownerUserIds: normalizeTenantStringArray(options.ownerUserIds || config.discordOwnerUserIds),
      allowedGuildIds: normalizeTenantStringArray(options.allowedGuildIds || config.discordAllowedGuildIds),
      allowedChannelIds: normalizeTenantStringArray(options.allowedChannelIds || config.discordAllowedChannelIds),
    };
  }

  public resolveFromDispatchInput(input: SurfaceTaskDispatchInput): TenantContext | null {
    return resolveTenantContext(
      {
        platform: input.platform,
        chatId: input.chatId,
        sourceUserId: input.sourceUserId,
        runtimeUserId: input.fallbackRuntimeUserId || input.sourceUserId,
        sessionId: input.sessionId || null,
        threadId: input.threadId || null,
        composerPayload: input.composerPayload || null,
        publicServerMode: input.surfacePolicy?.publicServerMode === true,
      },
      this.runtime,
    );
  }

  public resolveForDispatch(input: TenantResolutionInput | SurfaceTaskDispatchInput): TenantContext | null {
    if ('text' in input) {
      return this.resolveFromDispatchInput(input as SurfaceTaskDispatchInput);
    }

    const candidate = input as TenantResolutionInput;
    return resolveTenantContext(
      {
        platform: candidate.platform || null,
        chatId: candidate.chatId || null,
        sourceUserId: candidate.sourceUserId || null,
        runtimeUserId: candidate.runtimeUserId || null,
        sessionId: candidate.sessionId || null,
        threadId: candidate.threadId || null,
        composerPayload: candidate.composerPayload || null,
        publicServerMode: candidate.publicServerMode === true,
      },
      this.runtime,
    );
  }

  public resolveFromSession(input: {
    platform?: MessageChannel | string | null;
    chatId?: string | null;
    userId?: string | null;
    sessionId?: string | null;
    composerPayload?: Record<string, any> | null;
    publicServerMode?: boolean | null;
  }): TenantContext | null {
    return resolveTenantContext(
      {
        platform: input.platform || null,
        chatId: input.chatId || null,
        sourceUserId: input.userId || null,
        runtimeUserId: input.userId || null,
        sessionId: input.sessionId || null,
        threadId: null,
        composerPayload: input.composerPayload || null,
        publicServerMode: input.publicServerMode === true,
      },
      this.runtime,
    );
  }

  public resolveFromTask(task: Task | null | undefined): TenantContext | null {
    return resolveTenantContextFromTask(task, this.runtime);
  }

  public resolveFromPermission(permission: PermissionRequest | null | undefined): TenantContext | null {
    if (!permission) {
      return null;
    }

    return normalizeTenantContextRecord(asTenantContextRecord(permission.metadata).tenant_context);
  }

  public normalizeContext(value: unknown): TenantContext | null {
    return normalizeTenantContextRecord(value);
  }

  public toMetadataRecord(context: TenantContext | null | undefined): Record<string, any> | null {
    return toTenantMetadataRecord(context);
  }

  public isSharedBoundary(context: TenantContext | null | undefined): boolean {
    return isSharedTenantBoundary(context);
  }

  public shouldIsolateByTenant(context: TenantContext | null | undefined): boolean {
    return shouldIsolateTenantContext(context);
  }

  public matchesTaskTenant(task: Task | null | undefined, tenantContext: TenantContext | null | undefined): boolean {
    return matchesResolvedTaskTenant(task, tenantContext, {
      extractTenantId: TenantContextService.extractTenantId,
      resolveFromTask: (candidate) => this.resolveFromTask(candidate),
      asRecord: asTenantContextRecord,
    });
  }

  public static buildTaskMetadataFromContext(
    context: TenantContext | Record<string, any> | null | undefined,
  ): Record<string, any> {
    return buildTaskMetadataFromTenantContext(context);
  }

  public static extractTenantId(metadata: Record<string, any> | null | undefined): string | null {
    return extractTenantIdFromMetadata(metadata);
  }

  public static buildPermissionMetadataFromTask(task: Task | null | undefined): Record<string, any> {
    if (!task) {
      return {};
    }

    const resolver = new TenantContextService();
    return buildPermissionMetadataFromResolvedTask(task, resolver.resolveFromTask(task));
  }

  public static buildPermissionMetadataMatchFromTask(
    task: Task | { metadata?: Record<string, any> } | null | undefined,
  ): Record<string, any> | undefined {
    return buildPermissionMetadataMatchFromTaskMetadata(
      task,
      'task_id' in (task as any) ? (candidate) => new TenantContextService().resolveFromTask(candidate) : undefined,
    );
  }
}
