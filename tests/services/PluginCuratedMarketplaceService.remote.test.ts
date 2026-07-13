import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PluginCuratedMarketplaceService } from '../../src/services/PluginCuratedMarketplaceService.js';

describe('PluginCuratedMarketplaceService remote', () => {
  const tempRoots: string[] = [];
  const prevUrl = process.env.ZAVORTH_PLUGIN_MARKETPLACE_URL;

  afterEach(() => {
    if (prevUrl === undefined) delete process.env.ZAVORTH_PLUGIN_MARKETPLACE_URL;
    else process.env.ZAVORTH_PLUGIN_MARKETPLACE_URL = prevUrl;
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('merges remote cache under local curated entries', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-p7-market-'));
    tempRoots.push(root);
    fs.mkdirSync(path.join(root, 'config'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'config', 'plugin-marketplace-curated.json'),
      JSON.stringify([{ id: 'web-search', name: 'Web Search', tier: 'first-party' }]),
      'utf8',
    );

    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => ([
        { id: 'remote-tool', name: 'Remote Tool', tier: 'community', summary: 'from remote' },
        { id: 'web-search', name: 'Should not override local', tier: 'community' },
      ]),
    }) as any;

    const service = new PluginCuratedMarketplaceService({
      projectRoot: root,
      remoteUrl: 'https://example.com/catalog.json',
      fetchImpl,
    });

    const refreshed = await service.refreshRemote({ root });
    expect(refreshed.ok).toBe(true);
    expect(refreshed.entries.some((e) => e.id === 'remote-tool')).toBe(true);

    const listed = service.list({ root, includeRemote: true });
    expect(listed.ok).toBe(true);
    expect(listed.entries.some((e) => e.id === 'remote-tool')).toBe(true);
    expect(listed.entries.find((e) => e.id === 'web-search')?.name).toBe('Web Search');
    expect(listed.sources?.some((s) => s.kind === 'local')).toBe(true);
    expect(listed.sources?.some((s) => s.kind === 'cache' || s.kind === 'remote')).toBe(true);
  });

  it('rejects non-https and private hosts for remote refresh', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-market-ssrf-'));
    tempRoots.push(root);
    const service = new PluginCuratedMarketplaceService({
      projectRoot: root,
      remoteUrl: 'http://127.0.0.1/evil.json',
      fetchImpl: async () => {
        throw new Error('fetch should not be called');
      },
    });
    const result = await service.refreshRemote({ root });
    expect(result.ok).toBe(false);
    expect(result.findings.join(' ')).toMatch(/https|localhost|private/i);
  });
});
