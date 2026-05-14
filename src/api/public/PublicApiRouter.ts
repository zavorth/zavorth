import crypto from 'crypto';
import fs from 'fs';
import * as http from 'http';
import { config } from '../../config/index.js';
import { ApiResponse, ForbiddenError, NotFoundError, UnauthorizedError } from '../../contracts/public/errors';
import { isWeakCommandCenterToken } from '../../services/CommandCenterTokenService.js';

export type RequestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>;
export type PublicApiAccess = 'public' | 'authenticated' | 'admin';

export interface PublicApiAuthContext {
  userId: string;
  role: 'admin';
  source: 'bearer' | 'api-token-header';
}

export interface EndpointDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  pathPattern: RegExp;
  handler: RequestHandler;
  access: PublicApiAccess;
}

export interface PublicApiRouterOptions {
  authToken?: string | null;
  authTokenProvider?: () => string | null | undefined;
  principalUserId?: string | null;
  principalUserIdProvider?: () => string | null | undefined;
  allowedOrigins?: string[] | '*';
}

declare module 'http' {
  interface IncomingMessage {
    publicApiAuth?: PublicApiAuthContext;
  }
}

export class PublicApiRouter {
  private endpoints: EndpointDefinition[] = [];

  constructor(private readonly options: PublicApiRouterOptions = {}) {}

  register(
    method: EndpointDefinition['method'],
    pathPattern: RegExp,
    handler: RequestHandler,
    options: { access?: PublicApiAccess } = {},
  ) {
    this.endpoints.push({
      method,
      pathPattern,
      handler,
      access: options.access || 'authenticated',
    });
  }

  async route(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const method = String(req.method || 'GET').toUpperCase();
      
      this.applyCors(req, res);
      this.applySecurityHeaders(res);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Zavorth-Api-Token');

      if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      for (const endpoint of this.endpoints) {
        if (endpoint.method === method && endpoint.pathPattern.test(url.pathname)) {
          if (endpoint.access !== 'public') {
            req.publicApiAuth = this.authenticate(req);
            if (endpoint.access === 'admin' && req.publicApiAuth.role !== 'admin') {
              throw new ForbiddenError('Public API admin authorization required.');
            }
          }
          await endpoint.handler(req, res);
          return;
        }
      }

      throw new NotFoundError(`Route ${method} ${url.pathname} not found`);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  static requireAuth(req: http.IncomingMessage): PublicApiAuthContext {
    if (!req.publicApiAuth) {
      throw new UnauthorizedError('Public API authentication required.');
    }
    return req.publicApiAuth;
  }

  private applyCors(req: http.IncomingMessage, res: http.ServerResponse): void {
    const origin = String(req.headers.origin || '').trim();
    if (!origin) {
      return;
    }

    const allowedOrigins = this.options.allowedOrigins || [];
    if (allowedOrigins === '*' || allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
  }

  private applySecurityHeaders(res: http.ServerResponse): void {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  }

  private authenticate(req: http.IncomingMessage): PublicApiAuthContext {
    const expectedToken = this.resolveAuthToken();
    const provided = this.extractToken(req);
    if (!expectedToken || !provided.token || !this.safeEquals(provided.token, expectedToken)) {
      throw new UnauthorizedError('Public API authentication required.');
    }

    return {
      userId: this.resolvePrincipalUserId(),
      role: 'admin',
      source: provided.source,
    };
  }

  private extractToken(req: http.IncomingMessage): { token: string; source: PublicApiAuthContext['source'] } {
    const authHeader = String(req.headers.authorization || '').trim();
    const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    if (bearer) {
      return { token: bearer, source: 'bearer' };
    }

    return {
      token: String(req.headers['x-zavorth-api-token'] || '').trim(),
      source: 'api-token-header',
    };
  }

  private resolveAuthToken(): string {
    const explicit = String(this.options.authToken || '').trim();
    if (explicit && !isWeakCommandCenterToken(explicit)) {
      return explicit;
    }

    const provided = String(this.options.authTokenProvider?.() || '').trim();
    if (provided && !isWeakCommandCenterToken(provided)) {
      return provided;
    }

    const envToken = String(config.zavorthWebAuthToken || '').trim();
    if (envToken && !isWeakCommandCenterToken(envToken)) {
      return envToken;
    }

    return this.readTokenFile(config.zavorthWebAuthTokenFile);
  }

  private resolvePrincipalUserId(): string {
    return String(
      this.options.principalUserId
      || this.options.principalUserIdProvider?.()
      || 'web-user',
    ).trim() || 'web-user';
  }

  private readTokenFile(filePath: string): string {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return '';
      }
      const token = fs.readFileSync(filePath, 'utf8').trim();
      return isWeakCommandCenterToken(token) ? '' : token;
    } catch {
      return '';
    }
  }

  private safeEquals(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');
    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
  }

  private handleError(error: any, res: http.ServerResponse): void {
    let responseBody: ApiResponse<null> & {
      ok: false;
      data: null;
      traceId: string;
    } = {
      ok: false,
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      },
      traceId: `api_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
    };
    let statusCode = 500;

    if (error.name === 'ZavorthPublicError') {
      statusCode = error.statusCode;
      responseBody.error = {
        code: error.code,
        message: error.message,
        details: error.details
      };
    } else {
      console.error('[PublicApiRouter] Unhandled error:', error);
    }

    if (!res.headersSent) {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responseBody));
    }
  }

  // Wrapper for JSON responses ensuring they adhere to DTOs
  static sendJson<T>(res: http.ServerResponse, statusCode: number, data: T): void {
    if (!res.headersSent) {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    }
  }
}
