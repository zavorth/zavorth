import { ZavorthAppsSatelliteNodesService } from '../../src/services/ZavorthAppsSatelliteNodesService.js';

describe('ZavorthAppsSatelliteNodesService', () => {
  const now = () => new Date('2026-05-24T12:00:00.000Z');
  const exists = () => true;

  it('projects apps and satellite nodes as one governed product surface', () => {
    const service = new ZavorthAppsSatelliteNodesService({
      now,
      exists,
      cwd: 'C:/workspace',
      env: {},
    });

    const snapshot = service.execute();

    expect(snapshot.contractVersion).toBe('2026-05-24.apps-satellite-nodes-phase-7');
    expect(snapshot.source).toBe('ZavorthAppsSatelliteNodesService');
    expect(snapshot.surfaces.map((surface) => surface.id)).toEqual([
      'satellite-pwa',
      'mobile-companion',
      'desktop-tray',
      'desktop-companion',
      'node-host',
      'approval-companion',
    ]);
    expect(snapshot.health.satellitePwaReady).toBe(true);
    expect(snapshot.health.nodeHostReady).toBe(true);
    expect(snapshot.offlineQueue.available).toBe(true);
    expect(snapshot.safety.noRawPairingSecretsSerialized).toBe(true);
    expect(snapshot.safety.mobileAndTraySpecsDoNotClaimAppStoreBinaries).toBe(true);
  });

  it('creates preview QR/setup code without materializing a node registry draft', () => {
    const service = new ZavorthAppsSatelliteNodesService({
      now,
      exists,
      cwd: 'C:/workspace',
      env: {},
    });

    const snapshot = service.execute({
      action: 'pairing.qr',
      nodeKind: 'mobile-companion',
      label: 'Phone',
      ttlSeconds: 120,
    });

    expect(snapshot.pairing.status).toBe('preview');
    expect(snapshot.pairing.materialized).toBe(false);
    expect(snapshot.pairing.setupCode).toMatch(/^ZA-[A-Z0-9_-]{12}$/);
    expect(snapshot.pairing.qrPayload).toContain('zavorth://pair-code=');
    expect(snapshot.pairing.noRawTokenSerialized).toBe(true);
    expect(snapshot.pairing.ttlSeconds).toBe(120);
  });

  it('requires approval before materializing a claimable pairing draft', () => {
    const service = new ZavorthAppsSatelliteNodesService({
      now,
      exists,
      cwd: 'C:/workspace',
      env: {},
    });

    const snapshot = service.execute({
      action: 'pairing.qr',
      materialize: true,
    });

    expect(snapshot.status).toBe('approval-required');
    expect(snapshot.pairing.status).toBe('approval-required');
    expect(snapshot.pairing.materialized).toBe(false);
  });

  it('materializes pairing through NodePairingService only after approval', () => {
    const pairingService = {
      createPairingDraft: jest.fn(() => ({
        entry: { id: 'node-1', label: 'Desk' },
        pairingCode: 'ZA-MATERIALIZED',
      })),
    };
    const service = new ZavorthAppsSatelliteNodesService({
      now,
      exists,
      cwd: 'C:/workspace',
      env: {},
      pairingService: pairingService as any,
    });

    const snapshot = service.execute({
      action: 'pairing.qr',
      nodeKind: 'desktop-companion',
      materialize: true,
      approvalId: 'approval-1',
    });

    expect(pairingService.createPairingDraft).toHaveBeenCalled();
    expect(snapshot.pairing.status).toBe('materialized');
    expect(snapshot.pairing.setupCode).toBe('ZA-MATERIALIZED');
    expect(snapshot.pairing.qrPayload).not.toContain('sharedSecret');
    expect(snapshot.safety.pairingMaterializationRequiresApproval).toBe(true);
  });

  it('does not claim push notifications are live until credentials and consent exist', () => {
    const service = new ZavorthAppsSatelliteNodesService({
      now,
      exists,
      cwd: 'C:/workspace',
      env: {
        ZAVORTH_WEB_PUSH_PUBLIC_KEY: 'present',
        ZAVORTH_WEB_PUSH_PRIVATE_REF: 'secret-ref:webpush',
      },
    });

    const withoutConsent = service.execute({ action: 'push.plan' });
    const withConsent = service.execute({ action: 'push.plan', consentId: 'consent-1' });

    expect(withoutConsent.status).toBe('approval-required');
    expect(withoutConsent.push.liveSendPerformed).toBe(false);
    expect(withConsent.status).toBe('ready');
    expect(withConsent.push.channels.find((channel) => channel.id === 'web-push')?.status).toBe('ready');
    expect(withConsent.push.liveSendPerformed).toBe(false);
  });

  it('keeps mobile and desktop tray claims as specs unless real wrappers are configured', () => {
    const service = new ZavorthAppsSatelliteNodesService({
      now,
      exists,
      cwd: 'C:/workspace',
      env: {},
    });

    const snapshot = service.execute({ action: 'mobile.spec' });

    expect(snapshot.mobileCompanionSpec.ios.storeBinaryClaimed).toBe(false);
    expect(snapshot.mobileCompanionSpec.android.storeBinaryClaimed).toBe(false);
    expect(snapshot.desktopTraySpec.binaryClaimed).toBe(false);
    expect(snapshot.desktopTraySpec.status).toBe('spec-ready');
  });
});
