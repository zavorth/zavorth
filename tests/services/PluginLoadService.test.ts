import type { ZavorthPluginManifest } from '../../src/contracts/PluginManifestContract.js';
import { ZAVORTH_PLUGIN_OS_API_VERSION } from '../../src/contracts/PluginManifestContract.js';
import type { ZavorthDiscoveredPlugin } from '../../src/contracts/core/PluginRuntimeContract.js';
import { PluginLoadService } from '../../src/services/PluginLoadService.js';

const FIXED_NOW = () => new Date('2026-07-12T16:00:00.000Z');

const baseManifest = (overrides: Partial<ZavorthPluginManifest> = {}): ZavorthPluginManifest => ({
  schemaVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
  id: 'echo-plugin',
  label: 'Echo Plugin',
  version: '1.0.0',
  moduleKind: 'tool',
  summary: 'Echo capability plugin.',
  description: 'Binds an echo.run capability for load tests.',
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
        name: 'echo',
        aliases: [],
        usage: '<text>',
      },
    },
  ],
  permissions: [
    {
      kind: 'artifact.write',
      scope: 'workspace',
      reason: 'Write echo receipts.',
      required: false,
    },
  ],
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

function discovered(
  overrides: Partial<ZavorthDiscoveredPlugin> & { manifest-: ZavorthPluginManifest | null } = {},
): ZavorthDiscoveredPlugin {
  const manifest = overrides.manifest === undefined ? baseManifest() : overrides.manifest;
  const pluginId = overrides.pluginId || manifest?.id || 'echo-plugin';
  return {
    pluginId,
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
    ...overrides,
    pluginId,
    manifest,
  };
}

describe('PluginLoadService', () => {
  it.each(['../outside.js', '/tmp/outside.js', 'file:///tmp/outside.js'])(
    'blocks entrypoints outside the plugin package: %s',
    async (module) => {
      const importModule = jest.fn(async () => ({ register: () => undefined }));
      const service = new PluginLoadService({
        now: FIXED_NOW,
        existsSync: () => true,
        importModule,
      });

      const result = await service.loadOne(discovered({
        manifest: baseManifest({
          entrypoint: { module, exportName: 'register', runtime: 'node' },
        }),
      }));

      expect(result.status).toBe('blocked');
      expect(result.findings.join(' ')).toMatch(/relative path|escapes/i);
      expect(importModule).not.toHaveBeenCalled();
    },
  );

  it('skips plugins that are not loadEligible', async () => {
    const service = new PluginLoadService({
      now: FIXED_NOW,
      existsSync: () => true,
      importModule: async () => {
        throw new Error('should not import');
      },
    });

    const result = await service.loadOne(discovered({
      loadEligible: false,
      selected: true,
    }));

    expect(result.status).toBe('skipped');
    expect(result.findings).toEqual(
      expect.arrayContaining(['plugin is not load eligible']),
    );
    expect(service.getLoadedPlugins()).toEqual([]);
  });

  it('loads register(ctx) and binds declared capabilities + hooks', async () => {
    const service = new PluginLoadService({
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
          ctx.registerHook('tool.before_execute', async () => {});
        },
      }),
    });

    const result = await service.loadOne(discovered());
    expect(result.status).toBe('loaded');
    expect(result.capabilities).toEqual(['echo.run']);
    expect(result.hooks).toEqual(['tool.before_execute']);

    const handler = service.getCapabilityHandler('echo-plugin', 'echo.run');
    expect(handler).toBeTruthy();
    const output = await handler!({
      pluginId: 'echo-plugin',
      capabilityId: 'echo.run',
      input: { text: 'hi' },
      requestedBy: null,
    });
    expect(output).toEqual({ output: { echoed: 'hi' } });

    const registryHandler = service.createRegistryHandler('echo-plugin');
    expect(registryHandler).toBeTruthy();
    const invoked = await registryHandler!({
      pluginId: 'echo-plugin',
      capabilityId: 'echo.run',
      input: { text: 'yo' },
    }, {} as any);
    expect(invoked).toEqual({ echoed: 'yo' });
  });

  it('rejects bindCapability for undeclared capability', async () => {
    const service = new PluginLoadService({
      now: FIXED_NOW,
      existsSync: () => true,
      importModule: async () => ({
        register: (ctx: {
          bindCapability: (id: string, handler: unknown) => void;
        }) => {
          ctx.bindCapability('echo.run', async () => ({ output: true }));
          ctx.bindCapability('secret.pwn', async () => ({ output: 'nope' }));
        },
      }),
    });

    const result = await service.loadOne(discovered());
    expect(result.status).toBe('loaded');
    expect(result.findings).toEqual(
      expect.arrayContaining(['bindCapability rejected undeclared capability: secret.pwn']),
    );
    expect(service.getModuleHandler('echo-plugin')).toBeNull();
    expect(service.getCapabilityHandler('echo-plugin', 'echo.run')).toBeTruthy();
  });

  it('loads createZavorthModule style export', async () => {
    const service = new PluginLoadService({
      now: FIXED_NOW,
      existsSync: () => true,
      importModule: async () => ({
        createZavorthModule: () => ({
          manifest: baseManifest({
            entrypoint: {
              module: './index.js',
              exportName: 'createZavorthModule',
              runtime: 'node',
            },
          }),
          handler: async ({ input }: { input: Record<string, unknown> }) => ({
            output: { module: true, value: input?.value || null },
          }),
        }),
      }),
    });

    const result = await service.loadOne(discovered({
      manifest: baseManifest({
        entrypoint: {
          module: './index.js',
          exportName: 'createZavorthModule',
          runtime: 'node',
        },
      }),
    }));

    expect(result.status).toBe('loaded');
    expect(result.exportName).toBe('createZavorthModule');
    expect(service.getModuleHandler('echo-plugin')).toBeTruthy();

    const handler = service.getCapabilityHandler('echo-plugin', 'echo.run');
    const output = await handler!({
      pluginId: 'echo-plugin',
      capabilityId: 'echo.run',
      input: { value: 42 },
      requestedBy: null,
    });
    expect(output).toEqual({ output: { module: true, value: 42 } });
  });

  it('blocks load when sandbox trust is blocked', async () => {
    const service = new PluginLoadService({
      now: FIXED_NOW,
      existsSync: () => true,
      importModule: async () => ({
        register: () => {
          throw new Error('should not run');
        },
      }),
    });

    const result = await service.loadOne(discovered({
      state: {
        runtimeState: 'blocked',
        trust: 'blocked',
        installed: true,
        enabled: true,
        installedRevision: '1.0.0',
        sourceLocator: 'bundled://echo-plugin',
      },
      loadEligible: true,
      selected: true,
    }));

    expect(result.status).toBe('blocked');
    expect(result.findings.join(' ')).toMatch(/blocked/i);
  });

  it('does not import review-trust plugin code without explicit approval', async () => {
    const importModule = jest.fn(async () => ({
      register: (ctx: { bindCapability: (id: string, handler: unknown) => void }) => {
        ctx.bindCapability('echo.run', async () => ({ output: { ok: true } }));
      },
    }));
    const service = new PluginLoadService({
      now: FIXED_NOW,
      existsSync: () => true,
      importModule,
    });
    const plugin = discovered({
      state: {
        runtimeState: 'enabled',
        trust: 'review',
        installed: true,
        enabled: true,
        installedRevision: '1.0.0',
        sourceLocator: 'https://example.com/plugin.zip',
      },
    });

    const blocked = await service.loadOne(plugin);
    expect(blocked.status).toBe('blocked');
    expect(blocked.findings.join(' ')).toMatch(/explicit approval|review-trust/i);
    expect(importModule).not.toHaveBeenCalled();

    const approved = await service.loadOne(plugin, { approved: true });
    expect(approved.status).toBe('loaded');
    expect(importModule).toHaveBeenCalledTimes(1);
  });

  it('marks import failure as failed without throwing from loadAll', async () => {
    const service = new PluginLoadService({
      now: FIXED_NOW,
      existsSync: () => true,
      importModule: async () => {
        throw new Error('boom import');
      },
    });

    const snapshot = await service.loadAll([
      discovered(),
      discovered({
        pluginId: 'other',
        loadEligible: false,
        selected: false,
        manifest: baseManifest({ id: 'other' }),
      }),
    ]);

    expect(snapshot.summary.total).toBe(2);
    expect(snapshot.summary.failed).toBe(1);
    expect(snapshot.summary.skipped).toBe(1);
    expect(snapshot.results.find((item) => item.pluginId === 'echo-plugin')?.findings).toEqual(
      expect.arrayContaining(['boom import']),
    );
  });

  it('skips metadata-only sandbox profile without importing code', async () => {
    let imported = false;
    const service = new PluginLoadService({
      now: FIXED_NOW,
      existsSync: () => true,
      importModule: async () => {
        imported = true;
        return {};
      },
    });

    const result = await service.loadOne(discovered({
      manifest: baseManifest({
        policy: {
          defaultTrust: 'trusted',
          requiresApproval: false,
          allowNetworkByDefault: false,
          allowFilesystemWriteByDefault: false,
          allowProcessSpawnByDefault: false,
          sandboxProfile: 'metadata-only',
        },
      }),
    }));

    expect(result.status).toBe('skipped');
    expect(imported).toBe(false);
    expect(result.findings.join(' ')).toMatch(/metadata-only/i);
  });
});
