import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PluginForgeService } from '../../src/services/PluginForgeService.js';
import { PluginRegistryService } from '../../src/services/PluginRegistryService.js';

describe('PluginForgeService', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function makeRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-forge-'));
    tempRoots.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'tmp', version: '0.0.0' }), 'utf8');
    return root;
  }

  it('plan creates a preview package with valid manifest', async () => {
    const root = makeRoot();
    const service = new PluginForgeService({ projectRoot: root });
    const plan = await service.plan('I need a tool that echoes uppercase', { root });

    expect(plan.ok).toBe(true);
    expect(plan.pluginId).toBeTruthy();
    expect(plan.files.some((file) => file.path === 'manifest.json')).toBe(true);
    expect(plan.files.some((file) => file.path === 'index.js')).toBe(true);

    const previewAbs = path.join(root, plan.previewDir);
    expect(fs.existsSync(path.join(previewAbs, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(previewAbs, 'index.js'))).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(path.join(previewAbs, 'manifest.json'), 'utf8'));
    expect(new PluginRegistryService().validateManifest(manifest)).toEqual([]);
    expect(manifest.capabilities.some((cap: { id: string }) => cap.id === 'main.run')).toBe(true);

    const index = fs.readFileSync(path.join(previewAbs, 'index.js'), 'utf8');
    expect(index).toContain('toUpperCase');
    expect(index).toContain('module.exports');
  });

  it('plan picks search template for web search intents', async () => {
    const root = makeRoot();
    const plan = await new PluginForgeService({ projectRoot: root }).plan('search the web for docs', { root });
    expect(plan.ok).toBe(true);
    const previewAbs = path.join(root, plan.previewDir);
    const manifest = JSON.parse(fs.readFileSync(path.join(previewAbs, 'manifest.json'), 'utf8'));
    expect(manifest.moduleKind).toBe('search');
    expect(manifest.capabilities.some((cap: { id: string }) => cap.id === 'search.query')).toBe(true);
  });

  it('apply without approved fails and does not write package', async () => {
    const root = makeRoot();
    const service = new PluginForgeService({ projectRoot: root });
    const plan = await service.plan('memory store for notes', { root, id: 'forge-memory-test' });
    expect(plan.ok).toBe(true);

    const denied = await service.apply(plan.previewDir, { approved: false, root });
    expect(denied.ok).toBe(false);
    expect(denied.findings.some((line) => /approved/i.test(line))).toBe(true);
    expect(fs.existsSync(path.join(root, '.zavorth', 'plugins', plan.pluginId))).toBe(false);
    expect(fs.existsSync(path.join(root, 'plugins', plan.pluginId))).toBe(false);
  });

  it('apply with approved writes package and receipt', async () => {
    const root = makeRoot();
    const service = new PluginForgeService({
      projectRoot: root,
      testHarness: {
        run: async () => ({
          ok: true,
          pluginId: 'forge-memory-test',
          pluginPath: '',
          results: [],
        }),
      } as any,
    });
    const plan = await service.plan('memory store for notes', { root, id: 'forge-memory-test' });
    const applied = await service.apply(plan.previewDir, { approved: true, root });

    expect(applied.ok).toBe(true);
    expect(applied.pluginId).toBe('forge-memory-test');
    const target = path.join(root, applied.targetDir);
    expect(fs.existsSync(path.join(target, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(target, 'index.js'))).toBe(true);
    expect(applied.receiptPath).toBeTruthy();
    expect(fs.existsSync(path.join(root, applied.receiptPath!))).toBe(true);
  });
});
