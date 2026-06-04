import {
  ToolExposurePolicy,
  type ToolExposurePolicyInput,
} from '../agent/ToolExposurePolicy.js';

export type RuntimeAdapterProviderWebSearchFetchMode = 'search' | 'fetch';

export type RuntimeAdapterProviderWebSearchFetchResultShape = 'summary' | 'document' | 'citation';

export type RuntimeAdapterProviderWebSearchFetchSourceEvidence = {
  sourceRuntimeName?: string;
  sourcePaths: string[];
  observedAt: string;
  sourceProviderId?: string;
  sourceEndpointIds?: string[];
  notes?: string[];
};

export type RuntimeAdapterProviderWebSearchFetchEvidence = {
  fixtureCase?: string;
  sourceEvidence?: RuntimeAdapterProviderWebSearchFetchSourceEvidence;
  publicProviderId: string;
  modes: RuntimeAdapterProviderWebSearchFetchMode[];
  allowedDomains: string[];
  resultShapes: RuntimeAdapterProviderWebSearchFetchResultShape[];
};

export type RuntimeAdapterProviderWebSearchFetchExecutionGate = {
  providerSdkLoaded: false;
  liveProviderCallsAttempted: false;
  sourceModulesCopied: false;
  sourceStateMigrated: false;
  rawSecretsRead: false;
  setupCommandsExecuted: false;
  qaRunnersExecuted: false;
};

export type RuntimeAdapterProviderWebSearchFetchContract = {
  id: string;
  providerId: string;
  modes: RuntimeAdapterProviderWebSearchFetchMode[];
  networkPolicy: {
    allowedDomains: string[];
    resultShapes: RuntimeAdapterProviderWebSearchFetchResultShape[];
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

export type RuntimeAdapterProviderWebSearchFetchNormalization = {
  nativeContract: 'ZavorthWebSearchFetchProviderContracts/v1';
  generatedAt: string;
  contracts: RuntimeAdapterProviderWebSearchFetchContract[];
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
  executionGate: RuntimeAdapterProviderWebSearchFetchExecutionGate;
};

export type RuntimeAdapterProviderWebSearchFetchBoundaryOptions = {
  records: RuntimeAdapterProviderWebSearchFetchEvidence[];
  generatedAt: string;
  createExecutionGate?: () => RuntimeAdapterProviderWebSearchFetchExecutionGate;
};

function defaultExecutionGate(): RuntimeAdapterProviderWebSearchFetchExecutionGate {
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

export function normalizeRuntimeAdapterProviderWebSearchFetchContracts(
  options: RuntimeAdapterProviderWebSearchFetchBoundaryOptions,
): RuntimeAdapterProviderWebSearchFetchNormalization {
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
