import type { ZavorthPluginManifest } from '../../src/contracts/PluginManifestContract.js';
import { ZAVORTH_PLUGIN_OS_API_VERSION } from '../../src/contracts/PluginManifestContract.js';
import type { ZavorthDiscoveredPlugin } from '../../src/contracts/core/PluginRuntimeContract.js';
import { PluginLoadService } from '../../src/services/PluginLoadService.js';
import {
  normalizeChannelBinding,
  normalizeToolBinding,
} from '../../src/services/PluginModuleKindAdapters.js';
import { PluginRuntimeService } from '../../src/services/PluginRuntimeService.js';

const FIXED_NOW = () => new Date('2026-07-12T19:00:00.000Z');

const baseManifest = (overrides: Partial<ZavorthPluginManifest> = {}): ZavorthPluginManifest => ({
  schemaVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
  id: 'channel-plugin',
  label: 'Channel Plugin',
  version: '1.0.0',
  moduleKind: 'channel',
  summary: 'Channel adapter plugin.',
  description: 'Binds a channel adapter for moduleKind tests.',
  tags: ['channel'],
  source: {
    kind: 'local',
    locator: 'local://channel-plugin',
    digest: null,
    trusted: true,
  },
  compatibility: {
    zavorthVersion: '>=1.1.0',
    pluginApiVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
  },
  capabilities: [
    {
      id: 'channel.send',
      intent: 'channel_send',
      label: 'Channel Send',
      summary: 'Sends a channel message.',
      artifactKinds: [],
      command: { name: 'channel_send', aliases: [], usage: null },
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
  receiptKinds: [],
  ...overrides,
});

function discovered(manifest: ZavorthPluginManifest): ZavorthDiscoveredPlugin {
  return {
    pluginId: manifest.id,
    sourceKind: 'bundled',
    sourceRoot: '/tmp/plugins',
    packageDir: '/tmp/plugins/channel-plugin',
    manifestPath: '/tmp/plugins/channel-plugin/manifest.json',
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
      sourceLocator: 'bundled://channel-plugin',
    },
    loadEligible: true,
    selected: true,
    findings: [],
  };
}

describe('PluginModuleKindAdapters', () => {
  it('normalizeChannelBinding succeeds for channel moduleKind with declared capability', () => {
    const result = normalizeChannelBinding(baseManifest(), {
      id: 'main',
      capabilityId: 'channel.send',
      send: async () => ({ ok: true }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('main');
      expect(result.value.capabilityId).toBe('channel.send');
    }
  });

  it('normalizeChannelBinding fails for tool moduleKind', () => {
    const result = normalizeChannelBinding(baseManifest({ moduleKind: 'tool' }), {
      id: 'main',
      capabilityId: 'channel.send',
      send: async () => ({ ok: true }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.finding).toMatch(/moduleKind tool is not allowed/i);
    }
  });

  it('register(ctx) bindChannel succeeds for channel moduleKind with declared capability', async () => {
    const service = new PluginLoadService({
      now: FIXED_NOW,
      existsSync: () => true,
      importModule: async () => ({
        register: (ctx: {
          bindChannel: (adapter: {
            id: string;
            capabilityId: string;
            send: (input: Record<string, unknown>) => Promise<unknown>;
          }) => void;
        }) => {
          ctx.bindChannel({
            id: 'main',
            capabilityId: 'channel.send',
            send: async (input) => ({ sent: input?.text || '' }),
          });
        },
      }),
    });

    const result = await service.loadOne(discovered(baseManifest()));
    expect(result.status).toBe('loaded');
    expect(result.findings).toEqual([]);
    expect(service.getChannelBindings('channel-plugin')).toHaveLength(1);

    const handler = service.getCapabilityHandler('channel-plugin', 'channel.send');
    expect(handler).toBeTruthy();
    const output = await handler!({
      pluginId: 'channel-plugin',
      capabilityId: 'channel.send',
      input: { text: 'hello' },
      requestedBy: null,
    });
    expect(output).toEqual({ output: { sent: 'hello' } });
  });

  it('bindChannel fails for tool moduleKind', async () => {
    const service = new PluginLoadService({
      now: FIXED_NOW,
      existsSync: () => true,
      importModule: async () => ({
        register: (ctx: {
          bindChannel: (adapter: {
            id: string;
            capabilityId: string;
            send: () => Promise<unknown>;
          }) => void;
          bindCapability: (id: string, handler: unknown) => void;
        }) => {
          ctx.bindChannel({
            id: 'main',
            capabilityId: 'echo.run',
            send: async () => ({ ok: true }),
          });
          ctx.bindCapability('echo.run', async () => ({ output: true }));
        },
      }),
    });

    const result = await service.loadOne(discovered(baseManifest({
      id: 'tool-plugin',
      moduleKind: 'tool',
      capabilities: [
        {
          id: 'echo.run',
          intent: 'echo',
          label: 'Echo',
          summary: 'Echo.',
          artifactKinds: [],
          command: { name: 'echo', aliases: [], usage: null },
        },
      ],
    })));

    expect(result.status).toBe('loaded');
    expect(result.findings.join(' ')).toMatch(/moduleKind tool is not allowed/i);
    expect(service.getChannelBindings('tool-plugin')).toHaveLength(0);
  });

  it('bindTool registers capability handler', async () => {
    const toolManifest = baseManifest({
      id: 'tool-plugin',
      moduleKind: 'tool',
      capabilities: [
        {
          id: 'echo.run',
          intent: 'echo',
          label: 'Echo',
          summary: 'Echo.',
          artifactKinds: [],
          command: { name: 'echo', aliases: [], usage: null },
        },
      ],
    });

    const normalize = normalizeToolBinding(toolManifest, {
      capabilityId: 'echo.run',
      handler: async ({ input }) => ({ output: { echoed: input?.text || '' } }),
    });
    expect(normalize.ok).toBe(true);

    const service = new PluginLoadService({
      now: FIXED_NOW,
      existsSync: () => true,
      importModule: async () => ({
        register: (ctx: {
          bindTool: (tool: {
            capabilityId: string;
            handler: (input: {
              pluginId: string;
              capabilityId: string;
              input: Record<string, unknown>;
              requestedBy: string | null;
            }) => Promise<{ output: unknown }>;
          }) => void;
        }) => {
          ctx.bindTool({
            capabilityId: 'echo.run',
            handler: async ({ input }) => ({ output: { echoed: input?.text || '' } }),
          });
        },
      }),
    });

    const result = await service.loadOne(discovered(toolManifest));
    expect(result.status).toBe('loaded');
    const handler = service.getCapabilityHandler('tool-plugin', 'echo.run');
    expect(handler).toBeTruthy();
    const output = await handler!({
      pluginId: 'tool-plugin',
      capabilityId: 'echo.run',
      input: { text: 'hi' },
      requestedBy: null,
    });
    expect(output).toEqual({ output: { echoed: 'hi' } });
  });

  it('runtime wire invokes channelAdapters.register', async () => {
    const registered: string[] = [];
    const loader = new PluginLoadService({
      now: FIXED_NOW,
      existsSync: () => true,
      importModule: async () => ({
        register: (ctx: {
          bindChannel: (adapter: {
            id: string;
            capabilityId: string;
            send: (input: Record<string, unknown>) => Promise<unknown>;
          }) => void;
        }) => {
          ctx.bindChannel({
            id: 'main',
            capabilityId: 'channel.send',
            send: async () => ({ ok: true }),
          });
        },
      }),
    });

    const load = await loader.loadAll([discovered(baseManifest())]);
    expect(load.summary.loaded).toBe(1);

    const runtime = new PluginRuntimeService({ now: FIXED_NOW, loader });
    const wire = runtime.wire(load.loaded, {
      channelAdapters: {
        register: (adapter) => {
          registered.push(`${adapter.pluginId}:${adapter.id}`);
        },
      },
    });

    expect(wire.channelsRegistered).toBe(1);
    expect(wire.plans[0].channelIds).toEqual(['main']);
    expect(registered).toEqual(['channel-plugin:main']);
  });
});
