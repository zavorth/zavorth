export const CAPABILITY_HUB_CONTRACT_VERSION = 'zavorth-capability-hub/v1';

export type CapabilityHubItemKind =
  | 'runtime-capability'
  | 'channel'
  | 'integration'
  | 'provider'
  | 'mcp'
  | 'skill'
  | 'recipe';

export type CapabilityHubReadiness =
  | 'ready'
  | 'partial'
  | 'needs_configuration'
  | 'needs_probe'
  | 'planned'
  | 'disabled'
  | 'blocked';

export type CapabilityHubRiskLevel = 'low' | 'medium' | 'high' | 'blocked' | 'unknown';

export type CapabilityHubSourceKind =
  | 'zavorth-core'
  | 'local-config'
  | 'imported'
  | 'runtime'
  | 'template';

export type CapabilityHubQuery = {
  query?: string | null;
  kind?: CapabilityHubItemKind | null;
  readiness?: CapabilityHubReadiness | null;
  selectedId?: string | null;
  includeItems?: boolean;
};

export type CapabilityHubRequirement = {
  secretRefs: string[];
  envKeys: string[];
  accounts: string[];
  binaries: string[];
  manualSteps: string[];
};

export type CapabilityHubGovernance = {
  risk: CapabilityHubRiskLevel;
  requiresApproval: boolean;
  budgetRequired: boolean;
  sandboxRequired: boolean;
  networkScope: 'none' | 'local' | 'private-network' | 'external-policy' | 'unknown';
  receiptRequired: boolean;
  auditTrailRequired: boolean;
};

export type CapabilityHubActivation = {
  defaultEnabled: boolean;
  liveAllowed: boolean;
  configured: boolean;
  installed: boolean;
  setupGuided: boolean;
  readinessChecks: string[];
  commands: string[];
};

export type CapabilityHubProvenance = {
  owner: 'zavorth-core' | 'user' | 'imported';
  sourceService: string;
  sourceId: string;
  externalRuntimeDependency: boolean;
  canonicalRootOnly: boolean;
};

export type CapabilityHubItem = {
  id: string;
  kind: CapabilityHubItemKind;
  label: string;
  summary: string;
  description: string;
  tags: string[];
  readiness: CapabilityHubReadiness;
  source: CapabilityHubSourceKind;
  requirements: CapabilityHubRequirement;
  governance: CapabilityHubGovernance;
  activation: CapabilityHubActivation;
  provenance: CapabilityHubProvenance;
  searchText: string;
};

export type CapabilityHubGroupSummary = {
  kind: CapabilityHubItemKind;
  total: number;
  ready: number;
  needsConfiguration: number;
  planned: number;
  blocked: number;
};

export type CapabilityHubSnapshot = {
  contractVersion: typeof CAPABILITY_HUB_CONTRACT_VERSION;
  generatedAt: string;
  query: {
    query: string | null;
    kind: CapabilityHubItemKind | null;
    readiness: CapabilityHubReadiness | null;
    selectedId: string | null;
  };
  rootPolicy: {
    canonicalRoot: 'zavorth-core/Zavorth';
    externalCapabilityRootsAllowed: false;
    importsMustNormalizeToZavorthContract: true;
    secretsSerialized: false;
  };
  summary: {
    total: number;
    visible: number;
    ready: number;
    needsConfiguration: number;
    needsProbe: number;
    planned: number;
    blocked: number;
    guidedSetup: number;
    approvalGated: number;
  };
  groups: CapabilityHubGroupSummary[];
  featured: CapabilityHubItem[];
  selected: CapabilityHubItem | null;
  items: CapabilityHubItem[];
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
