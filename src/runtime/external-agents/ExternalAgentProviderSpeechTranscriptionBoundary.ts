export type ExternalAgentProviderSpeechMode = 'speech-to-text' | 'text-to-speech' | 'translation';

export type ExternalAgentProviderSpeechTranscriptionSourceEvidence = {
  sourceRuntimeName?: string;
  sourcePaths: string[];
  observedAt: string;
  sourceProviderId?: string;
  sourceModelIds?: string[];
  notes?: string[];
};

export type ExternalAgentProviderSpeechTranscriptionEvidence = {
  fixtureCase?: string;
  sourceEvidence?: ExternalAgentProviderSpeechTranscriptionSourceEvidence;
  publicProviderId: string;
  modes: ExternalAgentProviderSpeechMode[];
  audioFormats: string[];
  voiceModels: string[];
  generatedArtifactKind?: 'audio';
};

export type ExternalAgentProviderSpeechTranscriptionExecutionGate = {
  providerSdkLoaded: false;
  liveProviderCallsAttempted: false;
  sourceModulesCopied: false;
  sourceStateMigrated: false;
  rawSecretsRead: false;
  setupCommandsExecuted: false;
  qaRunnersExecuted: false;
};

export type ExternalAgentProviderSpeechTranscriptionContract = {
  id: string;
  providerId: string;
  modes: ExternalAgentProviderSpeechMode[];
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

export type ExternalAgentProviderSpeechTranscriptionNormalization = {
  nativeContract: 'ZavorthSpeechTranscriptionProviderContracts/v1';
  generatedAt: string;
  contracts: ExternalAgentProviderSpeechTranscriptionContract[];
  providerSpeechRuntimeIntroduced: false;
  providerSpeechExecutionAuthority: false;
  sourceSpeechSdkLoaded: false;
  sourceAudioHelpersLoaded: false;
  sourceAudioOutputPathAuthority: false;
  generatedAudioArtifactAuthority: 'ZavorthArtifact';
  liveAudioTranscriptionAllowed: false;
  executionGate: ExternalAgentProviderSpeechTranscriptionExecutionGate;
};

export type ExternalAgentProviderSpeechTranscriptionBoundaryOptions = {
  records: ExternalAgentProviderSpeechTranscriptionEvidence[];
  generatedAt: string;
  createExecutionGate?: () => ExternalAgentProviderSpeechTranscriptionExecutionGate;
};

function defaultExecutionGate(): ExternalAgentProviderSpeechTranscriptionExecutionGate {
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

export function normalizeExternalAgentProviderSpeechTranscriptionContracts(
  options: ExternalAgentProviderSpeechTranscriptionBoundaryOptions,
): ExternalAgentProviderSpeechTranscriptionNormalization {
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
