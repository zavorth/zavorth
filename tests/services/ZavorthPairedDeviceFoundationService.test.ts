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

  it('approves pending devices with public trust metadata and keeps denied scopes out of capability inspection', () => {
    const service = new ZavorthPairedDeviceFoundationService({
      now: () => new Date('2026-07-02T12:00:00.000Z'),
      devices: [{
        id: 'phone-1',
        label: 'Operator Phone',
        status: 'pending',
        publicKey: 'zavorth-device-key-v1',
        transport: 'mock-device-node',
        scopes: ['device:info'],
        capabilities: ['device.info', 'camera.capture'],
        lastSeenAt: null,
        trust: {
          level: 'untrusted',
          approvedAt: null,
          approvedBy: null,
          revokedAt: null,
          revokedBy: null,
          blockedAt: null,
          blockedBy: null,
          keyRotatedAt: null,
          trustReceiptId: null,
        },
      }],
    });

    const approval = service.approveDevice('phone-1', {
      actor: 'operator',
      scopes: ['device:info'],
      reason: 'Approve device identity only.',
    });
    const cameraInspection = service.inspectCapability('phone-1', 'camera.capture', {
      requiredScope: 'device:camera',
    });

    expect(approval.ok).toBe(true);
    expect(approval.device?.status).toBe('approved');
    expect(approval.device?.publicKey).toBe('zavorth-device-key-v1');
    expect(approval.device?.transport).toBe('mock-device-node');
    expect(approval.device?.trust).toEqual(expect.objectContaining({
      level: 'trusted',
      approvedAt: '2026-07-02T12:00:00.000Z',
      approvedBy: 'operator',
      trustReceiptId: approval.receipt.id,
    }));
    expect(approval.receipt).toEqual(expect.objectContaining({
      action: 'approve',
      status: 'allowed',
      previousStatus: 'pending',
      nextStatus: 'approved',
      auditTrail: 'paired-device-foundation',
    }));
    expect(cameraInspection).toEqual(expect.objectContaining({
      ok: false,
      status: 'scope-denied',
      deviceStatus: 'approved',
      requiredScope: 'device:camera',
    }));
  });

  it('enforces revoked and blocked transitions before approval and capability access', () => {
    const service = new ZavorthPairedDeviceFoundationService({
      now: () => new Date('2026-07-02T12:00:00.000Z'),
      devices: [{
        id: 'phone-2',
        label: 'Field Phone',
        status: 'pending',
        publicKey: 'zavorth-device-key-v2',
        transport: 'mock-device-node',
        scopes: ['device:info', 'device:camera'],
        capabilities: ['device.info', 'camera.capture'],
        lastSeenAt: null,
        trust: {
          level: 'untrusted',
          approvedAt: null,
          approvedBy: null,
          revokedAt: null,
          revokedBy: null,
          blockedAt: null,
          blockedBy: null,
          keyRotatedAt: null,
          trustReceiptId: null,
        },
      }],
    });

    const revoked = service.revokeDevice('phone-2', {
      actor: 'operator',
      reason: 'Lost device.',
    });
    const approveRevoked = service.approveDevice('phone-2', {
      actor: 'operator',
      scopes: ['device:info', 'device:camera'],
      reason: 'Attempted reapproval.',
    });
    const blocked = service.blockDevice('phone-2', {
      actor: 'security',
      reason: 'Escalated after loss report.',
    });
    const approveBlocked = service.approveDevice('phone-2', {
      actor: 'operator',
      scopes: ['device:info'],
      reason: 'Attempted unblock through approval.',
    });
    const inspection = service.inspectCapability('phone-2', 'device.info', {
      requiredScope: 'device:info',
    });

    expect(revoked.ok).toBe(true);
    expect(revoked.device?.status).toBe('revoked');
    expect(approveRevoked.ok).toBe(false);
    expect(approveRevoked.receipt.status).toBe('denied');
    expect(approveRevoked.receipt.previousStatus).toBe('revoked');
    expect(blocked.ok).toBe(true);
    expect(blocked.device?.status).toBe('blocked');
    expect(approveBlocked.ok).toBe(false);
    expect(approveBlocked.receipt.previousStatus).toBe('blocked');
    expect(inspection).toEqual(expect.objectContaining({
      ok: false,
      status: 'status-denied',
      deviceStatus: 'blocked',
    }));
  });

  it('drops unknown scopes and capabilities from device foundation records', () => {
    const service = new ZavorthPairedDeviceFoundationService({
      now: () => new Date('2026-07-02T12:00:00.000Z'),
      devices: [{
        id: 'phone-3',
        label: 'Unknown Scope Phone',
        status: 'pending',
        publicKey: 'zavorth-device-key-v3',
        transport: 'mock-device-node',
        scopes: ['device:info', 'device:root' as any],
        capabilities: ['device.info', 'host.root' as any],
        lastSeenAt: null,
        trust: {
          level: 'untrusted',
          approvedAt: null,
          approvedBy: null,
          revokedAt: null,
          revokedBy: null,
          blockedAt: null,
          blockedBy: null,
          keyRotatedAt: null,
          trustReceiptId: null,
        },
      }],
    });

    const device = service.listDevices()[0];

    expect(device.scopes).toEqual(['device:info']);
    expect(device.capabilities).toEqual(['device.info']);
  });
});
