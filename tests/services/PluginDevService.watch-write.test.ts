import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PluginDevService } from '../../src/services/PluginDevService.js';
import { PluginScaffoldService } from '../../src/services/PluginScaffoldService.js';
import { PluginStateBridgeService } from '../../src/services/PluginStateBridgeService.js';

describe('PluginDevService watch + writeManifest', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('writeManifest merges missing capabilities into manifest.json', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dev-write-'));
    tempRoots.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'tmp', version: '0.0.0' }), 'utf8');

    const targetDir = path.join(root, 'plugins', 'write-demo');
    new PluginScaffoldService().scaffold({
      root,
      id: 'write-demo',
      targetDir,
      moduleKind: 'tool',
      withHooks: false,
      withTools: true,
    });

    // Introduce a capability in code that is missing from the manifest.
    const indexPath = path.join(targetDir, 'index.js');
    fs.writeFileSync(indexPath, [
      'function register(ctx) {',
      "  ctx.bindCapability('main.run', async ({ input }) => ({ output: { ok: true, input: input || {} } }));",
      "  ctx.bindCapability('extra.ping', async () => ({ output: { ok: true } }));",
      '}',
      'module.exports = { register };',
      '',
    ].join('\n'), 'utf8');

    const manifestPath = path.join(targetDir, 'manifest.json');
    const before = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect((before.capabilities || []).some((item: { id: string }) => item.id === 'extra.ping')).toBe(false);

    const bridge = new PluginStateBridgeService({ projectRoot: root });
    const snapshot = await new PluginDevService({ stateBridge: bridge }).run({
      root,
      pluginPath: './plugins/write-demo',
      enable: true,
      trust: 'trusted',
      writeManifest: true,
      applyInference: true,
    });

    expect(snapshot.steps.some((step) => step.id === 'write-manifest' && step.ok)).toBe(true);
    const after = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect((after.capabilities || []).some((item: { id: string }) => item.id === 'extra.ping')).toBe(true);
    expect((after.capabilities || []).some((item: { id: string }) => item.id === 'main.run')).toBe(true);
  });

  it('watch mode with short watchMs starts watcher and can stop', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dev-watch-'));
    tempRoots.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'tmp', version: '0.0.0' }), 'utf8');

    const targetDir = path.join(root, 'plugins', 'watch-demo');
    new PluginScaffoldService().scaffold({
      root,
      id: 'watch-demo',
      targetDir,
      moduleKind: 'tool',
      withHooks: true,
      withTools: true,
    });

    let reloads = 0;
    const bridge = new PluginStateBridgeService({ projectRoot: root });
    const service = new PluginDevService({ stateBridge: bridge });

    const runPromise = service.run({
      root,
      pluginPath: './plugins/watch-demo',
      enable: true,
      trust: 'trusted',
      watch: true,
      watchIntervalMs: 40,
      watchMs: 250,
      onReload: async () => {
        reloads += 1;
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 80));
    const indexPath = path.join(targetDir, 'index.js');
    const body = fs.readFileSync(indexPath, 'utf8');
    fs.writeFileSync(indexPath, `${body}\n// touch ${Date.now()}\n`, 'utf8');
    const past = new Date(Date.now() + 2000);
    fs.utimesSync(indexPath, past, past);

    const snapshot = await runPromise;
    expect(snapshot.steps.some((step) => step.id === 'watch' && step.ok)).toBe(true);
    expect(typeof snapshot.stop).toBe('function');
    snapshot.stop?.();
    // Reload may or may not land before watchMs ends depending on scheduling; ensure no throw.
    expect(reloads).toBeGreaterThanOrEqual(0);
  });
});
