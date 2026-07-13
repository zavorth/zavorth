import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PluginOsBootstrapCatalogService } from '../../src/services/PluginOsBootstrapCatalogService.js';
import { PluginStateBridgeService } from '../../src/services/PluginStateBridgeService.js';

describe('PluginOsBootstrapCatalogService', () => {
  const tempRoots: string[] = [];
  const prevBootstrap = process.env.ZAVORTH_PLUGIN_OS_BOOTSTRAP;

  afterEach(() => {
    if (prevBootstrap === undefined) {
      delete process.env.ZAVORTH_PLUGIN_OS_BOOTSTRAP;
    } else {
      process.env.ZAVORTH_PLUGIN_OS_BOOTSTRAP = prevBootstrap;
    }
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function makeRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-p4-boot-'));
    tempRoots.push(root);
    return root;
  }

  function writePlugin(root: string, id: string, tier = 'first-party') {
    const dir = path.join(root, 'plugins', id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'manifest.json'),
      JSON.stringify({
        schemaVersion: 'zavorth.plugin-os.v1',
        id,
        label: id,
        version: '1.0.0',
        moduleKind: 'tool',
        summary: `${id} summary`,
        tags: [tier],
        capabilities: [{ id: `${id}.run`, intent: id, label: id, summary: id }],
        entrypoint: { module: './index.js', exportName: 'register', runtime: 'node' },
        lifecycle: { actions: ['invoke'], defaultAction: 'invoke' },
        policy: { defaultTrust: 'trusted' },
      }),
      'utf8',
    );
    fs.writeFileSync(
      path.join(dir, 'index.js'),
      "module.exports = { register(ctx) { ctx.bindCapability('x', async () => ({ output: { ok: true } })); } };\n",
      'utf8',
    );
  }

  function writeCatalog(root: string, entries: Array<{ id: string; tier: string }>) {
    fs.mkdirSync(path.join(root, 'config'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'config', 'plugin-marketplace-curated.json'),
      JSON.stringify(
        entries.map((entry) => ({
          id: entry.id,
          name: entry.id,
          tier: entry.tier,
          version: '1.0.0',
          source: `bundled://${entry.id}`,
        })),
        null,
        2,
      ),
      'utf8',
    );
  }

  it('enables first-party packages present on disk', () => {
    const root = makeRoot();
    writePlugin(root, 'web-search');
    writePlugin(root, 'github');
    writePlugin(root, 'hello-world');
    writeCatalog(root, [
      { id: 'web-search', tier: 'first-party' },
      { id: 'github', tier: 'first-party' },
      { id: 'hello-world', tier: 'example' },
    ]);
    fs.writeFileSync(
      path.join(root, 'config', 'plugin-os-bootstrap.json'),
      JSON.stringify({ autoEnableFirstParty: true, autoEnableExamples: false }),
      'utf8',
    );

    const bridge = new PluginStateBridgeService({ projectRoot: root });
    const result = new PluginOsBootstrapCatalogService({
      projectRoot: root,
      stateBridge: bridge,
    }).apply({ root });

    expect(result.ok).toBe(true);
    expect(result.enabled.sort()).toEqual(['github', 'web-search']);
    expect(result.enabled).not.toContain('hello-world');
    expect(bridge.resolve('web-search').enabled).toBe(true);
    expect(bridge.resolve('web-search').installed).toBe(true);
    expect(bridge.resolve('web-search').trust).toBe('trusted');
  });

  it('respects user disable and env kill switch', () => {
    const root = makeRoot();
    writePlugin(root, 'cost-tracker');
    writeCatalog(root, [{ id: 'cost-tracker', tier: 'first-party' }]);

    const bridge = new PluginStateBridgeService({ projectRoot: root });
    bridge.markInstalled({
      pluginId: 'cost-tracker',
      revision: '1.0.0',
      trust: 'trusted',
      enable: true,
    });
    bridge.setEnabled('cost-tracker', false);

    const service = new PluginOsBootstrapCatalogService({
      projectRoot: root,
      stateBridge: bridge,
    });
    const skipped = service.apply({ root });
    expect(skipped.enabled).toEqual([]);
    expect(skipped.skipped.some((item) => item.reason === 'user_disabled')).toBe(true);

    process.env.ZAVORTH_PLUGIN_OS_BOOTSTRAP = '0';
    const disabled = service.apply({ root });
    expect(disabled.findings.some((line) => /disabled by environment/i.test(line))).toBe(true);
  });

  it('resolves targets from catalog tiers', () => {
    const root = makeRoot();
    writeCatalog(root, [
      { id: 'a', tier: 'first-party' },
      { id: 'b', tier: 'example' },
    ]);
    fs.writeFileSync(
      path.join(root, 'config', 'plugin-os-bootstrap.json'),
      JSON.stringify({
        autoEnableFirstParty: true,
        autoEnableExamples: true,
        includeIds: ['extra'],
        excludeIds: ['b'],
      }),
      'utf8',
    );

    const ids = new PluginOsBootstrapCatalogService({ projectRoot: root }).resolveTargetIds({ root });
    expect(ids).toContain('a');
    expect(ids).toContain('extra');
    expect(ids).not.toContain('b');
  });
});
