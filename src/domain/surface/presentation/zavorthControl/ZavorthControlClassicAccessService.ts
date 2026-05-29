import * as http from 'http';

type ZavorthControlAuthLike = {
  validate: (token: string | null) => boolean;
};

export type ZavorthControlClassicAccessDeps = {
  authService: ZavorthControlAuthLike;
};

export class ZavorthControlClassicAccessService {
  public requiresAuthorization(pathname: string): boolean {
    return (
      pathname === '/classic' ||
      pathname === '/api/stats' ||
      pathname === '/api/sidecars' ||
      pathname === '/api/logs' ||
      pathname === '/api/bridge/schema' ||
      pathname.startsWith('/api/operations') ||
      pathname.startsWith('/api/snippets') ||
      pathname.startsWith('/api/audit')
    );
  }

  public isAuthorized(
    req: http.IncomingMessage,
    deps: ZavorthControlClassicAccessDeps,
  ): boolean {
    return this.isLoopbackAddress(req.socket.remoteAddress)
      || deps.authService.validate(this.resolveZavorthControlToken(req));
  }

  public isLoopbackAddress(remoteAddress: string | undefined): boolean {
    const normalized = String(remoteAddress || '').trim();
    return (
      normalized === '127.0.0.1' ||
      normalized === '::1' ||
      normalized === '::ffff:127.0.0.1' ||
      normalized === 'localhost'
    );
  }

  public resolveZavorthControlToken(req: http.IncomingMessage): string | null {
    const explicit = String(req.headers['x-zavorth-token'] || '').trim();
    if (explicit) {
      return explicit;
    }

    const authorization = String(req.headers.authorization || '').trim();
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : null;
  }
}

