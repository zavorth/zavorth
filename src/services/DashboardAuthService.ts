import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { generateDashboardToken, isWeakDashboardToken } from './DashboardTokenService.js';
import {
  TrustedDeviceAccessService,
  type TrustedDeviceAccessScope,
  type TrustedDeviceIdentity,
} from './TrustedDeviceAccessService.js';

type AuthStatus = {
  enabled: boolean;
  source: 'env' | 'runtime-file';
  tokenFile: string;
  multiUserJwtEnabled: boolean;
};

export type DashboardAuthenticatedIdentity = {
  authenticated: true;
  source: 'jwt' | 'dashboard-token';
  userId: string;
  profileId: string | null;
} | TrustedDeviceIdentity;

export class DashboardAuthService {
  private readonly token: string;
  private readonly status: AuthStatus;
  private readonly trustedDevices: TrustedDeviceAccessService;

  constructor(options: { trustedDevices?: TrustedDeviceAccessService } = {}) {
    const resolved = this.resolveToken();
    this.token = resolved.token;
    this.status = resolved.status;
    this.trustedDevices = options.trustedDevices || new TrustedDeviceAccessService();
  }

  public validate(candidate: string | null | undefined): boolean {
    const provided = String(candidate || '').trim();
    if (!provided) {
      return false;
    }

    const expectedBuffer = Buffer.from(this.token, 'utf8');
    const providedBuffer = Buffer.from(provided, 'utf8');
    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  }

  public getStatus(): AuthStatus {
    return { ...this.status };
  }

  public resolveAuthenticatedIdentity(req: {
    headers?: Record<string, string | string[] | undefined>;
  }): DashboardAuthenticatedIdentity | null {
    const token = this.resolveRequestToken(req);
    const jwtIdentity = this.resolveJwtIdentity(token)
      || this.resolveJwtIdentity(this.readHeaderString(req, 'x-zavorth-identity-jwt'));
    if (jwtIdentity) {
      return jwtIdentity;
    }
    if (this.validate(token)) {
      return {
        authenticated: true,
        source: 'dashboard-token',
        userId: 'local-owner',
        profileId: config.zavorthProductMode || 'default',
      };
    }
    return this.resolveTrustedDeviceIdentity(req, { requiredScopes: ['runtime:control'] });
  }

  public resolveTrustedDeviceIdentity(req: {
    headers?: Record<string, string | string[] | undefined>;
  }, options: {
    requiredScopes?: TrustedDeviceAccessScope[];
  } = {}): TrustedDeviceIdentity | null {
    const token = this.resolveRequestToken(req);
    const validated = this.trustedDevices.validateBearerToken(token, {
      requiredScopes: options.requiredScopes || [],
    });
    if (validated.ok) {
      return validated.identity;
    }
    return null;
  }

  private resolveToken(): { token: string; status: AuthStatus } {
    const envToken = String(config.zavorthWebAuthToken || '').trim();
    if (envToken && !isWeakDashboardToken(envToken)) {
      return {
        token: envToken,
        status: {
          enabled: true,
          source: 'env',
          tokenFile: config.zavorthWebAuthTokenFile,
          multiUserJwtEnabled: this.hasJwtSecret(),
        },
      };
    }

    const tokenFile = config.zavorthWebAuthTokenFile;
    const existingToken = this.readTokenFile(tokenFile);
    if (existingToken) {
      return {
        token: existingToken,
        status: {
          enabled: true,
          source: 'runtime-file',
          tokenFile,
          multiUserJwtEnabled: this.hasJwtSecret(),
        },
      };
    }

    const generated = generateDashboardToken();
    fs.mkdirSync(path.dirname(tokenFile), { recursive: true });
    fs.writeFileSync(tokenFile, generated, 'utf8');
    return {
      token: generated,
      status: {
        enabled: true,
        source: 'runtime-file',
        tokenFile,
        multiUserJwtEnabled: this.hasJwtSecret(),
      },
    };
  }

  private resolveRequestToken(req: {
    headers?: Record<string, string | string[] | undefined>;
  }): string {
    const authorization = this.readHeaderString(req, 'authorization');
    const bearer = authorization.toLowerCase().startsWith('bearer ')
      ? authorization.slice('bearer '.length).trim()
      : '';
    return bearer || this.readHeaderString(req, 'x-zavorth-token');
  }

  private resolveJwtIdentity(token: string): DashboardAuthenticatedIdentity | null {
    const secret = this.getJwtSecret();
    if (!secret || !token || token.split('.').length !== 3) {
      return null;
    }
    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
    try {
      const header = JSON.parse(this.decodeBase64Url(encodedHeader)) as Record<string, unknown>;
      if (header.alg !== 'HS256') {
        return null;
      }
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64url');
      if (!this.timingSafeStringEquals(expectedSignature, encodedSignature)) {
        return null;
      }
      const claims = JSON.parse(this.decodeBase64Url(encodedPayload)) as Record<string, unknown>;
      const nowSeconds = Math.floor(Date.now() / 1000);
      const exp = typeof claims.exp === 'number' ? claims.exp : null;
      const nbf = typeof claims.nbf === 'number' ? claims.nbf : null;
      if (exp !== null && exp <= nowSeconds) {
        return null;
      }
      if (nbf !== null && nbf > nowSeconds) {
        return null;
      }
      const expectedIssuer = String(process.env.ZAVORTH_DASHBOARD_JWT_ISSUER || '').trim();
      const expectedAudience = String(process.env.ZAVORTH_DASHBOARD_JWT_AUDIENCE || '').trim();
      if (expectedIssuer && String(claims.iss || '') !== expectedIssuer) {
        return null;
      }
      const audience = claims.aud;
      if (expectedAudience && !this.claimAudienceMatches(audience, expectedAudience)) {
        return null;
      }
      const userId = this.readClaimString(claims, ['sub', 'userId', 'uid', 'email']);
      if (!userId) {
        return null;
      }
      return {
        authenticated: true,
        source: 'jwt',
        userId,
        profileId: this.readClaimString(claims, [
          'profileId',
          'tenantId',
          'organizationId',
          'orgId',
          'productModeId',
        ]),
      };
    } catch {
      return null;
    }
  }

  private readClaimString(claims: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = claims[key];
      if (typeof value !== 'string') {
        continue;
      }
      const normalized = value.trim();
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  private claimAudienceMatches(value: unknown, expected: string): boolean {
    if (typeof value === 'string') {
      return value === expected;
    }
    if (Array.isArray(value)) {
      return value.some((entry) => entry === expected);
    }
    return false;
  }

  private decodeBase64Url(value: string): string {
    return Buffer.from(value, 'base64url').toString('utf8');
  }

  private timingSafeStringEquals(expected: string, provided: string): boolean {
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const providedBuffer = Buffer.from(provided || '', 'utf8');
    return expectedBuffer.length === providedBuffer.length
      && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  }

  private readHeaderString(
    req: { headers?: Record<string, string | string[] | undefined> },
    name: string,
  ): string {
    const raw = req.headers?.[name.toLowerCase()] ?? req.headers?.[name];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return String(value || '').trim();
  }

  private getJwtSecret(): string {
    return String(
      process.env.ZAVORTH_DASHBOARD_JWT_SECRET
      || process.env.ZAVORTH_WEB_AUTH_JWT_SECRET
      || '',
    ).trim();
  }

  private hasJwtSecret(): boolean {
    return Boolean(this.getJwtSecret());
  }

  private readTokenFile(filePath: string): string | null {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const token = fs.readFileSync(filePath, 'utf8').trim();
      return token || null;
    } catch {
      return null;
    }
  }
}
