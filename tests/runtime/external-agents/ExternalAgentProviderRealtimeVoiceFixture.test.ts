import {
  createWave1ProviderRealtimeVoiceFixtures,
  normalizeWave1ProviderRealtimeVoiceContracts,
} from '../../../src/runtime/external-agents/index.js';

describe('Wave 1 provider realtime voice fixture parity', () => {
  it('keeps realtime voice as Zavorth session metadata with live sockets blocked', () => {
    const fixtures = createWave1ProviderRealtimeVoiceFixtures();
    const normalization = normalizeWave1ProviderRealtimeVoiceContracts(fixtures);

    expect(fixtures.map((fixture) => fixture.fixtureCase)).toEqual([
      'realtime-voice-session-metadata',
      'realtime-live-socket-blocked',
    ]);
    expect(JSON.stringify(fixtures)).toContain('wss://providers.external-executor.invalid/realtime');
    expect(normalization).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthRealtimeVoiceProviderContracts/v1',
      providerRealtimeRuntimeIntroduced: false,
      providerRealtimeExecutionAuthority: false,
      sourceRealtimeSdkLoaded: false,
      sourceRealtimeClientLoaded: false,
      sourceRealtimeSocketAuthority: false,
      sourceRealtimeAudioStreamAuthority: false,
      liveSocketAllowed: false,
      audioStreamAllowed: false,
      sourceEndpointIdsStoredAsEvidenceOnly: true,
      sourceModelIdsStoredAsEvidenceOnly: true,
      executionGate: expect.objectContaining({
        providerSdkLoaded: false,
        liveProviderCallsAttempted: false,
        sourceModulesCopied: false,
        rawSecretsRead: false,
      }),
    }));
    expect(normalization.contracts).toEqual([
      expect.objectContaining({
        providerId: 'zavorth-provider:wave1-realtime',
        voiceModes: ['duplex-audio', 'realtime-transcription'],
        modelOptions: ['zavorth-realtime-model:voice-low-latency'],
        sessionPolicy: {
          nativeContract: 'ZavorthRealtimeSessionContract/v1',
          channelHints: ['api', 'voice'],
          reconnectHint: 'manual',
          replyPortPolicy: 'zavorth-reply-port-only',
          liveSocketAllowed: false,
          audioStreamAllowed: false,
          sourceSocketAuthority: false,
          sourceAudioStreamAuthority: false,
        },
        realtimeExecutionAvailable: false,
        sourceClientLoaded: false,
        sourceEndpointStoredAsEvidenceOnly: true,
        sourceModelStoredAsEvidenceOnly: true,
        nativeContract: 'ZavorthRealtimeProviderContract/v1',
      }),
      expect.objectContaining({
        sessionPolicy: expect.objectContaining({
          liveSocketAllowed: false,
          audioStreamAllowed: false,
          sourceSocketAuthority: false,
          sourceAudioStreamAuthority: false,
        }),
        realtimeExecutionAvailable: false,
        sourceClientLoaded: false,
        sourceEndpointStoredAsEvidenceOnly: true,
        sourceModelStoredAsEvidenceOnly: true,
      }),
    ]);
    expect(JSON.stringify(normalization.contracts)).not.toContain('external-executor');
    expect(JSON.stringify(normalization.contracts)).not.toContain('wss://');
  });
});
