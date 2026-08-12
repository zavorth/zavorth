import { safeFetch } from '../../src/security/SafeFetchService';

jest.mock('../../src/ai-gateway/lib/security/egressGuard.js', () => ({
  assertPublicHttpTargetAllowed: jest.fn(async (rawUrl: string) => new URL(rawUrl)),
}));

describe('safeFetch redirect security', () => {
  it('removes credentials when a redirect crosses origins', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = jest.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init || {} });
      return calls.length === 1
        ? new Response(null, { status: 302, headers: { location: 'https://attacker.example/download' } })
        : new Response('ok', { status: 200 });
    }) as unknown as typeof fetch;

    await safeFetch(
      'https://trusted.example/media',
      {
        headers: {
          Authorization: 'Bearer secret',
          Cookie: 'session=secret',
          'X-Api-Key': 'secret',
          Accept: 'audio/ogg',
        },
      },
      { fetchImpl },
    );

    const redirectedHeaders = new Headers(calls[1].init.headers);
    expect(redirectedHeaders.get('authorization')).toBeNull();
    expect(redirectedHeaders.get('cookie')).toBeNull();
    expect(redirectedHeaders.get('x-api-key')).toBeNull();
    expect(redirectedHeaders.get('accept')).toBe('audio/ogg');
  });

  it('converts POST to GET on a 302 without replaying its body', async () => {
    const calls: RequestInit[] = [];
    const fetchImpl = jest.fn(async (_url: string | URL, init?: RequestInit) => {
      calls.push(init || {});
      return calls.length === 1
        ? new Response(null, { status: 302, headers: { location: '/result' } })
        : new Response('ok', { status: 200 });
    }) as unknown as typeof fetch;

    await safeFetch(
      'https://trusted.example/action',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"value":1}',
      },
      { fetchImpl },
    );

    expect(calls[1].method).toBe('GET');
    expect(calls[1].body).toBeUndefined();
    expect(new Headers(calls[1].headers).get('content-type')).toBeNull();
  });
});
