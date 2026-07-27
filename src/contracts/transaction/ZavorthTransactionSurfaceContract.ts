import type {
  ZavorthTransactionIntentKind,
  ZavorthTransactionIntentTargetKind,
} from './ZavorthTransactionIntentContract.js';
import type { ZavorthTransactionActionKind } from './ZavorthTransactionPlaneContract.js';
import type {
  ZavorthTransactionRuntimeRunResult,
  ZavorthTransactionRuntimeStatus,
} from './ZavorthTransactionRuntimeContract.js';

export const ZAVORTH_TRANSACTION_SURFACE_CONTRACT_VERSION = 'zavorth-transaction-surface/gate-7' as const;

export type ZavorthTransactionSurfaceKind = 'web' | 'cli' | 'telegram' | 'api' | 'natural-first';

export type ZavorthTransactionSurfaceCardKind =
  | 'runtime-summary'
  | 'preview'
  | 'approval'
  | 'credential'
  | 'connector'
  | 'safety';

export type ZavorthTransactionSurfaceSeverity = 'info' | 'success' | 'warning' | 'danger';

export type ZavorthTransactionSurfaceActionKind =
  | 'request-approval'
  | 'reject-preview'
  | 'provide-credential-ref'
  | 'simulate'
  | 'open-ledger'
  | 'explain-blockers'
  | 'no-live-action';

export type ZavorthTransactionSurfaceNaturalFirstSnapshot = {
  route: string;
  intent: string;
  shouldEnterGateway: boolean;
  requiresApproval: boolean;
  riskLevel: string;
  signals: string[];
};

export type ZavorthTransactionSurfaceCard = {
  id: string;
  kind: ZavorthTransactionSurfaceCardKind;
  title: string;
  status: string;
  severity: ZavorthTransactionSurfaceSeverity;
  lines: string[];
};

export type ZavorthTransactionSurfaceAction = {
  id: string;
  kind: ZavorthTransactionSurfaceActionKind;
  label: string;
  enabled: boolean;
  requiresConfirmation: boolean;
  command?: string;
  reason: string;
};

export type ZavorthTransactionSurfaceProjection = {
  version: typeof ZAVORTH_TRANSACTION_SURFACE_CONTRACT_VERSION;
  id: string;
  createdAt: string;
  surface: ZavorthTransactionSurfaceKind;
  status: ZavorthTransactionRuntimeStatus;
  naturalFirst: ZavorthTransactionSurfaceNaturalFirstSnapshot;
  runtime: ZavorthTransactionRuntimeRunResult;
  cards: ZavorthTransactionSurfaceCard[];
  actions: ZavorthTransactionSurfaceAction[];
  replyText: string;
  apiPayload: {
    status: ZavorthTransactionRuntimeStatus;
    runId: string;
    previewId: string;
    cards: ZavorthTransactionSurfaceCard[];
    actions: ZavorthTransactionSurfaceAction[];
  };
  externalSideEffects: false;
  liveActionApplied: false;
  liveExecutionAuthorized: false;
  executableNow: false;
};

export type ZavorthTransactionSurfaceProjectInput = {
  text: string;
  /** Structured product kind — free text never activates transaction kinds. */
  kind?: ZavorthTransactionIntentKind;
  actionKind?: ZavorthTransactionActionKind;
  targetKind?: ZavorthTransactionIntentTargetKind;
  surface?: ZavorthTransactionSurfaceKind;
  userId?: string | null;
  sessionId?: string | null;
  workspace?: string | null;
  mode?: 'dry-run' | 'sandbox' | 'paper';
  approve?: boolean;
  reject?: boolean;
  requireCredential?: boolean;
  credentialRef?: string | null;
  connectorId?: string;
};

export type ZavorthTransactionSurfaceContractSnapshot = {
  version: typeof ZAVORTH_TRANSACTION_SURFACE_CONTRACT_VERSION;
  summary: string;
  surfaces: ZavorthTransactionSurfaceKind[];
  cardKinds: ZavorthTransactionSurfaceCardKind[];
  actionKinds: ZavorthTransactionSurfaceActionKind[];
  invariants: string[];
};

export function buildZavorthTransactionSurfaceContractSnapshot(): ZavorthTransactionSurfaceContractSnapshot {
  return {
    version: ZAVORTH_TRANSACTION_SURFACE_CONTRACT_VERSION,
    summary: 'Surface projection gateway for Zavorth Transaction Plane Surface controls.',
    surfaces: ['web', 'cli', 'telegram', 'api', 'natural-first'],
    cardKinds: ['runtime-summary', 'preview', 'approval', 'credential', 'connector', 'safety'],
    actionKinds: [
      'request-approval',
      'reject-preview',
      'provide-credential-ref',
      'simulate',
      'open-ledger',
      'explain-blockers',
      'no-live-action',
    ],
    invariants: [
      'All transaction text enters the governed Natural First gateway path.',
      'Surface projections expose cards and actions, not hidden live execution.',
      'Approval and credential actions are suggestions until explicit operator input.',
      'No surface projection may authorize live execution.',
      'Every surface projection reports externalSideEffects=false and liveActionApplied=false.',
      'Telegram/API/Web/CLI receive the same runtime truth with surface-specific presentation only.',
    ],
  };
}
