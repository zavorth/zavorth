import fs from 'node:fs';
import path from 'node:path';

import { PluginRegistryService } from '../../src/services/PluginRegistryService.js';

const EXAMPLES_ROOT = path.resolve(__dirname, '../../plugins/examples');

/** Contract schema + every moduleKind covered by examples (except generic `module`). */
const EXPECTED = [
  'hello-world',
  'example-channel',
  'example-memory',
  'example-provider',
  'example-hook',
  'example-auxiliary',
  'example-media',
  'example-voice',
  'example-search',
  'example-bridge',
  'example-sandbox',
  'example-qa',
  'example-workspace',
] as const;

const EXPECTED_KINDS: Record<(typeof EXPECTED)[number], string> = {
  'hello-world': 'tool',
  'example-channel': 'channel',
  'example-memory': 'memory',
  'example-provider': 'provider',
  'example-hook': 'agent',
  'example-auxiliary': 'diagnostics',
  'example-media': 'media',
  'example-voice': 'voice',
  'example-search': 'search',
  'example-bridge': 'bridge',
  'example-sandbox': 'sandbox',
  'example-qa': 'qa',
  'example-workspace': 'workspace',
};

describe('plugins/examples validation', () => {
  it('ships all expected example packages', () => {
    for (const id of EXPECTED) {
      const dir = path.join(EXAMPLES_ROOT, id);
      expect(fs.existsSync(path.join(dir, 'manifest.json'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'index.js'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'README.md'))).toBe(true);
    }
  });

  it('walks every examples/*/manifest.json and asserts schemaVersion + moduleKind + entrypoint', () => {
    const dirs = fs
      .readdirSync(EXAMPLES_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(dirs.length).toBeGreaterThanOrEqual(EXPECTED.length);

    for (const id of dirs) {
      const manifestPath = path.join(EXAMPLES_ROOT, id, 'manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        schemaVersion-: string;
        id-: string;
        moduleKind-: string;
        entrypoint-: { module-: string; exportName-: string };
        capabilities-: unknown[];
      };

      expect(manifest.schemaVersion).toBe('zavorth.plugin-os.v1');
      expect(manifest.id).toBe(id);
      expect(typeof manifest.moduleKind).toBe('string');
      expect(String(manifest.moduleKind).length).toBeGreaterThan(0);
      expect(manifest.entrypoint).toBeTruthy();
      expect(manifest.entrypoint?.module).toBe('./index.js');
      expect(manifest.entrypoint?.exportName || 'register').toBe('register');
      expect(Array.isArray(manifest.capabilities)).toBe(true);
      expect((manifest.capabilities || []).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('maps expected examples to their moduleKinds', () => {
    for (const id of EXPECTED) {
      const manifestPath = path.join(EXAMPLES_ROOT, id, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        moduleKind: string;
      };
      expect(manifest.moduleKind).toBe(EXPECTED_KINDS[id]);
    }
  });

  it('validates every example manifest via PluginRegistryService', () => {
    const registry = new PluginRegistryService();
    const dirs = fs
      .readdirSync(EXAMPLES_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    for (const id of dirs) {
      const manifestPath = path.join(EXAMPLES_ROOT, id, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const findings = registry.validateManifest(manifest);
      expect({ id, findings }).toEqual({ id, findings: [] });
    }
  });

  it('exports register from every example index.js', () => {
    const dirs = fs
      .readdirSync(EXAMPLES_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    for (const id of dirs) {
      const indexPath = path.join(EXAMPLES_ROOT, id, 'index.js');
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const mod = require(indexPath);
      expect(typeof mod.register).toBe('function');
    }
  });
});
