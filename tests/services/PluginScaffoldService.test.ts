import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PluginScaffoldService } from '../../src/services/PluginScaffoldService.js';
import { PluginRegistryService } from '../../src/services/PluginRegistryService.js';
import { ZAVORTH_PLUGIN_OS_API_VERSION } from '../../src/contracts/PluginManifestContract.js';

describe('PluginScaffoldService', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('creates definePlugin-style package files with valid manifest', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-scaffold-svc-'));
    tempRoots.push(root);
    const targetDir = path.join(root, 'plugins', 'demo-scaffold');

    const service = new PluginScaffoldService();
    const result = service.scaffold({
      root,
      id: 'demo-scaffold',
      targetDir,
      moduleKind: 'diagnostics',
      withHooks: true,
      withTools: true,
    });

    expect(result.id).toBe('demo-scaffold');
    expect(result.moduleKind).toBe('diagnostics');
    expect(fs.existsSync(path.join(targetDir, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'index.js'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'define-plugin.example.js'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'zavorth.plugin.json'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'README.md'))).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(path.join(targetDir, 'manifest.json'), 'utf8'));
    expect(manifest.schemaVersion).toBe(ZAVORTH_PLUGIN_OS_API_VERSION);
    expect(manifest.entrypoint.exportName).toBe('register');

    const registry = new PluginRegistryService();
    expect(registry.validateManifest(manifest)).toEqual([]);

    const indexSource = fs.readFileSync(path.join(targetDir, 'index.js'), 'utf8');
    expect(indexSource).toContain('function register(ctx)');
    expect(indexSource).toContain('module.exports');
    expect(indexSource).toContain('bindCapability');
    expect(indexSource).toContain('registerHook');

    const pkg = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8'));
    expect(pkg.type).toBeUndefined();
    expect(pkg.main).toBe('index.js');
  });

  it('honors withHooks=false', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-scaffold-nohooks-'));
    tempRoots.push(root);
    const targetDir = path.join(root, 'plugins', 'no-hooks');
    const service = new PluginScaffoldService();
    service.scaffold({
      root,
      id: 'no-hooks',
      targetDir,
      withHooks: false,
      withTools: true,
    });
    const indexSource = fs.readFileSync(path.join(targetDir, 'index.js'), 'utf8');
    expect(indexSource).not.toContain('registerHook');
  });
});
