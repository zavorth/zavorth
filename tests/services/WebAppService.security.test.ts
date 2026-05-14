import { config } from '../../src/config/index.js';
import { DashboardAuthService } from '../../src/services/DashboardAuthService.js';
import { WebAppService } from '../../src/services/WebAppService.js';
import { WebAppSecurityService } from '../../src/services/WebAppSecurityService.js';

describe('WebAppService security hardening', () => {
  const originalWebAuthToken = config.zavorthWebAuthToken;
  const originalPublicBaseUrl = config.zavorthPublicBaseUrl;
  const originalWebHost = config.zavorthWebHost;
  const originalWebPort = config.zavorthWebPort;

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
    config.zavorthPublicBaseUrl = originalPublicBaseUrl;
    config.zavorthWebHost = originalWebHost;
    config.zavorthWebPort = originalWebPort;
  });

  function createSecurityOnlyWebAppService(): any {
    const service = Object.create(WebAppService.prototype);
    service.composition = {
      webSecurity: new WebAppSecurityService(new DashboardAuthService()),
    };
    return service;
  }

  it('requires header-based auth instead of accepting the token in the query string', () => {
    config.zavorthWebAuthToken = 'web-secret';
    const service = createSecurityOnlyWebAppService();
    const url = new URL('http://127.0.0.1:33333/api/web/state');
    url.searchParams.set('sessionId', 'web-1');
    url.searchParams.set('token', 'web-secret');

    expect(
      service.isAuthorized(
        { headers: {} },
        url,
      ),
    ).toBe(false);
    expect(
      service.isAuthorized(
        { headers: { authorization: 'Bearer web-secret' } },
        url,
      ),
    ).toBe(true);
    expect(
      service.isAuthorized(
        { headers: { 'x-zavorth-token': 'web-secret' } },
        url,
      ),
    ).toBe(true);
  });

  it('only reflects explicitly allowed origins in CORS headers', () => {
    config.zavorthWebAuthToken = 'web-secret';
    config.zavorthPublicBaseUrl = 'https://zavorth.example.com';
    config.zavorthWebHost = '127.0.0.1';
    config.zavorthWebPort = 33333;
    const service = createSecurityOnlyWebAppService();

    const allowedResponse = {
      setHeader: jest.fn(),
    };
    expect(
      service.applyCorsHeaders(
        { headers: { origin: 'https://zavorth.example.com' } },
        allowedResponse,
      ),
    ).toBe(true);
    expect(allowedResponse.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      'https://zavorth.example.com',
    );
    expect(allowedResponse.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Headers',
      'Authorization, Content-Type, X-Zavorth-Token, bypass-tunnel-reminder',
    );
    expect(allowedResponse.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(allowedResponse.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
    expect(allowedResponse.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');

    const localhostResponse = {
      setHeader: jest.fn(),
    };
    expect(
      service.applyCorsHeaders(
        { headers: { origin: 'http://localhost:33333' } },
        localhostResponse,
      ),
    ).toBe(true);
    expect(localhostResponse.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      'http://localhost:33333',
    );

    const blockedResponse = {
      setHeader: jest.fn(),
    };
    expect(
      service.applyCorsHeaders(
        { headers: { origin: 'https://evil.example.com' } },
        blockedResponse,
      ),
    ).toBe(false);
    expect(
      blockedResponse.setHeader.mock.calls.filter((entry: unknown[]) => entry[0] === 'Access-Control-Allow-Origin'),
    ).toHaveLength(0);
  });
});
