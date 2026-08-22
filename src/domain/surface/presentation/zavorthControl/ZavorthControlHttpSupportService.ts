import * as http from 'http';

export type ZavorthControlHttpCorsDeps = {
  host: string;
  port: number;
  localBaseUrl: string;
  publicBaseUrl: string | null;
};

export class ZavorthControlHttpSupportService {
  public normalizePath(pathname: string): string {
    if (!pathname || pathname === '/') {
      return '/';
    }
    return pathname.replace(/\/+$/, '');
  }

  public normalizeUrl(value: string | null | undefined): string | null {
    const normalized = String(value || '').trim().replace(/\/+$/, '');
    return normalized.length > 0 ? normalized : null;
  }

  public applyCorsHeaders(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: ZavorthControlHttpCorsDeps,
  ): void {
    const origin = this.normalizeUrl(String(req.headers.origin || ''));
    const allowedOrigins = new Set(
      [
        deps.publicBaseUrl,
        deps.localBaseUrl,
        `http://localhost:${deps.port}`,
        `http://127.0.0.1:${deps.port}`,
        deps.host && !['0.0.0.0', '::', '[::]'].includes(deps.host) ? `http://${deps.host}:${deps.port}`
          : null,
      ].filter(Boolean) as string[],
    );

    if (origin && allowedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Zavorth-Token, X-Zavorth-Identity-Jwt, X-Zavorth-User-Id, X-Zavorth-Profile-Id',
    );
  }

  public handlePreflight(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): boolean {
    if (req.method !== 'OPTIONS') {
      return false;
    }

    res.writeHead(200);
    res.end();
    return true;
  }

  public readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
    return this.readRawBody(req).then((body) => {
      if (!body.trim()) {
        return {};
      }
      return JSON.parse(body);
    });
  }

  public readRawBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        resolve(body);
      });
      req.on('error', reject);
    });
  }
}

