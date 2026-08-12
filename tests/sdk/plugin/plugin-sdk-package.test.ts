import fs from 'node:fs';
import path from 'node:path';

import {
  definePlugin,
  inferManifestFromSource,
  resolvePluginPermissions,
} from '../../../packages/plugin-sdk/src/index.js';

describe('@zavorth/plugin-sdk package surface', () => {
  it('re-exports definePlugin from packages/plugin-sdk', () => {
    expect(typeof definePlugin).toBe('function');
    expect(typeof inferManifestFromSource).toBe('function');
    expect(typeof resolvePluginPermissions).toBe('function');

    const plugin = definePlugin({
      id: 'sdk-package-demo',
      kind: 'tool',
      tools: {
        'main.run': async ({ input }: { input?: unknown }) => ({
          output: { ok: true, input: input || {} },
        }),
      },
      permissions: 'auto',
    });

    expect(plugin.kind).toBe('zavorth.defined-plugin');
    expect(plugin.manifest.id).toBe('sdk-package-demo');
    expect(plugin.manifest.capabilities.some((item: { id: string }) => item.id === 'main.run')).toBe(true);
  });

  it('does not import monorepo-relative ../../../src paths', () => {
    const srcDir = path.resolve(__dirname, '../../../packages/plugin-sdk/src');
    const files = fs.readdirSync(srcDir).filter((name) => name.endsWith('.js') || name.endsWith('.ts'));
    for (const name of files) {
      if (name === 'index.ts') {
        // entry re-exports local siblings only
      }
      const text = fs.readFileSync(path.join(srcDir, name), 'utf8');
      expect(text).not.toMatch(/\.\.\/\.\.\/\.\.\/src\//);
      expect(text).not.toMatch(/from\s+['"]\.\.\/\.\.\/\.\.\//);
    }
  });
});
