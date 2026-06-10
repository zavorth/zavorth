import fs from 'fs';
import os from 'os';
import path from 'path';
import { TrustedDeviceAccessService } from '../../src/services/TrustedDeviceAccessService.js';

describe('TrustedDeviceAccessService', () => {
  const tempDirs: string[] = [];
  let now = new Date('2026-06-07T12:00:00.000Z');

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
    now = new Date('2026-06-07T12:00:00.000Z');
  });

  it('creates an owner-approved device grant without persisting raw tokens or pairing codes', () => {
    const service = createService();

    const draft = service.createPairingRequest({
      deviceName: 'Ana phone',
      requestedScopes: ['chat:send', 'approval:respond'],
      requestedBy: 'local-owner',
      ttlMs: 60_000,
    });
    const approved = service.approvePairingRequest({
      requestId: draft.requestId,
      approvedBy: 'local-owner',
    });
    const stateText = fs.readFileSync(service.stateFilePath, 'utf8');

    expect(draft.pairingCode).toMatch(/^ZV-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(approved.deviceToken).toMatch(/^zv_ld_[A-Za-z0-9_-]{40,}$/);
    expect(stateText).not.toContain(draft.pairingCode);
    expect(stateText).not.toContain(approved.deviceToken);
    expect(approved.receipt.secretRedacted).toBe(true);
    expect(JSON.stringify(approved.receipt)).not.toContain(approved.deviceToken);
    expect(service.listDevices()[0]).toMatchObject({
      deviceId: approved.device.deviceId,
      name: 'Ana phone',
      status: 'active',
      scopes: ['chat:send', 'approval:respond'],
    });
    expect(JSON.stringify(service.listDevices())).not.toContain('tokenHash');

    expect(service.validateBearerToken(approved.deviceToken, {
      requiredScopes: ['approval:respond'],
    })).toMatchObject({
      ok: true,
      identity: {
        source: 'trusted-device',
        deviceId: approved.device.deviceId,
        userId: 'local-owner',
        scopes: ['chat:send', 'approval:respond'],
      },
    });
    expect(service.validateBearerToken(approved.deviceToken)).toMatchObject({
      ok: true,
      identity: {
        deviceId: approved.device.deviceId,
      },
    });
    expect(service.validateBearerToken(approved.deviceToken, {
      requiredScopes: ['runtime:control'],
    })).toMatchObject({
      ok: false,
      reason: 'missing-scope',
    });
  });

  it('expires pairing requests and device grants without accepting stale secrets', () => {
    const service = createService();
    const draft = service.createPairingRequest({
      deviceName: 'Travel tablet',
      requestedScopes: ['chat:read'],
      requestedBy: 'local-owner',
      ttlMs: 500,
    });

    now = new Date('2026-06-07T12:00:01.000Z');

    expect(service.approvePairingRequest({
      requestId: draft.requestId,
      approvedBy: 'local-owner',
    })).toMatchObject({
      ok: false,
      reason: 'expired',
    });

    now = new Date('2026-06-07T12:02:00.000Z');
    const fresh = service.createPairingRequest({
      deviceName: 'Short lived device',
      requestedScopes: ['chat:read'],
      requestedBy: 'local-owner',
      deviceTtlMs: 1000,
    });
    const approved = service.approvePairingRequest({
      requestId: fresh.requestId,
      approvedBy: 'local-owner',
    });
    expect(approved.ok).toBe(true);

    now = new Date('2026-06-07T12:02:02.000Z');

    expect(service.validateBearerToken(approved.deviceToken, {
      requiredScopes: ['chat:read'],
    })).toMatchObject({
      ok: false,
      reason: 'expired',
    });
  });

  it('preserves explicit never-expiring device grants', () => {
    const service = createService({ defaultDeviceTtlMs: null });
    const draft = service.createPairingRequest({
      deviceName: 'Desk device',
      requestedScopes: ['chat:read'],
      requestedBy: 'local-owner',
    });
    const approved = service.approvePairingRequest({
      requestId: draft.requestId,
      approvedBy: 'local-owner',
    });

    now = new Date('2027-06-07T12:00:00.000Z');

    expect(approved.device.expiresAt).toBeNull();
    expect(service.validateBearerToken(approved.deviceToken, {
      requiredScopes: ['chat:read'],
    })).toMatchObject({
      ok: true,
      identity: {
        deviceId: approved.device.deviceId,
      },
    });
  });

  it('fails closed on unreadable state instead of replacing it with an empty file', () => {
    const service = createService();
    fs.mkdirSync(path.dirname(service.stateFilePath), { recursive: true });
    fs.writeFileSync(service.stateFilePath, '{not-json', 'utf8');

    expect(() => service.listDevices()).toThrow(/failed to read trusted-device access state/i);
    expect(fs.readFileSync(service.stateFilePath, 'utf8')).toBe('{not-json');
  });

  it('revokes device grants and records redacted receipts', () => {
    const service = createService();
    const draft = service.createPairingRequest({
      deviceName: 'Remote approvals',
      requestedScopes: ['approval:respond'],
      requestedBy: 'local-owner',
    });
    const approved = service.approvePairingRequest({
      requestId: draft.requestId,
      approvedBy: 'local-owner',
    });

    const revoked = service.revokeDevice({
      deviceId: approved.device.deviceId,
      revokedBy: 'local-owner',
      reason: 'lost device',
    });

    expect(revoked).toMatchObject({
      ok: true,
      receipt: {
        action: 'trusted-device.revoked',
        deviceId: approved.device.deviceId,
        secretRedacted: true,
      },
    });
    expect(service.validateBearerToken(approved.deviceToken, {
      requiredScopes: ['approval:respond'],
    })).toMatchObject({
      ok: false,
      reason: 'revoked',
    });
    expect(JSON.stringify(revoked)).not.toContain(approved.deviceToken);
  });

  it('rejects invalid scope requests instead of silently widening access', () => {
    const service = createService();

    expect(() => service.createPairingRequest({
      deviceName: 'Bad scope',
      requestedScopes: ['chat:send', 'policy:override'] as any,
      requestedBy: 'local-owner',
    })).toThrow(/unsupported trusted-device scope/i);
  });

  function createService(options: {
    defaultDeviceTtlMs?: number | null;
  } = {}): TrustedDeviceAccessService {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-trusted-device-'));
    tempDirs.push(root);
    return new TrustedDeviceAccessService({
      stateFilePath: path.join(root, 'trusted-devices.json'),
      now: () => now,
      randomBytes: (size) => Buffer.alloc(size, 7),
      defaultDeviceTtlMs: options.defaultDeviceTtlMs,
      idFactory: (() => {
        let next = 0;
        return (prefix: string) => `${prefix}-${++next}`;
      })(),
    });
  }
});
