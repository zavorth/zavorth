export type ModelPickerReadiness = 'ready' | 'needs_config' | 'needs_probe';
export type ModelPickerRouteMode = 'cloud' | 'local' | 'hybrid' | 'alias';
export type ModelPickerVisibility = 'public' | 'advanced';
export type AccessRouteReadinessCode =
  | 'ready'
  | 'missing_auth'
  | 'missing_base_url'
  | 'needs_probe'
  | 'unhealthy'
  | 'unsupported';
export type AccessRouteClass =
  | 'official'
  | 'aggregator'
  | 'partner'
  | 'gateway'
  | 'local'
  | 'custom_compatible'
  | 'alias'
  | 'fallback';
export type ProviderCatalogSource =
  | 'runtime_config'
  | 'static'
  | 'provider_live'
  | 'operator'
  | 'fallback'
  | 'live_api'
  | 'provider_catalog'
  | 'fallback_catalog'
  | 'local_catalog'
  | 'custom_model'
  | 'imported_model';
export type ProviderRouteKind = 'official' | 'aggregator' | 'partner' | 'custom_compatible' | 'local_runtime' | 'alias' | 'fallback';
export type ProviderCredentialKind = 'none' | 'api_key' | 'bearer_token' | 'oauth' | 'local_endpoint' | 'runtime_config' | 'custom';
export type ModelModality = 'text' | 'image' | 'audio' | 'video' | 'embedding' | 'tool';
export type ModelCapabilityKind =
  | 'chat'
  | 'coding'
  | 'reasoning'
  | 'research'
  | 'vision'
  | 'audio'
  | 'embedding'
  | 'tool_use'
  | 'streaming'
  | 'long_context'
  | 'local'
  | 'budget'
  | 'multimodal';

export type ProviderMeshIdentity = {
  familyId: string;
  vendorId: string;
  providerId: string;
  routeId: string;
  routeKind: ProviderRouteKind;
  modelId: string | null;
  credentialRef: string | null;
  credentialKind: ProviderCredentialKind;
  catalogSource: ProviderCatalogSource;
};

export type ModelFamilyCatalogEntry = {
  id: string;
  label: string;
  summary: string;
  vendorId: string;
  providerIds: string[];
  defaultModelName: string | null;
  secondaryModelNames: string[];
  fallbackModelNames: string[];
  primaryRouteId: string;
  routeIds: string[];
  visibility: ModelPickerVisibility;
  readiness: ModelPickerReadiness;
  ready: boolean;
  issue: string | null;
  capabilities: ModelCapabilityKind[];
  modalities: ModelModality[];
  limitations: string[];
  catalogSource: ProviderCatalogSource;
};

export type ModelFamilyCatalog = {
  schemaVersion: 1;
  generatedAt: string;
  families: ModelFamilyCatalogEntry[];
};

export type AccessRouteCatalogEntry = {
  id: string;
  label: string;
  familyIds: string[];
  vendorId: string;
  providerId: string;
  providerName: string;
  routeKind: ProviderRouteKind;
  mode: ModelPickerRouteMode;
  aliases: string[];
  requirements: string[];
  credentialKind: ProviderCredentialKind;
  credentialRefs: string[];
  currentModelName: string | null;
  secondaryModelNames: string[];
  fallbackModelNames: string[];
  readiness: ModelPickerReadiness;
  readinessCode?: AccessRouteReadinessCode;
  ready: boolean;
  issue: string | null;
  routeClass?: AccessRouteClass;
  authConfigured?: boolean;
  baseUrlRef?: string | null;
  baseUrlConfigured?: boolean;
  discoverySupported?: boolean;
  connectionId?: string | null;
  providerNodeId?: string | null;
  proxyId?: string | null;
  health?: {
    status: 'healthy' | 'unhealthy' | 'unknown' | 'not_applicable';
    message: string | null;
    checkedAt: string | null;
  } | null;
  explanation?: string[];
  capabilities: ModelCapabilityKind[];
  modalities: ModelModality[];
  limitations: string[];
  fallbackRouteIds: string[];
  catalogSource: ProviderCatalogSource;
};

export type AccessRouteCatalog = {
  schemaVersion: 1;
  generatedAt: string;
  routes: AccessRouteCatalogEntry[];
};

export type SelectedModelProfile = {
  schemaVersion: 1;
  source: 'current-config' | 'target-selection' | 'profile-selection';
  providerName: string;
  providerLabel: string;
  modelName: string | null;
  modelLabel: string;
  routeId: string;
  familyId: string;
  vendorId: string;
  providerId: string;
  routeKind: ProviderRouteKind;
  credentialKind: ProviderCredentialKind;
  credentialRef: string | null;
  catalogSource: ProviderCatalogSource;
  readiness: ModelPickerReadiness;
  ready: boolean;
  fallbackOrder: string[];
  fallbackRouteIds: string[];
  capabilities: ModelCapabilityKind[];
  modalities: ModelModality[];
  limitations: string[];
  identity: ProviderMeshIdentity;
  explanation: string[];
};

export type ModelPickerProfileEntry = {
  id: string;
  label: string;
  summary: string;
  preferredOrder: string[];
};

export type ModelPickerCandidate = {
  routeId: string;
  familyId: string;
  vendorId: string;
  providerId: string;
  modelName: string | null;
  providerLabel: string;
  modelLabel: string;
  readiness: ModelPickerReadiness;
  ready: boolean;
  capabilityScore: number;
  catalogSource: ProviderCatalogSource;
  capabilities: ModelCapabilityKind[];
  modalities: ModelModality[];
  limitations: string[];
  fallbackRouteIds: string[];
  explanation: string[];
};

export type ModelPickerSelectionInput = {
  includeAdvanced?: boolean;
  selectedTarget?: string | null;
  preferredProfileId?: string | null;
  requestedCapability?: ModelCapabilityKind | null;
  requireReady?: boolean;
};

export type ModelPickerSelectionResult = {
  schemaVersion: 1;
  generatedAt: string;
  input: ModelPickerSelectionInput;
  selected: SelectedModelProfile | null;
  candidates: ModelPickerCandidate[];
  explanation: string[];
};

export type ModelPickerContract = {
  schemaVersion: 1;
  generatedAt: string;
  families: ModelFamilyCatalog;
  routes: AccessRouteCatalog;
  profiles: ModelPickerProfileEntry[];
  selected: SelectedModelProfile;
};

export type ModelPickerContractBuildOptions = {
  includeAdvanced?: boolean;
  selectedTarget?: string | null;
  profileId?: string | null;
};
