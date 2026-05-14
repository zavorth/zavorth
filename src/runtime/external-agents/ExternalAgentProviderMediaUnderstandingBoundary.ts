export type ExternalAgentProviderMediaUnderstandingModality = 'image' | 'audio' | 'video';

export type ExternalAgentProviderMediaUnderstandingSourceEvidence = {
  sourceRuntimeName?: string;
  sourcePaths: string[];
  observedAt: string;
  sourceProviderId?: string;
  sourceModelIds?: string[];
  notes?: string[];
};

export type ExternalAgentProviderMediaUnderstandingEvidence = {
  fixtureCase?: string;
  sourceEvidence?: ExternalAgentProviderMediaUnderstandingSourceEvidence;
  publicProviderId: string;
  modalities: ExternalAgentProviderMediaUnderstandingModality[];
  acceptedContentTypes: string[];
  contextWindowHint: number;
};

export type ExternalAgentProviderMediaUnderstandingExecutionGate = {
  providerSdkLoaded: false;
  liveProviderCallsAttempted: false;
  sourceModulesCopied: false;
  sourceStateMigrated: false;
  rawSecretsRead: false;
  setupCommandsExecuted: false;
  qaRunnersExecuted: false;
};

export type ExternalAgentProviderMediaUnderstandingContract = {
  id: string;
  providerId: string;
  modalities: ExternalAgentProviderMediaUnderstandingModality[];
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

export type ExternalAgentProviderMediaUnderstandingNormalization = {
  nativeContract: 'ZavorthMediaUnderstandingProviderContracts/v1';
  generatedAt: string;
  contracts: ExternalAgentProviderMediaUnderstandingContract[];
  providerMediaUnderstandingRuntimeIntroduced: false;
  providerMediaUnderstandingExecutionAuthority: false;
  sourceMediaSdkLoaded: false;
  sourceFileProcessorsLoaded: false;
  sourceFileHandlersLoaded: false;
  sourceFilePathAuthority: false;
  sourceModelIdsStoredAsEvidenceOnly: true;
  attachmentInputsRequireZavorthArtifacts: true;
  unsafeFileHandlersBlocked: true;
  executionGate: ExternalAgentProviderMediaUnderstandingExecutionGate;
};

export type ExternalAgentProviderMediaUnderstandingBoundaryOptions = {
  records: ExternalAgentProviderMediaUnderstandingEvidence[];
  generatedAt: string;
  maxContextItems?: number;
  createExecutionGate?: () => ExternalAgentProviderMediaUnderstandingExecutionGate;
};

function defaultExecutionGate(): ExternalAgentProviderMediaUnderstandingExecutionGate {
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

export function normalizeExternalAgentProviderMediaUnderstandingContracts(
  options: ExternalAgentProviderMediaUnderstandingBoundaryOptions,
): ExternalAgentProviderMediaUnderstandingNormalization {
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
