export const ZAVORTH_SOURCE_SURFACE_LEDGER_CONTRACT_VERSION = '2026-05-05.checkpoint-0' as const;

export const SOURCE_SURFACE_CATEGORIES = [
  'root_directory',
  'root_file',
  'native_app',
  'internal_package',
  'src_module',
  'src_singleton_file',
  'script_group',
  'support_surface',
  'dependency_patch',
  'github_workflow',
  'skill',
  'runtime_dependency',
] as const;

export const SOURCE_SURFACE_DECISIONS = [
  'implemented',
  'replaced',
  'waived',
  'rejected',
] as const;

export const SOURCE_SURFACE_PRIORITIES = [
  'P0',
  'P1',
  'P2',
] as const;

export type SourceSurfaceCategory = typeof SOURCE_SURFACE_CATEGORIES[number];
export type SourceSurfaceDecision = typeof SOURCE_SURFACE_DECISIONS[number];
export type SourceSurfacePriority = typeof SOURCE_SURFACE_PRIORITIES[number];

export type SourceSurfaceDecisionFinality = 'final' | 'provisional';

export type SourceSurfaceLedgerEntry = {
  id: string;
  ordinal: number;
  category: SourceSurfaceCategory;
  sourcePath: string;
  item: string;
  decision: SourceSurfaceDecision;
  decisionFinality: SourceSurfaceDecisionFinality;
  ownerDecisionRequired: boolean;
  priority: SourceSurfacePriority;
  coverageStatus: string;
  zavorthDisposition: string;
  zavorthEvidence: string[];
  sourceEvidence: string[];
  notes: string;
};

export type SourceSurfaceLedgerSummary = {
  total: number;
  byDecision: Record<SourceSurfaceDecision, number>;
  byCategory: Record<SourceSurfaceCategory, number>;
  byPriority: Record<SourceSurfacePriority, number>;
  ownerDecisionRequired: number;
  provisional: number;
};

export type SourceSurfaceLedgerDocument = {
  schemaVersion: number;
  generatedAt: string;
  title: string;
  privacy: 'private';
  sourceRoot: string;
  zavorthRoot: string;
  sourceReports: string[];
  decisionEnum: SourceSurfaceDecision[];
  decisionSemantics: Record<SourceSurfaceDecision, string>;
  summary: SourceSurfaceLedgerSummary;
  entries: SourceSurfaceLedgerEntry[];
};

export type SourceDiscoveredSurfaceKind =
  | 'directory'
  | 'file'
  | 'semantic-group'
  | 'package-dependency';

export type SourceSurfaceEvidenceCounts = {
  files: number;
  dirs: number;
};

export type SourceDiscoveredSurface = {
  category: SourceSurfaceCategory;
  sourcePath: string;
  item: string;
  kind: SourceDiscoveredSurfaceKind;
  source: 'filesystem' | 'package-json' | 'semantic-script-group';
  evidence: string[];
  counts?: SourceSurfaceEvidenceCounts;
};

export type SourceSurfaceValidationIssue = {
  severity: 'error' | 'warning';
  entryId?: string;
  sourcePath?: string;
  category?: string;
  message: string;
};

export type SourceSurfaceDiffItem = {
  category: SourceSurfaceCategory;
  sourcePath: string;
  item: string;
  priority: SourceSurfacePriority;
  severity: 'blocking' | 'warning';
  reason: string;
  ledgerEntryId?: string;
  decision?: SourceSurfaceDecision;
  evidence: string[];
};

export type SourceSurfaceDiffSnapshot = {
  classified: number;
  unclassified: SourceSurfaceDiffItem[];
  missingFromCheckout: SourceSurfaceDiffItem[];
  evidenceChanged: SourceSurfaceDiffItem[];
};

export type SourceAbsorptionTarget =
  | 'core'
  | 'optional-pack'
  | 'qa-gate'
  | 'dependency-pack'
  | 'native-capability'
  | 'non-goal'
  | 'already-implemented'
  | 'rejected';

export type SourceAbsorptionPlannerItem = {
  entryId: string;
  category: SourceSurfaceCategory;
  sourcePath: string;
  priority: SourceSurfacePriority;
  decision: SourceSurfaceDecision;
  ownerDecisionRequired: boolean;
  target: SourceAbsorptionTarget;
  phase: number;
  reason: string;
};

export type SourceAbsorptionPlannerSnapshot = {
  generatedAt: string;
  summary: {
    items: number;
    byPhase: Record<string, number>;
    byTarget: Record<SourceAbsorptionTarget, number>;
    ownerDecisionRequired: number;
  };
  items: SourceAbsorptionPlannerItem[];
};

export type SourceSurfaceLedgerReceiptStatus =
  | 'passed'
  | 'failed';

export type SourceSurfaceLedgerReceipt = {
  id: string;
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SOURCE_SURFACE_LEDGER_CONTRACT_VERSION;
  status: SourceSurfaceLedgerReceiptStatus;
  phase: 0;
  statement: 'Source full-surface ledger is executable Zavorth governance infrastructure.';
  paths: {
    ledgerPath: string;
    sourceRoot: string;
    zavorthRoot: string;
  };
  summary: SourceSurfaceLedgerSummary & {
    discoveredSurfaces: number;
    classifiedSurfaces: number;
    unclassifiedSurfaces: number;
    missingLedgerSurfaces: number;
    evidenceChangedSurfaces: number;
    validationErrors: number;
    validationWarnings: number;
    ignoredSurfaces: number;
  };
  validation: {
    issues: SourceSurfaceValidationIssue[];
  };
  drift: SourceSurfaceDiffSnapshot;
  planner: SourceAbsorptionPlannerSnapshot;
  ignoredSurfaces: string[];
  policy: {
    noLiveProviderCalls: true;
    noLiveChannelSends: true;
    noFilesystemWritesToSource: true;
    noSecretValuesSerialized: true;
    failOnUnclassifiedSurfaces: true;
    missingExistingLedgerSurfacesAreWarnings: true;
  };
  commands: {
    inspect: 'npm run source-surface-ledger --silent';
    inspectJson: 'npm run source-surface-ledger:json --silent';
    check: 'npm run source-surface-ledger:check --silent';
    qa: 'npm run qa:source-surface-ledger --silent';
    nextStage: 'Intent model - Plugin OS And Package SDK Absorption';
  };
};
