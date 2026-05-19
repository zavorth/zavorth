import type {
  AccessRouteCatalogEntry,
  AccessRouteClass,
  ModelCapabilityKind,
  ModelPickerRouteMode,
  ProviderCredentialKind,
  ProviderRouteKind,
} from './ModelPickerContract.js';

export const ZAVORTH_PROVIDER_READINESS_MATRIX_CONTRACT_VERSION = '2026-05-14.checkpoint-3-live-completion' as const;

export type ZavorthProviderReadinessStatus =
  | 'ready'
  | 'missing_auth'
  | 'missing_base_url'
  | 'needs_probe'
  | 'degraded'
  | 'unsupported'
  | 'blocked';

export type ZavorthProviderProbeStatus =
  | 'not_run'
  | 'not_applicable'
  | 'ready_to_probe'
  | 'blocked'
  | 'passed'
  | 'failed';

export type ZavorthProviderLiveProbeMode = 'catalog_only' | 'explicit_live_probe';

export type ZavorthProviderReadinessProof =
  | 'none'
  | 'catalog'
  | 'health'
  | 'live_probe'
  | 'blocked';

export type ZavorthProviderReadinessEntry = {
  id: string;
  label: string;
  providerName: string;
  providerId: string;
  familyIds: string[];
  routeKind: ProviderRouteKind;
  routeClass: AccessRouteClass | 'unknown';
  mode: ModelPickerRouteMode;
  credentialKind: ProviderCredentialKind;
  credentialRefs: string[];
  requirements: string[];
  currentModelName: string | null;
  capabilities: ModelCapabilityKind[];
  status: ZavorthProviderReadinessStatus;
  catalogReady: boolean;
  liveReady: boolean;
  defaultRouteAllowed: boolean;
  readinessProof: ZavorthProviderReadinessProof;
  defaultBlockReason: string | null;
  authConfigured: boolean;
  baseUrlConfigured: boolean;
  discoverySupported: boolean;
  health: AccessRouteCatalogEntry['health'];
  issue: string | null;
  explanation: string[];
  userAction: string;
  testCommand: string;
  probe: {
    status: ZavorthProviderProbeStatus;
    mode: ZavorthProviderLiveProbeMode;
    liveNetworkUsed: boolean;
    requestedAt: string | null;
    completedAt: string | null;
    durationMs: number | null;
    target: string | null;
    httpStatus: number | null;
    modelCount: number | null;
    evidenceHash: string | null;
    summary: string;
  };
  rawSecretsPresent: false;
};

export type ZavorthProviderReadinessMatrixSnapshot = {
  contractVersion: typeof ZAVORTH_PROVIDER_READINESS_MATRIX_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'provider-readiness-matrix';
  generatedAt: string;
  status: 'ready' | 'attention' | 'blocked';
  activeProvider: string;
  activeModel: string;
  summary: {
    total: number;
    ready: number;
    livePassed: number;
    liveFailed: number;
    liveBlocked: number;
    liveNotRun: number;
    liveReady: number;
    catalogReadyButNotLive: number;
    defaultRouteAllowed: number;
    missingAuth: number;
    missingBaseUrl: number;
    needsProbe: number;
    degraded: number;
    unsupported: number;
    blocked: number;
  };
  entries: ZavorthProviderReadinessEntry[];
  profiles: Array<{
    id: string;
    label: string;
    summary: string;
    preferredOrder: string[];
  }>;
  simpleCatalog: {
    fastAndCheap: string[];
    higherIntelligence: string[];
    localPrivate: string[];
    openAiCompatible: string[];
  };
  liveCompletion: {
    providerSelectionRequiresLiveProof: true;
    catalogSupportIsNotLiveProof: true;
    liveProbeRequiresExplicitOperatorAction: true;
    rawSecretsSerialized: false;
    publicApiProviderTestEndpoint: '/api/v1/providers/:id/test';
    defaultRoutingPolicy: 'ready-and-live-proof';
    counts: {
      catalogReady: number;
      liveReady: number;
      catalogReadyButNotLive: number;
      defaultRouteAllowed: number;
    };
  };
  commands: Array<{
    id: string;
    command: string;
    summary: string;
    liveNetworkUsedByDefault: boolean;
  }>;
  commandCenterProjection: {
    route: '/dashboard';
    endpoint: '/api/providers/readiness';
    executionAuthority: false;
    canRenderTestButtons: true;
  };
  invariants: Array<{
    id: string;
    status: 'passed';
    detail: string;
  }>;
  nextAction: string;
};
