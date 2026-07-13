import { definePlugin, isDefinedPlugin, toPluginRegisterExport } from '../../../src/sdk/plugin/definePlugin.js';
import { ZAVORTH_PLUGIN_OS_API_VERSION } from '../../../src/contracts/PluginManifestContract.js';
import type { ZavorthPluginRegistrationContext } from '../../../src/contracts/core/PluginRuntimeContract.js';

function createMockContext() {
  const capabilities: string[] = [];
  const tools: string[] = [];
  const hooks: string[] = [];
  let setupCalled = false;
  const ctx = {
    bindCapability(id: string) {
      capabilities.push(id);
    },
    bindTool(tool: { capabilityId: string }) {
      tools.push(tool.capabilityId);
    },
    bindChannel() {},
    bindMemoryBackend() {},
    bindProvider() {},
    registerHook(event: string) {
      hooks.push(event);
    },
    getConfig: () => ({}),
    getLogger: () => ({
      debug() {},
      info() {},
      warn() {},
      error() {},
    }),
    getWorkspacePath: () => '/tmp',
    requestPermission: async () => true,
    emit() {},
    markSetup() {
      setupCalled = true;
    },
  } as unknown as ZavorthPluginRegistrationContext & { markSetup(): void };

  return {
    ctx,
    capabilities,
    tools,
    hooks,
    wasSetupCalled: () => setupCalled,
  };
}

describe('definePlugin', () => {
  it('builds a valid manifest with tools and auto permissions', () => {
    const defined = definePlugin({
      id: 'Echo.Tool',
      kind: 'tool',
      summary: 'Echo tool plugin',
      tools: {
        'echo.run': async ({ input }) => ({
          output: { text: input?.text || '' },
        }),
      },
      permissions: 'auto',
    });

    expect(isDefinedPlugin(defined)).toBe(true);
    expect(defined.kind).toBe('zavorth.defined-plugin');
    expect(defined.manifest.schemaVersion).toBe(ZAVORTH_PLUGIN_OS_API_VERSION);
    expect(defined.manifest.id).toBe('echo.tool');
    expect(defined.manifest.moduleKind).toBe('tool');
    expect(defined.manifest.capabilities.map((capability) => capability.id)).toEqual(['echo.run']);
    expect(defined.manifest.permissions.some((permission) => permission.kind === 'filesystem.read')).toBe(true);
    expect(defined.manifest.entrypoint.exportName).toBe('register');
  });

  it('register binds tools and hooks then runs setup', async () => {
    const mock = createMockContext();
    let setupOrder = '';
    const defined = definePlugin({
      id: 'hooked-tool',
      kind: 'diagnostics',
      tools: {
        'status.run': {
          handler: async () => ({ output: { ok: true } }),
          label: 'Status',
        },
      },
      hooks: {
        'tool.before_execute': async () => {
          setupOrder += 'hook;';
        },
      },
      setup: async () => {
        setupOrder += 'setup;';
      },
    });

    await defined.register(mock.ctx);

    expect(mock.tools).toContain('status.run');
    expect(mock.hooks).toContain('tool.before_execute');
    expect(setupOrder).toBe('setup;');
  });

  it('adds main.run when no capabilities or tools are provided', () => {
    const defined = definePlugin({
      id: 'empty-plugin',
      kind: 'module',
    });
    expect(defined.manifest.capabilities.map((capability) => capability.id)).toEqual(['main.run']);
  });

  it('toPluginRegisterExport exposes register and manifest', () => {
    const defined = definePlugin({
      id: 'export-plugin',
      tools: {
        'main.run': async () => ({ output: { ok: true } }),
      },
    });
    const exported = toPluginRegisterExport(defined);
    expect(exported.manifest.id).toBe('export-plugin');
    expect(typeof exported.register).toBe('function');
  });
});
