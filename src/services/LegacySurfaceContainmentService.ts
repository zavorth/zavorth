import {
  LEGACY_SURFACE_CONTAINMENT_VERSION,
  type LegacySurfaceContainmentSnapshot,
  type LegacySurfaceDescriptor,
  type LegacySurfaceFeatureDecision,
  type LegacySurfaceFeatureKind,
  type LegacySurfaceId,
  type LegacySurfaceRole,
} from '../contracts/LegacySurfaceContract.js';
import {
  renderLegacySurfaceBanner,
  resolveLegacySurfaceRole,
} from '../presentation/LegacySurfacePresentationPolicy.js';

type LegacySurfaceContainmentInput = {
  localBaseUrl?: string | null;
  remoteBaseUrl?: string | null;
  now?: Date | string | null;
};

const BLOCKED_RETIRED_ROUTE_FEATURE_KINDS = new Set<LegacySurfaceFeatureKind>([
  'product-feature',
  'business-rule',
  'security-fix',
  'compatibility-fix',
  'bugfix',
  'observability-maintenance',
]);

export class LegacySurfaceContainmentService {
  public buildSnapshot(input: LegacySurfaceContainmentInput = {}): LegacySurfaceContainmentSnapshot {
    const localBaseUrl = this.normalizeBaseUrl(input.localBaseUrl || 'http://127.0.0.1:33333');
    const remoteBaseUrl = this.normalizeBaseUrl(input.remoteBaseUrl || '');
    const generatedAt = input.now
      ? new Date(input.now).toISOString()
      : new Date().toISOString();

    return {
      contractVersion: LEGACY_SURFACE_CONTAINMENT_VERSION,
      canonicalEntry: '/zavorthControl',
      frozenSurfaces: [],
      retiredSurfaces: ['/app', '/classic'],
      generatedAt,
      summary: 'Use /zavorthControl as the only Zavorth web entry. /app and /classic were removed and no longer receive fallback, maintenance, or new product work.',
      consolidation: {
        phase: 'legacy-contained',
        canonicalDocs: [
          'docs/web-zavorthControl.md',
          'docs/product-direction.md',
        ],
        rule: 'New product, maintenance, security, and web observability go through /zavorthControl, Runtime API, Gateway Contract, or control plane; /app and /classic are no longer public surfaces.',
      },
      surfaces: [
        this.surface('zavorthControl', 'canonical', '/zavorthControl', 'ZavorthControl', 'primary',
          'Main surface for natural chat, approvals, receipts, providers, channels, and gateway status.',
          [
            'new product work',
            'everyday user flows',
            'session control through Runtime API or Gateway',
          ],
          []),
        this.surface('app', 'retired', '/app', 'Removed operational shell', 'removed',
          'Removed surface. It must not be served, linked, used as fallback, or receive maintenance.',
          [],
          [
            'qualquer trafego web',
            'fallback operational',
            'maintenance',
            'new features',
          ]),
        this.surface('classic', 'retired', '/classic', 'Removed classic zavorthControl', 'removed',
          'Removed surface. Observability and maintenance now go to /zavorthControl or official APIs.',
          [],
          [
            'any web traffic',
            'local observability',
            'maintenance fallback',
            'historical compatibility',
          ]),
      ],
      policy: {
        productFeaturesMustLandIn: ['gateway contract', 'control plane', 'zavorthControl'],
        legacyFeatureFreeze: false,
        legacyRoutesRetired: true,
        compatibilityPreserved: false,
        fallbackPreserved: false,
      },
      links: {
        localControlUrl: `${localBaseUrl}/zavorthControl`,
        localZavorthControlUrl: `${localBaseUrl}/zavorthControl`,
        localLegacyAppUrl: null,
        localClassicUrl: null,
        remoteControlUrl: remoteBaseUrl ? `${remoteBaseUrl}/zavorthControl` : null,
        remoteZavorthControlUrl: remoteBaseUrl ? `${remoteBaseUrl}/zavorthControl` : null,
        remoteLegacyAppUrl: null,
        remoteClassicUrl: null,
      },
    };
  }

  public resolveRole(pathname: string): LegacySurfaceRole {
    return resolveLegacySurfaceRole(pathname);
  }

  public isLegacy(pathname: string): boolean {
    return this.resolveRole(pathname) !== 'canonical';
  }

  public renderBanner(pathname: string): string | null {
    return renderLegacySurfaceBanner(pathname);
  }

  public decideFeatureDestination(
    pathname: string,
    featureKind: LegacySurfaceFeatureKind = 'product-feature',
  ): LegacySurfaceFeatureDecision {
    const snapshot = this.buildSnapshot();
    const requestedPath = this.normalizePathname(pathname);
    const surface = this.resolveSurface(snapshot, requestedPath);
    const retiredBlocked =
      surface.status === 'removed'
      && BLOCKED_RETIRED_ROUTE_FEATURE_KINDS.has(featureKind);
    if (retiredBlocked) {
      return {
        phase: 'legacy-contained',
        featureKind,
        requestedPath,
        surface,
        allowed: false,
        reason: `${surface.path} was removed; use /zavorthControl, Runtime API, Gateway Contract, or control plane.`,
        requiredDestination: snapshot.policy.productFeaturesMustLandIn,
      };
    }

    return {
      phase: 'legacy-contained',
      featureKind,
      requestedPath,
      surface,
      allowed: true,
      reason: surface.status === 'primary'
        ? '/zavorthControl is the only official web surface.'
        : `${surface.path} was removed; use /zavorthControl.`,
      requiredDestination: snapshot.policy.productFeaturesMustLandIn,
    };
  }

  private surface(
    id: LegacySurfaceId,
    role: LegacySurfaceRole,
    path: string,
    label: string,
    status: LegacySurfaceDescriptor['status'],
    summary: string,
    allowedUse: string[],
    blockedUse: string[],
  ): LegacySurfaceDescriptor {
    return {
      id,
      role,
      path,
      label,
      status,
      summary,
      allowedUse,
      blockedUse,
    };
  }

  private normalizeBaseUrl(value: string): string {
    return String(value || '').trim().replace(/\/+$/u, '');
  }

  private normalizePathname(value: string): string {
    const normalized = String(value || '/').trim().replace(/\/+$/u, '') || '/';
    return normalized === '' ? '/' : normalized;
  }

  private resolveSurface(
    snapshot: LegacySurfaceContainmentSnapshot,
    pathname: string,
  ): LegacySurfaceDescriptor {
    const role = this.resolveRole(pathname);
    const exactSurface = snapshot.surfaces.find((surface) => surface.path === pathname);
    if (exactSurface) {
      return exactSurface;
    }
    return snapshot.surfaces.find((surface) => surface.role === role)
      || snapshot.surfaces[0];
  }

}
