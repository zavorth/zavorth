export const ZAVORTH_TRAJECTORY_EXPORT_CONTRACT_VERSION =
  '2026-06-02.zavorth.trajectory-export.v1' as const;

export type ZavorthTrajectoryExportFormat = 'jsonl' | 'sharegpt' | 'alpaca';

export type ZavorthTrajectoryExportStatus =
  | 'empty'
  | 'preview'
  | 'approval-required'
  | 'exported';

export type ZavorthTrajectoryExportInput = {
  projectRoot?: string | null;
  format?: ZavorthTrajectoryExportFormat | null;
  limit?: number | null;
  exportPath?: string | null;
  approvalId?: string | null;
  includeReceipts?: boolean | null;
  includeMemory?: boolean | null;
  actorId?: string | null;
};

export type ZavorthTrajectoryExportRecord = {
  id: string;
  sourcePath: string;
  sourceKind: 'receipt' | 'memory' | 'event' | 'runtime' | 'unknown';
  instruction: string;
  input: string;
  output: string;
  tools: string[];
  approvals: string[];
  receipts: string[];
  metadata: Record<string, unknown>;
};

export type ZavorthTrajectoryExportReceipt = {
  id: string;
  kind: 'scan' | 'policy' | 'redaction' | 'write';
  status: 'done' | 'skipped' | 'approval-required' | 'blocked';
  summary: string;
  rawSecretSerialized: false;
};

export type ZavorthTrajectoryExportSnapshot = {
  contractVersion: typeof ZAVORTH_TRAJECTORY_EXPORT_CONTRACT_VERSION;
  generatedAt: string;
  source: 'ZavorthTrajectoryExportService';
  status: ZavorthTrajectoryExportStatus;
  format: ZavorthTrajectoryExportFormat;
  exportPath: string | null;
  summary: {
    scannedFiles: number;
    records: number;
    receipts: number;
    memoryRecords: number;
    approvals: number;
    tools: number;
  };
  records: ZavorthTrajectoryExportRecord[];
  receipts: ZavorthTrajectoryExportReceipt[];
  safety: {
    requiresApprovalForWrite: true;
    noRawSecretsSerialized: true;
    exportPathConfinedToProject: true;
    sourceContentRedacted: true;
  };
  commands: {
    preview: 'zavorth trajectory export --format jsonl';
    apply: 'zavorth trajectory export --format jsonl --export-path <path> --approval-id <id>';
    check: 'npm run zavorth:trajectory-export:check';
  };
};
