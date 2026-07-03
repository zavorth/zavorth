export type ExternalAgentProviderCatalogAvailability = 'available' | 'unavailable';

export type ExternalAgentProviderIdentityCatalogSourceEvidence = {
  sourceRuntimeName?: string;
  sourcePaths: string[];
  observedAt: string;
  sourceProviderId?: string;
  sourceModelIds?: string[];
  sourceEndpointIds?: string[];
  notes?: string[];
};

export type ExternalAgentProviderIdentityCatalogEvidence = {
  fixtureCase?: string;
  sourceEvidence?: ExternalAgentProviderIdentityCatalogSourceEvidence;
  sourceProviderId: string;
  sourceDisplayName?: string;
  sourceModelIds: string[];
  sourceEndpointIds: string[];
  families: string[];
  status: ExternalAgentProviderCatalogAvailability;
  diagnostics?: string[];
};

export type ExternalAgentProviderIdentityCatalogExecutionGate = {
  providerSdkLoaded: false;
  liveProviderCallsAttempted: false;
  sourceModulesCopied: false;
  sourceStateMigrated: false;
  rawSecretsRead: false;
  setupCommandsExecuted: false;
  qaRunnersExecuted: false;
};

export type ExternalAgentProviderCatalogRecord = {
  id: string;
  label: string;
  status: ExternalAgentProviderCatalogAvailability;
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

export type ExternalAgentProviderIdentityCatalogNormalization<RuntimeId extends string = string> = {
  nativeContract: 'ZavorthProviderIdentityCatalogNormalization/v1';
  generatedAt: string;
  runtimeId: RuntimeId;
  providers: ExternalAgentProviderCatalogRecord[];
  zavorthControl: {
    capabilities: Array<{
      id: string;
      providerId: string;
      label: string;
      status: ExternalAgentProviderCatalogAvailability;
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
  sourceProviderCatalogIntroduced: false;
  sourceProviderCatalogAuthoritative: false;
  sourceProviderCatalogLiveProbeAuthority: false;
  executionGate: ExternalAgentProviderIdentityCatalogExecutionGate;
};

export type ExternalAgentProviderIdentityCatalogBoundaryOptions<RuntimeId extends string = string> = {
  records: ExternalAgentProviderIdentityCatalogEvidence[];
  runtimeId: RuntimeId;
  generatedAt: string;
  publicProviderIdPrefix?: string;
  createExecutionGate?: () => ExternalAgentProviderIdentityCatalogExecutionGate;
};

function publicProviderId(prefix: string, index: number): string {
  return `${prefix}-${index + 1}`;
}

function modelPublicId(providerId: string, index: number): string {
  return `${providerId}:model-${index + 1}`;
}

function endpointPublicId(providerId: string, index: number): string {
  return `${providerId}:endpoint-${index + 1}`;
}

function defaultExecutionGate(): ExternalAgentProviderIdentityCatalogExecutionGate {
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

export function normalizeExternalAgentProviderIdentityCatalog<RuntimeId extends string>(
  options: ExternalAgentProviderIdentityCatalogBoundaryOptions<RuntimeId>,
): ExternalAgentProviderIdentityCatalogNormalization<RuntimeId> {
  const publicProviderIdPrefix = options.publicProviderIdPrefix || 'zavorth-provider:external';
  const providers = options.records.map((record, index): ExternalAgentProviderCatalogRecord => {
    const providerId = publicProviderId(publicProviderIdPrefix, index);
    return {
      id: providerId,
      label: record.status === 'available' ? `Provider ${index + 1}` : `Provider ${index + 1} unavailable`,
      status: record.status,
      modelFamilies: record.families,
      models: record.sourceModelIds.map((_, modelIndex) => ({
        id: modelPublicId(providerId, modelIndex),
        family: record.families[Math.min(modelIndex, record.families.length - 1)] || 'unknown',
        sourceModelStoredAsEvidenceOnly: true,
      })),
      endpoints: record.sourceEndpointIds.map((_, endpointIndex) => ({
        id: endpointPublicId(providerId, endpointIndex),
        mode: 'metadata-only',
        liveProbeAllowed: false,
      })),
      diagnostics: record.diagnostics || [],
      nativeContract: 'ZavorthProviderCatalogRecord/v1',
    };
  });

  return {
    nativeContract: 'ZavorthProviderIdentityCatalogNormalization/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    providers,
    zavorthControl: {
      capabilities: providers.map((provider) => ({
        id: `${provider.id}:catalog`,
        providerId: provider.id,
        label: provider.label,
        status: provider.status,
        policy: 'metadata-only',
      })),
      integrations: providers.map((provider) => ({
        id: `${provider.id}:integration`,
        category: 'provider',
        status: provider.status === 'available' ? 'connected' : 'missing',
        detail: provider.status === 'available'
          ? 'Provider catalog metadata is available through Zavorth-owned ids.'
          : 'Provider catalog metadata is unavailable and no live probe was attempted.',
      })),
    },
    sourceProviderIdsStoredAsEvidenceOnly: true,
    liveProbePerformed: false,
    sourceProviderCatalogIntroduced: false,
    sourceProviderCatalogAuthoritative: false,
    sourceProviderCatalogLiveProbeAuthority: false,
    executionGate: options.createExecutionGate?.() || defaultExecutionGate(),
  };
}
