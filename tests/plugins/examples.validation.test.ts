import fs from 'node:fs';
import path from 'node:path';

import { PluginRegistryService } from '../../src/services/PluginRegistryService.js';

const EXAMPLES_ROOT = path.resolve(__dirname, '../../plugins/examples');

const EXPECTED = [
  'hello-world',
  'example-channel',
  'example-memory',
  'example-provider',
  'example-hook',
  'example-auxiliary',
];

describe('plugins/examples validation', () => {
  it('ships all expected example packages', () => {
    for (const id of EXPECTED) {
      const dir = path.join(EXAMPLES_ROOT, id);
      expect(fs.existsSync(path.join(dir, 'manifest.json'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'index.js'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'README.md'))).toBe(true);
    }
  });

  it('validates every example manifest via PluginRegistryService', () => {
    const registry = new PluginRegistryService();
    for (const id of EXPECTED) {
      const manifestPath = path.join(EXAMPLES_ROOT, id, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const findings = registry.validateManifest(manifest);
      expect({ id, findings }).toEqual({ id, findings: [] });
    }
  });

  it('exports register from every example index.js', () => {
    for (const id of EXPECTED) {
      const indexPath = path.join(EXAMPLES_ROOT, id, 'index.js');
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const mod = require(indexPath);
      expect(typeof mod.register).toBe('function');
    }
  });
});
