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
      summary: 'Use /zavorthControl como a unica entrada web do Zavorth. /app e /classic foram removidas e nao recebem mais fallback, manutencao ou produto novo.',
      consolidation: {
        phase: 'P3-003',
        canonicalDocs: [
          'docs/web-zavorthControl.md',
          'docs/product-direction.md',
        ],
        rule: 'Produto novo, manutencao, seguranca e observabilidade web entram em /zavorthControl, Runtime API, Gateway Contract ou control plane; /app e /classic nao sao mais surfaces publicas.',
      },
      surfaces: [
        this.surface('zavorthControl', 'canonical', '/zavorthControl', 'ZavorthControl', 'primary',
          'Face principal para chat natural, approvals, receipts, providers, channels e status essencial do gateway.',
          [
            'produto novo',
            'fluxos de usuario comum',
            'controle de sessao via Runtime API/Gateway',
          ],
          []),
        this.surface('app', 'retired', '/app', 'Removed operational shell', 'removed',
          'Surface removida. Nao deve ser servida, linkada, usada como fallback ou receber manutencao.',
          [],
          [
            'qualquer trafego web',
            'fallback operacional',
            'manutencao',
            'novas features',
          ]),
        this.surface('classic', 'retired', '/classic', 'Removed classic zavorthControl', 'removed',
          'Surface removida. Observabilidade e manutencao agora devem ir para /zavorthControl ou APIs oficiais.',
          [],
          [
            'qualquer trafego web',
            'observabilidade local',
            'fallback de manutencao',
            'compatibilidade historica',
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
        phase: 'P3-003',
        featureKind,
        requestedPath,
        surface,
        allowed: false,
        reason: `${surface.path} foi removida; use /zavorthControl, Runtime API, Gateway Contract ou control plane.`,
        requiredDestination: snapshot.policy.productFeaturesMustLandIn,
      };
    }

    return {
      phase: 'P3-003',
      featureKind,
      requestedPath,
      surface,
      allowed: true,
      reason: surface.status === 'primary'
        ? '/zavorthControl e a unica surface web oficial.'
        : `${surface.path} foi removida; use /zavorthControl.`,
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
