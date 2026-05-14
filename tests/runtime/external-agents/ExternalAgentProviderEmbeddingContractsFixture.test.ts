import {
  createWave1ProviderEmbeddingFixtures,
  normalizeWave1ProviderEmbeddingContracts,
} from '../../../src/runtime/external-agents/index.js';

describe('Wave 1 provider embedding contract fixture parity', () => {
  it('keeps embedding metadata deterministic while SDK loading and execution stay blocked', () => {
    const fixtures = createWave1ProviderEmbeddingFixtures();
    const normalization = normalizeWave1ProviderEmbeddingContracts(fixtures);

    expect(fixtures.map((fixture) => fixture.fixtureCase)).toEqual([
      'embedding-model-metadata',
      'embedding-sdk-load-blocked',
    ]);
    expect(JSON.stringify(fixtures)).toContain('@external-executor/provider-embedding');
    expect(normalization).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthEmbeddingProviderContracts/v1',
      toolExposurePolicyInput: {
        requestedTools: ['provider.embedding.execute'],
        blockedTools: ['provider.embedding.execute'],
        blockedToolReason: 'provider-runtime-not-implemented',
      },
      providerEmbeddingRuntimeIntroduced: false,
      providerEmbeddingExecutionAuthority: false,
      sourceEmbeddingSdkLoaded: false,
      sourceEmbeddingClientModuleLoaded: false,
      sourceEmbeddingModelsStoredAsEvidenceOnly: true,
      vectorIndexMutationAllowed: false,
      executionGate: expect.objectContaining({
        providerSdkLoaded: false,
        liveProviderCallsAttempted: false,
        sourceModulesCopied: false,
        rawSecretsRead: false,
      }),
    }));
    expect(normalization.contracts).toEqual([
      expect.objectContaining({
        providerId: 'zavorth-provider:wave1-embedding',
        modelFamily: 'embedding',
        dimensions: 1536,
        batching: {
          maxBatchSize: 64,
          maxInputTokens: 8192,
        },
        costHint: 'metadata-only',
        indexingPolicy: {
          contextIndexingAllowed: false,
          memoryWriteAllowed: false,
        },
        executionAvailable: false,
        providerSdkLoaded: false,
        sourceClientModuleLoaded: false,
        sourceModelStoredAsEvidenceOnly: true,
        nativeContract: 'ZavorthEmbeddingProviderContract/v1',
      }),
      expect.objectContaining({
        dimensions: null,
        batching: null,
        executionAvailable: false,
        providerSdkLoaded: false,
        sourceClientModuleLoaded: false,
      }),
    ]);
    expect(JSON.stringify(normalization.contracts)).not.toContain('external-executor');
    expect(JSON.stringify(normalization)).not.toContain('@external-executor');
  });
});
