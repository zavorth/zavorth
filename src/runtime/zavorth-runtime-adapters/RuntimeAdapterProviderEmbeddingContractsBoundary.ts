import type {
  ToolExposurePolicyInput,
} from '../agent/ToolExposurePolicy.js';

export type RuntimeAdapterProviderEmbeddingSourceEvidence = {
  sourceRuntimeName?: string;
  sourcePaths: string[];
  observedAt: string;
  sourceProviderId?: string;
  sourceModelIds?: string[];
  notes?: string[];
};

export type RuntimeAdapterProviderEmbeddingEvidence = {
  fixtureCase?: string;
  sourceEvidence?: RuntimeAdapterProviderEmbeddingSourceEvidence;
  publicProviderId: string;
  modelFamily: string;
  dimensions?: number;
  batchingHint?: {
    maxBatchSize: number;
    maxInputTokens: number;
  };
  sdkPackage?: string;
};

export type RuntimeAdapterProviderEmbeddingExecutionGate = {
  providerSdkLoaded: false;
  liveProviderCallsAttempted: false;
  sourceModulesCopied: false;
  sourceStateMigrated: false;
  rawSecretsRead: false;
  setupCommandsExecuted: false;
  qaRunnersExecuted: false;
};

export type RuntimeAdapterProviderEmbeddingContract = {
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

export type RuntimeAdapterProviderEmbeddingContractsNormalization = {
  nativeContract: 'ZavorthEmbeddingProviderContracts/v1';
  generatedAt: string;
  contracts: RuntimeAdapterProviderEmbeddingContract[];
  toolExposurePolicyInput: ToolExposurePolicyInput;
  providerEmbeddingRuntimeIntroduced: false;
  providerEmbeddingExecutionAuthority: false;
  sourceEmbeddingSdkLoaded: false;
  sourceEmbeddingClientModuleLoaded: false;
  sourceEmbeddingModelsStoredAsEvidenceOnly: true;
  vectorIndexMutationAllowed: false;
  executionGate: RuntimeAdapterProviderEmbeddingExecutionGate;
};

export type RuntimeAdapterProviderEmbeddingContractsBoundaryOptions = {
  records: RuntimeAdapterProviderEmbeddingEvidence[];
  generatedAt: string;
  createExecutionGate?: () => RuntimeAdapterProviderEmbeddingExecutionGate;
};

function defaultExecutionGate(): RuntimeAdapterProviderEmbeddingExecutionGate {
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

export function normalizeRuntimeAdapterProviderEmbeddingContracts(
  options: RuntimeAdapterProviderEmbeddingContractsBoundaryOptions,
): RuntimeAdapterProviderEmbeddingContractsNormalization {
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
