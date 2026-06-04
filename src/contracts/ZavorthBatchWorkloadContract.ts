export const ZAVORTH_BATCH_WORKLOAD_CONTRACT_VERSION =
  '2026-06-02.zavorth.batch-workload.v1' as const;

export type ZavorthBatchWorkloadStatus =
  | 'empty'
  | 'preview'
  | 'approval-required'
  | 'completed'
  | 'failed';

export type ZavorthBatchWorkloadItemStatus =
  | 'queued'
  | 'completed'
  | 'failed'
  | 'skipped';

export type ZavorthBatchWorkloadInput = {
  projectRoot?: string | null;
  objective?: string | null;
  items?: string[] | null;
  live?: boolean | null;
  approvalId?: string | null;
  maxItems?: number | null;
  concurrency?: number | null;
  outputPath?: string | null;
  actorId?: string | null;
};

export type ZavorthBatchWorkloadItem = {
  id: string;
  index: number;
  prompt: string;
  status: ZavorthBatchWorkloadItemStatus;
  output: string | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

export type ZavorthBatchWorkloadReceipt = {
  id: string;
  kind: 'policy' | 'plan' | 'execution' | 'write' | 'redaction';
  status: 'done' | 'skipped' | 'approval-required' | 'failed';
  summary: string;
  rawSecretSerialized: false;
};

export type ZavorthBatchWorkloadSnapshot = {
  contractVersion: typeof ZAVORTH_BATCH_WORKLOAD_CONTRACT_VERSION;
  generatedAt: string;
  source: 'ZavorthBatchWorkloadService';
  status: ZavorthBatchWorkloadStatus;
  runId: string;
  objective: string;
  plan: {
    live: boolean;
    willExecute: boolean;
    maxItems: number;
    concurrency: number;
    outputPath: string | null;
    approvalRequired: boolean;
  };
  summary: {
    items: number;
    completed: number;
    failed: number;
    skipped: number;
  };
  items: ZavorthBatchWorkloadItem[];
  receipts: ZavorthBatchWorkloadReceipt[];
  safety: {
    liveRequiresApproval: true;
    noShellExecution: true;
    noNetworkByDefault: true;
    outputsRedacted: true;
    receiptsRequired: true;
  };
  commands: {
    preview: 'zavorth batch workload --objective "<goal>"';
    run: 'zavorth batch workload --live --approval-id <id>';
    check: 'npm run zavorth:batch-workload:check';
  };
};
