import {
  ToolExposurePolicy,
  type ToolExposurePolicyInput,
} from '../agent/ToolExposurePolicy.js';

export type ExternalAgentProviderWebSearchFetchMode = 'search' | 'fetch';

export type ExternalAgentProviderWebSearchFetchResultShape = 'summary' | 'document' | 'citation';

export type ExternalAgentProviderWebSearchFetchSourceEvidence = {
  sourceRuntimeName?: string;
  sourcePaths: string[];
  observedAt: string;
  sourceProviderId?: string;
  sourceEndpointIds?: string[];
  notes?: string[];
};

export type ExternalAgentProviderWebSearchFetchEvidence = {
  fixtureCase?: string;
  sourceEvidence?: ExternalAgentProviderWebSearchFetchSourceEvidence;
  publicProviderId: string;
  modes: ExternalAgentProviderWebSearchFetchMode[];
  allowedDomains: string[];
  resultShapes: ExternalAgentProviderWebSearchFetchResultShape[];
};

export type ExternalAgentProviderWebSearchFetchExecutionGate = {
  providerSdkLoaded: false;
  liveProviderCallsAttempted: false;
  sourceModulesCopied: false;
  sourceStateMigrated: false;
  rawSecretsRead: false;
  setupCommandsExecuted: false;
  qaRunnersExecuted: false;
};

export type ExternalAgentProviderWebSearchFetchContract = {
  id: string;
  providerId: string;
  modes: ExternalAgentProviderWebSearchFetchMode[];
  networkPolicy: {
    allowedDomains: string[];
    resultShapes: ExternalAgentProviderWebSearchFetchResultShape[];
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

export type ExternalAgentProviderWebSearchFetchNormalization = {
  nativeContract: 'ZavorthWebSearchFetchProviderContracts/v1';
  generatedAt: string;
  contracts: ExternalAgentProviderWebSearchFetchContract[];
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
  executionGate: ExternalAgentProviderWebSearchFetchExecutionGate;
};

export type ExternalAgentProviderWebSearchFetchBoundaryOptions = {
  records: ExternalAgentProviderWebSearchFetchEvidence[];
  generatedAt: string;
  createExecutionGate?: () => ExternalAgentProviderWebSearchFetchExecutionGate;
};

function defaultExecutionGate(): ExternalAgentProviderWebSearchFetchExecutionGate {
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

export function normalizeExternalAgentProviderWebSearchFetchContracts(
  options: ExternalAgentProviderWebSearchFetchBoundaryOptions,
): ExternalAgentProviderWebSearchFetchNormalization {
  const toolExposurePolicyInput: ToolExposurePolicyInput = {
    requestedTools: ['web.search', 'network_fetch'],
    requireApprovalFor: ['web.search'],
    blockedTools: ['network_fetch'],
    blockedToolReason: 'provider-web-fetch-live-network-blocked',
  };

  return {
    nativeContract: 'ZavorthWebSearchFetchProviderContracts/v1',
    generatedAt: options.generatedAt,
    contracts: options.records.map((record, index) => ({
      id: `${record.publicProviderId}:web-contract-${index + 1}`,
      providerId: record.publicProviderId,
      modes: record.modes,
      networkPolicy: {
        allowedDomains: record.allowedDomains,
        resultShapes: record.resultShapes,
        webSearchRequiresApproval: true,
        networkFetchBlocked: true,
        liveNetworkCallsAllowed: false,
        sourceNetworkAuthority: false,
        sourceEndpointStoredAsEvidenceOnly: true,
      },
      liveNetworkCallsAttempted: false,
      sourceFetcherExecuted: false,
      sourceFetcherLoaded: false,
      sourceBrowserNetworkLoaded: false,
      nativeContract: 'ZavorthWebSearchFetchProviderContract/v1',
    })),
    toolExposurePolicyInput,
    toolExposureProfile: new ToolExposurePolicy().buildProfile(toolExposurePolicyInput),
    providerWebSearchFetchRuntimeIntroduced: false,
    providerWebSearchFetchExecutionAuthority: false,
    sourceWebSdkLoaded: false,
    sourceFetcherLoaded: false,
    sourceBrowserNetworkLoaded: false,
    sourceNetworkAuthority: false,
    sourceEndpointIdsStoredAsEvidenceOnly: true,
    liveNetworkCallsAllowed: false,
    webSearchRequiresApproval: true,
    networkFetchBlocked: true,
    executionGate: options.createExecutionGate?.() || defaultExecutionGate(),
  };
}
