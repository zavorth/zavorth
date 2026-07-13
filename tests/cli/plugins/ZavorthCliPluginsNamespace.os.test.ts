import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runPlugins } from '../../../src/cli/plugins/ZavorthCliPluginsNamespace.js';
import { PluginStateBridgeService } from '../../../src/services/PluginStateBridgeService.js';

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-cli-plugins-os-'));
}

describe('ZavorthCliPluginsNamespace OS plane', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('enable via runPlugins updates bridge state', async () => {
    const root = createTempRoot();
    tempRoots.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'tmp', version: '0.0.0' }), 'utf8');
    const pluginsDir = path.join(root, '.zavorth');
    fs.mkdirSync(pluginsDir, { recursive: true });
    fs.writeFileSync(path.join(pluginsDir, 'plugins.json'), JSON.stringify([
      {
        id: 'sample-plugin',
        name: 'sample-plugin',
        spec: './sample-plugin',
        version: '0.1.0',
        status: 'installed',
        enabled: false,
        permissions: [],
        sandbox: {},
        hooks: {},
      },
    ], null, 2), 'utf8');

    await runPlugins(root, ['enable', 'sample-plugin', '--yes']);

    const bridge = new PluginStateBridgeService({ projectRoot: root });
    const state = bridge.resolve('sample-plugin');
    expect(state.installed).toBe(true);
    expect(state.enabled).toBe(true);
    expect(state.runtimeState).toBe('enabled');
  });
});
