import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PluginScaffoldService } from '../../src/services/PluginScaffoldService.js';
import { PluginRegistryService } from '../../src/services/PluginRegistryService.js';

const KINDS = ['tool', 'channel', 'memory', 'provider', 'agent', 'diagnostics'] as const;

describe('PluginScaffoldService templates', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it.each(KINDS)('generates valid manifest and index for kind=%s', (kind) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `zavorth-scaffold-${kind}-`));
    tempRoots.push(root);
    const targetDir = path.join(root, 'plugins', `scaffold-${kind}`);
    const service = new PluginScaffoldService();
    const result = service.scaffold({
      root,
      id: `scaffold-${kind}`,
      targetDir,
      kind,
      withHooks: true,
      withTools: true,
    });

    expect(result.moduleKind).toBeTruthy();
    const manifest = JSON.parse(fs.readFileSync(path.join(targetDir, 'manifest.json'), 'utf8'));
    const findings = new PluginRegistryService().validateManifest(manifest);
    expect(findings).toEqual([]);

    const indexSource = fs.readFileSync(path.join(targetDir, 'index.js'), 'utf8');
    expect(indexSource).toContain('function register(ctx)');
    expect(indexSource).toContain('module.exports');

    if (kind === 'channel') {
      expect(indexSource).toContain('bindChannel');
    } else if (kind === 'memory') {
      expect(indexSource).toContain('bindMemoryBackend');
    } else if (kind === 'provider') {
      expect(indexSource).toContain('bindProvider');
      expect(indexSource).toContain('name:');
    } else if (kind === 'agent') {
      expect(indexSource).toContain('registerHook');
      expect(indexSource).toContain('agent.after_turn');
    } else {
      expect(indexSource).toContain('bindCapability');
    }
  });

  it('writes index.ts alongside index.js when language=ts', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-scaffold-ts-'));
    tempRoots.push(root);
    const targetDir = path.join(root, 'plugins', 'ts-demo');
    const result = new PluginScaffoldService().scaffold({
      root,
      id: 'ts-demo',
      targetDir,
      kind: 'tool',
      language: 'ts',
    });

    expect(result.language).toBe('ts');
    expect(fs.existsSync(path.join(targetDir, 'index.js'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'index.ts'))).toBe(true);
    const tsSource = fs.readFileSync(path.join(targetDir, 'index.ts'), 'utf8');
    expect(tsSource).toContain('export function register');
  });
});
