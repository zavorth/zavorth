import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PluginTestHarnessService } from '../../src/services/PluginTestHarnessService.js';
import { PluginStateBridgeService } from '../../src/services/PluginStateBridgeService.js';

const REPO_ROOT = path.resolve(__dirname, '../..');
const HELLO_WORLD = path.join(REPO_ROOT, 'plugins', 'examples', 'hello-world');

describe('PluginTestHarnessService', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('runs default cases against hello-world example', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-harness-'));
    tempRoots.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'tmp', version: '0.0.0' }), 'utf8');

    const target = path.join(root, 'plugins', 'hello-world');
    fs.mkdirSync(target, { recursive: true });
    for (const file of fs.readdirSync(HELLO_WORLD)) {
      const source = path.join(HELLO_WORLD, file);
      if (fs.statSync(source).isFile()) {
        fs.copyFileSync(source, path.join(target, file));
      }
    }

    const bridge = new PluginStateBridgeService({ projectRoot: root });
    const harness = new PluginTestHarnessService({ stateBridge: bridge });
    const result = await harness.run({
      root,
      pluginPath: './plugins/hello-world',
    });

    expect(result.pluginId).toBe('hello-world');
    expect(result.results.find((item) => item.name === 'manifest-validates')?.ok).toBe(true);
    expect(result.results.find((item) => item.name === 'module-loads-register')?.ok).toBe(true);
    expect(result.results.find((item) => item.name === 'load-eligible')?.ok).toBe(true);
    expect(result.results.find((item) => item.name === 'load-one')?.ok).toBe(true);
    expect(result.results.find((item) => item.name === 'hooks-registered')?.ok).toBe(true);
    expect(result.ok).toBe(true);
  });
});
