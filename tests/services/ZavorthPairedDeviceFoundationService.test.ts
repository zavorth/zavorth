import { ZavorthPairedDeviceFoundationService } from '../../src/services/ZavorthPairedDeviceFoundationService.js';

describe('ZavorthPairedDeviceFoundationService', () => {
  it('describes the paired-device foundation without requiring native mobile apps yet', () => {
    const service = new ZavorthPairedDeviceFoundationService({
      now: () => new Date('2026-07-02T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.status).toBe('foundation-ready');
    expect(snapshot.summary.nativeMobileAppRequiredNow).toBe(false);
    expect(snapshot.summary.futureNativeTargets).toEqual(['ios', 'android']);
    expect(snapshot.capabilities.map((capability) => capability.id)).toEqual(expect.arrayContaining([
      'device.info',
      'camera.capture',
      'location.read',
      'device.confirm',
      'haptics.vibrate',
      'notifications.send',
    ]));
    expect(snapshot.pairing.claimEndpoint).toBe('/api/node-mesh/pairing/claim');
    expect(snapshot.heartbeat.endpoint).toBe('/api/node-mesh/heartbeat');
    expect(snapshot.invocation.queueMode).toBe('heartbeat-delivered');
    expect(snapshot.safety.mobileAppsNotRequiredForFoundation).toBe(true);
    expect(snapshot.safety.sensitiveCapabilitiesRequireApproval).toBe(true);
    expect(snapshot.safety.noLiveIoDuringFoundationCheck).toBe(true);
  });

  i