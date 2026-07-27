import {
  UNTRUSTED_NETWORK_CLIENT_KEY,
  extractClientIp,
} from '../../../src/ai-gateway/lib/rateLimiter';

function requestWithHeaders(headers: Record<string, string>): Request {
  return {
    headers: {
      get(name: string) {
        return headers[name.toLowerCase()] || null;
      },
    },
  } as unknown as Request;
}

describe('login client identity', () => {
  it('does not trust spoofable forwarding headers by default', () => {
    const first = extractClientIp(requestWithHeaders({ 'x-forwarded-for': '198.51.100.10' }), {} as NodeJS.ProcessEnv);
    const rotated = extractClientIp(requestWithHeaders({ 'x-forwarded-for': '203.0.113.20' }), {} as NodeJS.ProcessEnv);

    expect(first).toBe(UNTRUSTED_NETWORK_CLIENT_KEY);
    expect(rotated).toBe(UNTRUSTED_NETWORK_CLIENT_KEY);
  });

  it('uses forwarding headers only after an explicit trusted-proxy opt-in', () => {
    const env = { ZAVORTH_TRUST_PROXY_HEADERS: 'true' } as NodeJS.ProcessEnv;

    expect(extractClientIp(requestWithHeaders({ 'x-forwarded-for': '198.51.100.10, 127.0.0.1' }), env)).toBe(
      '198.51.100.10',
    );
    expect(extractClientIp(requestWithHeaders({ 'x-real-ip': '203.0.113.20' }), env)).toBe('203.0.113.20');
  });

  it('rejects malformed and oversized client-address headers', () => {
    const env = { ZAVORTH_TRUST_PROXY_HEADERS: 'true' } as NodeJS.ProcessEnv;
    expect(extractClientIp(requestWithHeaders({ 'x-forwarded-for': 'bad\naddress' }), env)).toBe(
      UNTRUSTED_NETWORK_CLIENT_KEY,
    );
    expect(extractClientIp(requestWithHeaders({ 'x-real-ip': 'x'.repeat(256) }), env)).toBe(
      UNTRUSTED_NETWORK_CLIENT_KEY,
    );
  });
});
