import {
  createWave1ProviderMediaUnderstandingFixtures,
  normalizeWave1ProviderMediaUnderstandingContracts,
} from '../../../src/runtime/external-agents/index.js';

describe('Wave 1 provider media understanding fixture parity', () => {
  it('maps multimodal metadata to attachment/context policy while file handlers stay blocked', () => {
    const fixtures = createWave1ProviderMediaUnderstandingFixtures();
    const normalization = normalizeWave1ProviderMediaUnderstandingContracts(fixtures);

    expect(fixtures.map((fixture) => fixture.fixtureCase)).toEqual([
      'media-understanding-input-metadata',
      'media-understanding-file-handler-blocked',
    ]);
    expect(JSON.stringify(fixtures)).toContain('extensions/media/file-handler.ts');
    expect(normalization).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthMediaUnderstandingProviderContracts/v1',
      providerMediaUnderstandingRuntimeIntroduced: false,
      providerMediaUnderstandingExecutionAuthority: false,
      sourceMediaSdkLoaded: false,
      sourceFileProcessorsLoaded: false,
      sourceFileHandlersLoaded: false,
      sourceFilePathAuthority: false,
      sourceModelIdsStoredAsEvidenceOnly: true,
      attachmentInputsRequireZavorthArtifacts: true,
      unsafeFileHandlersBlocked: true,
      executionGate: expect.objectContaining({
        providerSdkLoaded: false,
        liveProviderCallsAttempted: false,
        sourceModulesCopied: false,
        rawSecretsRead: false,
      }),
    }));
    expect(normalization.contracts).toEqual([
      expect.objectContaining({
        providerId: 'zavorth-provider:wave1-media-understanding',
        modalities: ['image', 'audio', 'video'],
        attachmentPolicy: {
          acceptedContentTypes: ['image/png', 'image/jpeg', 'audio/wav', 'video/mp4'],
          maxContextItems: 8,
          sourceFilePathsAllowed: false,
          attachmentMustBeZavorthArtifact: true,
          sourceFilePathStoredAsEvidenceOnly: true,
        },
        contextPolicy: {
          contextWindowHint: 128000,
          unsafeFileHandlersBlocked: true,
          sourceContextWindowStoredAsEvidenceOnly: true,
        },
        mediaUnderstandingExecutionAvailable: false,
        sourceFileProcessorsLoaded: false,
        sourceFileHandlersLoaded: false,
        sourceModelStoredAsEvidenceOnly: true,
        nativeContract: 'ZavorthMediaUnderstandingProviderContract/v1',
      }),
      expect.objectContaining({
        contextPolicy: expect.objectContaining({
          unsafeFileHandlersBlocked: true,
          sourceContextWindowStoredAsEvidenceOnly: true,
        }),
        mediaUnderstandingExecutionAvailable: false,
        sourceFileProcessorsLoaded: false,
        sourceFileHandlersLoaded: false,
        sourceModelStoredAsEvidenceOnly: true,
      }),
    ]);
    expect(JSON.stringify(normalization.contracts)).not.toContain('external-executor');
    expect(JSON.stringify(normalization.contracts)).not.toContain('file-handler.ts');
  });
});
