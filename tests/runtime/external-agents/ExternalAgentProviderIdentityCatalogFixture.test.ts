import {
  createWave1ProviderIdentityCatalogFixtures,
  normalizeWave1ProviderIdentityCatalog,
} from '../../../src/runtime/external-agents/index.js';

describe('Wave 1 provider identity catalog fixture parity', () => {
  it('normalizes provider catalog evidence into Zavorth-owned ids without live probing', () => {
    const fixtures = createWave1ProviderIdentityCatalogFixtures();
    const catalog = normalizeWave1ProviderIdentityCatalog(fixtures);

    expect(fixtures.map((fixture) => fixture.fixtureCase)).toEqual([
      'provider-catalog-safe-models',
      'provider-catalog-unavailable-provider',
    ]);
    expect(JSON.stringify(fixtures)).toContain('ExternalExecutor');
    expect(catalog).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthProviderIdentityCatalogNormalization/v1',
      sourceProviderIdsStoredAsEvidenceOnly: true,
      liveProbePerformed: false,
      sourceProviderCatalogIntroduced: false,
      sourceProviderCatalogAuthoritative: false,
      sourceProviderCatalogLiveProbeAuthority: false,
      executionGate: expect.objectContaining({
        providerSdkLoaded: false,
        liveProviderCallsAttempted: false,
        sourceModulesCopied: false,
        sourceStateMigrated: false,
        rawSecretsRead: false,
      }),
    }));
    expect(catalog.providers).toEqual([
      expect.objectContaining({
        id: 'zavorth-provider:wave1-1',
        label: 'Provider 1',
        status: 'available',
        modelFamilies: ['text', 'embedding'],
        models: [
          expect.objectContaining({
            id: 'zavorth-provider:wave1-1:model-1',
            sourceModelStoredAsEvidenceOnly: true,
          }),
          expect.objectContaining({
            id: 'zavorth-provider:wave1-1:model-2',
            sourceModelStoredAsEvidenceOnly: true,
          }),
        ],
        endpoints: [
          {
            id: 'zavorth-provider:wave1-1:endpoint-1',
            mode: 'metadata-only',
            liveProbeAllowed: false,
          },
        ],
        nativeContract: 'ZavorthProviderCatalogRecord/v1',
      }),
      expect.objectContaining({
        id: 'zavorth-provider:wave1-2',
        label: 'Provider 2 unavailable',
        status: 'unavailable',
        diagnostics: ['provider unavailable in frozen source inventory'],
      }),
    ]);
    expect(catalog.commandCenter.capabilities.map((capability) => capability.providerId)).toEqual([
      'zavorth-provider:wave1-1',
      'zavorth-provider:wave1-2',
    ]);
    expect(catalog.commandCenter.integrations).toEqual([
      expect.objectContaining({
        id: 'zavorth-provider:wave1-1:integration',
        status: 'connected',
      }),
      expect.objectContaining({
        id: 'zavorth-provider:wave1-2:integration',
        status: 'missing',
      }),
    ]);
    expect(JSON.stringify(catalog)).not.toContain('ExternalExecutor');
    expect(JSON.stringify(catalog)).not.toContain('external-executor');
  });
});
