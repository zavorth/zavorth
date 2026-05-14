import type {
  ZavorthTransactionActionKind,
} from './ZavorthTransactionPlaneContract.js';
import type {
  ZavorthTransactionConnectorKind,
} from './ZavorthTransactionPreviewContract.js';
import type {
  ZavorthTransactionSandboxAdapterCertificationInput,
  ZavorthTransactionSandboxAdapterCertificationResult,
} from './ZavorthTransactionSandboxAdapterCertificationContract.js';

export const ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_CONTRACT_VERSION =
  'zavorth-transaction-sandbox-controlled-executor/phase-13' as const;

export const ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_OWNER_PHRASE =
  'ZAVORTH CONTROLLED SANDBOX EXECUTION ONLY' as const;

export type ZavorthTransactionSandboxControlledExecutorStatus =
  | 'certification-required'
  | 'sandbox-operator-approval-required'
  | 'sandbox-execution-blocked'
  | 'sandbox-executed';

export type ZavorthTransactionSandboxControlledExecutorGateKind =
  | 'phase12-certification-ready'
  | 'certification-packet-present'
  | 'sandbox-operator-confirmation'
  | 'local-sandbox-only'
  | 'endpoint-not-called'
  | 'amount-within-certified-limits'
  | 'credential-ref-bound'
  | 'idempotency-ready'
  | 'kill-switch-ready'
  | 'rollback-ready'
  | 'sandbox-not-aborted'
  | 'sandbox-simulation-succeeds'
  | 'execution-receipt-ready'
  | 'live-still-disabled'
  | 'raw-secret-redaction';

export type ZavorthTransactionSandboxControlledExecutorGate = {
  kind: ZavorthTransactionSandboxControlledExecutorGateKind;
  passed: boolean;
  summary: string;
  evidence: string[];
};

export type ZavorthTransactionSandboxControlledExecutorOperatorGate = {
  ownerId: string;
  sandboxRunId: string;
  confirmed: boolean;
  requiredPhrase: typeof ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_OWNER_PHRASE;
  phraseAccepted: boolean;
  confirmationRecordedAt?: string;
  operatorDigest: string;
};

export type ZavorthTransactionSandboxExecutionReceipt = {
  id: string;
  createdAt: string;
  sandboxRunId: string;
  sourceCertificationResultId: string;
  sourceCertificationPacketId: string;
  sourceReviewPacketId: string;
  sourceCandidateEnvelopeId: string;
  adapterId: string;
  connectorId: string;
  connectorKind: ZavorthTransactionConnectorKind;
  actionKind: ZavorthTransactionActionKind;
  targetLabel: string;
  amount?: number;
  currency?: string;
  endpointHost: string;
  method: string;
  credentialRef: string;
  idempotencyHeader: string;
  idempotencyKey: string;
  killSwitchId: string;
  rollbackDrillId: string;
  resultStatus: 'accepted';
  localSandboxLedgerRecorded: true;
  localSandboxSimulationPerformed: true;
  sandboxExecutionAuthorized: true;
  sandboxExternalIoPerformed: false;
  liveExecutionAuthorized: false;
  executableNow: false;
  liveActionApplied: false;
  externalSideEffects: false;
  rollbackAvailable: true;
  redacted: true;
  rawSecretPresent: false;
  receiptDigest: string;
  conditions: string[];
};

export type ZavorthTransactionSandboxControlledExecutorSafety = {
  controlledSandboxOnly: true;
  localSandboxSimulationOnly: true;
  noExternalNetworkCall: true;
  noLiveExecution: true;
  noHiddenLiveAction: true;
  noRawSecretSerialized: true;
  externalSideEffects: false;
  sandboxExternalIoPerformed: false;
  liveExecutionAuthorized: false;
  executableNow: false;
  liveActionApplied: false;
  separateLiveExecutorRequired: true;
};

export type ZavorthTransactionSandboxControlledExecutorInput =
  ZavorthTransactionSandboxAdapterCertificationInput & {
    sandboxExecutionConfirmed?: boolean;
    sandboxExecutionIntent?: string | null;
    sandboxRunId?: string | null;
    forceKillSwitch?: boolean;
    simulateSandboxFailure?: boolean;
  };

export type ZavorthTransactionSandboxControlledExecutorResult = {
  version: typeof ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_CONTRACT_VERSION;
  id: string;
  createdAt: string;
  status: ZavorthTransactionSandboxControlledExecutorStatus;
  summary: string;
  operatorGate: ZavorthTransactionSandboxControlledExecutorOperatorGate;
  sourceCertification: ZavorthTransactionSandboxAdapterCertificationResult;
  gates: ZavorthTransactionSandboxControlledExecutorGate[];
  executionReceipt?: ZavorthTransactionSandboxExecutionReceipt;
  blockers: string[];
  nextSteps: string[];
  safety: ZavorthTransactionSandboxControlledExecutorSafety;
};

export type ZavorthTransactionSandboxControlledExecutorContractSnapshot = {
  version: typeof ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_CONTRACT_VERSION;
  summary: string;
  ownerPhrase: typeof ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_OWNER_PHRASE;
  statuses: ZavorthTransactionSandboxControlledExecutorStatus[];
  gateKinds: ZavorthTransactionSandboxControlledExecutorGateKind[];
  invariants: string[];
};

export function buildZavorthTransactionSandboxControlledExecutorContractSnapshot(): ZavorthTransactionSandboxControlledExecutorContractSnapshot {
  return {
    version: ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_CONTRACT_VERSION,
    summary: 'Controlled local sandbox executor contract for Zavorth Transaction Plane Phase 13.',
    ownerPhrase: ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_OWNER_PHRASE,
    statuses: [
      'certification-required',
      'sandbox-operator-approval-required',
      'sandbox-execution-blocked',
      'sandbox-executed',
    ],
    gateKinds: [
      'phase12-certification-ready',
      'certification-packet-present',
      'sandbox-operator-confirmation',
      'local-sandbox-only',
      'endpoint-not-called',
      'amount-within-certified-limits',
      'credential-ref-bound',
      'idempotency-ready',
      'kill-switch-ready',
      'rollback-ready',
      'sandbox-not-aborted',
      'sandbox-simulation-succeeds',
      'execution-receipt-ready',
      'live-still-disabled',
      'raw-secret-redaction',
    ],
    invariants: [
      'Phase 13 consumes a Phase 12 sandbox-certification-ready packet before any sandbox execution receipt can be emitted.',
      'Phase 13 performs only a deterministic local sandbox simulation and never calls external sandbox or live endpoints.',
      'Sandbox execution requires a dedicated owner phrase separate from Phase 10 and Phase 11 phrases.',
      'Sandbox execution receipts may report sandboxExecutionAuthorized=true for the local simulation only.',
      'Every Phase 13 result keeps sandboxExternalIoPerformed=false, externalSideEffects=false, liveExecutionAuthorized=false and liveActionApplied=false.',
      'Kill switch and rollback drill receipts from earlier phases must remain linked.',
      'Raw transaction secrets must never be serialized by the execution receipt.',
    ],
  };
}
