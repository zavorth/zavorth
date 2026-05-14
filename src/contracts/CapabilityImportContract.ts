import type {
  CapabilityHubItem,
  CapabilityHubItemKind,
  CapabilityHubReadiness,
  CapabilityHubRiskLevel,
} from './CapabilityHubContract.js';

export const CAPABILITY_IMPORT_CONTRACT_VERSION = 'zavorth-capability-import/v1';

export type CapabilityImportManifestRequirement = {
  secretRefs?: string[];
  envKeys?: string[];
  accounts?: string[];
  binaries?: string[];
  manualSteps?: string[];
};

export type CapabilityImportManifestGovernance = {
  risk?: CapabilityHubRiskLevel;
  requiresApproval?: boolean;
  budgetRequired?: boolean;
  sandboxRequired?: boolean;
  networkScope?: 'none' | 'local' | 'private-network' | 'external-policy' | 'unknown';
};

export type CapabilityImportManifestActivation = {
  readiness?: CapabilityHubReadiness;
  installed?: boolean;
  configured?: boolean;
  setupGuided?: boolean;
  readinessChecks?: string[];
  commands?: string[];
};

export type CapabilityImportManifestItem = {
  id: string;
  kind: CapabilityHubItemKind;
  label: string;
  summary: string;
  description?: string;
  tags?: string[];
  requirements?: CapabilityImportManifestRequirement;
  governance?: CapabilityImportManifestGovernance;
  activation?: CapabilityImportManifestActivation;
};

export type CapabilityImportManifest = {
  contractVersion?: string;
  packId: string;
  label: string;
  summary?: string;
  source?: {
    label?: string;
    externalRuntimeDependency?: boolean;
  };
  items: CapabilityImportManifestItem[];
};

export type CapabilityImportIssue = {
  severity: 'info' | 'warning' | 'error' | 'blocked';
  code: string;
  itemId: string | null;
  message: string;
};

export type CapabilityImportReceipt = {
  id: string;
  kind: 'manifest-validated' | 'item-normalized' | 'item-rejected' | 'secret-redacted';
  summary: string;
  itemId: string | null;
};

export type CapabilityImportPolicy = {
  canonicalRoot: 'zavorth-core/Zavorth';
  canonicalRootOnly: true;
  externalCapabilityRootsAllowed: false;
  importsMustNormalizeToCapabilityHub: true;
  dryRunOnly: true;
  liveActivation: false;
  secretsSerialized: false;
};

export type CapabilityImportSnapshot = {
  contractVersion: typeof CAPABILITY_IMPORT_CONTRACT_VERSION;
  generatedAt: string;
  policy: CapabilityImportPolicy;
  source: {
    manifestCount: number;
    sourceLabel: string | null;
  };
  summary: {
    receivedItems: number;
    normalizedItems: number;
    rejectedItems: number;
    warnings: number;
    blocked: number;
  };
  items: CapabilityHubItem[];
  issues: CapabilityImportIssue[];
  receipts: CapabilityImportReceipt[];
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
