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

const BLOCKED_LEGACY_FEATURE_KINDS = new Set<LegacySurfaceFeatureKind>([
  'product-feature',
  'business-rule',
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
      canonicalEntry: '/control',
      frozenSurfaces: ['/app', '/classic'],
      generatedAt,
      summary: 'Use /control como entrada principal do Zavorth web. /dashboard segue compativel, enquanto Runtime API, Gateway Contract e dashboard oficial recebem produto novo; /app e /classic permanecem apenas como legado operacional e fallback.',
      consolidation: {
        phase: 'P3-003',
        canonicalDocs: [
          'docs/web-dashboard.md',
          'docs/product-direction.md',
        ],
        rule: 'Produto novo e regras de negocio novas entram em /control, Runtime API, Gateway Contract ou control plane; /app e /classic recebem apenas manutencao, seguranca, bugfix e compatibilidade.',
      },
      surfaces: [
        this.surface('dashboard', 'canonical', '/control', 'Control UI', 'primary',
          'Face principal para chat natural, approvals, receipts, providers, channels e status essencial do gateway.',
          [
            'produto novo',
            'fluxos de usuario comum',
            'controle de sessao via Runtime API/Gateway',
          ],
          []),
        this.surface('app', 'legacy-operational', '/app', 'Operational shell legado', 'frozen',
          'Cockpit antigo para operador, manutencao e fallback local. Nao recebe novas features de produto.',
          [
            'fallback operacional',
            'manutencao local',
            'observabilidade pesada de operador',
          ],
          [
            'novas features de produto',
            'onboarding principal',
            'entrada padrao para usuario comum',
          ]),
        this.surface('classic', 'legacy-observability', '/classic', 'Classic dashboard legado', 'frozen',
          'Dashboard classico de observabilidade e manutencao. Mantido para compatibilidade.',
          [
            'observabilidade local',
            'fallback de manutencao',
            'compatibilidade historica',
          ],
          [
            'novas features de produto',
            'fluxos principais de chat ou onboarding',
            'entrypoint canonico',
          ]),
      ],
      policy: {
        productFeaturesMustLandIn: ['gateway contract', 'control plane', 'dashboard'],
        legacyFeatureFreeze: true,
        compatibilityPreserved: true,
        fallbackPreserved: true,
      },
      links: {
        localControlUrl: `${localBaseUrl}/control`,
        localDashboardUrl: `${localBaseUrl}/dashboard`,
        localLegacyAppUrl: `${localBaseUrl}/app`,
        localClassicUrl: `${localBaseUrl}/classic`,
        remoteControlUrl: remoteBaseUrl ? `${remoteBaseUrl}/control` : null,
        remoteDashboardUrl: remoteBaseUrl ? `${remoteBaseUrl}/dashboard` : null,
        remoteLegacyAppUrl: remoteBaseUrl ? `${remoteBaseUrl}/app` : null,
        remoteClassicUrl: remoteBaseUrl ? `${remoteBaseUrl}/classic` : null,
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
    const legacyBlocked =
      surface.status === 'frozen'
      && BLOCKED_LEGACY_FEATURE_KINDS.has(featureKind);
    if (legacyBlocked) {
      return {
        phase: 'P3-003',
        featureKind,
        requestedPath,
        surface,
        allowed: false,
        reason: `${surface.path} esta funcionalmente congelada; novas features e regras de negocio devem ir para /control.`,
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
        ? '/control e a surface oficial para produto novo.'
        : `${surface.path} permite apenas manutencao, seguranca, bugfix, compatibilidade ou observabilidade.`,
      requiredDestination: surface.status === 'primary'
        ? snapshot.policy.productFeaturesMustLandIn
        : ['legacy maintenance'],
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
    return snapshot.surfaces.find((surface) => surface.role === role)
      || snapshot.surfaces[0];
  }

}
