export type RuntimeAdapterProviderSpeechMode = 'speech-to-text' | 'text-to-speech' | 'translation';

export type RuntimeAdapterProviderSpeechTranscriptionSourceEvidence = {
  sourceRuntimeName?: string;
  sourcePaths: string[];
  observedAt: string;
  sourceProviderId?: string;
  sourceModelIds?: string[];
  notes?: string[];
};

export type RuntimeAdapterProviderSpeechTranscriptionEvidence = {
  fixtureCase?: string;
  sourceEvidence?: RuntimeAdapterProviderSpeechTranscriptionSourceEvidence;
  publicProviderId: string;
  modes: RuntimeAdapterProviderSpeechMode[];
  audioFormats: string[];
  voiceModels: string[];
  generatedArtifactKind?: 'audio';
};

export type RuntimeAdapterProviderSpeechTranscriptionExecutionGate = {
  providerSdkLoaded: false;
  liveProviderCallsAttempted: false;
  sourceModulesCopied: false;
  sourceStateMigrated: false;
  rawSecretsRead: false;
  setupCommandsExecuted: false;
  qaRunnersExecuted: false;
};

export type RuntimeAdapterProviderSpeechTranscriptionContract = {
  id: string;
  providerId: string;
  modes: RuntimeAdapterProviderSpeechMode[];
  audioFormats: string[];
  voiceModels: string[];
  replyPortPolicy: 'zavorth-reply-port-only';
  artifactPolicy: {
    generatedAudioStoredAs: 'ZavorthArtifact';
    sourceOutputPathAllowed: false;
  };
  speechExecutionAvailable: false;
  sourceAudioHelpersLoaded: false;
  sourceVoiceModelsStoredAsEvidenceOnly: true;
  audioInputRequiresZavorthArtifact: true;
  nativeContract: 'ZavorthSpeechProviderContract/v1';
};

export type RuntimeAdapterProviderSpeechTranscriptionNormalization = {
  nativeContract: 'ZavorthSpeechTranscriptionProviderContracts/v1';
  generatedAt: string;
  contracts: RuntimeAdapterProviderSpeechTranscriptionContract[];
  providerSpeechRuntimeIntroduced: false;
  providerSpeechExecutionAuthority: false;
  sourceSpeechSdkLoaded: false;
  sourceAudioHelpersLoaded: false;
  sourceAudioOutputPathAuthority: false;
  generatedAudioArtifactAuthority: 'ZavorthArtifact';
  liveAudioTranscriptionAllowed: false;
  executionGate: RuntimeAdapterProviderSpeechTranscriptionExecutionGate;
};

export type RuntimeAdapterProviderSpeechTranscriptionBoundaryOptions = {
  records: RuntimeAdapterProviderSpeechTranscriptionEvidence[];
  generatedAt: string;
  createExecutionGate?: () => RuntimeAdapterProviderSpeechTranscriptionExecutionGate;
};

function defaultExecutionGate(): RuntimeAdapterProviderSpeechTranscriptionExecutionGate {
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

export function normalizeRuntimeAdapterProviderSpeechTranscriptionContracts(
  options: RuntimeAdapterProviderSpeechTranscriptionBoundaryOptions,
): RuntimeAdapterProviderSpeechTranscriptionNormalization {
  return {
    nativeContract: 'ZavorthSpeechTranscriptionProviderContracts/v1',
    generatedAt: options.generatedAt,
    contracts: options.records.map((record, index) => ({
      id: `${record.publicProviderId}:speech-contract-${index + 1}`,
      providerId: record.publicProviderId,
      modes: record.modes,
      audioFormats: record.audioFormats,
      voiceModels: record.voiceModels,
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
    })),
    providerSpeechRuntimeIntroduced: false,
    providerSpeechExecutionAuthority: false,
    sourceSpeechSdkLoaded: false,
    sourceAudioHelpersLoaded: false,
    sourceAudioOutputPathAuthority: false,
    generatedAudioArtifactAuthority: 'ZavorthArtifact',
    liveAudioTranscriptionAllowed: false,
    executionGate: options.createExecutionGate?.() || defaultExecutionGate(),
  };
}
