import { LEGACY_SURFACE_CONTAINMENT_VERSION } from '../../src/contracts/LegacySurfaceContract.js';
import { LegacySurfaceContainmentService } from '../../src/services/LegacySurfaceContainmentService.js';

describe('LegacySurfaceContainmentService', () => {
  it('freezes legacy surfaces while keeping /control canonical', () => {
    const service = new LegacySurfaceContainmentService();
    const snapshot = service.buildSnapshot({
      localBaseUrl: 'http://127.0.0.1:33333/',
      remoteBaseUrl: 'https://zavorth.example.com/',
      now: '2026-04-14T12:00:00.000Z',
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        contractVersion: LEGACY_SURFACE_CONTAINMENT_VERSION,
        canonicalEntry: '/control',
        frozenSurfaces: ['/app', '/classic'],
        generatedAt: '2026-04-14T12:00:00.000Z',
        consolidation: expect.objectContaining({
          phase: 'P3-003',
          canonicalDocs: expect.arrayContaining([
            'docs/web-dashboard.md',
            'docs/product-direction.md',
          ]),
          rule: expect.stringContaining('/app e /classic recebem apenas manutencao'),
        }),
        policy: expect.objectContaining({
          productFeaturesMustLandIn: ['gateway contract', 'control plane', 'dashboard'],
          legacyFeatureFreeze: true,
          compatibilityPreserved: true,
          fallbackPreserved: true,
        }),
        links: {
          localControlUrl: 'http://127.0.0.1:33333/control',
          localDashboardUrl: 'http://127.0.0.1:33333/dashboard',
          localLegacyAppUrl: 'http://127.0.0.1:33333/app',
          localClassicUrl: 'http://127.0.0.1:33333/classic',
          remoteControlUrl: 'https://zavorth.example.com/control',
          remoteDashboardUrl: 'https://zavorth.example.com/dashboard',
          remoteLegacyAppUrl: 'https://zavorth.example.com/app',
          remoteClassicUrl: 'https://zavorth.example.com/classic',
        },
      }),
    );
    expect(snapshot.surfaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'dashboard', role: 'canonical', path: '/control', status: 'primary' }),
        expect.objectContaining({ id: 'app', role: 'legacy-operational', status: 'frozen' }),
        expect.objectContaining({ id: 'classic', role: 'legacy-observability', status: 'frozen' }),
      ]),
    );
  });

  it('renders legacy warnings only for contained legacy routes', () => {
    const service = new LegacySurfaceContainmentService();

    expect(service.resolveRole('/dashboard')).toBe('canonical');
    expect(service.resolveRole('/app/')).toBe('legacy-operational');
    expect(service.resolveRole('/classic')).toBe('legacy-observability');
    expect(service.isLegacy('/dashboard')).toBe(false);
    expect(service.isLegacy('/app')).toBe(true);
    expect(service.renderBanner('/dashboard')).toBeNull();
    expect(service.renderBanner('/app')).toContain('Use /control as the main entry');
    expect(service.renderBanner('/classic')).toContain('frozen');
  });

  it('routes new product work away from frozen legacy surfaces', () => {
    const service = new LegacySurfaceContainmentService();

    expect(service.decideFeatureDestination('/control', 'product-feature')).toEqual(
      expect.objectContaining({
        phase: 'P3-003',
        allowed: true,
        featureKind: 'product-feature',
        requestedPath: '/control',
        surface: expect.objectContaining({ id: 'dashboard', status: 'primary' }),
        requiredDestination: ['gateway contract', 'control plane', 'dashboard'],
      }),
    );
    expect(service.decideFeatureDestination('/app', 'business-rule')).toEqual(
      expect.objectContaining({
        phase: 'P3-003',
        allowed: false,
        featureKind: 'business-rule',
        requestedPath: '/app',
        surface: expect.objectContaining({ id: 'app', status: 'frozen' }),
        requiredDestination: ['gateway contract', 'control plane', 'dashboard'],
      }),
    );
    expect(service.decideFeatureDestination('/classic', 'observability-maintenance')).toEqual(
      expect.objectContaining({
        phase: 'P3-003',
        allowed: true,
        featureKind: 'observability-maintenance',
        requestedPath: '/classic',
        surface: expect.objectContaining({ id: 'classic', status: 'frozen' }),
        requiredDestination: ['legacy maintenance'],
      }),
    );
  });
});
