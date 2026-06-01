export const DISK_MUTATION_GATE_CONTRACT_VERSION = 'zavorth-disk-mutation-gate/v1' as const;

export type DiskMutationGateOperationKind = 'write_file' | 'append_file' | 'delete_file' | 'mkdir';

export type DiskMutationGateFindingSeverity = 'info' | 'warning' | 'blocked';

export type DiskMutationGateFinding = {
  id: string;
  severity: DiskMutationGateFindingSeverity;
  path: string | null;
  message: string;
};

export type DiskMutationGateRequestedOperation = {
  kind: DiskMutationGateOperationKind;
  path: string;
  content?: string | null;
  encoding?: 'utf8';
  reason?: string | null;
};

export type DiskMutationGateOperationPreview = {
  id: string;
  kind: DiskMutationGateOperationKind;
  requestedPath: string;
  absolutePath: string;
  relativePath: string;
  status: 'preview_ready' | 'blocked' | 'noop';
  before: {
    exists: boolean;
    kind: 'file' | 'directory' | 'symlink' | 'missing' | 'other';
    sha256: string | null;
    bytes: number;
  };
  after: {
    exists: boolean;
    kind: 'file' | 'directory' | 'missing';
    sha256: string | null;
    bytes: number;
  };
  diffPatch: string | null;
  findings: DiskMutationGateFinding[];
  reason: string | null;
};

export type DiskMutationGatePreview = {
  contractVersion: typeof DISK_MUTATION_GATE_CONTRACT_VERSION;
  source: 'DiskMutationGateService';
  previewId: string;
  mutationPlanId: string;
  generatedAt: string;
  status: 'preview_ready' | 'blocked' | 'noop';
  workspaceRoot: string;
  requestedBy: string | null;
  sourceSurface: string | null;
  operations: DiskMutationGateOperationPreview[];
  findings: DiskMutationGateFinding[];
  approval: {
    required: true;
    phrase: string;
    reason: string;
  };
  safety: {
    rawInstructionsExecuted: false;
    rawSecretsSerialized: false;
    policyBypassAllowed: false;
    previewBeforeApply: true;
    receiptRequired: true;
    outsideWorkspaceBlocked: true;
  };
  receiptPath: string;
  summary: string;
};

export type DiskMutationGateReceiptOperation = {
  id: string;
  kind: DiskMutationGateOperationKind;
  absolutePath: string;
  relativePath: string;
  beforeSha256: string | null;
  afterSha256: string | null;
  bytesBefore: number;
  bytesAfter: number;
  status: 'applied' | 'noop';
};

export type DiskMutationGateReceipt = {
  contractVersion: typeof DISK_MUTATION_GATE_CONTRACT_VERSION;
  receiptId: string;
  previewId: string;
  mutationPlanId: string;
  generatedAt: string;
  appliedAt: string;
  approvedBy: string;
  workspaceRoot: string;
  operations: DiskMutationGateReceiptOperation[];
  findings: DiskMutationGateFinding[];
  safety: DiskMutationGatePreview['safety'];
  rollback: {
    available: false;
    reason: string;
  };
  summary: string;
};

export type DiskMutationGateApplyResult = {
  ok: boolean;
  status: 'applied' | 'noop';
  preview: DiskMutationGatePreview;
  receipt: DiskMutationGateReceipt;
};

export type DiskMutationGateStatus = {
  contractVersion: typeof DISK_MUTATION_GATE_CONTRACT_VERSION;
  source: 'DiskMutationGateService';
  generatedAt: string;
  workspaceRoot: string;
  receiptPath: string;
  receiptCount: number;
  receipts: DiskMutationGateReceipt[];
  safety: DiskMutationGatePreview['safety'];
};
