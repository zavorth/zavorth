import type { ZavorthPluginManifest } from '../../src/contracts/PluginManifestContract.js';
import { ZAVORTH_PLUGIN_OS_API_VERSION } from '../../src/contracts/PluginManifestContract.js';
import type { ZavorthDiscoveredPlugin } from '../../src/contracts/core/PluginRuntimeContract.js';
import { PluginLoadService } from '../../src/services/PluginLoadService.js';
import { PluginRegistryService } from '../../src/services/PluginRegistryService.js';
import { PluginRuntimeService } from '../../src/services/PluginRuntimeService.js';
import { ToolHookPipelineService } from '../../src/services/ToolHookPipelineService.js';

const FIXED_NOW = () => new Date('2026-07-12T17:00:00.000Z');

const baseManifest = (overrides: Partial<ZavorthPluginManifest> = {}): ZavorthPluginManifest => ({
  schemaVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
  id: 'echo-plugin',
  label: 'Echo Plugin',
  version: '1.0.0',
  moduleKind: 'tool',
  summary: 'Echo capability plugin.',
  description: 'Binds an echo.run capability for runtime tests.',
  tags: ['tool', 'echo'],
  source: {
    kind: 'local',
    locator: 'local://echo-plugin',
    digest: null,
    trusted: true,
  },
  compatibility: {
    zavorthVersion: '>=1.1.0',
    pluginApiVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
  },
  capabilities: [
    {
      id: 'echo.run',
      intent: 'echo',
      label: 'Echo',
      summary: 'Echoes input text.',
      artifactKinds: [],
      command: {
        name: 'echo_run',
        aliases: [],
        usage: '<text>',
      },
    },
  ],
  permissions: [],
  entrypoint: {
    module: './index.js',
    exportName: 'register',
    runtime: 'node',
  },
  lifecycle: {
    actions: ['install', 'enable', 'disable', 'uninstall', 'invoke', 'doctor', 'upgrade'],
    defaultAction: 'invoke',
  },
  policy: {
    defaultTrust: 'trusted',
    requiresApproval: false,
    allowNetworkByDefault: false,
    allowFilesystemWriteByDefault: false,
    allowProcessSpawnByDefault: false,
    sandboxProfile: 'restricted',
  },
  artifactKinds: [],
  receiptKinds: ['echo.receipt'],
  ...overrides,
});

function makeDiscovered(manifest = baseManifest()): ZavorthDiscoveredPlugin {
  return {
    pluginId: manifest.id,
    sourceKind: 'bundled',
    sourceRoot: '/tmp/plugins',
    packageDir: '/tmp/plugins/echo-plugin',
    manifestPath: '/tmp/plugins/echo-plugin/manifest.json',
    manifestFilename: 'manifest.json',
    manifest,
    validation: { ok: true, findings: [] },
    compatibility: { ok: true, findings: [] },
    state: {
      runtimeState: 'enabled',
      trust: 'trusted',
      installed: true,
      enabled: true,
      installedRevision: '1.0.0',
      sourceLocator: 'bundled://echo-plugin',
    },
    loadEligible: true,
    selected: true,
    findings: [],
  };
}

describe('PluginRuntimeService', () => {
  it('bootstraps discover+load+wire with mock import and registries', async () => {
    const registeredTools: string[] = [];
    const hookEvents: string[] = [];
    const registry = new PluginRegistryService({ now: FIXED_NOW });
    const hookPipeline = new ToolHookPipelineService({ now: FIXED_NOW });
    const loader = new PluginLoadService({
      now: FIXED_NOW,
      existsSync: () => true,
      importModule: async () => ({
        register: (ctx: {
          bindCapability: (id: string, handler: unknown) => void;
          registerHook: (event: string, cb: unknown) => void;
        }) => {
          ctx.bindCapability('echo.run', async ({ input }) => ({
            output: { echoed: input?.text || '' },
          }));
          ctx.registerHook('tool.before_execute', async () => {
            hookEvents.push('tool.before_execute');
          });
        },
      }),
    });

    const discoveryStub = {
      discover: () => ({
        generatedAt: FIXED_NOW().toISOString(),
        contractVersion: '2026-07-12.plugin-runtime-v1' as const,
        sources: [],
        plugins: [makeDiscovered()],
        conflicts: [],
        summary: {
          total: 1,
          valid: 1,
          invalid: 0,
          loadEligible: 1,
          selected: 1,
          bySource: { bundled: 1, workspace: 0, user: 0 },
        },
      }),
      formatSnapshotText: () => 'discovery',
    };

    const runtime = new PluginRuntimeService({
      now: FIXED_NOW,
      discovery: discoveryStub as any,
      loader,
      pluginRegistry: registry,
      wireTargets: {
        pluginRegistry: registry,
        toolRegistry: {
          register: (tool: { name: string }) => {
            registeredTools.push(tool.name);
          },
        },
        hookPipeline,
      },
    });

    const snap = await runtime.bootstrap();
    expect(snap.summary.loaded).toBe(1);
    expect(snap.summary.wired).toBe(1);
    expect(snap.wire.handlersRegistered).toBe(1);
    expect(snap.wire.toolsRegistered).toBe(1);
    expect(snap.wire.hooksRegistered).toBe(1);
    expect(registeredTools).toContain('echo_run');
    expect(registry.hasHandler('echo-plugin')).toBe(true);

    await hookPipeline.run({
      event: 'tool.before_execute',
      context: { tool: 'echo_run' },
    });
    expect(hookEvents).toEqual(['tool.before_execute']);

    runtime.dispose();
  });

  it('wires a handler so PluginRegistryService.invoke executes', async () => {
    const registry = new PluginRegistryService({ now: FIXED_NOW });
    const loader = new PluginLoadService({
      now: FIXED_NOW,
      existsSync: () => true,
      importModule: async () => ({
        register: (ctx: { bindCapability: (id: string, handler: unknown) => void }) => {
          ctx.bindCapability('echo.run', async ({ input }) => ({
            output: { echoed: input?.text || '' },
          }));
        },
      }),
    });

    const runtime = new PluginRuntimeService({
      now: FIXED_NOW,
      loader,
      pluginRegistry: registry,
    });

    const load = await loader.loadAll([makeDiscovered()]);
    expect(load.summary.loaded).toBe(1);

    const wire = runtime.wire(load.loaded, { pluginRegistry: registry });
    expect(wire.handlersRegistered).toBe(1);

    registry.install('echo-plugin', { approved: true });
    registry.enable('echo-plugin', { approved: true });

    const result = await registry.invoke({
      pluginId: 'echo-plugin',
      capabilityId: 'echo.run',
      approved: true,
      input: { text: 'wired' },
    });

    expect(result.status).toBe('executed');
    expect(result.output).toEqual({ echoed: 'wired' });
  });

  it('dispose cleans hook listeners', async () => {
    let calls = 0;
    const hookPipeline = new ToolHookPipelineService({ now: FIXED_NOW });
    const loader = new PluginLoadService({
      now: FIXED_NOW,
      existsSync: () => true,
      importModule: async () => ({
        register: (ctx: {
          bindCapability: (id: string, handler: unknown) => void;
          registerHook: (event: string, cb: unknown) => void;
        }) => {
          ctx.bindCapability('echo.run', async () => ({ output: true }));
          ctx.registerHook('tool.after_execute', async () => {
            calls += 1;
          });
        },
      }),
    });

    const runtime = new PluginRuntimeService({ now: FIXED_NOW, loader });
    const load = await loader.loadAll([makeDiscovered()]);
    runtime.wire(load.loaded, { hookPipeline });

    await hookPipeline.run({ event: 'tool.after_execute', context: {} });
    expect(calls).toBe(1);

    runtime.dispose();
    await hookPipeline.run({ event: 'tool.after_execute', context: {} });
    expect(calls).toBe(1);
  });

  it('formatSnapshotText includes bootstrap summary lines', async () => {
    const loader = new PluginLoadService({
      now: FIXED_NOW,
      existsSync: () => true,
      importModule: async () => ({
        register: (ctx: { bindCapability: (id: string, handler: unknown) => void }) => {
          ctx.bindCapability('echo.run', async () => ({ output: 1 }));
        },
      }),
    });
    const discoveryStub = {
      discover: () => ({
        generatedAt: FIXED_NOW().toISOString(),
        contractVersion: '2026-07-12.plugin-runtime-v1' as const,
        sources: [],
        plugins: [makeDiscovered()],
        conflicts: [],
        summary: {
          total: 1,
          valid: 1,
          invalid: 0,
          loadEligible: 1,
          selected: 1,
          bySource: { bundled: 1, workspace: 0, user: 0 },
        },
      }),
      formatSnapshotText: () => 'discovery',
    };

    const runtime = new PluginRuntimeService({
      now: FIXED_NOW,
      discovery: discoveryStub as any,
      loader,
    });
    const snap = await runtime.bootstrap();
    const text = runtime.formatSnapshotText(snap);
    expect(text).toContain('Zavorth Plugin Runtime');
    expect(text).toContain('Loaded: 1');
    expect(text).toContain('echo-plugin');
  });
});
