import { EventEmitter } from 'events';
import { PublicApiRouter } from '../../../src/api/public/PublicApiRouter.js';
import { config } from '../../../src/config/index.js';

class MockResponse extends EventEmitter {
  public statusCode = 200;
  public headers: Record<string, string> = {};
  public body = '';
  public headersSent = false;

  public setHeader(name: string, value: string): void {
    this.headers[name.toLowerCase()] = value;
  }

  public writeHead(statusCode: number, headers: Record<string, string> = {}): void {
    this.statusCode = statusCode;
    for (const [key, value] of Object.entries(headers)) {
      this.setHeader(key, value);
    }
    this.headersSent = true;
  }

  public end(body = ''): void {
    this.body += String(body || '');
    this.emit('finish');
  }
}

function buildRequest(headers: Record<string, string> = {}) {
  return {
    method: 'GET',
    url: '/secure',
    headers,
  };
}

describe('PublicApiRouter security', () => {
  const originalWebAuthToken = config.zavorthWebAuthToken;

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
  });

  it('rejects weak dashboard placeholder tokens for public API auth', async () => {
    const router = new PublicApiRouter({ authToken: 'dev-token' });
    router.register('GET', /^\/secure$/, async (_req, res) => {
      PublicApiRouter.sendJson(res, 200, { ok: true });
    });
    const res = new MockResponse();

    await router.route(buildRequest({ authorization: 'Bearer dev-token' }) as any, res as any);

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual(expect.objectContaining({
      error: expect.objectContaining({
        code: 'UNAUTHORIZED',
      }),
    }));
  });

  it('applies no-store and browser hardening headers to public API responses', async () => {
    config.zavorthWebAuthToken = 'dashboard-secret';
    const router = new PublicApiRouter();
    router.register('GET', /^\/secure$/, async (_req, res) => {
      PublicApiRouter.sendJson(res, 200, { ok: true });
    });
    const res = new MockResponse();

    await router.route(buildRequest({ authorization: 'Bearer dashboard-secret' }) as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['permissions-policy']).toContain('camera=()');
  });
});
