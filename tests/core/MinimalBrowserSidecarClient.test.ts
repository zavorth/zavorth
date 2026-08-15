import http from 'http';
import { resolve } from 'node:path';
import { MinimalBrowserSidecarClient } from '../../src/core/MinimalBrowserSidecarClient.js';

describe('MinimalBrowserSidecarClient', () => {
  it('talks to the browser sidecar over HTTP without loading Playwright in core', async () => {
    const requests: Array<{ method: string | undefined; url: string | undefined; body: string }> = [];
    const server = http.createServer((request, response) => {
      let body = '';
      request.setEncoding('utf8');
      request.on('data', (chunk) => {
        body += chunk;
      });
      request.on('end', () => {
        requests.push({ method: request.method, url: request.url, body });
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ ok: true, route: request.url }));
      });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    expect(address).toEqual(expect.objectContaining({ port: expect.any(Number) }));

    try {
      const client = new MinimalBrowserSidecarClient({
        baseUrl: `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`,
      });
      const result = await client.navigate('https://example.com', { waitUntil: 'domcontentloaded' });

      expect(result).toEqual(expect.objectContaining({ ok: true, route: '/navigate' }));
      expect(requests).toHaveLength(1);
      expect(requests[0]).toEqual(expect.objectContaining({ method: 'POST', url: '/navigate' }));
      expect(JSON.parse(requests[0].body)).toEqual({
        url: 'https://example.com',
        waitUntil: 'domcontentloaded',
      });
      expect(require.cache[require.resolve('playwright')]).toBeUndefined();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
