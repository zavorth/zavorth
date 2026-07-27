import type {
  ZavorthTransactionLiveCandidateEnvelope,
  ZavorthTransactionLiveCandidateResult,
} from './ZavorthTransactionLiveCandidateContract.js';
import type { ZavorthTransactionSurfaceKind } from './ZavorthTransactionSurfaceContract.js';

export const ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_CONTRACT_VERSION =
  'zavorth-transaction-live-activation-review/gate-11' as const;

export const ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_OWNER_PHRASE = 'ZAVORTH LIVE ACTIVATION REVIEW ONLY' as const;

export type ZavorthTransactionLiveActivationReviewStatus =
  | 'candidate-required'
  | 'owner-review-required'
  | 'rollback-drill-required'
  | 'activation-policy-blocked'
  | 'ready-for-live-activation-review';

export type ZavorthTransactionLiveActivationReviewGateKind =
  | 'intent-model0-candidate-ready'
  | 'candidate-envelope-present'
  | 'owner-activation-review'
  | 'bounded-limits'
  | 'canary-limit-ready'
  | 'kill-switch-ready'
  | 'rollback-drill-ready'
  | 'connector-live-still-disabled'
  | 'separate-live-executor-required'
  | 'raw-secret-redaction';

export type ZavorthTransactionLiveActivationReviewGate = {
  kind: ZavorthTransactionLiveActivationReviewGateKind;
  passed: boolean;
  summary: string;
  evidence: string[];
};

export type ZavorthTransactionLiveActivationOwnerReview = {
  ownerId: string;
  reviewId: string;
  confirmed: boolean;
  requiredPhrase: typeof ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_OWNER_PHRASE;
  phraseAccepted: boolean;
  confirmationRecordedAt?: string;
  reviewDigest: string;
};

export type ZavorthTransactionLiveActivationLimits = {
  maxSingleAmount: number | null;
  maxDailyAmount: number | null;
  maxExecutionsPerDay: number | null;
  allowedConnectorIds: string[];
  allowedTargetLabels: string[];
  currency: string | null;
};

export type ZavorthTransactionLiveActivationKillSwitch = {
  id: string | null;
  enabled: boolean;
  tested: boolean;
  command: string | null;
  ownerId: string | null;
  lastTestedAt?: string;
};

export type ZavorthTransactionLiveActivationRollbackDrill = {
  drillId: string | null;
  performed: boolean;
  successful: boolean;
  summary: string;
  replayCommand: string;
  rollbackCommand: string;
  artifacts: string[];
};

export type ZavorthTransactionLiveActivationReviewPacket = {
  id: string;
  createdAt: string;
  expiresAt: string;
  sourceCandidateResultId: string;
  sourceCandidateEnvelopeId: string;
  ownerReviewId: string;
  surface: ZavorthTransactionSurfaceKind;
  connectorId: string;
  actionKind: ZavorthTransactionLiveCandidateEnvelope['actionKind'];
  targetLabel: string;
  amount?: number;
  currency?: string;
  credentialRef: string;
  approvalEntryId: string;
  rollbackDrillId: string;
  killSwitchId: string;
  limits: ZavorthTransactionLiveActivationLimits;
  packetDigest: string;
  reviewOnly: true;
  activationAuthorized: false;
  liveExecutionAuthorized: false;
  executableNow: false;
  liveActionApplied: false;
  externalSideEffects: false;
  separateLiveExecutorRequired: true;
  conditions: string[];
};

export type ZavorthTransactionLiveActivationReviewSafety = {
  activationReviewOnly: true;
  doesNotAuthorizeLiveExecution: true;
  noLiveExecution: true;
  noHiddenLiveAction: true;
  noRawSecretSerialized: true;
  externalSideEffects: false;
  liveExecutionAuthorized: false;
  executableNow: false;
  liveActionApplied: false;
  separateLiveExecutorRequired: true;
  killSwitchRequiredBeforeLive: true;
  rollbackDrillRequiredBeforeLive: true;
};

export type ZavorthTransactionLiveActivationReviewLimitsInput = {
  maxSingleAmount?: number | null;
  maxDailyAmount?: number | null;
  maxExecutionsPerDay?: number | null;
  allowedConnectorIds?: string[] | null;
  allowedTargetLabels?: string[] | null;
  currency?: string | null;
};

export type ZavorthTransactionLiveActivationKillSwitchInput = {
  id?: string | null;
  enabled?: boolean | null;
  tested?: boolean | null;
  command?: string | null;
  ownerId?: string | null;
};

export type ZavorthTransactionLiveActivationRollbackDrillInput = {
  drillId?: string | null;
  performed?: boolean | null;
  successful?: boolean | null;
  summary?: string | null;
  replayCommand?: string | null;
  rollbackCommand?: string | null;
  artifacts?: string[] | null;
};

export type ZavorthTransactionLiveActivationReviewInput = {
  text: string;
  /** Structured product kind — free text never activates transaction kinds. */
  kind?: import('./ZavorthTransactionIntentContract.js').ZavorthTransactionIntentKind;
  actionKind?: import('./ZavorthTransactionPlaneContract.js').ZavorthTransactionActionKind;
  targetKind?: import('./ZavorthTransactionIntentContract.js').ZavorthTransactionIntentTargetKind;
  surface?: ZavorthTransactionSurfaceKind;
  mode?: 'dry-run' | 'sandbox' | 'paper';
  approve?: boolean;
  reject?: boolean;
  requireCredential?: boolean;
  credentialRef?: string | null;
  connectorId?: string;
  ownerId?: string;
  ownerConfirmed?: boolean;
  ownerIntent?: string | null;
  activationReviewConfirmed?: boolean;
  activationReviewIntent?: string | null;
  activationReviewId?: string | null;
  limits?: ZavorthTransactionLiveActivationReviewLimitsInput | null;
  killSwitch?: ZavorthTransactionLiveActivationKillSwitchInput | null;
  rollbackDrill?: ZavorthTransactionLiveActivationRollbackDrillInput | null;
  useSafeDefaultControls?: boolean;
};

export type ZavorthTransactionLiveActivationReviewResult = {
  version: typeof ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_CONTRACT_VERSION;
  id: string;
  createdAt: string;
  status: ZavorthTransactionLiveActivationReviewStatus;
  summary: string;
  ownerReview: ZavorthTransactionLiveActivationOwnerReview;
  limits: ZavorthTransactionLiveActivationLimits;
  killSwitch: ZavorthTransactionLiveActivationKillSwitch;
  rollbackDrill: ZavorthTransactionLiveActivationRollbackDrill;
  gates: ZavorthTransactionLiveActivationReviewGate[];
  sourceCandidate: ZavorthTransactionLiveCandidateResult;
  reviewPacket?: ZavorthTransactionLiveActivationReviewPacket;
  blockers: string[];
  nextSteps: string[];
  safety: ZavorthTransactionLiveActivationReviewSafety;
};

export type ZavorthTransactionLiveActivationReviewContractSnapshot = {
  version: typeof ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_CONTRACT_VERSION;
  summary: string;
  ownerPhrase: typeof ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_OWNER_PHRASE;
  statuses: ZavorthTransactionLiveActivationReviewStatus[];
  gateKinds: ZavorthTransactionLiveActivationReviewGateKind[];
  invariants: string[];
};

export function buildZavorthTransactionLiveActivationReviewContractSnapshot(): ZavorthTransactionLiveActivationReviewContractSnapshot {
  return {
    version: ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_CONTRACT_VERSION,
    summary: 'Owner-gated live activation review contract for Zavorth Transaction Plane Intent model1.',
    ownerPhrase: ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_OWNER_PHRASE,
    statuses: [
      'candidate-required',
      'owner-review-required',
      'rollback-drill-required',
      'activation-policy-blocked',
      'ready-for-live-activation-review',
    ],
    gateKinds: [
      'intent-model0-candidate-ready',
      'candidate-envelope-present',
      'owner-activation-review',
      'bounded-limits',
      'canary-limit-ready',
      'kill-switch-ready',
      'rollback-drill-ready',
      'connector-live-still-disabled',
      'separate-live-executor-required',
      'raw-secret-redaction',
    ],
    invariants: [
      'Intent model1 consumes a Intent model0 candidate-ready envelope and turns it into a review-only activation packet.',
      'A ready-for-live-activation-review packet requires a second owner phrase dedicated to activation review.',
      'A ready-for-live-activation-review packet requires explicit bounded limits, kill switch and rollback drill receipts.',
      'Intent model1 does not authorize or execute a live transaction.',
      'Every Intent model1 result reports externalSideEffects=false, liveExecutionAuthorized=false, executableNow=false and liveActionApplied=false.',
      'Intent model1 requires a separate future live executor and cannot be used as that executor.',
      'Raw transaction secrets must never be serialized by the review packet.',
    ],
  };
}
