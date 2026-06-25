import type {
  ZavorthTransactionConnectorKind,
  ZavorthTransactionPreview,
  ZavorthTransactionPreviewStatus,
} from './ZavorthTransactionPreviewContract.js';
import type {
  ZavorthTransactionActionKind,
  ZavorthTransactionApprovalStatus,
  ZavorthTransactionDecisionStatus,
  ZavorthTransactionRiskLevel,
} from './ZavorthTransactionPlaneContract.js';

export const ZAVORTH_TRANSACTION_APPROVAL_CONTRACT_VERSION = 'zavorth-transaction-approval/checkpoint-3' as const;

export type ZavorthTransactionApprovalDecision = 'approved' | 'rejected';

export type ZavorthTransactionApprovalLedgerEntryKind =
  | 'preview-recorded'
  | 'approval-granted'
  | 'approval-rejected'
  | 'approval-blocked';

export type ZavorthTransactionApprovalActor = 'owner' | 'operator' | 'system';

export type ZavorthTransactionApprovalSignatureSource =
  | 'env'
  | 'local-file'
  | 'injected-test-key';

export type ZavorthTransactionApprovalQuoteSnapshot = {
  amount?: number;
  currency?: string;
  quoteStatus: string;
  feeStatus: string;
};

export type ZavorthTransactionApprovalLedgerEntry = {
  version: typeof ZAVORTH_TRANSACTION_APPROVAL_CONTRACT_VERSION;
  id: string;
  createdAt: string;
  kind: ZavorthTransactionApprovalLedgerEntryKind;
  previewId: string;
  approvalId?: string;
  actor: ZavorthTransactionApprovalActor;
  decision?: ZavorthTransactionApprovalDecision;
  approvalStatus: ZavorthTransactionApprovalStatus;
  reason: string;
  previewStatus: ZavorthTransactionPreviewStatus;
  actionKind: ZavorthTransactionActionKind;
  targetLabel: string;
  targetKind: string;
  riskLevel: ZavorthTransactionRiskLevel;
  connectorKind: ZavorthTransactionConnectorKind;
  quote: ZavorthTransactionApprovalQuoteSnapshot;
  policyStatus: ZavorthTransactionDecisionStatus;
  policyBlockers: string[];
  liveActionApplied: false;
  executableNow: false;
  liveExecutionAuthorized: false;
  previousEntryDigest?: string;
  payloadDigest: string;
  signature: string;
  signatureSource: ZavorthTransactionApprovalSignatureSource;
  receipts: string[];
};

export type ZavorthTransactionApprovalDecisionInput = {
  preview: ZavorthTransactionPreview;
  decision: ZavorthTransactionApprovalDecision;
  actor?: ZavorthTransactionApprovalActor;
  reason?: string;
};

export type ZavorthTransactionApprovalLedgerSummary = {
  version: typeof ZAVORTH_TRANSACTION_APPROVAL_CONTRACT_VERSION;
  ledgerFile: string;
  entries: number;
  previewsRecorded: number;
  approvalsGranted: number;
  approvalsRejected: number;
  approvalsBlocked: number;
  liveActionsApplied: 0;
  executableEntries: 0;
  latestEntryId: string | null;
  latestEntryDigest: string | null;
};

export type ZavorthTransactionApprovalContractSnapshot = {
  version: typeof ZAVORTH_TRANSACTION_APPROVAL_CONTRACT_VERSION;
  summary: string;
  ledgerEntryKinds: ZavorthTransactionApprovalLedgerEntryKind[];
  decisions: ZavorthTransactionApprovalDecision[];
  invariants: string[];
};

export function buildZavorthTransactionApprovalContractSnapshot(): ZavorthTransactionApprovalContractSnapshot {
  return {
    version: ZAVORTH_TRANSACTION_APPROVAL_CONTRACT_VERSION,
    summary: 'Signed approval ledger contract for Zavorth Transaction Plane Approval gate.',
    ledgerEntryKinds: ['preview-recorded', 'approval-granted', 'approval-rejected', 'approval-blocked'],
    decisions: ['approved', 'rejected'],
    invariants: [
      'Approval ledger entries are append-only JSONL records.',
      'Approving a preview in Approval gate does not execute a transaction.',
      'Approved previews still report liveExecutionAuthorized=false until a later connector execution phase.',
      'Blocked or clarification-needed previews cannot become approval-granted.',
      'Every entry includes payload digest, signature and previous-entry digest for auditability.',
      'Raw secrets must never appear in approval ledger entries.',
    ],
  };
}
