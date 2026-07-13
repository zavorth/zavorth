import { SourceSearchFetchService } from '../../../src/services/SourceSearchFetchService.js';

describe('SourceSearchFetchService.fetchAndExtract', () => {
  it('blocks without confirm-live-network', async () => {
    const service = new SourceSearchFetchService({
      fetchImpl: jest.fn(async () => {
        throw new Error('should not fetch');
      }),
    });

    const result = await service.fetchAndExtract({
      url: 'https://example.com/doc',
      confirmLiveNetwork: false,
    });

    expect(result.receipt.status).toBe('blocked');
    expect(result.content).toBeNull();
    expect(result.receipt.liveNetworkPerformed).toBe(false);
  });

  it('blocks private/localhost targets', async () => {
    const service = new SourceSearchFetchService({
      fetchImpl: jest.fn(async () => {
        throw new Error('should not fetch');
      }),
    });

    const result = await service.fetchAndExtract({
      url: 'http://127.0.0.1/secret',
      confirmLiveNetwork: true,
    });

    expect(result.receipt.status).toBe('blocked');
    expect(result.receipt.reason).toMatch(/private|localhost/i);
  });

  it('extracts title and text from HTML', async () => {
    const html = `
      <html><head><title>Hello Skill</title></head>
      <body><script>evil()</script><h1>Intro</h1><p>Body content here.</p></body></html>
    `;
    const service = new SourceSearchFetchService({
      fetchImpl: jest.fn(async () => ({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null),
        },
        text: async () => html,
      })) as unknown as typeof fetch,
    });

    const result = await service.fetchAndExtract({
      url: 'https://example.com/skill',
      confirmLiveNetwork: true,
    });

    expect(result.receipt.status).toBe('fetched');
    expect(result.title).toBe('Hello Skill');
    expect(result.content).toContain('Body content here');
    expect(result.content).not.toContain('evil()');
    expect(result.contentChars).toBeGreaterThan(0);
  });
});
