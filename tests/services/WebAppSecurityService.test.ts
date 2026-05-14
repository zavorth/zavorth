import { config } from '../../src/config/index.js';
import { DashboardAuthService } from '../../src/services/DashboardAuthService.js';
import { WebAppSecurityService } from '../../src/services/WebAppSecurityService.js';

describe('WebAppSecurityService', () => {
  const originalWebAuthToken = config.zavorthWebAuthToken;
  const originalPublicBaseUrl = config.zavorthPublicBaseUrl;
  const originalWebHost = config.zavorthWebHost;
  const originalWebPort = config.zavorthWebPort;
  const originalAllowQueryToken = process.env.ZAVORTH_ALLOW_QUERY_AUTH_TOKEN;

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
    config.zavorthPublicBaseUrl = originalPublicBaseUrl;
    config.zavorthWebHost = originalWebHost;
    config.zavorthWebPort = originalWebPort;
    if (originalAllowQueryToken === undefined) {
      delete process.env.ZAVORTH_ALLOW_QUERY_AUTH_TOKEN;
    } else {
      process.env.ZAVORTH_ALLOW_QUERY_AUTH_TOKEN = originalAllowQueryToken;
    }
  });

  it('authorizes only header-based credentials', () => {
    config.zavorthWebAuthToken = 'web-secret';
    const service = new WebAppSecurityService(new DashboardAuthService());

    expect(service.isAuthorized({ headers: {} } as any)).toBe(false);
    expect(service.isAuthorized({
      headers: {
        authorization: 'Bearer web-secret',
      },
    } as any)).toBe(true);
    expect(service.isAuthorized({
      headers: {
        'x-zavorth-token': 'web-secret',
      },
    } as any)).toBe(true);
  });

  it('rejects query tokens for websocket upgrades unless legacy query auth is explicitly enabled', () => {
    config.zavorthWebAuthToken = 'web-secret';
    config.zavorthWebPort = 33333;
    const service = new WebAppSecurityService(new DashboardAuthService());
    const url = new URL('http://127.0.0.1:33333/api/web/gateway/ws');
    url.searchParams.set('token', config.zavorthWebAuthToken);

    expect(service.isAuthorizedUpgrade({
      headers: {
        origin: 'http://127.0.0.1:33333',
      },
    } as any, url)).toBe(false);
    expect(service.isAuthorizedUpgrade({
      headers: {
        origin: 'http://127.0.0.1:33333',
        authorization: 'Bearer web-secret',
      },
    } as any, url)).toBe(true);
    process.env.ZAVORTH_ALLOW_QUERY_AUTH_TOKEN = 'true';
    expect(service.isAuthorizedUpgrade({
      headers: {
        origin: 'http://127.0.0.1:33333',
      },
    } as any, url)).toBe(true);
    expect(service.isAuthorizedUpgrade({
      headers: {
        origin: 'https://evil.example.com',
      },
    } as any, url)).toBe(false);
  });

  it('uses one-time short-lived tickets for browser websocket upgrades', () => {
    config.zavorthWebAuthToken = 'web-secret';
    config.zavorthWebPort = 33333;
    const service = new WebAppSecurityService(new DashboardAuthService());
    const issued = service.issueUpgradeTicket({
      headers: {
        authorization: 'Bearer web-secret',
      },
    } as any);

    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      throw new Error('ticket issue failed');
    }

    const url = new URL('http://127.0.0.1:33333/api/web/gateway/ws');
    url.searchParams.set('ticket', issued.ticket);
    const request = {
      headers: {
        origin: 'http://127.0.0.1:33333',
      },
    } as any;

    expect(service.isAuthorizedUpgrade(request, url)).toBe(true);
    expect(service.isAuthorizedUpgrade(request, url)).toBe(false);
  });

  it('reflects only allowed origins and advertises explicit auth headers', () => {
    config.zavorthWebAuthToken = 'web-secret';
    config.zavorthPublicBaseUrl = 'https://zavorth.example.com';
    config.zavorthWebHost = '127.0.0.1';
    config.zavorthWebPort = 33333;
    const service = new WebAppSecurityService(new DashboardAuthService());

    const allowedResponse = {
      setHeader: jest.fn(),
    };
    expect(
      service.applyCorsHeaders(
        { headers: { origin: 'https://zavorth.example.com' } } as any,
        allowedResponse as any,
      ),
    ).toBe(true);
    expect(allowedResponse.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      'https://zavorth.example.com',
    );
    expect(allowedResponse.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Headers',
      'Authorization, Content-Type, X-Zavorth-Token, X-Zavorth-Identity-Jwt, X-Zavorth-User-Id, X-Zavorth-Profile-Id, bypass-tunnel-reminder',
    );
    expect(allowedResponse.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(allowedResponse.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
    expect(allowedResponse.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');

    const blockedResponse = {
      setHeader: jest.fn(),
    };
    expect(
      service.applyCorsHeaders(
        { headers: { origin: 'https://evil.example.com' } } as any,
        blockedResponse as any,
      ),
    ).toBe(false);
  });
});
