import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PluginDevService } from '../../src/services/PluginDevService.js';
import { PluginScaffoldService } from '../../src/services/PluginScaffoldService.js';
import { PluginStateBridgeService } from '../../src/services/PluginStateBridgeService.js';

describe('PluginDevService', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('runs a local dev loop for a scaffolded plugin', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-plugin-dev-'));
    tempRoots.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'tmp', version: '0.0.0' }), 'utf8');

    const targetDir = path.join(root, 'plugins', 'dev-demo');
    new PluginScaffoldService().scaffold({
      root,
      id: 'dev-demo',
      targetDir,
      moduleKind: 'tool',
      withHooks: true,
      withTools: true,
    });

    const bridge = new PluginStateBridgeService({ projectRoot: root });
    const service = new PluginDevService({ stateBridge: bridge });
    const snapshot = await service.run({
      root,
      pluginPath: './plugins/dev-demo',
      enable: true,
      trust: 'trusted',
      applyInference: true,
    });

    expect(snapshot.pluginId).toBe('dev-demo');
    expect(snapshot.steps.some((step) => step.id === 'resolve-path' && step.ok)).toBe(true);
    expect(snapshot.steps.some((step) => step.id === 'bridge-install' && step.ok)).toBe(true);
    expect(snapshot.inference?.inferredCapabilityIds.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(targetDir, 'manifest.dev.inferred.json'))).toBe(true);

    const bridged = bridge.resolve('dev-demo');
    expect(bridged.installed).toBe(true);
    expect(bridged.enabled).toBe(true);
    expect(bridged.trust).toBe('trusted');

    const text = snapshot.formatText();
    expect(text).toContain('Plugin dev: dev-demo');
    expect(text).toContain('Steps:');
  });
});
