export type RuntimeAdapterProviderGenerationModality = 'image' | 'video' | 'music';

export type RuntimeAdapterProviderGenerationOutputHint = 'png' | 'mp4' | 'wav';

export type RuntimeAdapterProviderGenerationSourceEvidence = {
  sourceRuntimeName?: string;
  sourcePaths: string[];
  observedAt: string;
  sourceProviderId?: string;
  sourceModelIds?: string[];
  notes?: string[];
};

export type RuntimeAdapterProviderGenerationEvidence = {
  fixtureCase?: string;
  sourceEvidence?: RuntimeAdapterProviderGenerationSourceEvidence;
  publicProviderId: string;
  modalities: RuntimeAdapterProviderGenerationModality[];
  modelOptions: string[];
  outputHints: RuntimeAdapterProviderGenerationOutputHint[];
  latencyHintMs: number;
};

export type RuntimeAdapterProviderGenerationExecutionGate = {
  providerSdkLoaded: false;
  liveProviderCallsAttempted: false;
  sourceModulesCopied: false;
  sourceStateMigrated: false;
  rawSecretsRead: false;
  setupCommandsExecuted: false;
  qaRunnersExecuted: false;
};

export type RuntimeAdapterProviderGenerationContract = {
  id: string;
  providerId: string;
  modalities: RuntimeAdapterProviderGenerationModality[];
  modelOptions: string[];
  artifactPipeline: {
    outputHints: RuntimeAdapterProviderGenerationOutputHint[];
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

export type RuntimeAdapterProviderGenerationNormalization = {
  nativeContract: 'ZavorthGenerationProviderContracts/v1';
  generatedAt: string;
  contracts: RuntimeAdapterProviderGenerationContract[];
  providerGenerationRuntimeIntroduced: false;
  providerGenerationExecutionAuthority: false;
  sourceGenerationSdkLoaded: false;
  sourceGenerationClientLoaded: false;
  sourceOutputPathAuthority: false;
  generatedMediaArtifactAuthority: 'ZavorthArtifact';
  sourceModelIdsStoredAsEvidenceOnly: true;
  liveGenerationCallsAllowed: false;
  executionGate: RuntimeAdapterProviderGenerationExecutionGate;
};

export type RuntimeAdapterProviderGenerationBoundaryOptions = {
  records: RuntimeAdapterProviderGenerationEvidence[];
  generatedAt: string;
  createExecutionGate?: () => RuntimeAdapterProviderGenerationExecutionGate;
};

function defaultExecutionGate(): RuntimeAdapterProviderGenerationExecutionGate {
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

export function normalizeRuntimeAdapterProviderGenerationContracts(
  options: RuntimeAdapterProviderGenerationBoundaryOptions,
): RuntimeAdapterProviderGenerationNormalization {
  return {
    nativeContract: 'ZavorthGenerationProviderContracts/v1',
    generatedAt: options.generatedAt,
    contracts: options.records.map((record, index) => ({
      id: `${record.publicProviderId}:generation-contract-${index + 1}`,
      providerId: record.publicProviderId,
      modalities: record.modalities,
      modelOptions: record.modelOptions,
      artifactPipeline: {
        outputHints: record.outputHints,
        generatedMediaStoredAs: 'ZavorthArtifact',
        sourceOutputPathAllowed: false,
        sourceOutputPathAuthority: false,
        generatedOutputMustBeZavorthArtifact: true,
      },
      budgetPolicy: {
        costHint: 'metadata-only',
        latencyHintMs: record.latencyHintMs,
        sourceLatencyStoredAsEvidenceOnly: true,
      },
      generationExecutionAvailable: false,
      liveClientAvailable: false,
      sourceGenerationClientLoaded: false,
      sourceModelStoredAsEvidenceOnly: true,
      nativeContract: 'ZavorthGenerationProviderContract/v1',
    })),
    providerGenerationRuntimeIntroduced: false,
    providerGenerationExecutionAuthority: false,
    sourceGenerationSdkLoaded: false,
    sourceGenerationClientLoaded: false,
    sourceOutputPathAuthority: false,
    generatedMediaArtifactAuthority: 'ZavorthArtifact',
    sourceModelIdsStoredAsEvidenceOnly: true,
    liveGenerationCallsAllowed: false,
    executionGate: options.createExecutionGate?.() || defaultExecutionGate(),
  };
}
