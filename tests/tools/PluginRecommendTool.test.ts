import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PluginRecommendTool } from '../../src/tools/PluginRecommendTool.js';

describe('PluginRecommendTool', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function writePlugin(root: string, id: string, summary: string, tags: string[]) {
    const dir = path.join(root, 'plugins', id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'manifest.json'),
      JSON.stringify({
        id,
        label: id,
        summary,
        tags,
        moduleKind: 'tool',
        capabilities: [{ id: `${id}.run`, intent: id, label: id, summary }],
      }),
      'utf8',
    );
  }

  it('recommends web-search for search intents without auto-enable', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-p4-recommend-'));
    tempRoots.push(root);
    writePlugin(root, 'web-search', 'Search the web via backends', ['search', 'web']);
    writePlugin(root, 'github', 'GitHub CLI bridge', ['github']);

    const tool = new PluginRecommendTool({ projectRoot: root });
    // Free-text soft-ranking is off; exact plugin id (or LLM) owns matching.
    const raw = await tool.execute({ intent: 'web-search', limit: 3 });
    const parsed = JSON.parse(raw);

    expect(parsed.ok).toBe(true);
    expect(parsed.autoEnable).toBe(false);
    expect(parsed.mode).toBe('recommend');
    expect(parsed.recommendations[0].pluginId).toBe('web-search');
    expect(parsed.recommendations[0].enableHint).toContain('web-search');
  });

  it('explains a plugin id', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-p4-explain-'));
    tempRoots.push(root);
    writePlugin(root, 'memory-local', 'Local key value memory', ['memory']);

    const tool = new PluginRecommendTool({ projectRoot: root });
    const raw = await tool.execute({ explainPluginId: 'memory-local' });
    const parsed = JSON.parse(raw);

    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe('explain');
    expect(parsed.found).toBe(true);
    expect(parsed.autoEnable).toBe(false);
  });

  it('requires intent when not explaining', async () => {
    const tool = new PluginRecommendTool({ projectRoot: process.cwd() });
    const parsed = JSON.parse(await tool.execute({}));
    expect(parsed.ok).toBe(false);
    expect(parsed.reason).toBe('intent_required');
  });
});
