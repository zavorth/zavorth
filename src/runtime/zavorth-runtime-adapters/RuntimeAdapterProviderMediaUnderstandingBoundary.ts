export type RuntimeAdapterProviderMediaUnderstandingModality = 'image' | 'audio' | 'video';

export type RuntimeAdapterProviderMediaUnderstandingSourceEvidence = {
  sourceRuntimeName?: string;
  sourcePaths: string[];
  observedAt: string;
  sourceProviderId?: string;
  sourceModelIds?: string[];
  notes?: string[];
};

export type RuntimeAdapterProviderMediaUnderstandingEvidence = {
  fixtureCase?: string;
  sourceEvidence?: RuntimeAdapterProviderMediaUnderstandingSourceEvidence;
  publicProviderId: string;
  modalities: RuntimeAdapterProviderMediaUnderstandingModality[];
  acceptedContentTypes: string[];
  contextWindowHint: number;
};

export type RuntimeAdapterProviderMediaUnderstandingExecutionGate = {
  providerSdkLoaded: false;
  liveProviderCallsAttempted: false;
  sourceModulesCopied: false;
  sourceStateMigrated: false;
  rawSecretsRead: false;
  setupCommandsExecuted: false;
  qaRunnersExecuted: false;
};

export type RuntimeAdapterProviderMediaUnderstandingContract = {
  id: string;
  providerId: string;
  modalities: RuntimeAdapterProviderMediaUnderstandingModality[];
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

export type RuntimeAdapterProviderMediaUnderstandingNormalization = {
  nativeContract: 'ZavorthMediaUnderstandingProviderContracts/v1';
  generatedAt: string;
  contracts: RuntimeAdapterProviderMediaUnderstandingContract[];
  providerMediaUnderstandingRuntimeIntroduced: false;
  providerMediaUnderstandingExecutionAuthority: false;
  sourceMediaSdkLoaded: false;
  sourceFileProcessorsLoaded: false;
  sourceFileHandlersLoaded: false;
  sourceFilePathAuthority: false;
  sourceModelIdsStoredAsEvidenceOnly: true;
  attachmentInputsRequireZavorthArtifacts: true;
  unsafeFileHandlersBlocked: true;
  executionGate: RuntimeAdapterProviderMediaUnderstandingExecutionGate;
};

export type RuntimeAdapterProviderMediaUnderstandingBoundaryOptions = {
  records: RuntimeAdapterProviderMediaUnderstandingEvidence[];
  generatedAt: string;
  maxContextItems?: number;
  createExecutionGate?: () => RuntimeAdapterProviderMediaUnderstandingExecutionGate;
};

function defaultExecutionGate(): RuntimeAdapterProviderMediaUnderstandingExecutionGate {
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

export function normalizeRuntimeAdapterProviderMediaUnderstandingContracts(
  options: RuntimeAdapterProviderMediaUnderstandingBoundaryOptions,
): RuntimeAdapterProviderMediaUnderstandingNormalization {
  return {
    nativeContract: 'ZavorthMediaUnderstandingProviderContracts/v1',
    generatedAt: options.generatedAt,
    contracts: options.records.map((record, index) => ({
      id: `${record.publicProviderId}:media-understanding-contract-${index + 1}`,
      providerId: record.publicProviderId,
      modalities: record.modalities,
      attachmentPolicy: {
        acceptedContentTypes: record.acceptedContentTypes,
        maxContextItems: options.maxContextItems ?? 8,
        sourceFilePathsAllowed: false,
        attachmentMustBeZavorthArtifact: true,
        sourceFilePathStoredAsEvidenceOnly: true,
      },
      contextPolicy: {
        contextWindowHint: record.contextWindowHint,
        unsafeFileHandlersBlocked: true,
        sourceContextWindowStoredAsEvidenceOnly: true,
      },
      mediaUnderstandingExecutionAvailable: false,
      sourceFileProcessorsLoaded: false,
      sourceFileHandlersLoaded: false,
      sourceModelStoredAsEvidenceOnly: true,
      nativeContract: 'ZavorthMediaUnderstandingProviderContract/v1',
    })),
    providerMediaUnderstandingRuntimeIntroduced: false,
    providerMediaUnderstandingExecutionAuthority: false,
    sourceMediaSdkLoaded: false,
    sourceFileProcessorsLoaded: false,
    sourceFileHandlersLoaded: false,
    sourceFilePathAuthority: false,
    sourceModelIdsStoredAsEvidenceOnly: true,
    attachmentInputsRequireZavorthArtifacts: true,
    unsafeFileHandlersBlocked: true,
    executionGate: options.createExecutionGate?.() || defaultExecutionGate(),
  };
}
