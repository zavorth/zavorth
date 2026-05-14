export type ExternalAgentProviderGenerationModality = 'image' | 'video' | 'music';

export type ExternalAgentProviderGenerationOutputHint = 'png' | 'mp4' | 'wav';

export type ExternalAgentProviderGenerationSourceEvidence = {
  sourceRuntimeName?: string;
  sourcePaths: string[];
  observedAt: string;
  sourceProviderId?: string;
  sourceModelIds?: string[];
  notes?: string[];
};

export type ExternalAgentProviderGenerationEvidence = {
  fixtureCase?: string;
  sourceEvidence?: ExternalAgentProviderGenerationSourceEvidence;
  publicProviderId: string;
  modalities: ExternalAgentProviderGenerationModality[];
  modelOptions: string[];
  outputHints: ExternalAgentProviderGenerationOutputHint[];
  latencyHintMs: number;
};

export type ExternalAgentProviderGenerationExecutionGate = {
  providerSdkLoaded: false;
  liveProviderCallsAttempted: false;
  sourceModulesCopied: false;
  sourceStateMigrated: false;
  rawSecretsRead: false;
  setupCommandsExecuted: false;
  qaRunnersExecuted: false;
};

export type ExternalAgentProviderGenerationContract = {
  id: string;
  providerId: string;
  modalities: ExternalAgentProviderGenerationModality[];
  modelOptions: string[];
  artifactPipeline: {
    outputHints: ExternalAgentProviderGenerationOutputHint[];
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

export type ExternalAgentProviderGenerationNormalization = {
  nativeContract: 'ZavorthGenerationProviderContracts/v1';
  generatedAt: string;
  contracts: ExternalAgentProviderGenerationContract[];
  providerGenerationRuntimeIntroduced: false;
  providerGenerationExecutionAuthority: false;
  sourceGenerationSdkLoaded: false;
  sourceGenerationClientLoaded: false;
  sourceOutputPathAuthority: false;
  generatedMediaArtifactAuthority: 'ZavorthArtifact';
  sourceModelIdsStoredAsEvidenceOnly: true;
  liveGenerationCallsAllowed: false;
  executionGate: ExternalAgentProviderGenerationExecutionGate;
};

export type ExternalAgentProviderGenerationBoundaryOptions = {
  records: ExternalAgentProviderGenerationEvidence[];
  generatedAt: string;
  createExecutionGate?: () => ExternalAgentProviderGenerationExecutionGate;
};

function defaultExecutionGate(): ExternalAgentProviderGenerationExecutionGate {
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

export function normalizeExternalAgentProviderGenerationContracts(
  options: ExternalAgentProviderGenerationBoundaryOptions,
): ExternalAgentProviderGenerationNormalization {
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
