import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { runPlugins } from '../../src/cli/plugins/ZavorthCliPluginsNamespace.js';
import { PluginDiscoveryService } from '../../src/services/PluginDiscoveryService.js';
import { runPluginOsHook, setPluginOsHookPipeline } from '../../src/services/PluginOsHookPipelineAccess.js';
import { PluginRegistryService } from '../../src/services/PluginRegistryService.js';
import { PluginRuntimeService } from '../../src/services/PluginRuntimeService.js';
import { PluginStateBridgeService } from '../../src/services/PluginStateBridgeService.js';
import { ToolHookPipelineService } from '../../src/services/ToolHookPipelineService.js';


const requireFromTest = createRequire(__filename);

const REPO_ROOT = path.resolve(__dirname, '../..');
const PLUGIN_SRC = path.join(REPO_ROOT, 'plugins', 'session-scratch-janitor');
const FIXED_NOW = () => new Date('2026-07-12T21:30:00.000Z');

function createUserWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-user-ws-'));
}

function copyPluginIntoWorkspace(workspace: string): string {
  const target = path.join(workspace, 'plugins', 'session-scratch-janitor');
  fs.mkdirSync(target, { recursive: true });
  for (const file of fs.readdirSync(PLUGIN_SRC)) {
    const source = path.join(PLUGIN_SRC, file);
    if (fs.statSync(source).isFile()) {
      fs.copyFileSync(source, path.join(target, file));
    }
  }
  return target;
}

describe('session-scratch-janitor real-user flow', () => {
  const workspaces: string[] = [];

  afterEach(() => {
    setPluginOsHookPipeline(null);
    for (const root of workspaces.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('installs, enables, loads, tracks scratch files via hooks, and invokes capabilities', async () => {
    const workspace = createUserWorkspace();
    workspaces.push(workspace);
    fs.writeFileSync(path.join(workspace, 'package.json'), JSON.stringify({ name: 'user-ws', version: '0.0.0' }), 'utf8');
    const pluginDir = copyPluginIntoWorkspace(workspace);
    const relativePlugin = path.relative(workspace, pluginDir).replace(/\\/g, '/');

    // 1) User installs local plugin
    await runPlugins(workspace, ['install', `./${relativePlugin}`, '--yes']);

    // 2) User enables plugin
    await runPlugins(workspace, ['enable', 'session-scratch-janitor', '--yes']);

    // 3) User inspects / OS plane
    await runPlugins(workspace, ['inspect', 'session-scratch-janitor']);
    await runPlugins(workspace, ['os']);

    const bridge = new PluginStateBridgeService({ now: FIXED_NOW, projectRoot: workspace });
    const bridged = bridge.resolve('session-scratch-janitor');
    expect(bridged.installed).toBe(true);
    expect(bridged.enabled).toBe(true);
    expect(bridged.runtimeState).toBe('enabled');

    // 4) Discovery must mark loadEligible
    const discovery = new PluginDiscoveryService({
      now: FIXED_NOW,
      projectRoot: workspace,
      workspaceRoot: workspace,
      userHome: path.join(workspace, 'home'),
      stateLookup: bridge.asStateLookup(),
    });
    const discovered = discovery.discover();
    const plugin = discovered.plugins.find((entry) => entry.pluginId === 'session-scratch-janitor' && entry.selected);
    expect(plugin).toBeTruthy();
    expect(plugin?.validation.ok).toBe(true);
    expect(plugin?.loadEligible).toBe(true);

    // 5) Runtime bootstrap: load + wire registry + hooks
    const hookPipeline = new ToolHookPipelineService();
    setPluginOsHookPipeline(hookPipeline);
    const registry = new PluginRegistryService({ now: FIXED_NOW });
    const runtime = new PluginRuntimeService({
      now: FIXED_NOW,
      projectRoot: workspace,
      workspaceRoot: workspace,
      stateBridge: bridge,
      wireTargets: {
        pluginRegistry: registry,
        hookPipeline,
      },
      loadRuntime: {
        workspacePath: workspace,
        importModule: async (modulePath) => requireFromTest(modulePath) as Record<string, unknown>,
      },
    });

    const boot = await runtime.bootstrap({
      projectRoot: workspace,
      workspaceRoot: workspace,
      approvedPluginIds: ['session-scratch-janitor'],
      targets: {
        pluginRegistry: registry,
        hookPipeline,
      },
    });

    expect(boot.summary.loaded).toBeGreaterThanOrEqual(1);
    expect(boot.wire.handlersRegistered).toBeGreaterThanOrEqual(1);
    expect(boot.wire.hooksRegistered).toBeGreaterThanOrEqual(1);
    expect(registry.hasHandler('session-scratch-janitor')).toBe(true);

    // 6) Simulate tool writing a scratch file (user-like tool context)
    const scratchDir = path.join(workspace, '.zavorth', 'scratch');
    fs.mkdirSync(scratchDir, { recursive: true });
    const scratchFile = path.join(scratchDir, 'scratch-demo.tmp');
    fs.writeFileSync(scratchFile, 'ephemeral payload', 'utf8');

    await runPluginOsHook({
      event: 'tool.after_execute',
      workspace,
      context: {
        toolName: 'workspace.write',
        path: scratchFile,
        ok: true,
      },
    });

    // 7) Invoke status capability through registry (policy approved)
    const statusResult = await registry.invoke({
      pluginId: 'session-scratch-janitor',
      capabilityId: 'ephemera.status',
      input: {},
      approved: true,
    });
    expect(statusResult.status).toBe('executed');
    expect(statusResult.output).toEqual(expect.objectContaining({
      activeCount: 1,
      totalBytes: expect.any(Number),
    }));
    expect((statusResult.output as { active: Array<{ path: string }> }).active[0].path).toBe(scratchFile);

    // 8) Dry-run sweep
    const dryRun = await registry.invoke({
      pluginId: 'session-scratch-janitor',
      capabilityId: 'ephemera.sweep',
      input: { apply: false },
      approved: true,
    });
    expect(dryRun.status).toBe('executed');
    expect(dryRun.output).toEqual(expect.objectContaining({
      ok: true,
      receipt: expect.objectContaining({
        mode: 'dry-run',
        plannedCount: 1,
        deletedCount: 0,
      }),
    }));
    expect(fs.existsSync(scratchFile)).toBe(true);

    // 9) Apply sweep with trusted permission path (loader trusted/approved)
    // Re-bootstrap with trusted state so requestPermission returns true
    bridge.setTrust('session-scratch-janitor', 'trusted');
    runtime.dispose();
    const hookPipeline2 = new ToolHookPipelineService();
    setPluginOsHookPipeline(hookPipeline2);
    const registry2 = new PluginRegistryService({ now: FIXED_NOW });
    const runtime2 = new PluginRuntimeService({
      now: FIXED_NOW,
      projectRoot: workspace,
      workspaceRoot: workspace,
      stateBridge: bridge,
      wireTargets: {
        pluginRegistry: registry2,
        hookPipeline: hookPipeline2,
      },
      loadRuntime: {
        workspacePath: workspace,
        importModule: async (modulePath) => requireFromTest(modulePath) as Record<string, unknown>,
      },
    });
    await runtime2.bootstrap({
      projectRoot: workspace,
      workspaceRoot: workspace,
      approvedPluginIds: ['session-scratch-janitor'],
      targets: {
        pluginRegistry: registry2,
        hookPipeline: hookPipeline2,
      },
    });

    // Re-track after reload (ledger already has track; ensure file still exists)
    fs.writeFileSync(scratchFile, 'ephemeral payload', 'utf8');
    await runPluginOsHook({
      event: 'tool.after_execute',
      workspace,
      context: { toolName: 'workspace.write', path: scratchFile },
    });

    const applyResult = await registry2.invoke({
      pluginId: 'session-scratch-janitor',
      capabilityId: 'ephemera.sweep',
      input: { apply: true },
      approved: true,
    });
    expect(applyResult.status).toBe('executed');
    expect(applyResult.output).toEqual(expect.objectContaining({
      ok: true,
      receipt: expect.objectContaining({
        mode: 'apply',
        deletedCount: expect.any(Number),
      }),
    }));
    expect(fs.existsSync(scratchFile)).toBe(false);

    const ledgerPath = path.join(workspace, '.zavorth', 'session-scratch-janitor', 'ledger.jsonl');
    expect(fs.existsSync(ledgerPath)).toBe(true);
    const ledger = fs.readFileSync(ledgerPath, 'utf8');
    expect(ledger).toContain('"kind":"track"');
    expect(ledger).toContain('"kind":"sweep"');

    runtime2.dispose();
  });

  it('rejects paths outside allowlisted roots (safety)', async () => {
    const workspace = createUserWorkspace();
    workspaces.push(workspace);
    const { createJanitor } = requireFromTest(path.join(PLUGIN_SRC, 'janitor.js')) as {
      createJanitor: (workspacePath: string) => {
        observeToolContext(context: Record<string, unknown>): { tracked: string[] };
        isAllowlisted(targetPath: string): boolean;
      };
    };

    const janitor = createJanitor(workspace);
    const outside = path.join(workspace, 'src', 'important.ts');
    fs.mkdirSync(path.dirname(outside), { recursive: true });
    fs.writeFileSync(outside, 'secret', 'utf8');

    const observed = janitor.observeToolContext({ path: outside, toolName: 'workspace.write' });
    expect(observed.tracked).toEqual([]);
    expect(janitor.isAllowlisted(outside)).toBe(false);
  });
});
