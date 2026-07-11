import {
  isLoopbackOnlyWebBinding,
  isTrustedLoopbackRequest,
} from '../../../src/ai-gateway/shared/utils/loopbackRequest';

function makeRequest(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

describe('loopback request policy', () => {
  it('allows local no-credential mode only on a loopback-only binding', () => {
    const env = { ZAVORTH_WEB_HOST: '127.0.0.1' } as NodeJS.ProcessEnv;

    expect(isLoopbackOnlyWebBinding(env)).toBe(true);
    expect(isTrustedLoopbackRequest(makeRequest('http://127.0.0.1:3000/api/health'), env)).toBe(true);
  });

  it.each(['0.0.0.0', '::', '192.168.1.20'])('rejects Host spoofing when bound to %s', (bindHost) => {
    const env = { ZAVORTH_WEB_HOST: bindHost } as NodeJS.ProcessEnv;
    const spoofed = makeRequest('http://localhost/api/v1/chat/completions', {
      host: 'localhost',
    });

    expect(isLoopbackOnlyWebBinding(env)).toBe(false);
    expect(isTrustedLoopbackRequest(spoofed, env)).toBe(false);
  });

  it('treats PORT without an explicit host as a public binding', () => {
    const env = { PORT: '3000' } as NodeJS.ProcessEnv;

    expect(isLoopbackOnlyWebBinding(env)).toBe(false);
    expect(isTrustedLoopbackRequest(makeRequest('http://localhost/api/settings'), env)).toBe(false);
  });

  it('rejects external forwarded peers even on a loopback binding', () => {
    const env = { ZAVORTH_WEB_HOST: 'localhost' } as NodeJS.ProcessEnv;
    const proxied = makeRequest('http://localhost/api/settings', {
      host: 'localhost',
      'x-forwarded-host': 'localhost',
      'x-forwarded-for': '203.0.113.10',
    });

    expect(isTrustedLoopbackRequest(proxied, env)).toBe(false);
  });

  it('supports an explicit fail-closed local-mode switch', () => {
    const env = {
      ZAVORTH_WEB_HOST: '127.0.0.1',
      ZAVORTH_TRUST_LOCAL_REQUESTS: 'false',
    } as NodeJS.ProcessEnv;

    expect(isTrustedLoopbackRequest(makeRequest('http://127.0.0.1/api/settings'), env)).toBe(false);
  });
});
