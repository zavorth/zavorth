import * as http from 'http';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { DashboardAuthService } from './DashboardAuthService.js';

type UpgradeTicket = {
  expiresAt: number;
  consumed: boolean;
};

export class WebAppSecurityService {
  private readonly upgradeTickets = new Map<string, UpgradeTicket>();

  constructor(private readonly auth: DashboardAuthService) {}

  public isAuthorized(req: http.IncomingMessage): boolean {
    const resolved = this.resolveRequestToken(req);
    return this.auth.validate(resolved);
  }

  public isAuthorizedUpgrade(req: http.IncomingMessage, url: URL): boolean {
    const origin = String(req.headers.origin || '').trim();
    if (origin && !this.resolveAllowedCorsOrigin(origin)) {
      return false;
    }
    const ticket = String(url.searchParams.get('ticket') || '').trim();
    if (ticket && this.consumeUpgradeTicket(ticket)) {
      return true;
    }
    const resolved = this.resolveRequestToken(req, url);
    return this.auth.validate(resolved);
  }

  public issueUpgradeTicket(req: http.IncomingMessage, ttlMs = 5_000): {
    ok: true;
    ticket: string;
    expiresAt: string;
  } | {
    ok: false;
    error: string;
  } {
    const token = this.resolveRequestToken(req);
    if (!this.auth.validate(token)) {
      return {
        ok: false,
        error: 'Unauthorized',
      };
    }

    this.pruneUpgradeTickets();
    const ticket = crypto.randomBytes(24).toString('base64url');
    const expiresAt = Date.now() + Math.max(1_000, Math.min(ttlMs, 30_000));
    this.upgradeTickets.set(ticket, {
      expiresAt,
      consumed: false,
    });

    return {
      ok: true,
      ticket,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  private resolveRequestToken(req: http.IncomingMessage, url?: URL): string {
    const authorization = String(req.headers.authorization || '').trim();
    const bearer = authorization.toLowerCase().startsWith('bearer ')
      ? authorization.slice('bearer '.length).trim()
      : '';
    const headerToken = String(req.headers['x-zavorth-token'] || '').trim();
    const queryToken = process.env.ZAVORTH_ALLOW_QUERY_AUTH_TOKEN === 'true' && url
      ? String(url.searchParams.get('token') || '').trim()
      : '';
    return bearer || headerToken || queryToken;
  }

  private consumeUpgradeTicket(ticket: string): boolean {
    this.pruneUpgradeTickets();
    const entry = this.upgradeTickets.get(ticket);
    if (!entry || entry.consumed || entry.expiresAt < Date.now()) {
      this.upgradeTickets.delete(ticket);
      return false;
    }

    entry.consumed = true;
    this.upgradeTickets.delete(ticket);
    return true;
  }

  private pruneUpgradeTickets(): void {
    const now = Date.now();
    for (const [ticket, entry] of this.upgradeTickets.entries()) {
      if (entry.consumed || entry.expiresAt < now) {
        this.upgradeTickets.delete(ticket);
      }
    }
  }

  public applyCorsHeaders(req: http.IncomingMessage, res: http.ServerResponse): boolean {
    const origin = String(req.headers.origin || '').trim();
    const allowedOrigin = this.resolveAllowedCorsOrigin(origin);
    if (origin && !allowedOrigin) {
      return false;
    }
    this.applySecurityHeaders(res);
    if (allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Authorization, Content-Type, X-Zavorth-Token, X-Zavorth-Identity-Jwt, X-Zavorth-User-Id, X-Zavorth-Profile-Id, bypass-tunnel-reminder',
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Type');
    return true;
  }

  public applySecurityHeaders(res: http.ServerResponse): void {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  }

  public resolveAllowedCorsOrigin(origin: string): string | null {
    const normalizedOrigin = this.normalizeOrigin(origin);
    if (!normalizedOrigin) {
      return origin ? null : null;
    }

    return this.buildAllowedCorsOrigins().includes(normalizedOrigin)
      ? normalizedOrigin
      : null;
  }

  public buildAllowedCorsOrigins(): string[] {
    const origins = new Set<string>();
    const publicOrigin = this.normalizeOrigin(config.zavorthPublicBaseUrl);
    if (publicOrigin) {
      origins.add(publicOrigin);
    }

    const webPort = Number(config.zavorthWebPort || 33333) || 33333;
    origins.add(`http://127.0.0.1:${webPort}`);
    origins.add(`http://localhost:${webPort}`);
    origins.add(`http://[::1]:${webPort}`);

    const configuredHost = String(config.zavorthWebHost || '').trim();
    if (configuredHost && !['0.0.0.0', '::', '[::]'].includes(configuredHost)) {
      origins.add(`http://${configuredHost}:${webPort}`);
    }

    return Array.from(origins);
  }

  public normalizeOrigin(value: string): string | null {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return null;
    }
    try {
      return new URL(normalized).origin;
    } catch {
      return null;
    }
  }
}
