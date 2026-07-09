import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { config } from '../../src/config/index.js';
import { ZavorthControlAuthService } from '../../src/services/ZavorthControlAuthService.js';
import { TrustedDeviceAccessService } from '../../src/services/TrustedDeviceAccessService.js';

describe('ZavorthControlAuthService', () => {
  const originalWebAuthToken = config.zavorthWebAuthToken;
  const originalWebAuthTokenFile = config.zavorthWebAuthTokenFile;
  const originalTrustedDeviceAccessStateFile = config.trustedDeviceAccessStateFile;
  const originalHighRiskApprovalPin = config.highRiskApprovalPin;
  const originalJwtSecret = process.env.ZAVORTH_CONTROL_JWT_SECRET;
  const originalJwtIssuer = process.env.ZAVORTH_CONTROL_JWT_ISSUER;
  const originalJwtAudience = process.env.ZAVORTH_CONTROL_JWT_AUDIENCE;
  const tempDirs: string[] = [];

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
    config.zavorthWebAuthTokenFile = originalWebAuthTokenFile;
    config.trustedDeviceAccessStateFile = originalTrustedDeviceAccessStateFile;
    config.highRiskApprovalPin = originalHighRiskApprovalPin;
    restoreEnv('ZAVORTH_CONTROL_JWT_SECRET', originalJwtSecret);
    restoreEnv('ZAVORTH_CONTROL_JWT_ISSUER', originalJwtIssuer);
    restoreEnv('ZAVORTH_CONTROL_JWT_AUDIENCE', originalJwtAudience);
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('prefers ZAVORTH_WEB_AUTH_TOKEN over any other auth material', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-control-auth-env-'));
    tempDirs.push(root);
    const webSecret = 'web-secret-strong-token-32chars-min';
    config.zavorthWebAuthToken = webSecret;
    config.zavorthWebAuthTokenFile = path.join(root, 'web-token.txt');
    config.highRiskApprovalPin = '654321';

    const service = new ZavorthControlAuthService();

    expect(service.getStatus()).toEqual({
      enabled: true,
      source: 'env',
      tokenFile: config.zavorthWebAuthTokenFile,
      multiUserJwtEnabled: false,
    });
    expect(service.validate(webSecret)).toBe(true);
    expect(service.validate('654321')).toBe(false);
  });

  it('does not reuse the high-risk PIN as the web auth token', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-control-auth-runtime-'));
    tempDirs.push(root);
    const tokenFile = path.join(root, 'web-token.txt');
    config.zavorthWebAuthToken = '';
    config.zavorthWebAuthTokenFile = tokenFile;
    config.highRiskApprovalPin = '654321';

    const service = new ZavorthControlAuthService();
    const runtimeToken = fs.readFileSync(tokenFile, 'utf8').trim();

    expect(service.getStatus()).toEqual({
      enabled: true,
      source: 'runtime-file',
      tokenFile,
      multiUserJwtEnabled: false,
    });
    expect(runtimeToken).toMatch(/^bsk_cc_[A-Za-z0-9_-]{40,}$/);
    expect(runtimeToken).not.toBe('654321');
    expect(service.validate('654321')).toBe(false);
    expect(service.validate(runtimeToken)).toBe(true);
  });

  it('ignores weak placeholder web tokens and falls back to a generated runtime token', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-control-auth-weak-env-'));
    tempDirs.push(root);
    const tokenFile = path.join(root, 'web-token.txt');
    config.zavorthWebAuthToken = 'zavorth-access-2026';
    config.zavorthWebAuthTokenFile = tokenFile;

    const service = new ZavorthControlAuthService();
    const runtimeToken = fs.readFileSync(tokenFile, 'utf8').trim();

    expect(service.getStatus()).toEqual({
      enabled: true,
      source: 'runtime-file',
      tokenFile,
      multiUserJwtEnabled: false,
    });
    expect(runtimeToken).toMatch(/^bsk_cc_[A-Za-z0-9_-]{40,}$/);
    expect(service.validate('zavorth-access-2026')).toBe(false);
    expect(service.validate(runtimeToken)).toBe(true);
  });

  it('resolves a server-validated zavorthControl JWT identity when multiuser auth is configured', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-control-auth-jwt-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'bsk_cc_staticwebtokenforjwtfallbackaaaaaaaaaaaa';
    config.zavorthWebAuthTokenFile = path.join(root, 'web-token.txt');
    process.env.ZAVORTH_CONTROL_JWT_SECRET = 'jwt-secret-for-test';
    process.env.ZAVORTH_CONTROL_JWT_ISSUER = 'zavorth-test';
    process.env.ZAVORTH_CONTROL_JWT_AUDIENCE = 'zavorthControl';
    const token = signJwt({
      sub: 'maria',
      profileId: 'business',
      iss: 'zavorth-test',
      aud: 'zavorthControl',
      exp: Math.floor(Date.now() / 1000) + 60,
    }, process.env.ZAVORTH_CONTROL_JWT_SECRET);

    const service = new ZavorthControlAuthService();
    const identity = service.resolveAuthenticatedIdentity({
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(service.getStatus().multiUserJwtEnabled).toBe(true);
    expect(identity).toEqual({
      authenticated: true,
      source: 'jwt',
      userId: 'maria',
      profileId: 'business',
    });
  });

  it('does not let client identity headers impersonate another user with owner token auth', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-control-auth-owner-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'bsk_cc_staticwebtokenforownerfallbackaaaaaaaaaa';
    config.zavorthWebAuthTokenFile = path.join(root, 'web-token.txt');

    const service = new ZavorthControlAuthService();
    const identity = service.resolveAuthenticatedIdentity({
      headers: {
        authorization: `Bearer ${config.zavorthWebAuthToken}`,
        'x-zavorth-user-id': 'spoofed-maria',
        'x-zavorth-profile-id': 'spoofed-business',
      },
    });

    expect(identity).toEqual({
      authenticated: true,
      source: 'zavorthControl-token',
      userId: 'local-owner',
      profileId: config.zavorthProductMode || 'default',
    });
  });

  it('accepts runtime-control trusted device tokens without exposing the owner token', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-control-auth-trusted-device-'));
    tempDirs.push(root);
    const ownerToken = 'bsk_cc_controlownerfortrusteddevicesaaaaaaaaaaaa';
    config.zavorthWebAuthToken = ownerToken;
    config.zavorthWebAuthTokenFile = path.join(root, 'web-token.txt');
    config.trustedDeviceAccessStateFile = path.join(root, 'trusted-devices.json');
    const trustedDevices = new TrustedDeviceAccessService({
      stateFilePath: config.trustedDeviceAccessStateFile,
      now: () => new Date('2026-06-07T12:00:00.000Z'),
      randomBytes: (size) => Buffer.alloc(size, 11),
      idFactory: (() => {
        let next = 0;
        return (prefix: string) => `${prefix}-${++next}`;
      })(),
    });
    const draft = trustedDevices.createPairingRequest({
      deviceName: 'Satellite',
      requestedScopes: ['runtime:control', 'approval:respond'],
      requestedBy: 'local-owner',
    });
    const approved = trustedDevices.approvePairingRequest({
      requestId: draft.requestId,
      approvedBy: 'local-owner',
    });

    const service = new ZavorthControlAuthService();
    const identity = service.resolveAuthenticatedIdentity({
      headers: { authorization: `Bearer ${approved.deviceToken}` },
    });

    expect(approved.deviceToken).not.toBe(ownerToken);
    expect(identity).toEqual({
      authenticated: true,
      source: 'trusted-device',
      userId: 'local-owner',
      profileId: 'default',
      deviceId: approved.device.deviceId,
      scopes: ['runtime:control', 'approval:respond'],
    });
  });

  it('rejects trusted device tokens without runtime-control scope for control auth', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-control-auth-trusted-device-scope-'));
    tempDirs.push(root);
    const ownerToken = 'bsk_cc_controlownerforscopeddevicesaaaaaaaaaaaa';
    config.zavorthWebAuthToken = ownerToken;
    config.zavorthWebAuthTokenFile = path.join(root, 'web-token.txt');
    config.trustedDeviceAccessStateFile = path.join(root, 'trusted-devices.json');
    const trustedDevices = new TrustedDeviceAccessService({
      stateFilePath: config.trustedDeviceAccessStateFile,
      now: () => new Date('2026-06-07T12:00:00.000Z'),
      randomBytes: (size) => Buffer.alloc(size, 12),
      idFactory: (() => {
        let next = 0;
        return (prefix: string) => `${prefix}-${++next}`;
      })(),
    });
    const draft = trustedDevices.createPairingRequest({
      deviceName: 'Approval device',
      requestedScopes: ['approval:respond'],
      requestedBy: 'local-owner',
    });
    const approved = trustedDevices.approvePairingRequest({
      requestId: draft.requestId,
      approvedBy: 'local-owner',
    });

    const service = new ZavorthControlAuthService();
    const identity = service.resolveAuthenticatedIdentity({
      headers: { authorization: `Bearer ${approved.deviceToken}` },
    });

    expect(approved.deviceToken).not.toBe(ownerToken);
    expect(identity).toBeNull();
  });
});

function signJwt(claims: Record<string, unknown>, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header), 'utf8').toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
