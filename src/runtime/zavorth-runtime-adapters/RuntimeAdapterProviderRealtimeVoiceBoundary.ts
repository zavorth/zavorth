export type RuntimeAdapterProviderRealtimeVoiceMode = 'duplex-audio' | 'realtime-transcription';

export type RuntimeAdapterProviderRealtimeVoiceChannelHint = 'api' | 'voice';

export type RuntimeAdapterProviderRealtimeVoiceReconnectHint = 'manual' | 'auto';

export type RuntimeAdapterProviderRealtimeVoiceSourceEvidence = {
  sourceRuntimeName?: string;
  sourcePaths: string[];
  observedAt: string;
  sourceProviderId?: string;
  sourceModelIds?: string[];
  sourceEndpointIds?: string[];
  notes?: string[];
};

export type RuntimeAdapterProviderRealtimeVoiceEvidence = {
  fixtureCase?: string;
  sourceEvidence?: RuntimeAdapterProviderRealtimeVoiceSourceEvidence;
  publicProviderId: string;
  voiceModes: RuntimeAdapterProviderRealtimeVoiceMode[];
  modelOptions: string[];
  channelHints: RuntimeAdapterProviderRealtimeVoiceChannelHint[];
  reconnectHint: RuntimeAdapterProviderRealtimeVoiceReconnectHint;
};

export type RuntimeAdapterProviderRealtimeVoiceExecutionGate = {
  providerSdkLoaded: false;
  liveProviderCallsAttempted: false;
  sourceModulesCopied: false;
  sourceStateMigrated: false;
  rawSecretsRead: false;
  setupCommandsExecuted: false;
  qaRunnersExecuted: false;
};

export type RuntimeAdapterProviderRealtimeVoiceContract = {
  id: string;
  providerId: string;
  voiceModes: RuntimeAdapterProviderRealtimeVoiceMode[];
  modelOptions: string[];
  sessionPolicy: {
    nativeContract: 'ZavorthRealtimeSessionContract/v1';
    channelHints: RuntimeAdapterProviderRealtimeVoiceChannelHint[];
    reconnectHint: RuntimeAdapterProviderRealtimeVoiceReconnectHint;
    replyPortPolicy: 'zavorth-reply-port-only';
    liveSocketAllowed: false;
    audioStreamAllowed: false;
    sourceSocketAuthority: false;
    sourceAudioStreamAuthority: false;
  };
  realtimeExecutionAvailable: false;
  sourceClientLoaded: false;
  sourceEndpointStoredAsEvidenceOnly: true;
  sourceModelStoredAsEvidenceOnly: true;
  nativeContract: 'ZavorthRealtimeProviderContract/v1';
};

export type RuntimeAdapterProviderRealtimeVoiceNormalization = {
  nativeContract: 'ZavorthRealtimeVoiceProviderContracts/v1';
  generatedAt: string;
  contracts: RuntimeAdapterProviderRealtimeVoiceContract[];
  providerRealtimeRuntimeIntroduced: false;
  providerRealtimeExecutionAuthority: false;
  sourceRealtimeSdkLoaded: false;
  sourceRealtimeClientLoaded: false;
  sourceRealtimeSocketAuthority: false;
  sourceRealtimeAudioStreamAuthority: false;
  liveSocketAllowed: false;
  audioStreamAllowed: false;
  sourceEndpointIdsStoredAsEvidenceOnly: true;
  sourceModelIdsStoredAsEvidenceOnly: true;
  executionGate: RuntimeAdapterProviderRealtimeVoiceExecutionGate;
};

export type RuntimeAdapterProviderRealtimeVoiceBoundaryOptions = {
  records: RuntimeAdapterProviderRealtimeVoiceEvidence[];
  generatedAt: string;
  createExecutionGate?: () => RuntimeAdapterProviderRealtimeVoiceExecutionGate;
};

function defaultExecutionGate(): RuntimeAdapterProviderRealtimeVoiceExecutionGate {
  return {
    providerSdkLoaded: false,
    liveProviderCallsAttempted: false,
    sourceModulesCopied: false,
    sourceStateMigrated: false,
    rawSecretsRead: false,
    setupCommandsExecuted: false,
    qaRunnersExecuted: false,
  };
}

export function normalizeRuntimeAdapterProviderRealtimeVoiceContracts(
  options: RuntimeAdapterProviderRealtimeVoiceBoundaryOptions,
): RuntimeAdapterProviderRealtimeVoiceNormalization {
  return {
    nativeContract: 'ZavorthRealtimeVoiceProviderContracts/v1',
    generatedAt: options.generatedAt,
    contracts: options.records.map((record, index) => ({
      id: `${record.publicProviderId}:realtime-contract-${index + 1}`,
      providerId: record.publicProviderId,
      voiceModes: record.voiceModes,
      modelOptions: record.modelOptions,
      sessionPolicy: {
        nativeContract: 'ZavorthRealtimeSessionContract/v1',
        channelHints: record.channelHints,
        reconnectHint: record.reconnectHint,
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
    })),
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
    executionGate: options.createExecutionGate?.() || defaultExecutionGate(),
  };
}
