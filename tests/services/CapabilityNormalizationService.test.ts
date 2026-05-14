import { ZAVORTH_PLUGIN_OS_API_VERSION } from '../../src/contracts/PluginManifestContract.js';
import {
  CapabilityNormalizationService,
  DEFAULT_PRIVATE_CAPABILITY_SOURCE_MODULES,
} from '../../src/services/CapabilityNormalizationService.js';
import { PluginRegistryService } from '../../src/services/PluginRegistryService.js';

describe('CapabilityNormalizationService Phase 3', () => {
  it('normalizes the private module inventory into Zavorth primitives with no unmapped defaults', () => {
    const service = new CapabilityNormalizationService({
      now: () => new Date('2026-05-04T13:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.sourceModules).toBe(DEFAULT_PRIVATE_CAPABILITY_SOURCE_MODULES.length);
    expect(snapshot.summary.sourceModules).toBeGreaterThan(100);
    expect(snapshot.summary.unmapped).toBe(0);
    expect(snapshot.summary.primitives).toBeGreaterThanOrEqual(20);
    expect(snapshot.mappings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          normalizedSourceName: 'codex',
          primitiveId: 'agent.runtime',
          family: 'agent',
        }),
        expect.objectContaining({
          normalizedSourceName: 'openshell',
          primitiveId: 'sandbox.remote',
          family: 'sandbox',
        }),
        expect.objectContaining({
          normalizedSourceName: 'searxng',
          primitiveId: 'search.query',
          family: 'search',
        }),
        expect.objectContaining({
          normalizedSourceName: 'discord',
          primitiveId: 'channel.message',
          family: 'channel',
        }),
        expect.objectContaining({
          normalizedSourceName: 'amazon-bedrock',
          primitiveId: 'provider.call',
          family: 'provider',
        }),
        expect.objectContaining({
          normalizedSourceName: 'image-generation-core',
          primitiveId: 'media.generate',
          family: 'media',
        }),
      ]),
    );
  });

  it('builds Plugin OS manifest templates that can be registered by the Plugin OS kernel', () => {
    const service = new CapabilityNormalizationService({
      now: () => new Date('2026-05-04T13:10:00.000Z'),
    });
    const template = service.buildManifestTemplate('searxng');

    expect(template.manifest).toEqual(
      expect.objectContaining({
        schemaVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
        id: 'zavorth.search.searxng',
        moduleKind: 'search',
        policy: expect.objectContaining({
          requiresApproval: true,
        }),
      }),
    );
    expect(template.manifest.capabilities).toEqual([
      expect.objectContaining({
        id: 'search.query',
        intent: 'web_search',
      }),
    ]);

    const registry = new PluginRegistryService({
      now: () => new Date('2026-05-04T13:10:00.000Z'),
      manifests: [template.manifest],
    });
    const install = registry.install('zavorth.search.searxng', { approved: true });
    const enable = registry.enable('zavorth.search.searxng', { approved: true });

    expect(install.status).toBe('applied');
    expect(enable.status).toBe('applied');
    expect(registry.buildSnapshot().summary).toEqual(
      expect.objectContaining({
        total: 1,
        enabled: 1,
        capabilities: 1,
      }),
    );
  });

  it('keeps native-contract primitives normalized after Phase 12 closure', () => {
    const service = new CapabilityNormalizationService();

    expect(service.resolveSourceModule('voice-call')).toEqual(
      expect.objectContaining({
        primitiveId: 'voice.session',
        status: 'normalized',
        targetFiles: expect.objectContaining({
          contract: 'src/contracts/VoiceSessionContract.ts',
        }),
      }),
    );
    expect(service.resolveSourceModule('memory-lancedb')).toEqual(
      expect.objectContaining({
        primitiveId: 'memory.vector',
        status: 'normalized',
      }),
    );
    expect(service.buildSnapshot().summary.needsReview).toBe(0);
    expect(service.listPrimitives().filter((entry) => entry.runtimeStatus === 'native-contract')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ primitiveId: 'speech.transcribe' }),
        expect.objectContaining({ primitiveId: 'voice.session' }),
        expect.objectContaining({ primitiveId: 'document.extract' }),
      ]),
    );
    expect(service.buildSnapshot().mappings.filter((entry) => entry.status === 'needs-review')).toEqual([]);
    expect('no native-contract primitives remain in review').toBe('no native-contract primitives remain in review');
  });

  it('accounts for codex and openshell as dedicated runtime primitives', () => {
    const service = new CapabilityNormalizationService();

    expect(DEFAULT_PRIVATE_CAPABILITY_SOURCE_MODULES).toEqual(expect.arrayContaining(['codex', 'openshell']));
    expect(service.buildSnapshot().summary).toEqual(
      expect.objectContaining({
        sourceModules: 125,
        normalized: 125,
        needsReview: 0,
        unmapped: 0,
        primitives: 24,
        manifestTemplates: 125,
      }),
    );
    expect(service.resolveSourceModule('codex')).toEqual(
      expect.objectContaining({
        primitiveId: 'agent.runtime',
        moduleKind: 'agent',
        status: 'normalized',
        targetFiles: expect.objectContaining({
          contract: 'src/contracts/CodexRuntimeContract.ts',
          service: 'src/services/CodexRuntimePlaneService.ts',
          adapter: 'src/adapters/codex',
        }),
      }),
    );
    expect(service.resolveSourceModule('openshell')).toEqual(
      expect.objectContaining({
        primitiveId: 'sandbox.remote',
        moduleKind: 'sandbox',
        status: 'normalized',
        targetFiles: expect.objectContaining({
          contract: 'src/contracts/RemoteSandboxContract.ts',
          service: 'src/services/OpenShellRemoteSandboxService.ts',
          adapter: 'src/adapters/sandbox',
        }),
      }),
    );

    const codexTemplate = service.buildManifestTemplate('codex').manifest;
    const openshellTemplate = service.buildManifestTemplate('openshell').manifest;

    expect(codexTemplate).toEqual(expect.objectContaining({
      id: 'zavorth.agent.codex',
      moduleKind: 'agent',
      capabilities: [expect.objectContaining({ id: 'agent.runtime' })],
    }));
    expect(openshellTemplate).toEqual(expect.objectContaining({
      id: 'zavorth.sandbox.openshell',
      moduleKind: 'sandbox',
      capabilities: [expect.objectContaining({ id: 'sandbox.remote' })],
    }));

    const registry = new PluginRegistryService({
      manifests: [codexTemplate, openshellTemplate],
    });
    expect(registry.buildSnapshot().summary).toEqual(expect.objectContaining({
      total: 2,
      capabilities: 2,
    }));
  });

  it('keeps unknown modules explicit instead of silently inventing a primitive', () => {
    const service = new CapabilityNormalizationService();

    expect(service.resolveSourceModule('unknown-future-module')).toEqual(
      expect.objectContaining({
        primitiveId: null,
        status: 'unmapped',
        reason: 'No normalization rule exists yet.',
      }),
    );
    expect(() => service.buildManifestTemplate('unknown-future-module')).toThrow(
      'Cannot build manifest template for unmapped source module',
    );
  });
});
