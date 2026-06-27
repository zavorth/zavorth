import type {
  ModelCapabilityKind,
  ModelPickerReadiness,
  ProviderCredentialKind,
  ProviderRouteKind,
} from '../ModelPickerContract.js';

export type ZavorthModelProviderExperienceCategoryId =
  | 'fast_and_budget'
  | 'highest_intelligence'
  | 'local_private'
  | 'openai_compatible';

export type ZavorthModelProviderExperienceProviderTier =
  | 'essential'
  | 'power_user'
  | 'long_tail';

export type ZavorthModelProviderExperienceRoute = {
  routeId: string;
  providerId: string;
  providerName: string;
  label: string;
  modelName: string | null;
  modelLabel: string;
  routeKind: ProviderRouteKind;
  credentialKind: ProviderCredentialKind;
  credentialRefs: string[];
  readiness: ModelPickerReadiness;
  ready: boolean;
  capabilities: ModelCapabilityKind[];
  setupHint: string;
  explanation: string[];
};

export type ZavorthModelProviderExperienceCategory = {
  id: ZavorthModelProviderExperienceCategoryId;
  label: string;
  summary: string;
  recommendedRouteIds: string[];
  primary: ZavorthModelProviderExperienceRoute | null;
  alternatives: ZavorthModelProviderExperienceRoute[];
  emptyHint: string;
};

export type ZavorthModelProviderExperienceCoverageEntry = {
  providerId: string;
  label: string;
  tier: ZavorthModelProviderExperienceProviderTier;
  routeId: string | null;
  present: boolean;
  ready: boolean;
  readiness: ModelPickerReadiness | 'missing';
  setupHint: string;
};

export type ZavorthModelProviderExperienceFallbackPolicy = {
  strategy: 'capability_then_readiness_then_cost_privacy';
  supportsLastKnownGoodProvider: boolean;
  requiresPolicyBrokerForExternalUse: boolean;
  explanation: string[];
};

export type ZavorthModelProviderExperienceSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  status: 'ready' | 'needs_config' | 'incomplete';
  essentialCoverage: {
    required: number;
    present: number;
    ready: number;
    entries: ZavorthModelProviderExperienceCoverageEntry[];
  };
  powerUserCoverage: {
    tracked: number;
    present: number;
    ready: number;
    entries: ZavorthModelProviderExperienceCoverageEntry[];
  };
  categories: ZavorthModelProviderExperienceCategory[];
  fallbackPolicy: ZavorthModelProviderExperienceFallbackPolicy;
  productPromise: string;
  explanation: string[];
};
