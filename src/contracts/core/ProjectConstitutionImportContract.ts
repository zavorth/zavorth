export const PROJECT_CONSTITUTION_IMPORT_CONTRACT_VERSION = 'zavorth-project-constitution-import/v1' as const;

export type ProjectConstitutionImportSourceKind = 'agents-md' | 'claude-md';

export type ProjectConstitutionImportFindingSeverity = 'info' | 'warning' | 'blocked';

export type ProjectConstitutionImportFinding = {
  id: string;
  severity: ProjectConstitutionImportFindingSeverity;
  sourcePath: string | null;
  line: number | null;
  message: string;
};

export type ProjectConstitutionImportSource = {
  kind: ProjectConstitutionImportSourceKind;
  fileName: 'AGENTS.md' | 'CLAUDE.md';
  path: string;
  relativePath: string;
  bytesRead: number;
  truncated: boolean;
  redacted: boolean;
  sha256: string;
  importedLineCount: number;
  findings: ProjectConstitutionImportFinding[];
};

export type ProjectConstitutionImportPreview = {
  contractVersion: typeof PROJECT_CONSTITUTION_IMPORT_CONTRACT_VERSION;
  source: 'ProjectConstitutionImportService';
  previewId: string;
  generatedAt: string;
  status: 'no_sources' | 'preview_ready';
  workspaceRoot: string;
  targetPath: string;
  targetExists: boolean;
  sources: ProjectConstitutionImportSource[];
  findings: ProjectConstitutionImportFinding[];
  writes: Array<{
    path: string;
    operation: 'create' | 'update' | 'none';
    beforeSha256: string | null;
    afterSha256: string | null;
  }>;
  diffSummary: {
    addedLines: number;
    removedLines: number;
    replacedManagedBlocks: number;
  };
  safety: {
    rawInstructionsExecuted: false;
    rawSecretsSerialized: false;
    policyBypassAllowed: false;
    approvalRequired: true;
    importedAsAdvisoryContext: true;
  };
  approval: {
    required: true;
    phrase: string;
    reason: string;
  };
  receiptPath: string;
  summary: string;
};

export type ProjectConstitutionImportReceipt = {
  contractVersion: typeof PROJECT_CONSTITUTION_IMPORT_CONTRACT_VERSION;
  receiptId: string;
  previewId: string;
  generatedAt: string;
  appliedAt: string;
  approvedBy: string;
  workspaceRoot: string;
  targetPath: string;
  sourcePaths: string[];
  beforeSha256: string | null;
  afterSha256: string;
  findings: ProjectConstitutionImportFinding[];
  safety: ProjectConstitutionImportPreview['safety'];
  summary: string;
};

export type ProjectConstitutionImportApplyResult = {
  ok: boolean;
  status: 'applied';
  receipt: ProjectConstitutionImportReceipt;
  preview: ProjectConstitutionImportPreview;
};

export type ProjectConstitutionImportedSourceSummary = {
  sourcePath: string;
  receiptId: string | null;
  importedAt: string | null;
};

export type ProjectConstitutionImportStatus = {
  contractVersion: typeof PROJECT_CONSTITUTION_IMPORT_CONTRACT_VERSION;
  source: 'ProjectConstitutionImportService';
  generatedAt: string;
  workspaceRoot: string;
  targetPath: string;
  targetExists: boolean;
  candidateSources: Array<{
    fileName: 'AGENTS.md' | 'CLAUDE.md';
    path: string;
    exists: boolean;
  }>;
  receipts: ProjectConstitutionImportReceipt[];
  importedSources: ProjectConstitutionImportedSourceSummary[];
  safety: {
    policyBypassAllowed: false;
    importsAreAdvisoryOnly: true;
    approvalRequiredForApply: true;
  };
};
