export type VendorReleaseIsolation = 'core-safe' | 'vendor-isolated';
export type VendorCoreCopyPolicy = 'allow-with-attribution' | 'isolated-vendor-only';

export type VendorReleaseIndexStatus =
  | 'aligned'
  | 'update_available'
  | 'unlocked'
  | 'missing_worktree';

export type VendorLicenseDecision = {
  vendorId: string;
  displayName: string;
  license: string;
  releaseIsolation: VendorReleaseIsolation;
  coreCopyPolicy: VendorCoreCopyPolicy;
  reviewRequired: boolean;
  allowVendorSync: boolean;
  allowCoreCopy: boolean;
  rationale: string;
  recommendedAction: string;
  summary: string;
};

export type VendorDiffSummary = {
  vendorId: string;
  displayName: string;
  status: VendorReleaseIndexStatus;
  changed: boolean;
  lockedCommit: string | null;
  worktreeCommit: string | null;
  sourceHead: string | null;
  currentCommit: string | null;
  targetCommit: string | null;
  currentShort: string | null;
  targetShort: string | null;
  lastActionType: 'update' | 'rollback' | null;
  lastActionAt: string | null;
  trimmed: string | null;
  summary: string;
};

export type VendorReleaseIndexEntry = {
  vendorId: string;
  displayName: string;
  license: string;
  integrationMode: string;
  upstream: string;
  resolvedSourceType: 'local' | 'upstream';
  resolvedSource: string;
  mirrorDir: string;
  worktreeDir: string;
  lockedCommit: string | null;
  sourceHead: string | null;
  mirrorHead: string | null;
  worktreeCommit: string | null;
  status: VendorReleaseIndexStatus;
  updateAvailable: boolean;
  live: boolean;
  ready: boolean;
  baseUrl: string | null;
  port: number | null;
  statusFile?: string | null;
  healthFile?: string | null;
  syncStatus?: 'inspected' | 'promoted' | 'rolled_back' | 'failed' | 'unknown';
  syncSummary?: string | null;
  healthSummary?: string | null;
  lastAction: {
    type: 'update' | 'rollback' | null;
    createdAt: string | null;
    trimmed: string | null;
  };
  diff: VendorDiffSummary;
  licenseDecision: VendorLicenseDecision;
};

export type VendorReleaseIndexSnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    updateAvailable: number;
    live: number;
    ready: number;
    reviewRequired: number;
    blockedForCoreCopy: number;
  };
  entries: VendorReleaseIndexEntry[];
};
