import {
  createWave1ProviderGenerationFixtures,
  normalizeWave1ProviderGenerationContracts,
} from '../../../src/runtime/external-agents/index.js';

describe('Wave 1 provider generation fixture parity', () => {
  it('maps generation output hints to Zavorth artifact and budget contracts with live clients unavailable', () => {
    const fixtures = createWave1ProviderGenerationFixtures();
    const normalization = normalizeWave1ProviderGenerationContracts(fixtures);

    expect(fixtures.map((fixture) => fixture.fixtureCase)).toEqual([
      'generation-output-artifact-metadata',
      'generation-live-client-blocked',
    ]);
    expect(JSON.stringify(fixtures)).toContain('external-executor/image-gen');
    expect(normalization).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthGenerationProviderContracts/v1',
      providerGenerationRuntimeIntroduced: false,
      providerGenerationExecutionAuthority: false,
      sourceGenerationSdkLoaded: false,
      sourceGenerationClientLoaded: false,
      sourceOutputPathAuthority: false,
      generatedMediaArtifactAuthority: 'ZavorthArtifact',
      sourceModelIdsStoredAsEvidenceOnly: true,
      liveGenerationCallsAllowed: false,
      executionGate: expect.objectContaining({
        providerSdkLoaded: false,
        liveProviderCallsAttempted: false,
        sourceModulesCopied: false,
        rawSecretsRead: false,
      }),
    }));
    expect(normalization.contracts).toEqual([
      expect.objectContaining({
        providerId: 'zavorth-provider:wave1-generation',
        modalities: ['image', 'video', 'music'],
        modelOptions: [
          'zavorth-generation-model:image-safe',
          'zavorth-generation-model:video-safe',
          'zavorth-generation-model:music-safe',
        ],
        artifactPipeline: {
          outputHints: ['png', 'mp4', 'wav'],
          generatedMediaStoredAs: 'ZavorthArtifact',
          sourceOutputPathAllowed: false,
          sourceOutputPathAuthority: false,
          generatedOutputMustBeZavorthArtifact: true,
        },
        budgetPolicy: {
          costHint: 'metadata-only',
          latencyHintMs: 45000,
          sourceLatencyStoredAsEvidenceOnly: true,
        },
        generationExecutionAvailable: false,
        liveClientAvailable: false,
        sourceGenerationClientLoaded: false,
        sourceModelStoredAsEvidenceOnly: true,
        nativeContract: 'ZavorthGenerationProviderContract/v1',
      }),
      expect.objectContaining({
        artifactPipeline: expect.objectContaining({
          generatedMediaStoredAs: 'ZavorthArtifact',
          sourceOutputPathAllowed: false,
          sourceOutputPathAuthority: false,
          generatedOutputMustBeZavorthArtifact: true,
        }),
        generationExecutionAvailable: false,
        liveClientAvailable: false,
        sourceGenerationClientLoaded: false,
        sourceModelStoredAsEvidenceOnly: true,
      }),
    ]);
    expect(JSON.stringify(normalization.contracts)).not.toContain('external-executor');
    expect(JSON.stringify(normalization.contracts)).not.toContain('client.ts');
  });
});
