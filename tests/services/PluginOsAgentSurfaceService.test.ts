import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PluginOsAgentSurfaceService } from '../../src/services/PluginOsAgentSurfaceService.js';
import { PluginStateBridgeService } from '../../src/services/PluginStateBridgeService.js';

describe('PluginOsAgentSurfaceService', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('builds prompt block with first-party catalog and no auto-enable', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-p5-surface-'));
    tempRoots.push(root);
    fs.mkdirSync(path.join(root, 'config'), { recursive: true });
    fs.mkdirSync(path.join(root, 'plugins', 'web-search'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'plugins', 'web-search', 'manifest.json'),
      JSON.stringify({
        id: 'web-search',
        summary: 'Search the web',
        tags: ['search'],
        capabilities: [{ id: 'search.query' }],
      }),
      'utf8',
    );
    fs.writeFileSync(
      path.join(root, 'config', 'plugin-marketplace-curated.json'),
      JSON.stringify([
        {
          id: 'web-search',
          name: 'Web Search',
          summary: 'Search the web',
          tier: 'first-party',
          tags: ['search'],
        },
      ]),
      'utf8',
    );

    const bridge = new PluginStateBridgeService({ projectRoot: root });
    bridge.markInstalled({ pluginId: 'web-search', enable: true, trust: 'trusted' });

    const service = new PluginOsAgentSurfaceService({ projectRoot: root, stateBridge: bridge });
    const surface = service.buildSurface({ root });

    expect(surface.promptBlock).toContain('Plugin OS');
    expect(surface.promptBlock).toContain('web-search');
    expect(surface.promptBlock.toLowerCase()).toContain('plugin_suggest');
    expect(surface.enabledPluginIds).toContain('web-search');
    expect(surface.recommendHints.some((hint) => /never auto-enable/i.test(hint))).toBe(true);

    const ranked = await service.recommendForAgent({
      intent: 'search the web',
      root,
      limit: 3,
    });
    expect(ranked.autoEnable).toBe(false);
    expect(ranked.ok).toBe(true);
    expect(ranked.recommendations[0]?.pluginId).toBe('web-search');
    expect(ranked.recommendations[0]?.enableHint).toContain('enable web-search');
  });
});
