import type { ZavorthTransactionApprovalLedgerEntry } from './ZavorthTransactionApprovalContract.js';
import type {
  ZavorthTransactionConnectorMode,
  ZavorthTransactionConnectorRunResult,
} from './ZavorthTransactionConnectorContract.js';
import type { ZavorthTransactionCredentialValidationResult } from './ZavorthTransactionCredentialContract.js';
import type {
  ZavorthTransactionIntentKind,
  ZavorthTransactionIntentTargetKind,
} from './ZavorthTransactionIntentContract.js';
import type { ZavorthTransactionActionKind } from './ZavorthTransactionPlaneContract.js';
import type { ZavorthTransactionPreview } from './ZavorthTransactionPreviewContract.js';

export const ZAVORTH_TRANSACTION_RUNTIME_CONTRACT_VERSION = 'zavorth-transaction-runtime/gate-6' as const;

export type ZavorthTransactionRuntimeStatus =
  | 'preview-ready'
  | 'approval-required'
  | 'credential-required'
  | 'simulated'
  | 'blocked'
  | 'needs-clarification';

export type ZavorthTransactionRuntimeStage =
  | 'intent'
  | 'preview'
  | 'approval-ledger'
  | 'credential-validation'
  | 'typed-connector';

export type ZavorthTransactionRuntimeRunInput = {
  text: string;
  /** Structured product kind — free text never activates transaction kinds. */
  kind?: ZavorthTransactionIntentKind;
  actionKind?: ZavorthTransactionActionKind;
  targetKind?: ZavorthTransactionIntentTargetKind;
  channel?: string;
  mode?: ZavorthTransactionConnectorMode;
  approve?: boolean;
  reject?: boolean;
  requireCredential?: boolean;
  credentialRef?: string | null;
  connectorId?: string;
};

export type ZavorthTransactionRuntimeStageReceipt = {
  phase: ZavorthTransactionRuntimeStage;
  status: string;
  receiptIds: string[];
};

export type ZavorthTransactionRuntimeRunResult = {
  version: typeof ZAVORTH_TRANSACTION_RUNTIME_CONTRACT_VERSION;
  id: string;
  createdAt: string;
  status: ZavorthTransactionRuntimeStatus;
  text: string;
  mode: ZavorthTransactionConnectorMode;
  preview: ZavorthTransactionPreview;
  previewEntry?: ZavorthTransactionApprovalLedgerEntry;
  approvalEntry?: ZavorthTransactionApprovalLedgerEntry;
  credentialValidation?: ZavorthTransactionCredentialValidationResult;
  connectorRun?: ZavorthTransactionConnectorRunResult;
  blockers: string[];
  warnings: string[];
  phaseReceipts: ZavorthTransactionRuntimeStageReceipt[];
  nextSteps: string[];
  externalSideEffects: false;
  liveActionApplied: false;
  liveExecutionAuthorized: false;
  executableNow: false;
};

export type ZavorthTransactionRuntimeContractSnapshot = {
  version: typeof ZAVORTH_TRANSACTION_RUNTIME_CONTRACT_VERSION;
  summary: string;
  statuses: ZavorthTransactionRuntimeStatus[];
  phases: ZavorthTransactionRuntimeStage[];
  invariants: string[];
};

export function buildZavorthTransactionRuntimeContractSnapshot(): ZavorthTransactionRuntimeContractSnapshot {
  return {
    version: ZAVORTH_TRANSACTION_RUNTIME_CONTRACT_VERSION,
    summary: 'End-to-end natural transaction runtime orchestrator for Zavorth Transaction Plane Runtime gateway.',
    statuses: [
      'preview-ready',
      'approval-required',
      'credential-required',
      'simulated',
      'blocked',
      'needs-clarification',
    ],
    phases: ['intent', 'preview', 'approval-ledger', 'credential-validation', 'typed-connector'],
    invariants: [
      'Runtime gateway orchestrates existing transaction phases but does not introduce live execution.',
      'Every runtime result exposes preview, approval, credential and connector artifacts when they exist.',
      'Real-money connector dry-runs require approval before typed connector dry-run.',
      'Credential refs are validated before they are passed to connector payloads.',
      'The runtime never serializes raw credential values.',
      'Every runtime result reports externalSideEffects=false, liveActionApplied=false and executableNow=false.',
    ],
  };
}
