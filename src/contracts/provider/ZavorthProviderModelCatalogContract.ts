import type {
  ModelCapabilityKind,
  ModelModality,
  ModelPickerRouteMode,
  ProviderCredentialKind,
  ProviderRouteKind,
} from './ModelPickerContract.js';
import type {
  ZavorthProviderProbeStatus,
  ZavorthProviderReadinessProof,
  ZavorthProviderReadinessStatus,
} from './ZavorthProviderReadinessMatrixContract.js';

export const ZAVORTH_PROVIDER_MODEL_CATALOG_CONTRACT_VERSION = '2026-05-17.provider-model-catalog.v1' as const;

export type ZavorthProviderModelCatalogStatus = 'ready' | 'attention' | 'blocked';

export type ZavorthProviderModelCatalogProvider = {
  id: string;
  label: string;
  providerId: string;
  providerName: string;
  routeKind: ProviderRouteKind;
  mode: ModelPickerRouteMode;
  status: ZavorthProviderReadinessStatus;
  catalogReady: boolean;
  liveReady: boolean;
  defaultRouteAllowed: boolean;
  readinessProof: ZavorthProviderReadinessProof;
  liveStatus: ZavorthProviderProbeStatus;
  model: string | null;
  staticModelCount: number;
  liveDiscoveredModelCount: number | null;
  effectiveModelCount: number;
  modelSample: string[];
  capabilities: ModelCapabilityKind[];
  modalities: ModelModality[];
  credentialKind: ProviderCredentialKind;
  credentialRefs: string[];
  requirements: string[];
  issue: string | null;
  defaultBlockReason: string | null;
  userAction: string;
  testCommand: string;
};

export type ZavorthProviderModelCatalogSnapshot = {
  contractVersion: typeof ZAVORTH_PROVIDER_MODEL_CATALOG_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'provider-model-catalog';
  generatedAt: string;
  status: ZavorthProviderModelCatalogStatus;
  source: {
    readinessSurface: 'provider-readiness-matrix';
    staticCatalog: 'provider-integration-registry';
    liveEvidence: 'sanitized-provider-proof-store';
  };
  activeProvider: string;
  activeModel: string;
  summary: {
    providerRoutes: number;
    catalogReadyRoutes: number;
    liveReadyRoutes: number;
    defaultRouteAllowed: number;
    catalogReadyButNotLive: number;
    missingAuth: number;
    missingBaseUrl: number;
    staticCatalogModels: number;
    liveDiscoveredModels: number;
    effectiveModelSurface: number;
    modalityCounts: Record<ModelModality | 'unknown', number>;
    capabilityCounts: Partial<Record<ModelCapabilityKind, number>>;
  };
  sections: {
    liveValidated: string[];
    readyButNotLive: string[];
    needsCredentials: string[];
    needsBaseUrl: string[];
    aggregators: string[];
    localPrivate: string[];
    mediaCapable: string[];
  };
  providers: ZavorthProviderModelCatalogProvider[];
  commands: Array<{
    id: string;
    command: string;
    summary: string;
    liveNetworkUsedByDefault: boolean;
  }>;
  dashboardProjection: {
    route: '/dashboard';
    endpoint: '/api/providers/model-catalog';
    executionAuthority: false;
    normalRenderMakesNoNetworkCalls: true;
  };
  safety: {
    noRawProviderSecrets: true;
    catalogIsNotLiveProof: true;
    liveProbeRequiresExplicitOperatorAction: true;
    dashboardCannotExecuteProviderCalls: true;
    modelListingMayBeDynamicThroughAggregators: true;
  };
  nextAction: string;
};
