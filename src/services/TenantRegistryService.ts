import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type { TenantBoundary, TenantContext } from './TenantContextService.js';
import { logger } from '../logger.js';

export type TenantRegistryRecord = {
  tenantId: string;
  tenantType: string;
  boundary: TenantBoundary;
  isolationMode: string;
  onboardingStatus: string;
  platform: string;
  policyProfile: string;
  publicServerMode: boolean;
  scopeId: string | null;
  sessionId: string | null;
  guildId: string | null;
  channelId: string | null;
  threadId: string | null;
  sourceUserId: string | null;
  runtimeUserId: string | null;
  ownerUserIds: string[];
  allowedGuildIds: string[];
  allowedChannelIds: string[];
  firstSeenAt: string;
  lastSeenAt: string;
};

type TenantRegistryState = {
  tenants: Record<string, TenantRegistryRecord>;
};

export type TenantRegistrySummary = {
  totalCount: number;
  sharedCount: number;
  personalCount: number;
  pendingOnboardingCount: number;
  publicServerCount: number;
  byPlatform: Record<string, number>;
  recent: TenantRegistryRecord[];
  pendingOnboarding: TenantRegistryRecord[];
};

type TenantRegistryOptions = {
  filePath?: string;
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

export class TenantRegistryService {
  private static readonly PLACEHOLDER_SHARED_TENANT_STALE_MS = 24 * 60 * 60 * 1000;
  private readonly filePath: string;
  private readonly now: () => Date;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;

  constructor(options: TenantRegistryOptions = {}) {
    this.filePath = options.filePath || config.tenantRegistryStateFile;
    this.now = options.now || (() => new Date());
    this.existsSync = options.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = options.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = options.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSync = options.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public observe(context: TenantContext | null | undefined): void {
    if (!context?.tenantId) {
      return;
    }

    const state = this.readState();
    const existing = state.tenants[context.tenantId];
    const nowIso = this.now().toISOString();
    state.tenants[context.tenantId] = {
      tenantId: context.tenantId,
      tenantType: context.tenantType,
      boundary: context.boundary,
      isolationMode: context.isolationMode,
      onboardingStatus: context.onboardingStatus,
      platform: context.platform,
      policyProfile: context.policyProfile,
      publicServerMode: context.publicServerMode === true,
      scopeId: context.scopeId,
      sessionId: context.sessionId,
      guildId: context.guildId,
      channelId: context.channelId,
      threadId: context.threadId,
      sourceUserId: context.sourceUserId,
      runtimeUserId: context.runtimeUserId,
      ownerUserIds: [...context.ownerUserIds],
      allowedGuildIds: [...context.allowedGuildIds],
      allowedChannelIds: [...context.allowedChannelIds],
      firstSeenAt: existing?.firstSeenAt || nowIso,
      lastSeenAt: nowIso,
    };
    this.writeState(state);
  }

  public upsert(context: TenantContext | null | undefined): TenantRegistryRecord | null {
    this.observe(context);
    if (!context?.tenantId) {
      return null;
    }
    return this.getTenant(context.tenantId);
  }

  public getTenant(tenantId: string): TenantRegistryRecord | null {
    const normalizedTenantId = String(tenantId || '').trim();
    if (!normalizedTenantId) {
      return null;
    }
    return this.readState().tenants[normalizedTenantId] || null;
  }

  public list(): TenantRegistryRecord[] {
    return Object.values(this.readState().tenants).sort((a, b) => {
      return String(b.lastSeenAt || '').localeCompare(String(a.lastSeenAt || ''));
    });
  }

  public listTenants(): TenantRegistryRecord[] {
    return this.list();
  }

  public summarize(limit: number = 5): TenantRegistrySummary {
    const records = this.list();
    return {
      totalCount: records.length,
      sharedCount: records.filter((record) => record.boundary === 'shared').length,
      personalCount: records.filter((record) => record.boundary !== 'shared').length,
      pendingOnboardingCount: records.filter((record) => record.onboardingStatus === 'pending_onboarding').length,
      publicServerCount: records.filter((record) => record.publicServerMode === true).length,
      byPlatform: records.reduce<Record<string, number>>((acc, record) => {
        const platform = String(record.platform || '').trim() || 'unknown';
        acc[platform] = (acc[platform] || 0) + 1;
        return acc;
      }, {}),
      recent: records.slice(0, Math.max(0, limit)),
      pendingOnboarding: records
        .filter((record) => record.onboardingStatus === 'pending_onboarding')
        .slice(0, Math.max(0, limit)),
    };
  }

  private readState(): TenantRegistryState {
    if (!this.existsSync(this.filePath)) {
      return { tenants: {} };
    }

    try {
      const parsed = JSON.parse(this.readFileSync(this.filePath, 'utf8')) as Partial<TenantRegistryState>;
      return {
        tenants: parsed.tenants && typeof parsed.tenants === 'object'
          ? Object.entries(parsed.tenants).reduce<Record<string, TenantRegistryRecord>>((acc, [tenantId, record]) => {
            const normalized = this.normalizeRecord(tenantId, record);
            if (normalized && !this.isStalePlaceholderSharedTenant(normalized)) {
              acc[normalized.tenantId] = normalized;
            }
            return acc;
          }, {})
          : {},
      };
    } catch (error: unknown) {logger.warn('[Tenant Registry] parsing failed', error);
    return { tenants: {} };
  }
  }

  private writeState(state: TenantRegistryState): void {
    this.mkdirSync(path.dirname(this.filePath), { recursive: true });
    this.writeFileSync(this.filePath, JSON.stringify(state, null, 2), 'utf8');
  }

  private normalizeRecord(tenantId: string, value: unknown): TenantRegistryRecord | null {
    const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
    const normalizedTenantId = String(record?.tenantId || tenantId || '').trim();
    if (!normalizedTenantId) {
      return null;
    }

    return {
      tenantId: normalizedTenantId,
      tenantType: String(record?.tenantType || record?.tenant_type || 'unknown').trim() || 'unknown',
      boundary: String(record?.boundary || '').trim().toLowerCase() === 'shared' ? 'shared' : 'personal',
      isolationMode: String(record?.isolationMode || record?.isolation_mode || '').trim() || 'private',
      onboardingStatus: String(record?.onboardingStatus || record?.onboarding_status || '').trim() || 'internal',
      platform: String(record?.platform || 'unknown').trim() || 'unknown',
      policyProfile: String(record?.policyProfile || record?.policy_profile || 'runtime-default').trim() || 'runtime-default',
      publicServerMode: record?.publicServerMode === true || record?.public_server_mode === true,
      scopeId: this.optionalString(record?.scopeId || record?.scope_id),
      sessionId: this.optionalString(record?.sessionId || record?.session_id),
      guildId: this.optionalString(record?.guildId || record?.guild_id),
      channelId: this.optionalString(record?.channelId || record?.channel_id),
      threadId: this.optionalString(record?.threadId || record?.thread_id),
      sourceUserId: this.optionalString(record?.sourceUserId || record?.source_user_id),
      runtimeUserId: this.optionalString(record?.runtimeUserId || record?.runtime_user_id),
      ownerUserIds: this.normalizeStringArray(record?.ownerUserIds || record?.owner_user_ids),
      allowedGuildIds: this.normalizeStringArray(record?.allowedGuildIds || record?.allowed_guild_ids),
      allowedChannelIds: this.normalizeStringArray(record?.allowedChannelIds || record?.allowed_channel_ids),
      firstSeenAt: String(record?.firstSeenAt || record?.first_seen_at || '').trim() || this.now().toISOString(),
      lastSeenAt: String(record?.lastSeenAt || record?.last_seen_at || '').trim() || this.now().toISOString(),
    };
  }

  private optionalString(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }

  private normalizeStringArray(value: unknown): string[] {
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

  private isStalePlaceholderSharedTenant(record: TenantRegistryRecord): boolean {
    if (record.boundary !== 'shared' || record.onboardingStatus !== 'pending_onboarding' || !record.publicServerMode) {
      return false;
    }
    if (record.allowedChannelIds.length > 0) {
      return false;
    }

    const lastSeenAt = Date.parse(String(record.lastSeenAt || '').trim());
    if (!Number.isFinite(lastSeenAt)) {
      return false;
    }
    if (this.now().getTime() - lastSeenAt < TenantRegistryService.PLACEHOLDER_SHARED_TENANT_STALE_MS) {
      return false;
    }

    const looksSynthetic = [record.guildId, record.channelId, record.sourceUserId, record.runtimeUserId]
      .map((value) => String(value || '').trim())
      .some((value) => /^(guild|channel|discord-user)-\d+$/i.test(value));
    const guildMismatch = Boolean(
      record.guildId
      && record.allowedGuildIds.length > 0
      && !record.allowedGuildIds.includes(record.guildId),
    );

    return looksSynthetic || guildMismatch;
  }
}
