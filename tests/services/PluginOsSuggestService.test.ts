import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PluginOsSuggestService } from '../../src/services/PluginOsSuggestService.js';
import { PluginStateBridgeService } from '../../src/services/PluginStateBridgeService.js';

describe('PluginOsSuggestService', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('suggests enableable plugin for search intent without auto-enable', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-c-suggest-'));
    tempRoots.push(root);
    const dir = path.join(root, 'plugins', 'web-search');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'manifest.json'),
      JSON.stringify({
        id: 'web-search',
        label: 'Web Search',
        summary: 'Search the web',
        tags: ['search', 'web'],
        capabilities: [{ id: 'search.query', intent: 'search', label: 'Search', summary: 'Search' }],
        permissions: [{ kind: 'network.external', scope: 'external', reason: 'web', required: false }],
        policy: { defaultTrust: 'trusted' },
      }),
      'utf8',
    );

    const bridge = new PluginStateBridgeService({ projectRoot: root });
    // installed but disabled
    bridge.markInstalled({
      pluginId: 'web-search',
      trust: 'trusted',
      enable: false,
    });

    const result = await new PluginOsSuggestService({
      projectRoot: root,
      stateBridge: bridge,
    }).suggest({ intent: 'search the web', root });

    expect(result.ok).toBe(true);
    expect(result.autoEnable).toBe(false);
    expect(result.primary?.pluginId).toBe('web-search');
    expect(result.primary?.canEnable).toBe(true);
    expect(result.ui.actions.some((a) => a.id === 'enable')).toBe(true);
    expect(result.ui.actions.some((a) => a.id === 'recommend_only')).toBe(true);
    expect(result.formatText()).toContain('autoEnable: false');
  });
});
