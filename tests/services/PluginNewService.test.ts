import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PluginNewService } from '../../src/services/PluginNewService.js';
import { PluginStateBridgeService } from '../../src/services/PluginStateBridgeService.js';
import { PluginRegistryService } from '../../src/services/PluginRegistryService.js';
import { ZAVORTH_PLUGIN_OS_API_VERSION } from '../../src/contracts/PluginManifestContract.js';

describe('PluginNewService', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('scaffolds minimal ping package and enables bridge on run=true', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-plugin-new-'));
    tempRoots.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'tmp', version: '0.0.0' }), 'utf8');

    const bridge = new PluginStateBridgeService({ projectRoot: root });
    const service = new PluginNewService({
      stateBridge: bridge,
      devService: {
        run: async () => ({
          generatedAt: new Date().toISOString(),
          pluginPath: path.join(root, 'plugins', 'hello'),
          pluginId: 'hello',
          steps: [{ id: 'runtime-bootstrap', ok: true, summary: 'mock ok' }],
          nextCommands: [],
          formatText: () => 'mock',
        }),
      } as any,
    });

    const result = await service.run({
      root,
      id: 'hello',
      run: true,
    });

    expect(result.ok).toBe(true);
    expect(result.id).toBe('hello');
    const targetDir = path.join(root, 'plugins', 'hello');
    expect(fs.existsSync(path.join(targetDir, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'index.js'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'README.md'))).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(path.join(targetDir, 'manifest.json'), 'utf8'));
    expect(manifest.schemaVersion).toBe(ZAVORTH_PLUGIN_OS_API_VERSION);
    expect(manifest.capabilities.some((cap: { id: string }) => cap.id === 'main.ping')).toBe(true);
    expect(new PluginRegistryService().validateManifest(manifest)).toEqual([]);

    const indexSource = fs.readFileSync(path.join(targetDir, 'index.js'), 'utf8');
    expect(indexSource).toContain('main.ping');
    expect(indexSource).toContain('module.exports');

    const state = bridge.resolve('hello');
    expect(state.installed).toBe(true);
    expect(state.enabled).toBe(true);
    expect(state.trust).toBe('trusted');

    expect(result.nextUtterance).toMatch(/run plugin hello ping/i);
    expect(result.steps.some((step) => step.id === 'scaffold' && step.ok)).toBe(true);
    expect(result.steps.some((step) => step.id === 'install-enable' && step.ok)).toBe(true);
  });

  it('scaffolds without install when run=false', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-plugin-new-norun-'));
    tempRoots.push(root);
    const bridge = new PluginStateBridgeService({ projectRoot: root });
    const result = await new PluginNewService({ stateBridge: bridge }).run({
      root,
      id: 'solo',
      run: false,
    });
    expect(result.ok).toBe(true);
    expect(fs.existsSync(path.join(root, 'plugins', 'solo', 'index.js'))).toBe(true);
    expect(bridge.resolve('solo').installed).toBe(false);
  });
});
