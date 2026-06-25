import type {
  ZavorthTransactionLiveMicroRolloutCertificationInput,
  ZavorthTransactionLiveMicroRolloutCertificationResult,
} from './ZavorthTransactionLiveMicroRolloutCertificationContract.js';
import type { ZavorthTransactionActionKind } from './ZavorthTransactionPlaneContract.js';
import type { ZavorthTransactionConnectorKind } from './ZavorthTransactionPreviewContract.js';

export const ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_CONTRACT_VERSION =
  'zavorth-transaction-live-executor-gate/checkpoint-16' as const;

export const ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_OWNER_PHRASE =
  'ZAVORTH LIVE EXECUTOR READY HOLD' as const;

export type ZavorthTransactionLiveExecutorGateStatus =
  | 'micro-rollout-certification-required'
  | 'live-operator-confirmation-required'
  | 'live-adapter-required'
  | 'live-policy-blocked'
  | 'live-ready-held';

export type ZavorthTransactionLiveExecutorGateKind =
  | 'intent-model4-15-micro-rollout-certified'
  | 'micro-rollout-packet-present'
  | 'live-operator-confirmation'
  | 'live-adapter-manifest-present'
  | 'live-environment-declared'
  | 'adapter-connector-matches-certification'
  | 'credential-ref-bound'
  | 'endpoint-allowlist-ready'
  | 'idempotency-ready'
  | 'amount-within-micro-limit'
  | 'daily-limit-preserved'
  | 'kill-switch-linked'
  | 'rollback-linked'
  | 'price-recheck-required'
  | 'balance-check-required'
  | 'receipt-fetch-required'
  | 'circuit-breaker-ready'
  | 'live-execution-held'
  | 'raw-secret-redaction';

export type ZavorthTransactionLiveExecutorGate = {
  kind: ZavorthTransactionLiveExecutorGateKind;
  passed: boolean;
  summary: string;
  evidence: string[];
};

export type ZavorthTransactionLiveExecutorAdapterManifest = {
  id: string;
  connectorId: string;
  connectorKind: ZavorthTransactionConnectorKind;
  actionKind: ZavorthTransactionActionKind;
  displayName: string;
  environment: 'live';
  endpointBaseUrl: string;
  allowedHosts: string[];
  credentialRef: string;
  idempotencyHeader: string;
  maximumLiveAmount: number | null;
  maxRequestsPerMinute: number | null;
  timeoutMs: number | null;
  circuitBreaker: boolean;
  supportsIdempotency: boolean;
  supportsBalanceCheck: boolean;
  supportsPriceRecheck: boolean;
  supportsReceiptFetch: boolean;
  killSwitchId: string;
  rollbackDrillId: string;
  rollbackCommand: string;
  healthCheckCommand: string;
  liveSmokeCommand: string;
  rawSecretsAccepted: false;
  redacted: true;
};

export type ZavorthTransactionLiveExecutorAdapterManifestInput =
  Partial<Omit<ZavorthTransactionLiveExecutorAdapterManifest, 'environment' | 'rawSecretsAccepted' | 'redacted'>> & {
    environment?: 'live' | 'production' | 'sandbox' | 'paper' | string;
    connectorKind?: ZavorthTransactionConnectorKind | string;
    actionKind?: ZavorthTransactionActionKind | string;
    rawSecretsAccepted?: boolean | null;
  };

export type ZavorthTransactionLiveExecutorOperatorGate = {
  ownerId: string;
  liveRunId: string;
  confirmed: boolean;
  requiredPhrase: typeof ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_OWNER_PHRASE;
  phraseAccepted: boolean;
  confirmationRecordedAt?: string;
  operatorDigest: string;
};

export type ZavorthTransactionLiveExecutorReadinessPacket = {
  id: string;
  createdAt: string;
  sourceMicroRolloutResultId: string;
  sourceMicroRolloutPacketId: string;
  sourceSandboxExecutionReceiptId: string;
  sourceCertificationPacketId: string;
  sourceReviewPacketId: string;
  sourceCandidateEnvelopeId: string;
  liveRunId: string;
  operatorOwnerId: string;
  adapterManifestDigest: string;
  connectorId: string;
  connectorKind: ZavorthTransactionConnectorKind;
  actionKind: ZavorthTransactionActionKind;
  adapterId: string;
  endpointHost: string;
  targetLabel: string;
  maximumLiveAmount: number | null;
  currency?: string;
  idempotencyHeader: string;
  idempotencyKey: string;
  credentialRef: string;
  killSwitchId: string;
  rollbackDrillId: string;
  liveExecutorReady: true;
  readyForExternalAdapterBinding: true;
  executionHeld: true;
  liveExecutionAuthorized: false;
  executableNow: false;
  liveActionApplied: false;
  externalSideEffects: false;
  rawSecretPresent: false;
  receiptDigest: string;
  conditions: string[];
};

export type ZavorthTransactionLiveExecutorGateSafety = {
  liveExecutorGateReady: boolean;
  noBundledFinancialAdapter: true;
  noLiveExecution: true;
  noHiddenLiveAction: true;
  noRawSecretSerialized: true;
  externalSideEffects: false;
  liveExecutionAuthorized: false;
  executableNow: false;
  liveActionApplied: false;
  externalAdapterBindingRequired: true;
  ownerPhraseRequired: true;
  killSwitchRequired: true;
  rollbackRequired: true;
};

export type ZavorthTransactionLiveExecutorGateInput =
  ZavorthTransactionLiveMicroRolloutCertificationInput & {
    liveOperatorConfirmed?: boolean;
    liveOperatorIntent?: string | null;
    liveRunId?: string | null;
    executeLive?: boolean;
    useSafeLiveAdapterControls?: boolean;
    liveAdapterManifest?: ZavorthTransactionLiveExecutorAdapterManifestInput | null;
  };

export type ZavorthTransactionLiveExecutorGateResult = {
  version: typeof ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_CONTRACT_VERSION;
  id: string;
  createdAt: string;
  status: ZavorthTransactionLiveExecutorGateStatus;
  summary: string;
  operatorGate: ZavorthTransactionLiveExecutorOperatorGate;
  sourceMicroRolloutCertification: ZavorthTransactionLiveMicroRolloutCertificationResult;
  liveAdapterManifest: ZavorthTransactionLiveExecutorAdapterManifest | null;
  gates: ZavorthTransactionLiveExecutorGate[];
  readinessPacket?: ZavorthTransactionLiveExecutorReadinessPacket;
  blockers: string[];
  nextSteps: string[];
  safety: ZavorthTransactionLiveExecutorGateSafety;
};

export type ZavorthTransactionLiveExecutorGateContractSnapshot = {
  version: typeof ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_CONTRACT_VERSION;
  summary: string;
  ownerPhrase: typeof ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_OWNER_PHRASE;
  statuses: ZavorthTransactionLiveExecutorGateStatus[];
  gateKinds: ZavorthTransactionLiveExecutorGateKind[];
  invariants: string[];
};

export function buildZavorthTransactionLiveExecutorGateContractSnapshot(): ZavorthTransactionLiveExecutorGateContractSnapshot {
  return {
    version: ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_CONTRACT_VERSION,
    summary: 'Live executor readiness gate for Zavorth Transaction Plane Intent model6.',
    ownerPhrase: ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_OWNER_PHRASE,
    statuses: [
      'micro-rollout-certification-required',
      'live-operator-confirmation-required',
      'live-adapter-required',
      'live-policy-blocked',
      'live-ready-held',
    ],
    gateKinds: [
      'intent-model4-15-micro-rollout-certified',
      'micro-rollout-packet-present',
      'live-operator-confirmation',
      'live-adapter-manifest-present',
      'live-environment-declared',
      'adapter-connector-matches-certification',
      'credential-ref-bound',
      'endpoint-allowlist-ready',
      'idempotency-ready',
      'amount-within-micro-limit',
      'daily-limit-preserved',
      'kill-switch-linked',
      'rollback-linked',
      'price-recheck-required',
      'balance-check-required',
      'receipt-fetch-required',
      'circuit-breaker-ready',
      'live-execution-held',
      'raw-secret-redaction',
    ],
    invariants: [
      'Intent model6 consumes a Intent model4-15 micro-rollout-certified packet before any live executor readiness packet can be emitted.',
      'Intent model6 ships no bundled financial adapter and performs no live execution by default.',
      'A dedicated live executor owner phrase is required after the micro-rollout certification phrase.',
      'A live-ready-held packet means the system is prepared for external adapter binding, not that money has moved.',
      'executeLive=true is deliberately policy-blocked in this readiness gate.',
      'Every Intent model6 result keeps liveExecutionAuthorized=false, executableNow=false, liveActionApplied=false and externalSideEffects=false.',
      'Raw transaction secrets must never be serialized by the readiness packet.',
    ],
  };
}
