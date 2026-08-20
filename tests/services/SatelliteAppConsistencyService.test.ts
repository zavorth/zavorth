import type { SatelliteAppConsistencySurface } from '../../src/contracts/SatelliteAppConsistencyContract.js';
import { WebRemoteAppConsistencyService as SatelliteAppConsistencyService } from '../../src/services/WebRemoteAppConsistencyService.js';
import { PluginRegistryService } from '../../src/services/PluginRegistryService.js';

const entry = (service: SatelliteAppConsistencyService, surface: SatelliteAppConsistencySurface) =>
  service.buildSnapshot().entries.find((item) => item.surface === surface);

const completeSatelliteJs = [
  'new WebSocket',
  '/api/web/satellite/ws',
  'auth.challenge',
  'auth.response',
  'chat.stream_chunk',
  'nodeIdInput',
  'sharedSecretInput',
  'sharedSecret',
  'heartbeat.ping',
  'heartbeat.pong',
  'completedInvocations',
  'capabilities',
  'capability.invoke',
  'capability.result',
  'camera.capture',
  'navigator.mediaDevices',
  'getUserMedia',
  'location.read',
  'navigator.geolocation',
  'getCurrentPosition',
  'notifications.send',
  'Notification',
  'requestPermission',
  'credentials.get',
  'PublicKeyCredential',
  'webauthn',
  'navigator.vibrate',
  'vibrate(',
  'offlineQueue',
  'navigator.onLine',
  'navigator.serviceWorker',
  'heartbeatMs',
  'localStorage',
].join('\n');

describe('SatelliteAppConsistencyService Runtime gateway', () => {
  it('builds Satellite/App consistency from the current PWA without live devices', () => {
    const service = new SatelliteAppConsistencyService({
      now: () => new Date('2026-05-04T16:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.checkpoint-6');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        surfaces: 13,
        native: 2,
        backendReady: 10,
        pwaShell: 1,
        declaredOnly: 0,
        templateReady: 0,
        missing: 0,
        decisionRequired: 0,
        liveDeviceRequired: false,
        secretValuesSerialized: false,
      }),
    );
    expect(entry(service, 'pwa-shell')).toEqual(expect.objectContaining({ status: 'pwa-shell' }));
    expect(entry(service, 'transport')).toEqual(expect.objectContaining({ status: 'native' }));
    expect(entry(service, 'pairing')).toEqual(expect.objectContaining({ status: 'backend-ready' }));
    expect(entry(service, 'heartbeat')).toEqual(expect.objectContaining({ status: 'native' }));
    expect(entry(service, 'camera')).toEqual(expect.objectContaining({ status: 'backend-ready' }));
    expect(entry(service, 'biometric')).toEqual(expect.objectContaining({ status: 'backend-ready' }));
    expect(entry(service, 'native-wrapper')).toEqual(expect.objectContaining({ status: 'backend-ready' }));
    expect(snapshot.nativeWrapperDecision).toEqual(
      expect.objectContaining({
        required: false,
        recommendation: 'keep-pwa-first',
      }),
    );
  });

  it('keeps browser API gaps visible when a Satellite template only declares device features', () => {
    const partial = new SatelliteAppConsistencyService({
      files: {
        indexHtml: 'satellite.js',
        manifestJson: '"display": "standalone"\n"start_url": "/satellite"',
        serviceWorker: "caches.open\nself.addEventListener('fetch'",
        satelliteJs: 'camera.capture\nnavigator.serviceWorker\nheartbeatMs\nlocalStorage',
      },
    });
    const camera = partial.buildEntryForSurface('camera');
    const haptic = partial.buildEntryForSurface('haptic');

    expect(camera.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ marker: 'camera.capture', present: true }),
        expect.objectContaining({ marker: 'getUserMedia', present: false }),
        expect.objectContaining({ marker: 'navigator.mediaDevices', present: false }),
      ]),
    );
    expect(camera.findings.join(' ')).toContain('getUserMedia');
    expect(haptic.status).toBe('template-ready');
    expect(haptic.smokeGate.liveDeviceRequired).toBe(false);
    expect(haptic.smokeGate.command).toContain('buildEntryForSurface');
  });

  it('can certify a complete browser capability template as backend-ready in dry-run mode', () => {
    const service = new SatelliteAppConsistencyService({
      files: {
        indexHtml: 'satellite.js',
        manifestJson: '"display": "standalone"\n"start_url": "/satellite"',
        serviceWorker: "caches.open\nself.addEventListener('fetch'",
        satelliteJs: completeSatelliteJs,
      },
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.declaredOnly).toBe(0);
    expect(snapshot.summary.templateReady).toBe(0);
    expect(snapshot.summary.decisionRequired).toBe(0);
    expect(service.buildEntryForSurface('camera').status).toBe('backend-ready');
    expect(service.buildEntryForSurface('location').status).toBe('backend-ready');
    expect(service.buildEntryForSurface('notification').status).toBe('backend-ready');
    expect(service.buildEntryForSurface('biometric').status).toBe('backend-ready');
    expect(service.buildEntryForSurface('haptic').status).toBe('backend-ready');
    expect(service.buildEntryForSurface('offline').status).toBe('backend-ready');
  });

  it('emits a Satellite Plugin OS manifest that can be installed and invoked as a plan', async () => {
    const manifest = new SatelliteAppConsistencyService({
      now: () => new Date('2026-05-04T16:20:00.000Z'),
    }).buildSnapshot().generatedPluginManifests[0];
    const registry = new PluginRegistryService({
      now: () => new Date('2026-05-04T16:21:00.000Z'),
      manifests: [manifest],
    });

    expect(manifest.id).toBe('zavorth.device.satellite');
    expect(manifest.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'satellite.connect', intent: 'satellite_management' }),
        expect.objectContaining({ id: 'camera.capture', intent: 'camera_capture' }),
        expect.objectContaining({ id: 'location.read', intent: 'location_read' }),
        expect.objectContaining({ id: 'notifications.send', intent: 'notification_send' }),
        expect.objectContaining({ id: 'biometric.approve', intent: 'biometric_approval' }),
        expect.objectContaining({ id: 'haptic.vibrate', intent: 'haptic_feedback' }),
      ]),
    );
    expect(registry.install(manifest.id, { approved: true }).status).toBe('applied');
    expect(registry.enable(manifest.id, { approved: true }).status).toBe('applied');
    await expect(registry.invoke({
      pluginId: manifest.id,
      capabilityId: 'camera.capture',
      approved: true,
    })).resolves.toEqual(expect.objectContaining({ status: 'planned' }));
  });

  it('keeps Satellite interactive action cards wired into the browser runtime', () => {
    const satelliteJs = completeSatelliteJs + [
      'renderActionCard',
      'handleAction',
      'action.request',
      'approval.request',
      'capability.result',
      'actionId',
      'decision',
    ].join('\n');

    const service = new SatelliteAppConsistencyService({
      files: {
        indexHtml: 'satellite.js',
        manifestJson: '"display": "standalone"\n"start_url": "/satellite"',
        serviceWorker: "caches.open\nself.addEventListener('fetch'",
        satelliteJs,
      },
    });

    expect(service.buildEntryForSurface('node-invoke').evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ marker: 'capability.result', present: true }),
      ]),
    );
    expect(satelliteJs).toContain('renderActionCard');
    expect(satelliteJs).toContain('handleAction');
    expect(satelliteJs).toContain('action.request');
    expect(satelliteJs).toContain('approval.request');
  });
});
