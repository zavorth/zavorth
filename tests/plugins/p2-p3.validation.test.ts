import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import type { ZavorthPluginManifest } from '../../src/contracts/PluginManifestContract.js';
import type { ZavorthDiscoveredPlugin } from '../../src/contracts/core/PluginRuntimeContract.js';
import { PluginRegistryService } from '../../src/services/PluginRegistryService.js';
import { PluginLoadService } from '../../src/services/PluginLoadService.js';


const PLUGINS_ROOT = path.resolve(__dirname, '../../plugins');
const requireFromTest = createRequire(__filename);

const P2_P3 = [
  'selfmod-plugin-forge',
  'mcp-bridge',
  'gmail',
  'calendar',
  'linear',
  'notion',
];

function asDiscovered(id: string, packageDir: string, manifest: ZavorthPluginManifest): ZavorthDiscoveredPlugin {
  return {
    pluginId: id,
    sourceKind: 'bundled',
    sourceRoot: PLUGINS_ROOT,
    packageDir,
    manifestPath: path.join(packageDir, 'manifest.json'),
    manifestFilename: 'manifest.json',
    manifest,
    validation: { ok: true, findings: [] },
    compatibility: { ok: true, findings: [] },
    state: {
      runtimeState: 'enabled',
      trust: 'trusted',
      installed: true,
      enabled: true,
      installedRevision: manifest.version || '1.0.0',
      sourceLocator: `bundled://${id}`,
    },
    loadEligible: true,
    selected: true,
    findings: [],
  };
}

describe('P2/P3 Plugin OS packages', () => {
  it('ships manifest.json + index.js + README.md', () => {
    for (const id of P2_P3) {
      const dir = path.join(PLUGINS_ROOT, id);
      expect(fs.existsSync(path.join(dir, 'manifest.json'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'index.js'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'README.md'))).toBe(true);
    }
  });

  it('validates every new manifest', () => {
    const registry = new PluginRegistryService();
    for (const id of P2_P3) {
      const manifestPath = path.join(PLUGINS_ROOT, id, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const findings = registry.validateManifest(manifest);
      expect({ id, findings }).toEqual({ id, findings: [] });
    }
  });

  it('exports register and loads via PluginLoadService', async () => {
    for (const id of P2_P3) {
      const dir = path.join(PLUGINS_ROOT, id);
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const mod = require(path.join(dir, 'index.js'));
      expect(typeof mod.register).toBe('function');

      const manifest = JSON.parse(
        fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'),
      ) as ZavorthPluginManifest;
      const loader = new PluginLoadService({
        workspacePath: path.resolve(__dirname, '../..'),
        importModule: async (modulePath: string) => requireFromTest(modulePath),
      });
      const result = await loader.loadOne(asDiscovered(id, dir, manifest), { approved: true });
      expect(result.status).toBe('loaded');
      expect(result.capabilities.length).toBeGreaterThan(0);
    }
  });

  it('curated marketplace includes P2/P3 ids', () => {
    const curatedPath = path.resolve(__dirname, '../../config/plugin-marketplace-curated.json');
    expect(fs.existsSync(curatedPath)).toBe(true);
    const curated = JSON.parse(fs.readFileSync(curatedPath, 'utf8')) as Array<{ id: string }>;
    const ids = new Set(curated.map((entry) => entry.id));
    for (const id of P2_P3) {
      expect(ids.has(id)).toBe(true);
    }
  });
});
