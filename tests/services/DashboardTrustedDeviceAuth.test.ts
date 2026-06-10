import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index.js';
import { DashboardAuthService } from '../../src/services/DashboardAuthService.js';
import { TrustedDeviceAccessService } from '../../src/services/TrustedDeviceAccessService.js';

describe('Dashboard trusted device authentication', () => {
  const originalWebAuthToken = config.zavorthWebAuthToken;
  const originalWebAuthTokenFile = config.zavorthWebAuthTokenFile;
  const originalTrustedDeviceAccessStateFile = config.trustedDeviceAccessStateFile;
  const tempDirs: string[] = [];

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
    config.zavorthWebAuthTokenFile = originalWebAuthTokenFile;
    config.trustedDeviceAccessStateFile = originalTrustedDeviceAccessStateFile;
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('lets runtime-control device tokens unlock the local API without sharing the owner token', () => {
    const { ownerToken, deviceToken, deviceId } = arrangeApprovedDevice(['runtime:control', 'chat:send']);
    const service = new DashboardAuthService();

    expect(deviceToken).not.toBe(ownerToken);
    expect(service.resolveAuthenticatedIdentity({
      headers: { authorization: `Bearer ${deviceToken}` },
    })).toEqual({
      authenticated: true,
      source: 'trusted-device',
      userId: 'local-owner',
      profileId: 'default',
      deviceId,
      scopes: ['runtime:control', 'chat:send'],
    });
  });

  it('keeps narrow device tokens out of broad dashboard authentication while allowing scoped checks', () => {
    const { deviceToken, deviceId } = arrangeApprovedDevice(['approval:respond']);
    const service = new DashboardAuthService();

    expect(service.resolveAuthenticatedIdentity({
      headers: { authorization: `Bearer ${deviceToken}` },
    })).toBeNull();
    expect(service.resolveTrustedDeviceIdentity({
      headers: { authorization: `Bearer ${deviceToken}` },
    }, {
      requiredScopes: ['approval:respond'],
    })).toEqual({
      authenticated: true,
      source: 'trusted-device',
      userId: 'local-owner',
      profileId: 'default',
      deviceId,
      scopes: ['approval:respond'],
    });
  });

  function arrangeApprovedDevice(scopes: string[]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-trusted-device-'));
    tempDirs.push(root);
    const ownerToken = 'bsk_cc_ownerwebtokenforlocaldevicesaaaaaaaaaaaa';
    config.zavorthWebAuthToken = ownerToken;
    config.zavorthWebAuthTokenFile = path.join(root, 'web-token.txt');
    config.trustedDeviceAccessStateFile = path.join(root, 'trusted-devices.json');
    const devices = new TrustedDeviceAccessService({
      stateFilePath: config.trustedDeviceAccessStateFile,
      now: () => new Date('2026-06-07T12:00:00.000Z'),
      randomBytes: (size) => Buffer.alloc(size, 9),
      idFactory: (() => {
        let next = 0;
        return (prefix: string) => `${prefix}-${++next}`;
      })(),
    });
    const draft = devices.createPairingRequest({
      deviceName: 'Desktop companion',
      requestedScopes: scopes as any,
      requestedBy: 'local-owner',
    });
    const approved = devices.approvePairingRequest({
      requestId: draft.requestId,
      approvedBy: 'local-owner',
    });
    return {
      ownerToken,
      deviceToken: approved.deviceToken,
      deviceId: approved.device.deviceId,
    };
  }
});
