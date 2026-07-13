import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runPlugins } from '../../../src/cli/plugins/ZavorthCliPluginsNamespace.js';
import { ZAVORTH_PLUGIN_OS_API_VERSION } from '../../../src/contracts/PluginManifestContract.js';
import { PluginStateBridgeService } from '../../../src/services/PluginStateBridgeService.js';

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-cli-plugins-scaffold-'));
}

describe('ZavorthCliPluginsNamespace scaffold and marketplace install', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('scaffolds a Plugin OS package with manifest.json and register entrypoint', async () => {
    const root = createTempRoot();
    tempRoots.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'tmp', version: '0.0.0' }), 'utf8');

    await runPlugins(root, [
      'scaffold',
      'demo-cost-tracker',
      '--module-kind',
      'diagnostics',
      '--yes',
    ]);

    const targetDir = path.join(root, 'plugins', 'demo-cost-tracker');
    expect(fs.existsSync(path.join(targetDir, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'index.js'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'zavorth.plugin.json'))).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(path.join(targetDir, 'manifest.json'), 'utf8')) as {
      schemaVersion: string;
      moduleKind: string;
      entrypoint: { exportName: string; module: string };
    };
    expect(manifest.schemaVersion).toBe(ZAVORTH_PLUGIN_OS_API_VERSION);
    expect(manifest.moduleKind).toBe('diagnostics');
    expect(manifest.entrypoint.exportName).toBe('register');
    expect(manifest.entrypoint.module).toBe('./index.js');

    const indexSource = fs.readFileSync(path.join(targetDir, 'index.js'), 'utf8');
    expect(indexSource).toContain('function register(ctx)');
    expect(indexSource).toContain('module.exports');
    expect(indexSource).toContain('bindCapability');
    expect(fs.existsSync(path.join(targetDir, 'define-plugin.example.js'))).toBe(true);
  });

  it('installs a marketplace entry into bridge state and workspace plugins', async () => {
    const root = createTempRoot();
    tempRoots.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'tmp', version: '0.0.0' }), 'utf8');

    await runPlugins(root, [
      'install',
      'marketplace:zavorth-plugin-cost-tracker',
      '--yes',
      '--enable',
    ]);

    const packageDir = path.join(root, '.zavorth', 'plugins', 'zavorth-plugin-cost-tracker');
    expect(fs.existsSync(path.join(packageDir, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(packageDir, 'index.js'))).toBe(true);

    const bridge = new PluginStateBridgeService({ projectRoot: root });
    const state = bridge.resolve('zavorth-plugin-cost-tracker');
    expect(state.installed).toBe(true);
    expect(state.enabled).toBe(true);
    expect(state.runtimeState).toBe('enabled');
  });
});
