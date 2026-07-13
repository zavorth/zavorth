import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { PluginDiscoveryService } from '../../src/services/PluginDiscoveryService.js';
import { PluginRuntimeService } from '../../src/services/PluginRuntimeService.js';
import { PluginStateBridgeService } from '../../src/services/PluginStateBridgeService.js';
import { PluginRegistryService } from '../../src/services/PluginRegistryService.js';
import { ToolHookPipelineService } from '../../src/services/ToolHookPipelineService.js';
import { setPluginOsHookPipeline, runPluginOsHook } from '../../src/services/PluginOsHookPipelineAccess.js';

const requireFromTest = createRequire(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

describe('session-scratch-janitor repo smoke (operator-like)', () => {
  afterEach(() => {
    setPluginOsHookPipeline(null);
  });

  it('discovers the bundled plugin under repo plugins/ and can load when enabled', async () => {
    expect(fs.existsSync(path.join(REPO_ROOT, 'plugins', 'session-scratch-janitor', 'manifest.json'))).toBe(true);

    const bridge = new PluginStateBridgeService({ projectRoot: REPO_ROOT });
    bridge.markInstalled({
      pluginId: 'session-scratch-janitor',
      revision: '1.0.0',
      sourceLocator: 'bundled://session-scratch-janitor',
      enable: true,
      trust: 'trusted',
    });

    const discovery = new PluginDiscoveryService({
      projectRoot: REPO_ROOT,
      stateLookup: bridge.asStateLookup(),
    });
    const snap = discovery.discover();
    const plugin = snap.plugins.find(
      (entry) => entry.pluginId === 'session-scratch-janitor' && entry.selected,
    );
    expect(plugin).toBeTruthy();
    expect(plugin?.sourceKind).toBe('bundled');
    expect(plugin?.validation.ok).toBe(true);
    expect(plugin?.loadEligible).toBe(true);

    const hooks = new ToolHookPipelineService();
    setPluginOsHookPipeline(hooks);
    const registry = new PluginRegistryService();
    const runtime = new PluginRuntimeService({
      projectRoot: REPO_ROOT,
      stateBridge: bridge,
      wireTargets: { pluginRegistry: registry, hookPipeline: hooks },
      loadRuntime: {
        workspacePath: REPO_ROOT,
        importModule: async (modulePath) => requireFromTest(modulePath),
      },
    });

    const boot = await runtime.bootstrap({
      projectRoot: REPO_ROOT,
      approvedPluginIds: ['session-scratch-janitor'],
      targets: { pluginRegistry: registry, hookPipeline: hooks },
    });
    expect(boot.summary.loaded).toBeGreaterThanOrEqual(1);

    const scratchDir = path.join(REPO_ROOT, '.zavorth', 'scratch');
    fs.mkdirSync(scratchDir, { recursive: true });
    const scratchFile = path.join(scratchDir, `scratch-repo-smoke-${Date.now()}.tmp`);
    fs.writeFileSync(scratchFile, 'repo smoke', 'utf8');

    await runPluginOsHook({
      event: 'tool.after_execute',
      workspace: REPO_ROOT,
      context: { toolName: 'workspace.write', path: scratchFile },
    });

    const status = await registry.invoke({
      pluginId: 'session-scratch-janitor',
      capabilityId: 'ephemera.status',
      approved: true,
    });
    expect(status.status).toBe('executed');
    expect((status.output as { activeCount: number }).activeCount).toBeGreaterThanOrEqual(1);

    const sweep = await registry.invoke({
      pluginId: 'session-scratch-janitor',
      capabilityId: 'ephemera.sweep',
      input: { apply: true },
      approved: true,
    });
    expect(sweep.status).toBe('executed');
    expect(fs.existsSync(scratchFile)).toBe(false);

    runtime.dispose();
  });
});
