import type { LiveReadinessStatus } from './LiveReadinessContract.js';

export const ZAVORTH_FILE_DOCUMENT_DIFF_LIVE_PLANE_CONTRACT_VERSION = '2026-05-04.live-checkpoint-9' as const;

export type FileDocumentDiffLiveTargetId =
  | 'file-transfer'
  | 'document-extract'
  | 'diffs'
  | 'open-prose'
  | 'lobster';

export type FileDocumentDiffLiveCapability =
  | 'file.transfer'
  | 'document.extract'
  | 'artifact.diff';

export type FileDocumentDiffLiveMode =
  | 'import'
  | 'export'
  | 'copy'
  | 'move'
  | 'txt'
  | 'html'
  | 'pdf'
  | 'docx'
  | 'tables'
  | 'metadata'
  | 'file-diff'
  | 'artifact-diff'
  | 'inline-diff'
  | 'workflow-decision';

export type FileDocumentDiffLiveStatus =
  | 'file-transfer-live'
  | 'document-extract-live'
  | 'artifact-diff-live'
  | 'workflow-decision-live'
  | 'blocked';

export type FileDocumentDiffLiveAdapterFamily =
  | 'local-filesystem-transfer'
  | 'document-text-extractor'
  | 'artifact-diff-engine'
  | 'document-workflow-router';

export type FileDocumentDiffLiveGateKind =
  | 'filesystem-transfer-adapter'
  | 'workspace-write-policy'
  | 'document-extractor'
  | 'pdf-docx-baseline'
  | 'table-extraction'
  | 'artifact-diff'
  | 'prose-workflow-decision'
  | 'lobster-workflow-decision'
  | 'artifact-receipt'
  | 'configured-doctor'
  | 'mock-smoke'
  | 'staging-live-smoke'
  | 'redacted-receipt';

export type FileDocumentDiffLiveGateStatus =
  | 'passed'
  | 'partial'
  | 'missing'
  | 'blocked';

export type FileDocumentDiffLiveConfigSchema = {
  requiredEnv: string[];
  optionalEnv: string[];
  secretEnv: string[];
  artifactEnv: string[];
  secretValuesSerialized: false;
};

export type FileDocumentDiffLiveGate = {
  kind: FileDocumentDiffLiveGateKind;
  status: FileDocumentDiffLiveGateStatus;
  evidence: string;
  command: string | null;
};

export type FileDocumentDiffLiveReceipt = {
  id: string;
  targetId: FileDocumentDiffLiveTargetId;
  status: FileDocumentDiffLiveStatus;
  readinessStatus: Extract<LiveReadinessStatus, 'partial-live' | 'configured-only' | 'blocked'>;
  capabilities: FileDocumentDiffLiveCapability[];
  adapterFamily: FileDocumentDiffLiveAdapterFamily;
  modes: FileDocumentDiffLiveMode[];
  liveIoPerformed: false;
  stagingLiveRequiresExplicitCommand: true;
  artifactFirst: true;
  policyGatedWorkspaceWrites: true;
  secretValuesSerialized: false;
};

export type FileDocumentDiffLiveEntry = {
  targetId: FileDocumentDiffLiveTargetId;
  status: FileDocumentDiffLiveStatus;
  readinessStatus: Extract<LiveReadinessStatus, 'partial-live' | 'configured-only' | 'blocked'>;
  capabilities: FileDocumentDiffLiveCapability[];
  adapterFamily: FileDocumentDiffLiveAdapterFamily;
  modes: FileDocumentDiffLiveMode[];
  adapterTarget: string;
  serviceTargets: string[];
  configSchema: FileDocumentDiffLiveConfigSchema;
  gates: FileDocumentDiffLiveGate[];
  gaps: string[];
  doctorCommand: string;
  stagingLiveSmokeCommand: string;
  receipt: FileDocumentDiffLiveReceipt;
};

export type FileDocumentDiffLivePlaneSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_FILE_DOCUMENT_DIFF_LIVE_PLANE_CONTRACT_VERSION;
  phase: 'Certification matrix - File, Document, Diff And Prose Live Plane';
  status: 'closed' | 'attention' | 'blocked';
  summary: {
    targets: 5;
    fileTransferTargets: number;
    documentExtractTargets: number;
    artifactDiffTargets: number;
    workflowDecisionTargets: number;
    policyGatedWriteTargets: number;
    pdfDocxBaselineTargets: number;
    tableExtractionTargets: number;
    stagingLiveSmokeCommands: number;
    redactedReceipts: number;
    blocked: number;
    fileTransferMarkedLiveByPlanOnly: false;
    documentExtractMarkedLiveByDryPlaceholder: false;
    liveIoRequiredByStage9Check: false;
    secretValuesSerialized: false;
  };
  entries: FileDocumentDiffLiveEntry[];
  receipts: FileDocumentDiffLiveReceipt[];
  policy: {
    noLiveIoDuringStage9Check: true;
    workspaceWritesRequireExplicitApproval: true;
    documentExtractionArtifactsRequired: true;
    tableExtractionBaselineRequired: true;
    artifactDiffsRequired: true;
    proseWorkflowDecisionRequired: true;
    stagingLiveRequiresExplicitOperatorCommand: true;
    noSecretsSerialized: true;
  };
  commands: {
    check: 'npm run file-document-diff-live-plane:check --silent';
    doctor: 'npm run file-document-diff-live-plane -- --profile configured';
    stagingLiveSmoke: 'npm run file-document-diff-live-plane -- --profile staging-live --target <target> --confirm-live-io';
    focusedTests: string[];
    typecheck: 'npm run runtime:check --silent';
    nextStage: 'Intent model0 - Diagnostics, QA And Migration Live Plane';
  };
};
