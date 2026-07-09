import crypto from 'crypto';
import fs from 'fs';
import * as http from 'http';
import { config } from '../../../config/index.js';
import { normalizeBearerToken } from '../../../config/configHelpers.js';
import { logger } from '../../../logger.js';

type EchoRouteBucket = 'read' | 'execute' | 'resolve';

type EchoRoutePolicy = {
  bucket: EchoRouteBucket;
  maxRequests: number;
};

export type EchoEdgeDecision =
  | {
      ok: true;
      headers: Record<string, string>;
    }
  | {
      ok: false;
      statusCode: number;
      body: {
        error: string;
        code: string;
      };
      headers: Record<string, string>;
    };

type EchoEdgeHardeningOptions = {
  authToken?: string;
  authTokenFile?: string;
  allowLoopbackAuthBypass?: boolean;
  trustProxyHeaders?: boolean;
  rateLimitWindowMs?: number;
  readRateLimitMaxRequests?: number;
  executeRateLimitMaxRequests?: number;
  resolveRateLimitMaxRequests?: number;
  maxBodyBytes?: number;
  now?: () => number;
};

export class EchoEdgeHardeningService {
  private readonly authToken: string;
  private readonly allowLoopbackAuthBypass: boolean;
  private readonly trustProxyHeaders: boolean;
  private readonly rateLimitWindowMs: number;
  private readonly readRateLimitMaxRequests: number;
  private readonly executeRateLimitMaxRequests: number;
  private readonly resolveRateLimitMaxRequests: number;
  private readonly maxBodyBytes: number;
  private readonly now: () => number;
  private readonly rateLimitEvents = new Map<string, number[]>();

  constructor(options: EchoEdgeHardeningOptions = {}) {
    this.authToken = this.resolveAuthToken(options);
    this.allowLoopbackAuthBypass =
      options.allowLoopbackAuthBypass ?? config.zavorthEchoEdgeAllowLoopbackAuthBypass;
    this.trustProxyHeaders = options.trustProxyHeaders ?? config.zavorthEchoEdgeTrustProxyHeaders;
    this.rateLimitWindowMs =
      sanitizeInteger(options.rateLimitWindowMs ?? config.zavorthEchoEdgeRateLimitWindowMs, 30_000);
    this.readRateLimitMaxRequests =
      sanitizeInteger(options.readRateLimitMaxRequests ?? config.zavorthEchoEdgeReadRateLimitMaxRequests, 90);
    this.executeRateLimitMaxRequests =
      sanitizeInteger(options.executeRateLimitMaxRequests ?? config.zavorthEchoEdgeExecuteRateLimitMaxRequests, 12);
    this.resolveRateLimitMaxRequests =
      sanitizeInteger(options.resolveRateLimitMaxRequests ?? config.zavorthEchoEdgeResolveRateLimitMaxRequests, 30);
    this.maxBodyBytes = sanitizeInteger(options.maxBodyBytes ?? config.zavorthEchoEdgeMaxBodyBytes, 32_768);
    this.now = options.now || (() => Date.now());
  }

  public getMaxBodyBytes(): number {
    return this.maxBodyBytes;
  }

  public evaluateRequest(req: http.IncomingMessage, pathname: string): EchoEdgeDecision | null {
    const policy = this.resolveRoutePolicy(pathname, req.method || 'GET');
    if (!policy) {
      return null;
    }

    const clientIp = this.resolveClientIp(req);
    const headers: Record<string, string> = {
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Zavorth-Echo-Edge': policy.bucket,
    };

    const bypassAllowed = this.allowLoopbackAuthBypass && this.isLoopbackAddress(clientIp);
    if (!this.authToken) {
      if (!bypassAllowed) {
        return {
          ok: false,
          statusCode: 401,
          body: {
            error: 'Token de borda Echo ausente ou invalido.',
            code: 'auth_required',
          },
          headers: {
            ...headers,
            'WWW-Authenticate': 'Bearer realm="zavorth-echo"',
          },
        };
      }
    } else {
      if (!bypassAllowed && !this.isAuthorized(req)) {
        return {
          ok: false,
          statusCode: 401,
          body: {
            error: 'Token de borda Echo ausente ou invalido.',
            code: 'auth_required',
          },
          headers: {
            ...headers,
            'WWW-Authenticate': 'Bearer realm="zavorth-echo"',
          },
        };
      }
    }

    const rateLimit = this.consumeRateLimit(policy, clientIp);
    headers['X-RateLimit-Limit'] = String(rateLimit.limit);
    headers['X-RateLimit-Remaining'] = String(rateLimit.remaining);
    headers['X-RateLimit-Reset'] = String(rateLimit.resetEpochSeconds);

    if (!rateLimit.allowed) {
      return {
        ok: false,
        statusCode: 429,
        body: {
          error: 'Limite temporario da borda Echo excedido. Aguarde antes de tentar novamente.',
          code: 'rate_limit_exceeded',
        },
        headers: {
          ...headers,
          'Retry-After': String(rateLimit.retryAfterSeconds),
        },
      };
    }

    return {
      ok: true,
      headers,
    };
  }

  private resolveAuthToken(options: EchoEdgeHardeningOptions): string {
    const explicit = String(options.authToken ?? config.zavorthEchoEdgeAuthToken ?? '').trim();
    if (explicit) {
      return explicit;
    }

    const tokenFile = String(options.authTokenFile ?? config.zavorthEchoEdgeAuthTokenFile ?? '').trim();
    if (!tokenFile || !fs.existsSync(tokenFile)) {
      return '';
    }

    try {
      return fs.readFileSync(tokenFile, 'utf8').trim();
    } catch (error: any) { const err = error; const e = error; logger.warn('[Edge Hardening] filesystem operation failed', error); return ''; }
  }

  private resolveRoutePolicy(pathname: string, method: string): EchoRoutePolicy | null {
    const canonicalPathname = this.toCanonicalEchoPathname(pathname);

    if (method === 'POST' && canonicalPathname === '/api/v2/echo/execute') {
      return {
        bucket: 'execute',
        maxRequests: this.executeRateLimitMaxRequests,
      };
    }

    if (method === 'POST' && canonicalPathname === '/api/v2/echo/audio/speech') {
      return {
        bucket: 'execute',
        maxRequests: this.executeRateLimitMaxRequests,
      };
    }

    if (method === 'POST' && canonicalPathname === '/api/v2/echo/permissions/resolve') {
      return {
        bucket: 'resolve',
        maxRequests: this.resolveRateLimitMaxRequests,
      };
    }

    if (
      method === 'GET'
      && (
        canonicalPathname === '/api/v2/echo/status'
        || canonicalPathname === '/api/v2/echo/capabilities'
        || canonicalPathname === '/api/v2/echo/workbench'
        || canonicalPathname === '/api/v2/echo/experience'
        || canonicalPathname === '/api/v2/echo/tools'
        || canonicalPathname === '/api/v2/echo/history'
        || canonicalPathname === '/api/v2/echo/snapshot'
        || canonicalPathname === '/api/v2/echo/connection'
        || canonicalPathname === '/api/v2/echo/permissions'
        || canonicalPathname === '/api/v2/echo/voice-metrics'
      )
    ) {
      return {
        bucket: 'read',
        maxRequests: this.readRateLimitMaxRequests,
      };
    }

    return null;
  }

  private toCanonicalEchoPathname(pathname: string): string {
    return pathname.startsWith('/api/v2/nexus/')
      ? pathname.replace('/api/v2/nexus/', '/api/v2/echo/')
      : pathname;
  }

  private isAuthorized(req: http.IncomingMessage): boolean {
    const expected = String(this.authToken || '').trim();
    if (!expected) {
      return true;
    }

    const bearer = normalizeBearerToken(expected);
    const candidate = readHeader(req, 'authorization')
      || normalizeBearerToken(readHeader(req, 'x-zavorth-echo-token'));
    if (!candidate) {
      return false;
    }

    const expectedBuffer = Buffer.from(bearer, 'utf8');
    const candidateBuffer = Buffer.from(candidate, 'utf8');
    if (expectedBuffer.length !== candidateBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, candidateBuffer);
  }

  private consumeRateLimit(policy: EchoRoutePolicy, clientIp: string): {
    allowed: boolean;
    limit: number;
    remaining: number;
    retryAfterSeconds: number;
    resetEpochSeconds: number;
  } {
    const limit = Math.max(0, policy.maxRequests);
    const now = this.now();
    const windowStart = now - this.rateLimitWindowMs;
    const clientKey = `${policy.bucket}:${clientIp}`;
    const entries = (this.rateLimitEvents.get(clientKey) || []).filter((timestamp) => timestamp >= windowStart);

    if (limit <= 0) {
      this.rateLimitEvents.delete(clientKey);
      return {
        allowed: true,
        limit: 0,
        remaining: 0,
        retryAfterSeconds: 0,
        resetEpochSeconds: Math.ceil(now / 1000),
      };
    }

    if (entries.length >= limit) {
      const oldest = entries[0] || now;
      const retryAfterMs = Math.max(0, (oldest + this.rateLimitWindowMs) - now);
      this.rateLimitEvents.set(clientKey, entries);
      return {
        allowed: false,
        limit,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
        resetEpochSeconds: Math.ceil((oldest + this.rateLimitWindowMs) / 1000),
      };
    }

    entries.push(now);
    this.rateLimitEvents.set(clientKey, entries);
    const oldest = entries[0] || now;
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - entries.length),
      retryAfterSeconds: 0,
      resetEpochSeconds: Math.ceil((oldest + this.rateLimitWindowMs) / 1000),
    };
  }

  private resolveClientIp(req: http.IncomingMessage): string {
    const remote = normalizeIp(req.socket?.remoteAddress || '');
    const canTrustProxyHeaders = this.trustProxyHeaders && this.isLoopbackAddress(remote);
    const forwardedFor = canTrustProxyHeaders
      ? String(readHeader(req, 'x-forwarded-for') || '').split(',')[0]?.trim()
      : '';
    const realIp = canTrustProxyHeaders ? readHeader(req, 'x-real-ip') : '';
    return normalizeIp(forwardedFor || realIp || remote || 'unknown');
  }

  private isLoopbackAddress(address: string): boolean {
    const normalized = normalizeIp(address);
    return normalized === '127.0.0.1' || normalized === '::1' || normalized === 'localhost';
  }
}

function readHeader(req: http.IncomingMessage, key: string): string {
  const value = req.headers[String(key || '').toLowerCase()];
  if (Array.isArray(value)) {
    return String(value[0] || '').trim();
  }
  return String(value || '').trim();
}

function sanitizeInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

function normalizeIp(value: string): string {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return '';
  }

  if (normalized === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }

  return normalized;
}
