export type ExternalAgentProviderRealtimeVoiceMode = 'duplex-audio' | 'realtime-transcription';

export type ExternalAgentProviderRealtimeVoiceChannelHint = 'api' | 'voice';

export type ExternalAgentProviderRealtimeVoiceReconnectHint = 'manual' | 'auto';

export type ExternalAgentProviderRealtimeVoiceSourceEvidence = {
  sourceRuntimeName?: string;
  sourcePaths: string[];
  observedAt: string;
  sourceProviderId?: string;
  sourceModelIds?: string[];
  sourceEndpointIds?: string[];
  notes?: string[];
};

export type ExternalAgentProviderRealtimeVoiceEvidence = {
  fixtureCase?: string;
  sourceEvidence?: ExternalAgentProviderRealtimeVoiceSourceEvidence;
  publicProviderId: string;
  voiceModes: ExternalAgentProviderRealtimeVoiceMode[];
  modelOptions: string[];
  channelHints: ExternalAgentProviderRealtimeVoiceChannelHint[];
  reconnectHint: ExternalAgentProviderRealtimeVoiceReconnectHint;
};

export type ExternalAgentProviderRealtimeVoiceExecutionGate = {
  providerSdkLoaded: false;
  liveProviderCallsAttempted: false;
  sourceModulesCopied: false;
  sourceStateMigrated: false;
  rawSecretsRead: false;
  setupCommandsExecuted: false;
  qaRunnersExecuted: false;
};

export type ExternalAgentProviderRealtimeVoiceContract = {
  id: string;
  providerId: string;
  voiceModes: ExternalAgentProviderRealtimeVoiceMode[];
  modelOptions: string[];
  sessionPolicy: {
    nativeContract: 'ZavorthRealtimeSessionContract/v1';
    channelHints: ExternalAgentProviderRealtimeVoiceChannelHint[];
    reconnectHint: ExternalAgentProviderRealtimeVoiceReconnectHint;
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

export type ExternalAgentProviderRealtimeVoiceNormalization = {
  nativeContract: 'ZavorthRealtimeVoiceProviderContracts/v1';
  generatedAt: string;
  contracts: ExternalAgentProviderRealtimeVoiceContract[];
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
  executionGate: ExternalAgentProviderRealtimeVoiceExecutionGate;
};

export type ExternalAgentProviderRealtimeVoiceBoundaryOptions = {
  records: ExternalAgentProviderRealtimeVoiceEvidence[];
  generatedAt: string;
  createExecutionGate?: () => ExternalAgentProviderRealtimeVoiceExecutionGate;
};

function defaultExecutionGate(): ExternalAgentProviderRealtimeVoiceExecutionGate {
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

export function normalizeExternalAgentProviderRealtimeVoiceContracts(
  options: ExternalAgentProviderRealtimeVoiceBoundaryOptions,
): ExternalAgentProviderRealtimeVoiceNormalization {
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
