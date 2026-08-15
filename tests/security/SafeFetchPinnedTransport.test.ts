import http from 'node:http';
import { resolve } from 'node:path';
import { safeFetch } from '../../src/security/SafeFetchService.js';

describe('safeFetch pinned transport', () => {
  const originalGlobalPrivateSetting = process.env.ALLOW_PRIVATE_EGRESS_TARGETS;

  afterEach(() => {
    if (originalGlobalPrivateSetting === undefined) delete process.env.ALLOW_PRIVATE_EGRESS_TARGETS;
    else process.env.ALLOW_PRIVATE_EGRESS_TARGETS = originalGlobalPrivateSetting;
  });

  it('uses the guarded production transport with a resolved address', async () => {
    process.env.ALLOW_PRIVATE_EGRESS_TARGETS = 'true';
    const server = http.createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.end('pinned transport ok');
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Test server did not expose a TCP port.');
      const response = await safeFetch(`http://127.0.0.1:${address.port}/health`);
      expect(response.ok).toBe(true);
      const text = await response.text();
      expect(text).toBe('pinned transport ok');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  });
});
