import type {
  ZavorthTransactionSandboxControlledExecutorInput,
  ZavorthTransactionSandboxControlledExecutorResult,
} from './ZavorthTransactionSandboxControlledExecutorContract.js';

export const ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_CONTRACT_VERSION =
  'zavorth-transaction-live-micro-rollout-certification/phase-14-15' as const;

export const ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_OWNER_PHRASE =
  'ZAVORTH MICRO ROLLOUT CERTIFICATION ONLY' as const;

export type ZavorthTransactionLiveMicroRolloutCertificationStatus =
  | 'sandbox-execution-required'
  | 'micro-rollout-owner-review-required'
  | 'micro-rollout-policy-blocked'
  | 'certification-failed'
  | 'micro-rollout-certified';

export type ZavorthTransactionLiveMicroRolloutStageKind =
  | 'observe-only'
  | 'preview-only'
  | 'sandbox-certified'
  | 'paper-trading'
  | 'micro-transaction-hold'
  | 'daily-limit-hold'
  | 'mandate-limit-hold'
  | 'controlled-production-hold';

export type ZavorthTransactionLiveMicroRolloutStage = {
  order: number;
  kind: ZavorthTransactionLiveMicroRolloutStageKind;
  status: 'certified' | 'hold';
  maxAmount?: number;
  liveExternalIoPerformed: false;
  liveActionApplied: false;
  summary: string;
};

export type ZavorthTransactionLiveMicroRolloutCertificationScenarioId =
  | 'prompt-injection-without-approval'
  | 'token-leak'
  | 'approval-replay'
  | 'expired-mandate'
  | 'connector-down'
  | 'price-drift'
  | 'wrong-user-approval'
  | 'duplicate-execution'
  | 'missing-rollback'
  | 'incomplete-ledger';

export type ZavorthTransactionLiveMicroRolloutCertificationScenario = {
  id: ZavorthTransactionLiveMicroRolloutCertificationScenarioId;
  label: string;
  passed: boolean;
  expected: string;
  observed: string;
  remediation: string;
};

export type ZavorthTransactionLiveMicroRolloutCertificationGateKind =
  | 'phase13-sandbox-executed'
  | 'sandbox-execution-receipt-present'
  | 'owner-micro-rollout-review'
  | 'rollout-ladder-defined'
  | 'micro-amount-limit-ready'
  | 'daily-limit-ready'
  | 'execution-count-limit-ready'
  | 'kill-switch-linked'
  | 'rollback-linked'
  | 'connector-certified'
  | 'certification-suite-passed'
  | 'live-execution-still-disabled'
  | 'raw-secret-redaction';

export type ZavorthTransactionLiveMicroRolloutCertificationGate = {
  kind: ZavorthTransactionLiveMicroRolloutCertificationGateKind;
  passed: boolean;
  summary: string;
  evidence: string[];
};

export type ZavorthTransactionLiveMicroRolloutLimits = {
  maxMicroAmount: number | null;
  maxDailyAmount: number | null;
  maxExecutionsPerDay: number | null;
  requiredObservationHours: number;
  allowedConnectorIds: string[];
  allowedTargetLabels: string[];
  currency: string | null;
};

export type ZavorthTransactionLiveMicroRolloutOwnerReview = {
  ownerId: string;
  rolloutReviewId: string;
  confirmed: boolean;
  requiredPhrase: typeof ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_OWNER_PHRASE;
  phraseAccepted: boolean;
  confirmationRecordedAt?: string;
  reviewDigest: string;
};

export type ZavorthTransactionLiveMicroRolloutCertificationPacket = {
  id: string;
  createdAt: string;
  sourceSandboxExecutorResultId: string;
  sourceSandboxExecutionReceiptId: string;
  sourceCertificationPacketId: string;
  sourceReviewPacketId: string;
  sourceCandidateEnvelopeId: string;
  ownerRolloutReviewId: string;
  rolloutPlanDigest: string;
  certificationDigest: string;
  connectorId: string;
  adapterId: string;
  targetLabel: string;
  currency?: string;
  limits: ZavorthTransactionLiveMicroRolloutLimits;
  stages: ZavorthTransactionLiveMicroRolloutStage[];
  scenarios: ZavorthTransactionLiveMicroRolloutCertificationScenario[];
  certifiedForFutureLiveMicroRollout: true;
  certificationOnly: true;
  liveMicroRolloutAuthorized: false;
  liveExecutionAuthorized: false;
  executableNow: false;
  liveActionApplied: false;
  externalSideEffects: false;
  rawSecretPresent: false;
  conditions: string[];
};

export type ZavorthTransactionLiveMicroRolloutCertificationSafety = {
  certificationOnly: true;
  futureMicroRolloutOnly: true;
  noLiveExecution: true;
  noHiddenLiveAction: true;
  noRawSecretSerialized: true;
  externalSideEffects: false;
  liveMicroRolloutAuthorized: false;
  liveExecutionAuthorized: false;
  executableNow: false;
  liveActionApplied: false;
  rollbackRequiredBeforeLive: true;
  aggressiveCertificationRequired: true;
};

export type ZavorthTransactionLiveMicroRolloutCertificationInput =
  ZavorthTransactionSandboxControlledExecutorInput & {
    microRolloutReviewConfirmed?: boolean;
    microRolloutReviewIntent?: string | null;
    microRolloutReviewId?: string | null;
    useSafeMicroRolloutControls?: boolean;
    rolloutLimits?: {
      maxMicroAmount?: number | null;
      maxDailyAmount?: number | null;
      maxExecutionsPerDay?: number | null;
      requiredObservationHours?: number | null;
      allowedConnectorIds?: string[] | null;
      allowedTargetLabels?: string[] | null;
      currency?: string | null;
    } | null;
    failCertificationScenario?: ZavorthTransactionLiveMicroRolloutCertificationScenarioId | null;
  };

export type ZavorthTransactionLiveMicroRolloutCertificationResult = {
  version: typeof ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_CONTRACT_VERSION;
  id: string;
  createdAt: string;
  status: ZavorthTransactionLiveMicroRolloutCertificationStatus;
  summary: string;
  ownerReview: ZavorthTransactionLiveMicroRolloutOwnerReview;
  rolloutLimits: ZavorthTransactionLiveMicroRolloutLimits;
  rolloutStages: ZavorthTransactionLiveMicroRolloutStage[];
  scenarios: ZavorthTransactionLiveMicroRolloutCertificationScenario[];
  sourceSandboxExecution: ZavorthTransactionSandboxControlledExecutorResult;
  gates: ZavorthTransactionLiveMicroRolloutCertificationGate[];
  certificationPacket?: ZavorthTransactionLiveMicroRolloutCertificationPacket;
  blockers: string[];
  nextSteps: string[];
  safety: ZavorthTransactionLiveMicroRolloutCertificationSafety;
};

export type ZavorthTransactionLiveMicroRolloutCertificationContractSnapshot = {
  version: typeof ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_CONTRACT_VERSION;
  summary: string;
  ownerPhrase: typeof ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_OWNER_PHRASE;
  statuses: ZavorthTransactionLiveMicroRolloutCertificationStatus[];
  stages: ZavorthTransactionLiveMicroRolloutStageKind[];
  scenarios: ZavorthTransactionLiveMicroRolloutCertificationScenarioId[];
  gateKinds: ZavorthTransactionLiveMicroRolloutCertificationGateKind[];
  invariants: string[];
};

export function buildZavorthTransactionLiveMicroRolloutCertificationContractSnapshot(): ZavorthTransactionLiveMicroRolloutCertificationContractSnapshot {
  return {
    version: ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_CONTRACT_VERSION,
    summary: 'Combined live micro-rollout and aggressive certification contract for Zavorth Transaction Plane Phase 14-15.',
    ownerPhrase: ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_OWNER_PHRASE,
    statuses: [
      'sandbox-execution-required',
      'micro-rollout-owner-review-required',
      'micro-rollout-policy-blocked',
      'certification-failed',
      'micro-rollout-certified',
    ],
    stages: [
      'observe-only',
      'preview-only',
      'sandbox-certified',
      'paper-trading',
      'micro-transaction-hold',
      'daily-limit-hold',
      'mandate-limit-hold',
      'controlled-production-hold',
    ],
    scenarios: [
      'prompt-injection-without-approval',
      'token-leak',
      'approval-replay',
      'expired-mandate',
      'connector-down',
      'price-drift',
      'wrong-user-approval',
      'duplicate-execution',
      'missing-rollback',
      'incomplete-ledger',
    ],
    gateKinds: [
      'phase13-sandbox-executed',
      'sandbox-execution-receipt-present',
      'owner-micro-rollout-review',
      'rollout-ladder-defined',
      'micro-amount-limit-ready',
      'daily-limit-ready',
      'execution-count-limit-ready',
      'kill-switch-linked',
      'rollback-linked',
      'connector-certified',
      'certification-suite-passed',
      'live-execution-still-disabled',
      'raw-secret-redaction',
    ],
    invariants: [
      'Phase 14-15 consumes a Phase 13 sandbox-executed receipt before any micro-rollout certification packet can be emitted.',
      'Phase 14-15 defines a live micro-rollout ladder but does not execute a live microtransaction.',
      'Micro-rollout certification requires a dedicated owner phrase separate from earlier transaction phrases.',
      'The aggressive certification suite must prove injection, token leak, replay, expired mandate, connector outage, price drift, wrong user, duplicate execution, missing rollback and incomplete ledger are blocked.',
      'A micro-rollout-certified packet still reports liveMicroRolloutAuthorized=false, liveExecutionAuthorized=false and liveActionApplied=false.',
      'Raw transaction secrets must never be serialized by the certification packet.',
    ],
  };
}
