import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { config } from '../../src/config/index.js';
import { DashboardAuthService } from '../../src/services/DashboardAuthService.js';

describe('DashboardAuthService', () => {
  const originalWebAuthToken = config.zavorthWebAuthToken;
  const originalWebAuthTokenFile = config.zavorthWebAuthTokenFile;
  const originalHighRiskApprovalPin = config.highRiskApprovalPin;
  const originalJwtSecret = process.env.ZAVORTH_DASHBOARD_JWT_SECRET;
  const originalJwtIssuer = process.env.ZAVORTH_DASHBOARD_JWT_ISSUER;
  const originalJwtAudience = process.env.ZAVORTH_DASHBOARD_JWT_AUDIENCE;
  const tempDirs: string[] = [];

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
    config.zavorthWebAuthTokenFile = originalWebAuthTokenFile;
    config.highRiskApprovalPin = originalHighRiskApprovalPin;
    restoreEnv('ZAVORTH_DASHBOARD_JWT_SECRET', originalJwtSecret);
    restoreEnv('ZAVORTH_DASHBOARD_JWT_ISSUER', originalJwtIssuer);
    restoreEnv('ZAVORTH_DASHBOARD_JWT_AUDIENCE', originalJwtAudience);
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('prefers ZAVORTH_WEB_AUTH_TOKEN over any other auth material', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-auth-env-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.zavorthWebAuthTokenFile = path.join(root, 'web-token.txt');
    config.highRiskApprovalPin = '654321';

    const service = new DashboardAuthService();

    expect(service.getStatus()).toEqual({
      enabled: true,
      source: 'env',
      tokenFile: config.zavorthWebAuthTokenFile,
      multiUserJwtEnabled: false,
    });
    expect(service.validate('web-secret')).toBe(true);
    expect(service.validate('654321')).toBe(false);
  });

  it('does not reuse the high-risk PIN as the web auth token', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-auth-runtime-'));
    tempDirs.push(root);
    const tokenFile = path.join(root, 'web-token.txt');
    config.zavorthWebAuthToken = '';
    config.zavorthWebAuthTokenFile = tokenFile;
    config.highRiskApprovalPin = '654321';

    const service = new DashboardAuthService();
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
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-auth-weak-env-'));
    tempDirs.push(root);
    const tokenFile = path.join(root, 'web-token.txt');
    config.zavorthWebAuthToken = 'zavorth-access-2026';
    config.zavorthWebAuthTokenFile = tokenFile;

    const service = new DashboardAuthService();
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

  it('resolves a server-validated dashboard JWT identity when multiuser auth is configured', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-auth-jwt-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'bsk_cc_staticwebtokenforjwtfallbackaaaaaaaaaaaa';
    config.zavorthWebAuthTokenFile = path.join(root, 'web-token.txt');
    process.env.ZAVORTH_DASHBOARD_JWT_SECRET = 'jwt-secret-for-test';
    process.env.ZAVORTH_DASHBOARD_JWT_ISSUER = 'zavorth-test';
    process.env.ZAVORTH_DASHBOARD_JWT_AUDIENCE = 'dashboard';
    const token = signJwt({
      sub: 'maria',
      profileId: 'business',
      iss: 'zavorth-test',
      aud: 'dashboard',
      exp: Math.floor(Date.now() / 1000) + 60,
    }, process.env.ZAVORTH_DASHBOARD_JWT_SECRET);

    const service = new DashboardAuthService();
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
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-auth-owner-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'bsk_cc_staticwebtokenforownerfallbackaaaaaaaaaa';
    config.zavorthWebAuthTokenFile = path.join(root, 'web-token.txt');

    const service = new DashboardAuthService();
    const identity = service.resolveAuthenticatedIdentity({
      headers: {
        authorization: `Bearer ${config.zavorthWebAuthToken}`,
        'x-zavorth-user-id': 'spoofed-maria',
        'x-zavorth-profile-id': 'spoofed-business',
      },
    });

    expect(identity).toEqual({
      authenticated: true,
      source: 'dashboard-token',
      userId: 'local-owner',
      profileId: config.zavorthProductMode || 'default',
    });
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
