import { definePlugin } from '../../../src/sdk/plugin/definePlugin.js';
import {
  inferManifestFromDefinedPlugin,
  inferManifestFromSource,
  reconcileManifestWithInference,
} from '../../../src/sdk/plugin/manifestInference.js';
import { ZAVORTH_PLUGIN_OS_API_VERSION } from '../../../src/contracts/PluginManifestContract.js';

describe('manifestInference', () => {
  it('infers from DefinedPlugin', () => {
    const defined = definePlugin({
      id: 'defined-infer',
      kind: 'tool',
      tools: {
        'alpha.run': async () => ({ output: { ok: true } }),
        'beta.run': async () => ({ output: { ok: true } }),
      },
      hooks: {
        'tool.after_execute': async () => {},
      },
    });

    const result = inferManifestFromDefinedPlugin(defined);
    expect(result.ok).toBe(true);
    expect(result.source).toBe('defined-plugin');
    expect(result.inferredCapabilityIds).toEqual(expect.arrayContaining(['alpha.run', 'beta.run']));
    expect(result.inferredHookEvents).toContain('tool.after_execute');
    expect(result.manifest?.schemaVersion).toBe(ZAVORTH_PLUGIN_OS_API_VERSION);
  });

  it('source-scan finds bindCapability and registerHook', () => {
    const source = `
function register(ctx) {
  ctx.bindCapability('ephemera.status', async () => ({ output: {} }));
  ctx.bindCapability("ephemera.sweep", async () => ({ output: {} }));
  ctx.registerHook('tool.after_execute', async () => {});
  ctx.registerHook('agent.after_turn', async () => {});
}
module.exports = { register };
`;
    const result = inferManifestFromSource(source, 'session-scratch-janitor');
    expect(result.ok).toBe(true);
    expect(result.source).toBe('source-scan');
    expect(result.inferredCapabilityIds).toEqual(
      expect.arrayContaining(['ephemera.status', 'ephemera.sweep']),
    );
    expect(result.inferredHookEvents).toEqual(
      expect.arrayContaining(['tool.after_execute', 'agent.after_turn']),
    );
  });

  it('source-scan finds definePlugin tools keys', () => {
    const source = `
export const plugin = definePlugin({
  id: 'sample-dev',
  kind: 'diagnostics',
  tools: {
    'status.run': async () => ({ output: {} }),
    'cleanup.run': async () => ({ output: {} }),
  },
  hooks: {
    'shutdown.before': async () => {},
  },
});
`;
    const result = inferManifestFromSource(source, 'fallback');
    expect(result.inferredCapabilityIds).toEqual(
      expect.arrayContaining(['status.run', 'cleanup.run']),
    );
    expect(result.manifest?.id).toBe('sample-dev');
    expect(result.inferredHookEvents).toContain('shutdown.before');
  });

  it('merge-dev adds missing capability stubs without inventing permissions beyond presets', () => {
    const existing = definePlugin({
      id: 'drift-plugin',
      tools: {
        'main.run': async () => ({ output: {} }),
      },
    }).manifest;

    const inferred = inferManifestFromSource(
      `ctx.bindCapability('main.run', async () => ({})); ctx.bindCapability('extra.run', async () => ({}));`,
      'drift-plugin',
    );

    const reconciled = reconcileManifestWithInference(existing, inferred, {
      writeMode: 'merge-dev',
    });
    expect(reconciled.manifest?.capabilities.some((capability) => capability.id === 'extra.run')).toBe(true);
    expect(reconciled.findings.some((finding) => finding.includes('extra.run'))).toBe(true);
  });

  it('strict mode reports drift for missing capabilities', () => {
    const existing = definePlugin({
      id: 'strict-plugin',
      tools: {
        'main.run': async () => ({ output: {} }),
      },
    }).manifest;

    const inferred = inferManifestFromSource(
      `ctx.bindCapability('missing.cap', async () => ({}));`,
      'strict-plugin',
    );
    const reconciled = reconcileManifestWithInference(existing, inferred, {
      writeMode: 'strict',
    });
    expect(reconciled.drift.some((item) => item.includes('missing.cap'))).toBe(true);
    expect(reconciled.manifest?.capabilities.every((capability) => capability.id !== 'missing.cap')).toBe(true);
  });
});
