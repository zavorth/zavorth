import { PluginRegistryService } from '../../src/services/PluginRegistryService.js';
import { ProviderMeshParityService } from '../../src/services/ProviderMeshParityService.js';

describe('ProviderMeshParityService Phase 4', () => {
  it('builds provider.call parity coverage for the private provider inventory', () => {
    const service = new ProviderMeshParityService({
      now: () => new Date('2026-05-04T14:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.primitiveId).toBe('provider.call');
    expect(snapshot.summary.sourceProviders).toBeGreaterThan(40);
    expect(snapshot.summary.generatedPluginManifests).toBe(snapshot.summary.sourceProviders);
    expect(snapshot.summary.secretValuesSerialized).toBe(false);
    expect(snapshot.summary.unmapped).toBe(0);
    expect(snapshot.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          normalizedSourceName: 'openai',
          status: 'first-class',
          adapterStrategy: 'bespoke-runtime',
          runtimeSupported: true,
        }),
        expect.objectContaining({
          normalizedSourceName: 'openrouter',
          status: 'first-class',
          runtimeSupported: true,
        }),
        expect.objectContaining({
          normalizedSourceName: 'amazon-bedrock',
          status: 'generic-compatible',
          generatedProviderManifest: true,
          adapterStrategy: 'openai-compatible-runtime',
        }),
      ]),
    );
  });

  it('generates long-tail provider manifests without serializing secret values', () => {
    const entry = new ProviderMeshParityService({
      sourceProviders: ['amazon-bedrock'],
    }).buildEntry('amazon-bedrock');

    expect(entry.generatedProviderManifest).toBe(true);
    expect(entry.manifest).toEqual(
      expect.objectContaining({
        id: 'amazon-bedrock',
        routeKind: 'custom_compatible',
      }),
    );
    expect(entry.manifest.routes[0]).toEqual(
      expect.objectContaining({
        credentialRefs: ['AMAZON_BEDROCK_API_KEY', 'AMAZON_BEDROCK_BASE_URL'],
      }),
    );
    expect(entry.credentialPolicy).toEqual(
      expect.objectContaining({
        secretValuesSerialized: false,
        requiresOperatorConfiguration: true,
      }),
    );
    expect(JSON.stringify(entry)).not.toContain('sk-');
  });

  it('classifies local compatible providers with local adapter strategy', () => {
    const entry = new ProviderMeshParityService({
      sourceProviders: ['lmstudio'],
    }).buildEntry('lmstudio');

    expect(entry.status).toBe('generic-compatible');
    expect(entry.adapterStrategy).toBe('local-openai-compatible-runtime');
    expect(entry.credentialPolicy).toEqual(
      expect.objectContaining({
        authKind: 'local_endpoint',
        requiresOperatorConfiguration: false,
      }),
    );
    expect(entry.route.mode).toBe('local');
  });

  it('closes Anthropic-compatible provider families as generic runtimes instead of P0 blockers', () => {
    const entry = new ProviderMeshParityService({
      sourceProviders: ['anthropic-vertex'],
    }).buildEntry('anthropic-vertex');

    expect(entry.status).toBe('generic-compatible');
    expect(entry.adapterStrategy).toBe('anthropic-compatible-runtime');
    expect(entry.runtimeSupported).toBe(true);
    expect(entry.findings).toContain('provider manifest generated from Phase 4 parity template');
  });

  it('emits provider plugin manifests that register in the Plugin OS kernel', () => {
    const entry = new ProviderMeshParityService({
      sourceProviders: ['deepinfra'],
    }).buildEntry('deepinfra');
    const registry = new PluginRegistryService({
      now: () => new Date('2026-05-04T14:20:00.000Z'),
      manifests: [entry.generatedPluginManifest],
    });

    expect(entry.generatedPluginManifest.capabilities).toEqual([
      expect.objectContaining({
        id: 'provider.call',
        intent: 'provider_routing',
      }),
    ]);
    expect(registry.install(entry.generatedPluginManifest.id, { approved: true }).status).toBe('applied');
    expect(registry.enable(entry.generatedPluginManifest.id, { approved: true }).status).toBe('applied');
    expect(registry.buildSnapshot().summary.enabled).toBe(1);
  });
});
