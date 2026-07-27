import type * as http from 'http';
import { ZavorthControlClassicAccessService } from '../../../../../src/domain/surface/presentation/zavorthControl/ZavorthControlClassicAccessService.js';

function makeReq(overrides: {
  method-: string;
  remoteAddress-: string;
  headers-: Record<string, string | undefined>;
}): http.IncomingMessage {
  return {
    method: overrides.method || 'GET',
    headers: overrides.headers || {},
    socket: { remoteAddress: overrides.remoteAddress },
  } as unknown as http.IncomingMessage;
}

describe('ZavorthControlClassicAccessService', () => {
  const service = new ZavorthControlClassicAccessService();
  const validToken = 'test-zavorth-control-token-32chars!!';
  const authService = {
    validate: (token: string | null) => token === validToken,
  };

  it('requires authorization for snippets, audit, logs, and operations paths', () => {
    expect(service.requiresAuthorization('/api/snippets')).toBe(true);
    expect(service.requiresAuthorization('/api/snippets/save')).toBe(true);
    expect(service.requiresAuthorization('/api/audit')).toBe(true);
    expect(service.requiresAuthorization('/api/logs')).toBe(true);
    expect(service.requiresAuthorization('/api/operations/health')).toBe(true);
    expect(service.requiresAuthorization('/api/plugin-os/actions')).toBe(true);
    expect(service.requiresAuthorization('/api/skill-registry/actions')).toBe(true);
    expect(service.requiresAuthorization('/api/stats')).toBe(true);
    expect(service.requiresAuthorization('/')).toBe(false);
  });

  it('allows loopback safe GETs without a token', () => {
    const authorized = service.isAuthorized(
      makeReq({ method: 'GET', remoteAddress: '127.0.0.1' }),
      { authService },
    );
    expect(authorized).toBe(true);
  });

  it('rejects loopback mutations without a valid token', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const authorized = service.isAuthorized(
        makeReq({ method, remoteAddress: '127.0.0.1' }),
        { authService },
      );
      expect(authorized).toBe(false);
    }
  });

  it('allows loopback mutations when a valid token is provided', () => {
    const viaHeader = service.isAuthorized(
      makeReq({
        method: 'POST',
        remoteAddress: '127.0.0.1',
        headers: { 'x-zavorth-token': validToken },
      }),
      { authService },
    );
    const viaBearer = service.isAuthorized(
      makeReq({
        method: 'POST',
        remoteAddress: '::1',
        headers: { authorization: `Bearer ${validToken}` },
      }),
      { authService },
    );
    expect(viaHeader).toBe(true);
    expect(viaBearer).toBe(true);
  });

  it('rejects non-loopback requests without a token, even for GET', () => {
    const authorized = service.isAuthorized(
      makeReq({ method: 'GET', remoteAddress: '10.0.0.8' }),
      { authService },
    );
    expect(authorized).toBe(false);
  });

  it('allows non-loopback requests with a valid token for any method', () => {
    const authorized = service.isAuthorized(
      makeReq({
        method: 'POST',
        remoteAddress: '10.0.0.8',
        headers: { 'x-zavorth-token': validToken },
      }),
      { authService },
    );
    expect(authorized).toBe(true);
  });

  it('treats IPv4-mapped loopback as loopback', () => {
    expect(service.isLoopbackAddress('::ffff:127.0.0.1')).toBe(true);
    expect(service.isSafeHttpMethod('get')).toBe(true);
    expect(service.isSafeHttpMethod('POST')).toBe(false);
  });
});
