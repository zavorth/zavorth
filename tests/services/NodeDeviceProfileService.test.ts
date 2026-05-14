import { NodeDeviceProfileService } from '../../src/services/NodeDeviceProfileService.js';

describe('NodeDeviceProfileService', () => {
  it('resolves profile ids and aliases consistently', () => {
    const service = new NodeDeviceProfileService();
    const headlessProfile = service.resolveProfile('headless-worker');
    const desktopProfile = service.resolveProfile('desktop-companion');

    expect(service.normalizeProfileId('desktop')).toBe('desktop-companion');
    expect(service.normalizeProfileId('mobile')).toBe('mobile-companion');
    expect(service.resolveProfile('browser')).toEqual(
      expect.objectContaining({
        id: 'browser-companion',
        kind: 'browser',
      }),
    );
    expect(service.resolveProfile(null, 'desktop')).toEqual(
      expect.objectContaining({
        id: 'desktop-companion',
      }),
    );
    expect(headlessProfile.defaultCapabilityIds).toEqual(
      expect.arrayContaining(['device.info', 'system.run', 'files.read', 'files.write', 'files.watch', 'browser.proxy']),
    );
    expect(desktopProfile.defaultCapabilityIds).toEqual(
      expect.arrayContaining(['device.info', 'screen.capture', 'files.read', 'files.write', 'files.watch', 'clipboard.read', 'clipboard.write']),
    );
    expect(service.resolveProfile('mobile').defaultCapabilityIds).toEqual(
      expect.arrayContaining(['device.info', 'camera.capture', 'notifications.send', 'location.read']),
    );
    expect(service.listRecommendedProfiles()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'headless-worker' }),
        expect.objectContaining({ id: 'desktop-companion' }),
        expect.objectContaining({ id: 'browser-companion' }),
        expect.objectContaining({ id: 'mobile-companion' }),
      ]),
    );
  });
});
