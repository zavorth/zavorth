import { LEGACY_SURFACE_CONTAINMENT_VERSION } from '../../src/contracts/LegacySurfaceContract.js';
import { LegacySurfaceContainmentService } from '../../src/services/LegacySurfaceContainmentService.js';

describe('LegacySurfaceContainmentService', () => {
  it('removes old web surfaces while keeping /dashboard canonical', () => {
    const service = new LegacySurfaceContainmentService();
    const snapshot = service.buildSnapshot({
      localBaseUrl: 'http://127.0.0.1:33333/',
      remoteBaseUrl: 'https://zavorth.example.com/',
      now: '2026-04-14T12:00:00.000Z',
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        contractVersion: LEGACY_SURFACE_CONTAINMENT_VERSION,
        canonicalEntry: '/zavorthControl',
        frozenSurfaces: [],
        retiredSurfaces: ['/app', '/classic'],
        generatedAt: '2026-04-14T12:00:00.000Z',
        consolidation: expect.objectContaining({
          phase: 'P3-003',
          canonicalDocs: expect.arrayContaining([
            'docs/web-dashboard.md',
            'docs/product-direction.md',
          ]),
          rule: expect.stringContaining('/app e /classic nao sao mais surfaces publicas'),
        }),
        policy: expect.objectContaining({
          productFeaturesMustLandIn: ['gateway contract', 'control plane', 'dashboard'],
          legacyFeatureFreeze: false,
          legacyRoutesRetired: true,
          compatibilityPreserved: false,
          fallbackPreserved: false,
        }),
        links: {
          localControlUrl: 'http://127.0.0.1:33333/dashboard',
          localDashboardUrl: 'http://127.0.0.1:33333/dashboard',
          localLegacyAppUrl: null,
          localClassicUrl: null,
          remoteControlUrl: 'https://zavorth.example.com/zavorthControl',
          remoteDashboardUrl: 'https://zavorth.example.com/zavorthControl',
          remoteLegacyAppUrl: null,
          remoteClassicUrl: null,
        },
      }),
    );
    expect(snapshot.surfaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'dashboard', role: 'canonical', path: '/zavorthControl', status: 'primary' }),
        expect.objectContaining({ id: 'app', role: 'retired', status: 'removed' }),
        expect.objectContaining({ id: 'classic', role: 'retired', status: 'removed' }),
      ]),
    );
  });

  it('renders removed-route warnings only for retired routes', () => {
    const service = new LegacySurfaceContainmentService();

    expect(service.resolveRole('/zavorthControl')).toBe('canonical');
    expect(service.resolveRole('/app/')).toBe('retired');
    expect(service.resolveRole('/classic')).toBe('retired');
    expect(service.isLegacy('/zavorthControl')).toBe(false);
    expect(service.isLegacy('/app')).toBe(true);
    expect(service.renderBanner('/zavorthControl')).toBeNull();
    expect(service.renderBanner('/app')).toContain('has been removed');
    expect(service.renderBanner('/classic')).toContain('Use /dashboard');
  });

  it('blocks all work against removed web surfaces', () => {
    const service = new LegacySurfaceContainmentService();

    expect(service.decideFeatureDestination('/zavorthControl', 'product-feature')).toEqual(
      expect.objectContaining({
        gate: 'P3-003',
        allowed: true,
        featureKind: 'product-feature',
        requestedPath: '/zavorthControl',
        surface: expect.objectContaining({ id: 'dashboard', status: 'primary' }),
        requiredDestination: ['gateway contract', 'control plane', 'dashboard'],
      }),
    );
    expect(service.decideFeatureDestination('/app', 'business-rule')).toEqual(
      expect.objectContaining({
        gate: 'P3-003',
        allowed: false,
        featureKind: 'business-rule',
        requestedPath: '/app',
        surface: expect.objectContaining({ id: 'app', status: 'removed' }),
        requiredDestination: ['gateway contract', 'control plane', 'dashboard'],
      }),
    );
    expect(service.decideFeatureDestination('/classic', 'observability-maintenance')).toEqual(
      expect.objectContaining({
        gate: 'P3-003',
        allowed: false,
        featureKind: 'observability-maintenance',
        requestedPath: '/classic',
        surface: expect.objectContaining({ id: 'classic', status: 'removed' }),
        requiredDestination: ['gateway contract', 'control plane', 'dashboard'],
      }),
    );
  });
});
