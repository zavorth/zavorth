import {
  createWave1ProviderSpeechTranscriptionFixtures,
  normalizeWave1ProviderSpeechTranscriptionContracts,
} from '../../../src/runtime/external-agents/index.js';

describe('Wave 1 provider speech/transcription fixture parity', () => {
  it('maps speech metadata to Zavorth media and artifact policies without source helpers', () => {
    const fixtures = createWave1ProviderSpeechTranscriptionFixtures();
    const normalization = normalizeWave1ProviderSpeechTranscriptionContracts(fixtures);

    expect(fixtures.map((fixture) => fixture.fixtureCase)).toEqual([
      'speech-transcription-audio-metadata',
      'speech-generated-artifact-policy',
    ]);
    expect(JSON.stringify(fixtures)).toContain('external-executor/voice-narration');
    expect(normalization).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthSpeechTranscriptionProviderContracts/v1',
      providerSpeechRuntimeIntroduced: false,
      providerSpeechExecutionAuthority: false,
      sourceSpeechSdkLoaded: false,
      sourceAudioHelpersLoaded: false,
      sourceAudioOutputPathAuthority: false,
      generatedAudioArtifactAuthority: 'ZavorthArtifact',
      liveAudioTranscriptionAllowed: false,
      executionGate: expect.objectContaining({
        providerSdkLoaded: false,
        liveProviderCallsAttempted: false,
        sourceModulesCopied: false,
        rawSecretsRead: false,
      }),
    }));
    expect(normalization.contracts).toEqual([
      expect.objectContaining({
        providerId: 'zavorth-provider:wave1-speech',
        modes: ['speech-to-text', 'translation'],
        audioFormats: ['audio/wav', 'audio/mpeg'],
        replyPortPolicy: 'zavorth-reply-port-only',
        artifactPolicy: {
          generatedAudioStoredAs: 'ZavorthArtifact',
          sourceOutputPathAllowed: false,
        },
        speechExecutionAvailable: false,
        sourceAudioHelpersLoaded: false,
        sourceVoiceModelsStoredAsEvidenceOnly: true,
        audioInputRequiresZavorthArtifact: true,
        nativeContract: 'ZavorthSpeechProviderContract/v1',
      }),
      expect.objectContaining({
        modes: ['text-to-speech'],
        voiceModels: ['zavorth-voice-model:narration-1'],
        speechExecutionAvailable: false,
        sourceAudioHelpersLoaded: false,
        sourceVoiceModelsStoredAsEvidenceOnly: true,
        audioInputRequiresZavorthArtifact: true,
      }),
    ]);
    expect(JSON.stringify(normalization.contracts)).not.toContain('external-executor');
    expect(JSON.stringify(normalization.contracts)).not.toContain('src/tts');
  });
});
