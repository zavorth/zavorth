import type {
  ZavorthTransactionCertificationReport,
} from './ZavorthTransactionCertificationContract.js';
import type {
  ZavorthTransactionDashboardProjection,
} from './ZavorthTransactionDashboardContract.js';
import type {
  ZavorthTransactionConnectorPayload,
} from './ZavorthTransactionConnectorContract.js';
import type {
  ZavorthTransactionActionKind,
} from './ZavorthTransactionPlaneContract.js';
import type {
  ZavorthTransactionConnectorKind,
} from './ZavorthTransactionPreviewContract.js';
import type {
  ZavorthTransactionSurfaceKind,
} from './ZavorthTransactionSurfaceContract.js';

export const ZAVORTH_TRANSACTION_LIVE_CANDIDATE_CONTRACT_VERSION = 'zavorth-transaction-live-candidate/checkpoint-10' as const;

export const ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE = 'ZAVORTH LIVE CANDIDATE ONLY' as const;

export type ZavorthTransactionLiveCandidateStatus =
  | 'certification-required'
  | 'runtime-blocked'
  | 'owner-confirmation-required'
  | 'candidate-ready';

export type ZavorthTransactionLiveCandidateGateKind =
  | 'certification-matrix-certification'
  | 'dashboard-simulated'
  | 'approval-ledger-approved'
  | 'credential-ref-ready'
  | 'typed-connector-simulated'
  | 'owner-confirmation'
  | 'raw-secret-redaction'
  | 'live-switch-disabled';

export type ZavorthTransactionLiveCandidateGate = {
  kind: ZavorthTransactionLiveCandidateGateKind;
  passed: boolean;
  summary: string;
  evidence: string[];
};

export type ZavorthTransactionLiveCandidateOwnerGate = {
  ownerId: string;
  confirmed: boolean;
  requiredPhrase: typeof ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE;
  phraseAccepted: boolean;
  confirmationRecordedAt?: string;
  intentDigest: string;
};

export type ZavorthTransactionLiveCandidateEnvelope = {
  id: string;
  createdAt: string;
  sourceDashboardProjectionId: string;
  sourceSurfaceProjectionId: string;
  surface: ZavorthTransactionSurfaceKind;
  actionKind: ZavorthTransactionActionKind;
  connectorKind: ZavorthTransactionConnectorKind;
  connectorId: string;
  target: {
    kind: string;
    label: string;
  };
  amount?: number;
  currency?: string;
  credentialRef: string;
  approvalEntryId: string;
  previewId: string;
  idempotencyKey: string;
  payloadDigest: string;
  payloadPreview: ZavorthTransactionConnectorPayload;
  candidateOnly: true;
  rawSecretPresent: false;
};

export type ZavorthTransactionLiveCandidateSafety = {
  liveCandidateOnly: true;
  candidateDoesNotAuthorizeLiveExecution: true;
  noLiveExecution: true;
  noHiddenLiveAction: true;
  noRawSecretSerialized: true;
  externalSideEffects: false;
  liveExecutionAuthorized: false;
  executableNow: false;
  liveActionApplied: false;
};

export type ZavorthTransactionLiveCandidateResult = {
  version: typeof ZAVORTH_TRANSACTION_LIVE_CANDIDATE_CONTRACT_VERSION;
  id: string;
  createdAt: string;
  status: ZavorthTransactionLiveCandidateStatus;
  summary: string;
  ownerGate: ZavorthTransactionLiveCandidateOwnerGate;
  gates: ZavorthTransactionLiveCandidateGate[];
  envelope?: ZavorthTransactionLiveCandidateEnvelope;
  dashboardProjection: ZavorthTransactionDashboardProjection;
  certificationReport: ZavorthTransactionCertificationReport;
  blockers: string[];
  nextSteps: string[];
  safety: ZavorthTransactionLiveCandidateSafety;
};

export type ZavorthTransactionLiveCandidateInput = {
  text: string;
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
};

export type ZavorthTransactionLiveCandidateContractSnapshot = {
  version: typeof ZAVORTH_TRANSACTION_LIVE_CANDIDATE_CONTRACT_VERSION;
  summary: string;
  statuses: ZavorthTransactionLiveCandidateStatus[];
  gateKinds: ZavorthTransactionLiveCandidateGateKind[];
  ownerPhrase: typeof ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE;
  invariants: string[];
};

export function buildZavorthTransactionLiveCandidateContractSnapshot(): ZavorthTransactionLiveCandidateContractSnapshot {
  return {
    version: ZAVORTH_TRANSACTION_LIVE_CANDIDATE_CONTRACT_VERSION,
    summary: 'Owner-gated live-candidate envelope contract for Zavorth Transaction Plane Intent model0.',
    statuses: [
      'certification-required',
      'runtime-blocked',
      'owner-confirmation-required',
      'candidate-ready',
    ],
    gateKinds: [
      'certification-matrix-certification',
      'dashboard-simulated',
      'approval-ledger-approved',
      'credential-ref-ready',
      'typed-connector-simulated',
      'owner-confirmation',
      'raw-secret-redaction',
      'live-switch-disabled',
    ],
    ownerPhrase: ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE,
    invariants: [
      'Intent model0 may produce a live-candidate envelope, but it still cannot execute a live transaction.',
      'A candidate-ready envelope requires Certification matrix certification to pass first.',
      'A candidate-ready envelope requires explicit owner confirmation using the required phrase.',
      'A candidate-ready envelope requires approval-granted, credential-ready and typed connector simulated receipts.',
      'Candidate envelopes may include credential refs, but never raw credential values.',
      'Every Intent model0 result reports externalSideEffects=false, liveExecutionAuthorized=false, executableNow=false and liveActionApplied=false.',
    ],
  };
}
