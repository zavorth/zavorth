import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runPlugins } from '../../../src/cli/plugins/ZavorthCliPluginsNamespace.js';

describe('ZavorthCliPluginsNamespace forge + mcp', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function makeRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-cli-forge-'));
    tempRoots.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'tmp', version: '0.0.0' }), 'utf8');
    fs.mkdirSync(path.join(root, 'config'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'config', 'mcp-servers.json'),
      JSON.stringify([
        {
          id: 'filesystem',
          enabled: false,
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem'],
          capability: 'filesystem',
        },
      ], null, 2),
      'utf8',
    );
    return root;
  }

  it('forge plan creates preview and apply without --yes stays dry', async () => {
    const root = makeRoot();
    const plan = await runPlugins(root, ['forge', 'plan', 'tool that echoes uppercase', '--id', 'cli-upper']);
    expect(plan).toBeTruthy();
    const text = typeof plan === 'object' && plan && 'text' in plan
      ? String((plan as any).text || '')
      : String(plan || '');
    // render returns structured payload — check filesystem side effects
    const previews = path.join(root, '.zavorth', 'plugin-forge', 'previews');
    expect(fs.existsSync(previews)).toBe(true);
    const dirs = fs.readdirSync(previews);
    expect(dirs.some((name) => name.startsWith('cli-upper'))).toBe(true);

    const dryApply = await runPlugins(root, ['forge', 'apply', 'cli-upper']);
    void dryApply;
    expect(fs.existsSync(path.join(root, '.zavorth', 'plugins', 'cli-upper'))).toBe(false);

    const applied = await runPlugins(root, ['forge', 'apply', 'cli-upper', '--yes']);
    void applied;
    expect(fs.existsSync(path.join(root, '.zavorth', 'plugins', 'cli-upper', 'manifest.json'))).toBe(true);
  });

  it('mcp list and materialize --yes write bridge package', async () => {
    const root = makeRoot();
    const mcpListed = await runPlugins(root, ['mcp', 'list']);
    const forgeListed = await runPlugins(root, ['forge', 'list']);
    void mcpListed;
    void forgeListed;

    const dry = await runPlugins(root, ['mcp', 'materialize', 'filesystem']);
    void dry;
    expect(fs.existsSync(path.join(root, '.zavorth', 'plugins', 'mcp-filesystem'))).toBe(false);

    const made = await runPlugins(root, ['mcp', 'materialize', 'filesystem', '--yes']);
    void made;
    expect(fs.existsSync(path.join(root, '.zavorth', 'plugins', 'mcp-filesystem', 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(root, '.zavorth', 'plugins', 'mcp-filesystem', 'index.js'))).toBe(true);
  });

  it('marketplace --curated reads curated catalog when present', async () => {
    const root = makeRoot();
    fs.writeFileSync(
      path.join(root, 'config', 'plugin-marketplace-curated.json'),
      JSON.stringify([
        {
          id: 'gmail',
          name: 'Gmail',
          summary: 'Gmail bridge',
          moduleKind: 'bridge',
          source: 'bundled://gmail',
          signed: true,
          tier: 'first-party',
          curated: true,
        },
      ], null, 2),
      'utf8',
    );
    const result = await runPlugins(root, ['marketplace', '--curated']);
    const payload = result as any;
    const plugins = payload?.plugins || payload?.data?.plugins || [];
    if (Array.isArray(plugins) && plugins.length) {
      expect(plugins.some((entry: any) => entry.id === 'gmail')).toBe(true);
    } else {
      // soft assert via text lines if render shape differs
      const text = JSON.stringify(result);
      expect(text).toContain('gmail');
    }
  });
});
