import {
  ToolExposurePolicy,
  type ToolExposurePolicyInput,
} from '../agent/ToolExposurePolicy.js';
import {
  normalizeExternalAgentProviderIdentityCatalog,
} from './ExternalAgentProviderIdentityCatalogBoundary.js';
import {
  normalizeExternalAgentProviderSecretRefBoundary,
} from './ExternalAgentProviderSecretRefBoundary.js';
import {
  normalizeExternalAgentProviderEmbeddingContracts,
} from './ExternalAgentProviderEmbeddingContractsBoundary.js';
import {
  normalizeExternalAgentProviderSpeechTranscriptionContracts,
} from './ExternalAgentProviderSpeechTranscriptionBoundary.js';
import {
  normalizeExternalAgentProviderRealtimeVoiceContracts,
} from './ExternalAgentProviderRealtimeVoiceBoundary.js';
import {
  normalizeExternalAgentProviderMediaUnderstandingContracts,
} from './ExternalAgentProviderMediaUnderstandingBoundary.js';
import {
  normalizeExternalAgentProviderGenerationContracts,
} from './ExternalAgentProviderGenerationBoundary.js';
import {
  normalizeExternalAgentProviderWebSearchFetchContracts,
} from './ExternalAgentProviderWebSearchFetchBoundary.js';

export const EXTERNAL_AGENT_WAVE1_PROVIDER_FIXTURE_NOW = '2026-04-27T20:00:00.000Z';
export const EXTERNAL_AGENT_WAVE1_PROVIDER_RUNTIME_ID = 'external-wave1-provider-fixture-runtime';
export const EXTERNAL_AGENT_WAVE1_PROVIDER_SOURCE_RUNTIME_NAME = 'ExternalExecutor';

export type ExternalAgentWave1ProviderSourceEvidence = {
  sourceRuntimeName: typeof EXTERNAL_AGENT_WAVE1_PROVIDER_SOURCE_RUNTIME_NAME;
  sourcePaths: string[];
  observedAt: string;
  sourceProviderId?: string;
  sourceModelIds?: string[];
  sourceEnvNames?: string[];
  sourceEndpointIds?: string[];
  notes?: string[];
};

export type ExternalAgentWave1ProviderExecutionGate = {
  providerSdkLoaded: false;
  liveProviderCallsAttempted: false;
  sourceModulesCopied: false;
  sourceStateMigrated: false;
  rawSecretsRead: false;
  setupCommandsExecuted: false;
  qaRunnersExecuted: false;
};

export type ExternalAgentWave1ProviderCatalogFixture = {
  fixtureCase: 'provider-catalog-safe-models' | 'provider-catalog-unavailable-provider';
  sourceEvidence: ExternalAgentWave1ProviderSourceEvidence;
  sourceProviderId: string;
  sourceDisplayName: string;
  sourceModelIds: string[];
  sourceEndpointIds: string[];
  families: string[];
  status: 'available' | 'unavailable';
  diagnostics?: string[];
};

export type ExternalAgentWave1ProviderCatalogRecord = {
  id: string;
  label: string;
  status: 'available' | 'unavailable';
  modelFamilies: string[];
  models: Array<{
    id: string;
    family: string;
    sourceModelStoredAsEvidenceOnly: true;
  }>;
  endpoints: Array<{
    id: string;
    mode: 'metadata-only';
    liveProbeAllowed: false;
  }>;
  diagnostics: string[];
  nativeContract: 'ZavorthProviderCatalogRecord/v1';
};

export type ExternalAgentWave1ProviderIdentityCatalogNormalization = {
  nativeContract: 'ZavorthProviderIdentityCatalogNormalization/v1';
  generatedAt: string;
  runtimeId: typeof EXTERNAL_AGENT_WAVE1_PROVIDER_RUNTIME_ID;
  providers: ExternalAgentWave1ProviderCatalogRecord[];
  commandCenter: {
    capabilities: Array<{
      id: string;
      providerId: string;
      label: string;
      status: 'available' | 'unavailable';
      policy: 'metadata-only';
    }>;
    integrations: Array<{
      id: string;
      category: 'provider';
      status: 'connected' | 'missing';
      detail: string;
    }>;
  };
  sourceProviderIdsStoredAsEvidenceOnly: true;
  liveProbePerformed: false;
  executionGate: ExternalAgentWave1ProviderExecutionGate;
};

export type ExternalAgentWave1ProviderSecretRefFixture = {
  fixtureCase: 'secretref-env-mapping' | 'secretref-missing-secret';
  sourceEvidence: ExternalAgentWave1ProviderSourceEvidence;
  publicProviderId: string;
  purposes: Array<'api-key' | 'organization' | 'project' | 'endpoint'>;
  secretStatus: 'mapped' | 'missing';
  sourceCredentialPath: string;
};

export type ExternalAgentWave1ProviderSecretRef = {
  id: string;
  providerId: string;
  purpose: 'api-key' | 'organization' | 'project' | 'endpoint';
  status: 'mapped' | 'missing';
  resolver: 'zavorth-secret-store';
  sourceEnvNameEvidenceId: string;
  rawValueExposed: false;
  sourcePathExposed: false;
  nativeContract: 'ZavorthSecretRef/v1';
};

export type ExternalAgentWave1ProviderSecretRefBoundaryNormalization = {
  nativeContract: 'ZavorthProviderSecretRefBoundary/v1';
  generatedAt: string;
  secretRefs: ExternalAgentWave1ProviderSecretRef[];
  sanitizedDiagnostics: Array<{
    id: string;
    providerId: string;
    severity: 'warning';
    code: 'missing-provider-secret';
    detail: string;
  }>;
  rawSecretValuesObserved: false;
  sourceCredentialPathsExposed: false;
  configStateMigrationRequired: false;
  sourceCredentialStoreIntroduced: false;
  sourceCredentialStoreAuthoritative: false;
  sourceConfigMigrationAuthority: false;
  executionGate: ExternalAgentWave1ProviderExecutionGate;
};

export type ExternalAgentWave1ProviderEmbeddingFixture = {
  fixtureCase: 'embedding-model-metadata' | 'embedding-sdk-load-blocked';
  sourceEvidence: ExternalAgentWave1ProviderSourceEvidence;
  publicProviderId: string;
  modelFamily: string;
  dimensions?: number;
  batchingHint?: {
    maxBatchSize: number;
    maxInputTokens: number;
  };
  sdkPackage?: string;
};

export type ExternalAgentWave1ProviderEmbeddingContract = {
  id: string;
  providerId: string;
  modelFamily: string;
  dimensions: number | null;
  batching: {
    maxBatchSize: number;
    maxInputTokens: number;
  } | null;
  costHint: 'metadata-only';
  indexingPolicy: {
    contextIndexingAllowed: false;
    memoryWriteAllowed: false;
  };
  executionAvailable: false;
  providerSdkLoaded: false;
  sourceClientModuleLoaded: false;
  sourceModelStoredAsEvidenceOnly: true;
  nativeContract: 'ZavorthEmbeddingProviderContract/v1';
};

export type ExternalAgentWave1ProviderEmbeddingNormalization = {
  nativeContract: 'ZavorthEmbeddingProviderContracts/v1';
  generatedAt: string;
  contracts: ExternalAgentWave1ProviderEmbeddingContract[];
  toolExposurePolicyInput: ToolExposurePolicyInput;
  providerEmbeddingRuntimeIntroduced: false;
  providerEmbeddingExecutionAuthority: false;
  sourceEmbeddingSdkLoaded: false;
  sourceEmbeddingClientModuleLoaded: false;
  sourceEmbeddingModelsStoredAsEvidenceOnly: true;
  vectorIndexMutationAllowed: false;
  executionGate: ExternalAgentWave1ProviderExecutionGate;
};

export type ExternalAgentWave1ProviderSpeechTranscriptionFixture = {
  fixtureCase: 'speech-transcription-audio-metadata' | 'speech-generated-artifact-policy';
  sourceEvidence: ExternalAgentWave1ProviderSourceEvidence;
  publicProviderId: string;
  modes: Array<'speech-to-text' | 'text-to-speech' | 'translation'>;
  audioFormats: string[];
  voiceModels: string[];
  generatedArtifactKind?: 'audio';
};

export type ExternalAgentWave1ProviderSpeechTranscriptionContract = {
  id: string;
  providerId: string;
  modes: Array<'speech-to-text' | 'text-to-speech' | 'translation'>;
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

export type ExternalAgentWave1ProviderSpeechTranscriptionNormalization = {
  nativeContract: 'ZavorthSpeechTranscriptionProviderContracts/v1';
  generatedAt: string;
  contracts: ExternalAgentWave1ProviderSpeechTranscriptionContract[];
  providerSpeechRuntimeIntroduced: false;
  providerSpeechExecutionAuthority: false;
  sourceSpeechSdkLoaded: false;
  sourceAudioHelpersLoaded: false;
  sourceAudioOutputPathAuthority: false;
  generatedAudioArtifactAuthority: 'ZavorthArtifact';
  liveAudioTranscriptionAllowed: false;
  executionGate: ExternalAgentWave1ProviderExecutionGate;
};

export type ExternalAgentWave1ProviderRealtimeVoiceFixture = {
  fixtureCase: 'realtime-voice-session-metadata' | 'realtime-live-socket-blocked';
  sourceEvidence: ExternalAgentWave1ProviderSourceEvidence;
  publicProviderId: string;
  voiceModes: Array<'duplex-audio' | 'realtime-transcription'>;
  modelOptions: string[];
  channelHints: Array<'api' | 'voice'>;
  reconnectHint: 'manual' | 'auto';
};

export type ExternalAgentWave1ProviderRealtimeVoiceContract = {
  id: string;
  providerId: string;
  voiceModes: Array<'duplex-audio' | 'realtime-transcription'>;
  modelOptions: string[];
  sessionPolicy: {
    nativeContract: 'ZavorthRealtimeSessionContract/v1';
    channelHints: Array<'api' | 'voice'>;
    reconnectHint: 'manual' | 'auto';
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

export type ExternalAgentWave1ProviderRealtimeVoiceNormalization = {
  nativeContract: 'ZavorthRealtimeVoiceProviderContracts/v1';
  generatedAt: string;
  contracts: ExternalAgentWave1ProviderRealtimeVoiceContract[];
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
  executionGate: ExternalAgentWave1ProviderExecutionGate;
};

export type ExternalAgentWave1ProviderMediaUnderstandingFixture = {
  fixtureCase: 'media-understanding-input-metadata' | 'media-understanding-file-handler-blocked';
  sourceEvidence: ExternalAgentWave1ProviderSourceEvidence;
  publicProviderId: string;
  modalities: Array<'image' | 'audio' | 'video'>;
  acceptedContentTypes: string[];
  contextWindowHint: number;
};

export type ExternalAgentWave1ProviderMediaUnderstandingContract = {
  id: string;
  providerId: string;
  modalities: Array<'image' | 'audio' | 'video'>;
  attachmentPolicy: {
    acceptedContentTypes: string[];
    maxContextItems: number;
    sourceFilePathsAllowed: false;
    attachmentMustBeZavorthArtifact: true;
    sourceFilePathStoredAsEvidenceOnly: true;
  };
  contextPolicy: {
    contextWindowHint: number;
    unsafeFileHandlersBlocked: true;
    sourceContextWindowStoredAsEvidenceOnly: true;
  };
  mediaUnderstandingExecutionAvailable: false;
  sourceFileProcessorsLoaded: false;
  sourceFileHandlersLoaded: false;
  sourceModelStoredAsEvidenceOnly: true;
  nativeContract: 'ZavorthMediaUnderstandingProviderContract/v1';
};

export type ExternalAgentWave1ProviderMediaUnderstandingNormalization = {
  nativeContract: 'ZavorthMediaUnderstandingProviderContracts/v1';
  generatedAt: string;
  contracts: ExternalAgentWave1ProviderMediaUnderstandingContract[];
  providerMediaUnderstandingRuntimeIntroduced: false;
  providerMediaUnderstandingExecutionAuthority: false;
  sourceMediaSdkLoaded: false;
  sourceFileProcessorsLoaded: false;
  sourceFileHandlersLoaded: false;
  sourceFilePathAuthority: false;
  sourceModelIdsStoredAsEvidenceOnly: true;
  attachmentInputsRequireZavorthArtifacts: true;
  unsafeFileHandlersBlocked: true;
  executionGate: ExternalAgentWave1ProviderExecutionGate;
};

export type ExternalAgentWave1ProviderGenerationFixture = {
  fixtureCase: 'generation-output-artifact-metadata' | 'generation-live-client-blocked';
  sourceEvidence: ExternalAgentWave1ProviderSourceEvidence;
  publicProviderId: string;
  modalities: Array<'image' | 'video' | 'music'>;
  modelOptions: string[];
  outputHints: Array<'png' | 'mp4' | 'wav'>;
  latencyHintMs: number;
};

export type ExternalAgentWave1ProviderGenerationContract = {
  id: string;
  providerId: string;
  modalities: Array<'image' | 'video' | 'music'>;
  modelOptions: string[];
  artifactPipeline: {
    outputHints: Array<'png' | 'mp4' | 'wav'>;
    generatedMediaStoredAs: 'ZavorthArtifact';
    sourceOutputPathAllowed: false;
    sourceOutputPathAuthority: false;
    generatedOutputMustBeZavorthArtifact: true;
  };
  budgetPolicy: {
    costHint: 'metadata-only';
    latencyHintMs: number;
    sourceLatencyStoredAsEvidenceOnly: true;
  };
  generationExecutionAvailable: false;
  liveClientAvailable: false;
  sourceGenerationClientLoaded: false;
  sourceModelStoredAsEvidenceOnly: true;
  nativeContract: 'ZavorthGenerationProviderContract/v1';
};

export type ExternalAgentWave1ProviderGenerationNormalization = {
  nativeContract: 'ZavorthGenerationProviderContracts/v1';
  generatedAt: string;
  contracts: ExternalAgentWave1ProviderGenerationContract[];
  providerGenerationRuntimeIntroduced: false;
  providerGenerationExecutionAuthority: false;
  sourceGenerationSdkLoaded: false;
  sourceGenerationClientLoaded: false;
  sourceOutputPathAuthority: false;
  generatedMediaArtifactAuthority: 'ZavorthArtifact';
  sourceModelIdsStoredAsEvidenceOnly: true;
  liveGenerationCallsAllowed: false;
  executionGate: ExternalAgentWave1ProviderExecutionGate;
};

export type ExternalAgentWave1ProviderWebSearchFetchFixture = {
  fixtureCase: 'web-search-fetch-policy-metadata' | 'web-search-fetch-live-network-blocked';
  sourceEvidence: ExternalAgentWave1ProviderSourceEvidence;
  publicProviderId: string;
  modes: Array<'search' | 'fetch'>;
  allowedDomains: string[];
  resultShapes: Array<'summary' | 'document' | 'citation'>;
};

export type ExternalAgentWave1ProviderWebSearchFetchContract = {
  id: string;
  providerId: string;
  modes: Array<'search' | 'fetch'>;
  networkPolicy: {
    allowedDomains: string[];
    resultShapes: Array<'summary' | 'document' | 'citation'>;
    webSearchRequiresApproval: true;
    networkFetchBlocked: true;
    liveNetworkCallsAllowed: false;
    sourceNetworkAuthority: false;
    sourceEndpointStoredAsEvidenceOnly: true;
  };
  liveNetworkCallsAttempted: false;
  sourceFetcherExecuted: false;
  sourceFetcherLoaded: false;
  sourceBrowserNetworkLoaded: false;
  nativeContract: 'ZavorthWebSearchFetchProviderContract/v1';
};

export type ExternalAgentWave1ProviderWebSearchFetchNormalization = {
  nativeContract: 'ZavorthWebSearchFetchProviderContracts/v1';
  generatedAt: string;
  contracts: ExternalAgentWave1ProviderWebSearchFetchContract[];
  toolExposurePolicyInput: ToolExposurePolicyInput;
  toolExposureProfile: ReturnType<ToolExposurePolicy['buildProfile']>;
  providerWebSearchFetchRuntimeIntroduced: false;
  providerWebSearchFetchExecutionAuthority: false;
  sourceWebSdkLoaded: false;
  sourceFetcherLoaded: false;
  sourceBrowserNetworkLoaded: false;
  sourceNetworkAuthority: false;
  sourceEndpointIdsStoredAsEvidenceOnly: true;
  liveNetworkCallsAllowed: false;
  webSearchRequiresApproval: true;
  networkFetchBlocked: true;
  executionGate: ExternalAgentWave1ProviderExecutionGate;
};

function sourceEvidence(input: {
  sourcePaths: string[];
  sourceProviderId?: string;
  sourceModelIds?: string[];
  sourceEnvNames?: string[];
  sourceEndpointIds?: string[];
  notes?: string[];
}): ExternalAgentWave1ProviderSourceEvidence {
  return {
    sourceRuntimeName: EXTERNAL_AGENT_WAVE1_PROVIDER_SOURCE_RUNTIME_NAME,
    observedAt: EXTERNAL_AGENT_WAVE1_PROVIDER_FIXTURE_NOW,
    ...input,
  };
}

export function createWave1ProviderExecutionGate(): ExternalAgentWave1ProviderExecutionGate {
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

export function createWave1ProviderIdentityCatalogFixtures(): ExternalAgentWave1ProviderCatalogFixture[] {
  return [
    {
      fixtureCase: 'provider-catalog-safe-models',
      sourceProviderId: 'external-executor-provider-text-safe',
      sourceDisplayName: 'ExternalExecutor text provider',
      sourceModelIds: ['external-executor/text-small', 'external-executor/text-large'],
      sourceEndpointIds: ['https://providers.external-executor.invalid/v1/text'],
      families: ['text', 'embedding'],
      status: 'available',
      sourceEvidence: sourceEvidence({
        sourcePaths: [
          'src/plugins/capability-provider-runtime.ts',
          'src/plugins/manifest-registry.ts',
          'extensions/text/manifest.json',
        ],
        sourceProviderId: 'external-executor-provider-text-safe',
        sourceModelIds: ['external-executor/text-small', 'external-executor/text-large'],
        sourceEndpointIds: ['https://providers.external-executor.invalid/v1/text'],
      }),
    },
    {
      fixtureCase: 'provider-catalog-unavailable-provider',
      sourceProviderId: 'external-executor-provider-voice-missing',
      sourceDisplayName: 'ExternalExecutor voice provider',
      sourceModelIds: ['external-executor/realtime-voice'],
      sourceEndpointIds: ['wss://providers.external-executor.invalid/realtime'],
      families: ['realtime-voice'],
      status: 'unavailable',
      diagnostics: ['provider unavailable in frozen source inventory'],
      sourceEvidence: sourceEvidence({
        sourcePaths: [
          'src/plugins/capability-provider-runtime.ts',
          'extensions/voice/manifest.json',
        ],
        sourceProviderId: 'external-executor-provider-voice-missing',
        sourceModelIds: ['external-executor/realtime-voice'],
        sourceEndpointIds: ['wss://providers.external-executor.invalid/realtime'],
      }),
    },
  ];
}

export function normalizeWave1ProviderIdentityCatalog(
  fixtures: ExternalAgentWave1ProviderCatalogFixture[] = createWave1ProviderIdentityCatalogFixtures(),
): ExternalAgentWave1ProviderIdentityCatalogNormalization {
  return normalizeExternalAgentProviderIdentityCatalog({
    records: fixtures,
    generatedAt: EXTERNAL_AGENT_WAVE1_PROVIDER_FIXTURE_NOW,
    runtimeId: EXTERNAL_AGENT_WAVE1_PROVIDER_RUNTIME_ID,
    publicProviderIdPrefix: 'zavorth-provider:wave1',
    createExecutionGate: createWave1ProviderExecutionGate,
  });
}

export function createWave1ProviderSecretRefFixtures(): ExternalAgentWave1ProviderSecretRefFixture[] {
  return [
    {
      fixtureCase: 'secretref-env-mapping',
      publicProviderId: 'zavorth-provider:wave1-secret-mapped',
      purposes: ['api-key', 'organization'],
      secretStatus: 'mapped',
      sourceCredentialPath: '~/.external-executor/providers.json',
      sourceEvidence: sourceEvidence({
        sourcePaths: [
          'src/secrets/provider-secrets.ts',
          'src/config/provider-config.ts',
          'extensions/text/manifest.json',
        ],
        sourceProviderId: 'external-executor-provider-text-safe',
        sourceEnvNames: ['EXTERNAL_EXECUTOR_TEXT_API_KEY', 'EXTERNAL_EXECUTOR_TEXT_ORG'],
      }),
    },
    {
      fixtureCase: 'secretref-missing-secret',
      publicProviderId: 'zavorth-provider:wave1-secret-missing',
      purposes: ['api-key'],
      secretStatus: 'missing',
      sourceCredentialPath: '~/.external-executor/missing-media-provider.json',
      sourceEvidence: sourceEvidence({
        sourcePaths: [
          'src/secrets/provider-secrets.ts',
          'extensions/media/manifest.json',
        ],
        sourceProviderId: 'external-executor-provider-media-missing',
        sourceEnvNames: ['EXTERNAL_EXECUTOR_MEDIA_API_KEY'],
      }),
    },
  ];
}

export function normalizeWave1ProviderSecretRefBoundary(
  fixtures: ExternalAgentWave1ProviderSecretRefFixture[] = createWave1ProviderSecretRefFixtures(),
): ExternalAgentWave1ProviderSecretRefBoundaryNormalization {
  return normalizeExternalAgentProviderSecretRefBoundary({
    records: fixtures,
    generatedAt: EXTERNAL_AGENT_WAVE1_PROVIDER_FIXTURE_NOW,
    createExecutionGate: createWave1ProviderExecutionGate,
  });
}

export function createWave1ProviderEmbeddingFixtures(): ExternalAgentWave1ProviderEmbeddingFixture[] {
  return [
    {
      fixtureCase: 'embedding-model-metadata',
      publicProviderId: 'zavorth-provider:wave1-embedding',
      modelFamily: 'embedding',
      dimensions: 1536,
      batchingHint: {
        maxBatchSize: 64,
        maxInputTokens: 8192,
      },
      sourceEvidence: sourceEvidence({
        sourcePaths: [
          'src/plugins/capability-provider-runtime.ts',
          'src/memory-host-sdk/embeddings.ts',
          'extensions/embedding/manifest.json',
        ],
        sourceProviderId: 'external-executor-provider-embedding',
        sourceModelIds: ['external-executor/text-embedding-small'],
      }),
    },
    {
      fixtureCase: 'embedding-sdk-load-blocked',
      publicProviderId: 'zavorth-provider:wave1-embedding',
      modelFamily: 'embedding',
      sdkPackage: '@external-executor/provider-embedding',
      sourceEvidence: sourceEvidence({
        sourcePaths: [
          'src/memory-host-sdk/provider-client.ts',
          'extensions/embedding/client.ts',
        ],
        sourceProviderId: 'external-executor-provider-embedding',
        sourceModelIds: ['external-executor/text-embedding-small'],
        notes: ['SDK package is evidence only and must not be loaded.'],
      }),
    },
  ];
}

export function normalizeWave1ProviderEmbeddingContracts(
  fixtures: ExternalAgentWave1ProviderEmbeddingFixture[] = createWave1ProviderEmbeddingFixtures(),
): ExternalAgentWave1ProviderEmbeddingNormalization {
  return normalizeExternalAgentProviderEmbeddingContracts({
    records: fixtures,
    generatedAt: EXTERNAL_AGENT_WAVE1_PROVIDER_FIXTURE_NOW,
    createExecutionGate: createWave1ProviderExecutionGate,
  });
}

export function createWave1ProviderSpeechTranscriptionFixtures(): ExternalAgentWave1ProviderSpeechTranscriptionFixture[] {
  return [
    {
      fixtureCase: 'speech-transcription-audio-metadata',
      publicProviderId: 'zavorth-provider:wave1-speech',
      modes: ['speech-to-text', 'translation'],
      audioFormats: ['audio/wav', 'audio/mpeg'],
      voiceModels: ['zavorth-voice-model:transcribe-1'],
      sourceEvidence: sourceEvidence({
        sourcePaths: [
          'src/tts',
          'src/realtime-transcription',
          'extensions/speech/manifest.json',
        ],
        sourceProviderId: 'external-executor-provider-speech',
        sourceModelIds: ['external-executor/transcribe-1'],
      }),
    },
    {
      fixtureCase: 'speech-generated-artifact-policy',
      publicProviderId: 'zavorth-provider:wave1-speech',
      modes: ['text-to-speech'],
      audioFormats: ['audio/wav'],
      voiceModels: ['zavorth-voice-model:narration-1'],
      generatedArtifactKind: 'audio',
      sourceEvidence: sourceEvidence({
        sourcePaths: [
          'src/tts/output-writer.ts',
          'extensions/speech/client.ts',
        ],
        sourceProviderId: 'external-executor-provider-speech',
        sourceModelIds: ['external-executor/voice-narration'],
      }),
    },
  ];
}

export function normalizeWave1ProviderSpeechTranscriptionContracts(
  fixtures: ExternalAgentWave1ProviderSpeechTranscriptionFixture[] = createWave1ProviderSpeechTranscriptionFixtures(),
): ExternalAgentWave1ProviderSpeechTranscriptionNormalization {
  return normalizeExternalAgentProviderSpeechTranscriptionContracts({
    records: fixtures,
    generatedAt: EXTERNAL_AGENT_WAVE1_PROVIDER_FIXTURE_NOW,
    createExecutionGate: createWave1ProviderExecutionGate,
  });
}

export function createWave1ProviderRealtimeVoiceFixtures(): ExternalAgentWave1ProviderRealtimeVoiceFixture[] {
  return [
    {
      fixtureCase: 'realtime-voice-session-metadata',
      publicProviderId: 'zavorth-provider:wave1-realtime',
      voiceModes: ['duplex-audio', 'realtime-transcription'],
      modelOptions: ['zavorth-realtime-model:voice-low-latency'],
      channelHints: ['api', 'voice'],
      reconnectHint: 'manual',
      sourceEvidence: sourceEvidence({
        sourcePaths: [
          'src/realtime-voice/session.ts',
          'src/realtime-transcription',
          'extensions/realtime/manifest.json',
        ],
        sourceProviderId: 'external-executor-provider-realtime-voice',
        sourceEndpointIds: ['wss://providers.external-executor.invalid/realtime'],
      }),
    },
    {
      fixtureCase: 'realtime-live-socket-blocked',
      publicProviderId: 'zavorth-provider:wave1-realtime',
      voiceModes: ['duplex-audio'],
      modelOptions: ['zavorth-realtime-model:voice-low-latency'],
      channelHints: ['voice'],
      reconnectHint: 'manual',
      sourceEvidence: sourceEvidence({
        sourcePaths: [
          'src/realtime-voice/socket-client.ts',
          'extensions/voice/client.ts',
        ],
        sourceProviderId: 'external-executor-provider-realtime-voice',
        sourceEndpointIds: ['wss://providers.external-executor.invalid/realtime'],
        notes: ['Live websocket client is evidence only and remains blocked.'],
      }),
    },
  ];
}

export function normalizeWave1ProviderRealtimeVoiceContracts(
  fixtures: ExternalAgentWave1ProviderRealtimeVoiceFixture[] = createWave1ProviderRealtimeVoiceFixtures(),
): ExternalAgentWave1ProviderRealtimeVoiceNormalization {
  return normalizeExternalAgentProviderRealtimeVoiceContracts({
    records: fixtures,
    generatedAt: EXTERNAL_AGENT_WAVE1_PROVIDER_FIXTURE_NOW,
    createExecutionGate: createWave1ProviderExecutionGate,
  });
}

export function createWave1ProviderMediaUnderstandingFixtures(): ExternalAgentWave1ProviderMediaUnderstandingFixture[] {
  return [
    {
      fixtureCase: 'media-understanding-input-metadata',
      publicProviderId: 'zavorth-provider:wave1-media-understanding',
      modalities: ['image', 'audio', 'video'],
      acceptedContentTypes: ['image/png', 'image/jpeg', 'audio/wav', 'video/mp4'],
      contextWindowHint: 128000,
      sourceEvidence: sourceEvidence({
        sourcePaths: [
          'extensions/vision/manifest.json',
          'extensions/media/manifest.json',
          'extensions/image/manifest.json',
        ],
        sourceProviderId: 'external-executor-provider-media-understanding',
        sourceModelIds: ['external-executor/vision-large'],
      }),
    },
    {
      fixtureCase: 'media-understanding-file-handler-blocked',
      publicProviderId: 'zavorth-provider:wave1-media-understanding',
      modalities: ['image', 'video'],
      acceptedContentTypes: ['image/png', 'video/mp4'],
      contextWindowHint: 64000,
      sourceEvidence: sourceEvidence({
        sourcePaths: [
          'extensions/media/file-handler.ts',
          'extensions/image/processors.ts',
        ],
        sourceProviderId: 'external-executor-provider-media-understanding',
        notes: ['Source file processors are evidence only and remain blocked.'],
      }),
    },
  ];
}

export function normalizeWave1ProviderMediaUnderstandingContracts(
  fixtures: ExternalAgentWave1ProviderMediaUnderstandingFixture[] = createWave1ProviderMediaUnderstandingFixtures(),
): ExternalAgentWave1ProviderMediaUnderstandingNormalization {
  return normalizeExternalAgentProviderMediaUnderstandingContracts({
    records: fixtures,
    generatedAt: EXTERNAL_AGENT_WAVE1_PROVIDER_FIXTURE_NOW,
    createExecutionGate: createWave1ProviderExecutionGate,
  });
}

export function createWave1ProviderGenerationFixtures(): ExternalAgentWave1ProviderGenerationFixture[] {
  return [
    {
      fixtureCase: 'generation-output-artifact-metadata',
      publicProviderId: 'zavorth-provider:wave1-generation',
      modalities: ['image', 'video', 'music'],
      modelOptions: [
        'zavorth-generation-model:image-safe',
        'zavorth-generation-model:video-safe',
        'zavorth-generation-model:music-safe',
      ],
      outputHints: ['png', 'mp4', 'wav'],
      latencyHintMs: 45000,
      sourceEvidence: sourceEvidence({
        sourcePaths: [
          'extensions/image/manifest.json',
          'extensions/video/manifest.json',
          'extensions/music/manifest.json',
        ],
        sourceProviderId: 'external-executor-provider-generation',
        sourceModelIds: ['external-executor/image-gen', 'external-executor/video-gen', 'external-executor/music-gen'],
      }),
    },
    {
      fixtureCase: 'generation-live-client-blocked',
      publicProviderId: 'zavorth-provider:wave1-generation',
      modalities: ['image'],
      modelOptions: ['zavorth-generation-model:image-safe'],
      outputHints: ['png'],
      latencyHintMs: 30000,
      sourceEvidence: sourceEvidence({
        sourcePaths: [
          'extensions/image/client.ts',
          'extensions/media/generation-client.ts',
        ],
        sourceProviderId: 'external-executor-provider-generation',
        sourceModelIds: ['external-executor/image-gen'],
        notes: ['Generation client is evidence only and remains unavailable.'],
      }),
    },
  ];
}

export function normalizeWave1ProviderGenerationContracts(
  fixtures: ExternalAgentWave1ProviderGenerationFixture[] = createWave1ProviderGenerationFixtures(),
): ExternalAgentWave1ProviderGenerationNormalization {
  return normalizeExternalAgentProviderGenerationContracts({
    records: fixtures,
    generatedAt: EXTERNAL_AGENT_WAVE1_PROVIDER_FIXTURE_NOW,
    createExecutionGate: createWave1ProviderExecutionGate,
  });
}

export function createWave1ProviderWebSearchFetchFixtures(): ExternalAgentWave1ProviderWebSearchFetchFixture[] {
  return [
    {
      fixtureCase: 'web-search-fetch-policy-metadata',
      publicProviderId: 'zavorth-provider:wave1-web',
      modes: ['search', 'fetch'],
      allowedDomains: ['docs.example.invalid', 'support.example.invalid'],
      resultShapes: ['summary', 'document', 'citation'],
      sourceEvidence: sourceEvidence({
        sourcePaths: [
          'extensions/search/manifest.json',
          'extensions/fetch/manifest.json',
          'extensions/browser/manifest.json',
        ],
        sourceProviderId: 'external-executor-provider-web',
        sourceEndpointIds: ['https://providers.external-executor.invalid/search'],
      }),
    },
    {
      fixtureCase: 'web-search-fetch-live-network-blocked',
      publicProviderId: 'zavorth-provider:wave1-web',
      modes: ['fetch'],
      allowedDomains: [],
      resultShapes: ['document'],
      sourceEvidence: sourceEvidence({
        sourcePaths: [
          'extensions/fetch/client.ts',
          'extensions/browser/live-network.ts',
        ],
        sourceProviderId: 'external-executor-provider-web',
        sourceEndpointIds: ['https://providers.external-executor.invalid/fetch'],
        notes: ['Live source fetcher is evidence only and does not execute.'],
      }),
    },
  ];
}

export function normalizeWave1ProviderWebSearchFetchContracts(
  fixtures: ExternalAgentWave1ProviderWebSearchFetchFixture[] = createWave1ProviderWebSearchFetchFixtures(),
): ExternalAgentWave1ProviderWebSearchFetchNormalization {
  return normalizeExternalAgentProviderWebSearchFetchContracts({
    records: fixtures,
    generatedAt: EXTERNAL_AGENT_WAVE1_PROVIDER_FIXTURE_NOW,
    createExecutionGate: createWave1ProviderExecutionGate,
  });
}
