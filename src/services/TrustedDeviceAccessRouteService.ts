
import * as http from 'http';
import { TrustedDeviceAccessService, type TrustedDeviceAccessScope } from './TrustedDeviceAccessService.js';
import { asErrorLike } from '../utils/errorLike.js';

type LocalAccessRouteDeps = {
  readJsonBody: (req: http.IncomingMessage) => Promise<Record<string, unknown>>;
  writeJson: (res: http.ServerResponse, body: unknown, statusCode?: number) => void;
  authService?: {
    resolveAuthenticatedIdentity: (req: http.IncomingMessage) => {
      authenticated: true;
      source: string;
      userId: string;
      profileId: string | null;
    } | null;
  };
};

export class TrustedDeviceAccessRouteService {
  public constructor(
    private readonly localAccess: TrustedDeviceAccessService,
    private readonly ownerSource: 'zavorthControl-token' | 'zavorthControl-token',
  ) {}

  public async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    deps: LocalAccessRouteDeps,
  ): Promise<boolean> {
    const identity = deps.authService?.resolveAuthenticatedIdentity(req) || null;
    if (identity?.source !== this.ownerSource) {
      deps.writeJson(res, { ok: false, error: 'Owner authentication required' }, 403);
      return true;
    }

    if (pathname === '/api/v2/local-access/devices' && req.method === 'GET') {
      deps.writeJson(res, {
        ok: true,
        devices: this.localAccess.listDevices(),
      });
      return true;
    }

    if (pathname === '/api/v2/local-access/pairing-draft' && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      try {
        const draft = this.localAccess.createPairingRequest({
          deviceName: this.readOptionalString(body.deviceName) || this.readOptionalString(body.name) || 'Trusted device',
          requestedScopes: this.readTrustedDeviceScopes(body.scopes || body.requestedScopes),
          requestedBy: identity.userId,
          ttlMs: this.readPositiveNumber(body.ttlMs),
          deviceTtlMs: this.readDeviceTtlMs(body),
        });
        deps.writeJson(res, {
          ok: true,
          data: {
            requestId: draft.requestId,
            deviceName: draft.deviceName,
            pairingCode: draft.pairingCode,
            scopes: draft.scopes,
            expiresAt: draft.expiresAt,
          },
          receipt: draft.receipt,
        });
      } catch (error: unknown) {
        const err = asErrorLike(error);
        deps.writeJson(res, {
          ok: false,
          error: error instanceof Error ? err.message : 'Invalid local access request',
        }, 400);
      }
      return true;
    }

    if (pathname === '/api/v2/local-access/pairing-approve' && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      const requestId = this.readOptionalString(body.requestId);
      if (!requestId) {
        deps.writeJson(res, { ok: false, error: 'bad-request' }, 400);
        return true;
      }
      const result = this.localAccess.approvePairingRequest({
        requestId,
        approvedBy: identity.userId,
        userId: identity.userId,
        profileId: identity.profileId,
      });
      if (!result.ok) {
        deps.writeJson(res, { ok: false, error: result.reason }, result.reason === 'not-found' ? 404 : 409);
        return true;
      }
      deps.writeJson(res, {
        ok: true,
        data: {
          deviceToken: result.deviceToken,
          device: result.device,
        },
        receipt: result.receipt,
      });
      return true;
    }

    if (pathname === '/api/v2/local-access/devices/revoke' && req.method === 'POST') {
      const body = await deps.readJsonBody(req);
      const deviceId = this.readOptionalString(body.deviceId);
      if (!deviceId) {
        deps.writeJson(res, { ok: false, error: 'bad-request' }, 400);
        return true;
      }
      const result = this.localAccess.revokeDevice({
        deviceId,
        revokedBy: identity.userId,
        reason: this.readOptionalString(body.reason),
      });
      if (!result.ok) {
        deps.writeJson(res, { ok: false, error: result.reason }, 404);
        return true;
      }
      deps.writeJson(res, {
        ok: true,
        device: result.device,
        receipt: result.receipt,
      });
      return true;
    }

    deps.writeJson(res, { ok: false, error: 'local access route not found.' }, 404);
    return true;
  }

  private readOptionalString(value: unknown): string | null {
    const text = String(value || '').trim();
    return text || null;
  }

  private readPositiveNumber(value: unknown): number | null {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }

  private readDeviceTtlMs(body: Record<string, unknown>): number | null | undefined {
    if (!Object.prototype.hasOwnProperty.call(body, 'deviceTtlMs')) {
      return undefined;
    }
    if (body.deviceTtlMs === null) {
      return null;
    }
    const ttlMs = this.readPositiveNumber(body.deviceTtlMs);
    if (ttlMs === null) {
      throw new Error('deviceTtlMs must be a positive number or null');
    }
    return ttlMs;
  }

  private readTrustedDeviceScopes(value: unknown): TrustedDeviceAccessScope[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }
    return value
      .map((entry) => String(entry || '').trim())
      .filter(Boolean) as TrustedDeviceAccessScope[];
  }
}
