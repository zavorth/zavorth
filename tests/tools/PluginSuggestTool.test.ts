import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PluginSuggestTool } from '../../src/tools/PluginSuggestTool.js';
import { PluginStateBridgeService } from '../../src/services/PluginStateBridgeService.js';
import { PluginOsSuggestService } from '../../src/services/PluginOsSuggestService.js';

describe('PluginSuggestTool', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns structured suggest-to-enable payload', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-c-tool-'));
    tempRoots.push(root);
    const dir = path.join(root, 'plugins', 'github');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'manifest.json'),
      JSON.stringify({
        id: 'github',
        summary: 'GitHub bridge',
        tags: ['github', 'pr'],
        capabilities: [{ id: 'github.pr.list' }],
      }),
      'utf8',
    );
    const bridge = new PluginStateBridgeService({ projectRoot: root });
    const tool = new PluginSuggestTool({
      projectRoot: root,
      suggest: new PluginOsSuggestService({ projectRoot: root, stateBridge: bridge }),
    });

    const raw = await tool.execute({ intent: 'github pull requests' });
    const parsed = JSON.parse(raw);
    expect(parsed.autoEnable).toBe(false);
    expect(parsed.ok).toBe(true);
    expect(parsed.note).toMatch(/never auto-enables/i);
  });
});
