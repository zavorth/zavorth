import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runPlugins } from '../../../src/cli/plugins/ZavorthCliPluginsNamespace.js';


describe('plugins singular alias surface', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('runPlugins help documents plugin and plugins commands', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-plugin-alias-'));
    tempRoots.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'tmp', version: '0.0.0' }), 'utf8');

    const result = await runPlugins(root, ['help']);
    const text = JSON.stringify(result);
    expect(text).toMatch(/list/i);
    expect(text).toMatch(/install/i);
    expect(text).toMatch(/uninstall/i);
    expect(text).toMatch(/dev/i);
    expect(text).toMatch(/test/i);
    expect(text).toMatch(/plane|status/i);
  });

  it('plane/status returns control-plane snapshot', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-plugin-plane-'));
    tempRoots.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'tmp', version: '0.0.0' }), 'utf8');

    const plane = await runPlugins(root, ['plane']);
    const status = await runPlugins(root, ['status']);
    expect(JSON.stringify(plane)).toMatch(/control plane|Bridged plugins|commands/i);
    expect(JSON.stringify(status)).toMatch(/control plane|Bridged plugins|commands/i);
  });

  it('LiveNamespaces switch includes plugin alias (source contract)', () => {
    const livePath = path.resolve(__dirname, '../../../src/cli/ZavorthCliLiveNamespaces.ts');
    const source = fs.readFileSync(livePath, 'utf8');
    expect(source).toContain("case 'plugin'");
    expect(source).toContain("case 'plugins'");
    expect(source).toContain('runPluginsNamespace');
  });
});
