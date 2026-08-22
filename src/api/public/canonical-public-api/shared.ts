import fs from 'fs';
import path from 'path';
import type { GatewayStatusDTO, SessionDTO } from '../../../contracts/public/rest/dto.js';
import type { PlatformRegistryItemDTO, PluginDTO } from '../../../contracts/public/rest/platform-ops-dto.js';
import type { CanonicalPublicApiRuntime } from './types.js';

export interface PlatformRegistryEntry {
  id: string;
  label: string;
  kind: PlatformRegistryItemDTO['kind'];
  source: string;
  origin?: string;
  registrySource?: string;
  trust?: string;
  trustState?: PlatformRegistryItemDTO['trustState'];
  reviewState?: PlatformRegistryItemDTO['reviewState'];
  signatureState?: PlatformRegistryItemDTO['signatureState'];
  readiness?: PlatformRegistryItemDTO['readiness'];
  installState?: PlatformRegistryItemDTO['installState'];
  runtimePermissionProfile?: PlatformRegistryItemDTO['runtimePermissionProfile'];
  promotedFromLearning?: boolean;
  discoveryOnly?: boolean;
  featured?: boolean;
  summary?: string;
  provenance?: {
    sourceLocator?: string;
    sourceDigest?: string;
    sourceTrusted?: boolean;
  };
}

export class CanonicalPublicApiSharedSupport {
  private static readonly STALE_MAINTENANCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

  constructor(private readonly runtime: CanonicalPublicApiRuntime) {}

  public normalizeValue(value: unknown): string {
    return String(value || '').trim();
  }

  public resolveUserId(explicitUserId?: string | null): string {
    const direct = this.normalizeValue(explicitUserId);
    if (direct) {
      return direct;
    }

    return this.normalizeValue(this.runtime.getRuntime()?.webUserId) || 'web-user';
  }

  public resolveEnvironment(): GatewayStatusDTO['environment'] {
    const raw = String(process.env.NODE_ENV || '').trim().toLowerCase();
    if (raw === 'production' || raw === 'test') {
      return raw;
    }
    return 'development';
  }

  public readPackageVersion(): string {
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      if (!fs.existsSync(packagePath)) {
        return '1.0.0';
      }
      const payload = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as { version?: string };
      return String(payload.version || '1.0.0');
    } catch (error: unknown) {
      return '1.0.0';
    }
  }

  public isMaintenanceRunning(snapshot: {
    maintenance?: {
      startedAt?: string | null;
      finishedAt?: string | null;
    } | null;
  } | null): boolean {
    const startedAt = String(snapshot?.maintenance?.startedAt || '').trim();
    const finishedAt = String(snapshot?.maintenance?.finishedAt || '').trim();
    if (!startedAt || finishedAt) {
      return false;
    }

    const startedAtMs = Date.parse(startedAt);
    if (!Number.isFinite(startedAtMs)) {
      return true;
    }

    return (Date.now() - startedAtMs) <= CanonicalPublicApiSharedSupport.STALE_MAINTENANCE_MAX_AGE_MS;
  }

  public hasBlockingOperationalError(lastError: {
    level?: string | null;
  } | null | undefined): boolean {
    if (!lastError) {
      return false;
    }

    const level = String(lastError.level || '').trim().toLowerCase();
    if (!level) {
      return true;
    }

    return level !== 'warn' && level !== 'warning' && level !== 'info' && level !== 'debug';
  }

  public serializeSession(
    entry: {
      id: string;
      sessionId: string | null;
      label: string;
      latestStatus: string | null;
      updatedAt: string | null;
      platform: string;
      workspace: string | null;
    },
    generatedAt: string,
  ): SessionDTO {
    const latestStatus = String(entry.latestStatus || '').trim().toLowerCase();
    const status: SessionDTO['status'] =
      /error|failed|rejected/.test(latestStatus) ? 'error'
        : /closed|done|completed|archived/.test(latestStatus) ? 'archived'
          : 'active';

    return {
      id: entry.sessionId || entry.id,
      createdAt: entry.updatedAt || generatedAt,
      updatedAt: entry.updatedAt || generatedAt,
      title: entry.label,
      status,
      tags: [entry.platform, ...(entry.workspace ? [entry.workspace] : [])],
    };
  }

  public resolvePlatformOrigin(entry: PlatformRegistryEntry): PlatformRegistryItemDTO['origin'] {
    const origin = entry.origin || (
      entry.source === 'learning-plane'
        ? 'learned-local'
        : entry.registrySource ? 'trusted-third-party'
          : 'official'
    );
    return origin === 'quarantined'
      ? 'quarantined'
      : origin === 'learned-local'
        ? 'learned-local'
        : origin === 'trusted-third-party'
          ? 'trusted-third-party'
          : 'official';
  }

  public resolvePlatformTrustState(entry: PlatformRegistryEntry): PlatformRegistryItemDTO['trustState'] {
    const trustState = entry.trustState || (
      entry.trust === 'trusted'
        ? 'trusted'
        : entry.trust === 'planned'
          ? 'planned'
          : 'review'
    );
    return trustState === 'quarantined'
      ? 'quarantined'
      : trustState === 'planned'
        ? 'planned'
        : trustState === 'trusted'
          ? 'trusted'
          : 'review';
  }

  public resolvePlatformReviewState(entry: PlatformRegistryEntry): PlatformRegistryItemDTO['reviewState'] {
    const reviewState = entry.reviewState || ((entry.trust || 'review') === 'trusted' ? 'approved' : 'pending');
    return reviewState === 'rejected'
      ? 'rejected'
      : reviewState === 'not-required'
        ? 'not-required'
        : reviewState === 'approved'
          ? 'approved'
          : 'pending';
  }

  public resolvePlatformSignatureState(entry: PlatformRegistryEntry): PlatformRegistryItemDTO['signatureState'] {
    const signatureState = entry.signatureState || (entry.registrySource ? 'catalog-verified' : 'none');
    return signatureState === 'verified'
      ? 'verified'
      : signatureState === 'workspace'
        ? 'workspace'
        : signatureState === 'unsigned'
          ? 'unsigned'
          : signatureState === 'catalog-verified'
            ? 'catalog-verified'
            : 'none';
  }

  public mapPlatformItem(entry: PlatformRegistryEntry): PlatformRegistryItemDTO {
    return {
      id: entry.id,
      label: entry.label,
      kind: entry.kind as PlatformRegistryItemDTO['kind'],
      source: entry.source,
      origin: this.resolvePlatformOrigin(entry),
      readiness: entry.readiness as PlatformRegistryItemDTO['readiness'],
      trustState: this.resolvePlatformTrustState(entry),
      reviewState: this.resolvePlatformReviewState(entry),
      installState: entry.installState as PlatformRegistryItemDTO['installState'],
      signatureState: this.resolvePlatformSignatureState(entry),
      runtimePermissionProfile: (entry.runtimePermissionProfile || 'native-runtime') as PlatformRegistryItemDTO['runtimePermissionProfile'],
      promotedFromLearning: entry.promotedFromLearning === true,
      discoveryOnly: entry.discoveryOnly === true,
      featured: entry.featured === true,
      summary: entry.summary || '',
      registrySource: entry.registrySource || undefined,
      provenance: {
        sourceLocator: entry.provenance?.sourceLocator || undefined,
        sourceDigest: entry.provenance?.sourceDigest || undefined,
        sourceTrusted: typeof entry.provenance?.sourceTrusted === 'boolean'
          ? entry.provenance.sourceTrusted
          : undefined,
      },
    };
  }

  public mapPlugin(entry: PlatformRegistryEntry): PluginDTO {
    return {
      id: String(entry.id || '').replace(/^plugin:/, ''),
      name: entry.label,
      version: 'unknown',
      description: entry.summary,
      author: entry.registrySource || entry.source || undefined,
      status: entry.readiness === 'disabled'
        ? 'error'
        : (['installed', 'enabled', 'workspace'].includes(entry.installState as string) ? 'active' : 'installed'),
    };
  }
}
