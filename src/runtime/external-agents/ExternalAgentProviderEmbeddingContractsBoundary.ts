import type {
  ToolExposurePolicyInput,
} from '../agent/ToolExposurePolicy.js';

export type ExternalAgentProviderEmbeddingSourceEvidence = {
  sourceRuntimeName?: string;
  sourcePaths: string[];
  observedAt: string;
  sourceProviderId?: string;
  sourceModelIds?: string[];
  notes?: string[];
};

export type ExternalAgentProviderEmbeddingEvidence = {
  fixtureCase?: string;
  sourceEvidence?: ExternalAgentProviderEmbeddingSourceEvidence;
  publicProviderId: string;
  modelFamily: string;
  dimensions?: number;
  batchingHint?: {
    maxBatchSize: number;
    maxInputTokens: number;
  };
  sdkPackage?: string;
};

export type ExternalAgentProviderEmbeddingExecutionGate = {
  providerSdkLoaded: false;
  liveProviderCallsAttempted: false;
  sourceModulesCopied: false;
  sourceStateMigrated: false;
  rawSecretsRead: false;
  setupCommandsExecuted: false;
  qaRunnersExecuted: false;
};

export type ExternalAgentProviderEmbeddingContract = {
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

export type ExternalAgentProviderEmbeddingContractsNormalization = {
  nativeContract: 'ZavorthEmbeddingProviderContracts/v1';
  generatedAt: string;
  contracts: ExternalAgentProviderEmbeddingContract[];
  toolExposurePolicyInput: ToolExposurePolicyInput;
  providerEmbeddingRuntimeIntroduced: false;
  providerEmbeddingExecutionAuthority: false;
  sourceEmbeddingSdkLoaded: false;
  sourceEmbeddingClientModuleLoaded: false;
  sourceEmbeddingModelsStoredAsEvidenceOnly: true;
  vectorIndexMutationAllowed: false;
  executionGate: ExternalAgentProviderEmbeddingExecutionGate;
};

export type ExternalAgentProviderEmbeddingContractsBoundaryOptions = {
  records: ExternalAgentProviderEmbeddingEvidence[];
  generatedAt: string;
  createExecutionGate?: () => ExternalAgentProviderEmbeddingExecutionGate;
};

function defaultExecutionGate(): ExternalAgentProviderEmbeddingExecutionGate {
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

export function normalizeExternalAgentProviderEmbeddingContracts(
  options: ExternalAgentProviderEmbeddingContractsBoundaryOptions,
): ExternalAgentProviderEmbeddingContractsNormalization {
  return {
    nativeContract: 'ZavorthEmbeddingProviderContracts/v1',
    generatedAt: options.generatedAt,
    contracts: options.records.map((record, index) => ({
      id: `${record.publicProviderId}:embedding-contract-${index + 1}`,
      providerId: record.publicProviderId,
      modelFamily: record.modelFamily,
      dimensions: record.dimensions ?? null,
      batching: record.batchingHint ?? null,
      costHint: 'metadata-only',
      indexingPolicy: {
        contextIndexingAllowed: false,
        memoryWriteAllowed: false,
      },
      executionAvailable: false,
      providerSdkLoaded: false,
      sourceClientModuleLoaded: false,
      sourceModelStoredAsEvidenceOnly: true,
      nativeContract: 'ZavorthEmbeddingProviderContract/v1',
    })),
    toolExposurePolicyInput: {
      requestedTools: ['provider.embedding.execute'],
      blockedTools: ['provider.embedding.execute'],
      blockedToolReason: 'provider-runtime-not-implemented',
    },
    providerEmbeddingRuntimeIntroduced: false,
    providerEmbeddingExecutionAuthority: false,
    sourceEmbeddingSdkLoaded: false,
    sourceEmbeddingClientModuleLoaded: false,
    sourceEmbeddingModelsStoredAsEvidenceOnly: true,
    vectorIndexMutationAllowed: false,
    executionGate: options.createExecutionGate?.() || defaultExecutionGate(),
  };
}
