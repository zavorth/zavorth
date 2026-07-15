import type {
  ZavorthTransactionSurfaceAction,
  ZavorthTransactionSurfaceKind,
  ZavorthTransactionSurfaceProjection,
  ZavorthTransactionSurfaceSeverity,
} from './ZavorthTransactionSurfaceContract.js';
import type { ZavorthTransactionRuntimeStatus } from './ZavorthTransactionRuntimeContract.js';

export const ZAVORTH_TRANSACTION_ZAVORTH_CONTROL_CONTRACT_VERSION =
  'zavorth-transaction-zavorthControl/checkpoint-8' as const;

export type ZavorthTransactionZavorthControlLaneKind =
  | 'intake'
  | 'natural-first'
  | 'preview'
  | 'approval'
  | 'credential'
  | 'connector'
  | 'ledger'
  | 'safety';

export type ZavorthTransactionZavorthControlTileKind =
  | 'status'
  | 'action'
  | 'target'
  | 'amount'
  | 'approval'
  | 'credential'
  | 'connector'
  | 'safety';

export type ZavorthTransactionZavorthControlTimelineStatus = 'done' | 'pending' | 'blocked' | 'skipped';

export type ZavorthTransactionZavorthControlActionPlacement = 'primary' | 'secondary' | 'danger' | 'disabled';

export type ZavorthTransactionZavorthControlTone = 'ready' | 'attention' | 'blocked' | 'success';

export type ZavorthTransactionZavorthControlLane = {
  id: string;
  kind: ZavorthTransactionZavorthControlLaneKind;
  title: string;
  summary: string;
  severity: ZavorthTransactionSurfaceSeverity;
  status: string;
  facts: Array<{
    label: string;
    value: string;
  }>;
};

export type ZavorthTransactionZavorthControlTile = {
  id: string;
  kind: ZavorthTransactionZavorthControlTileKind;
  label: string;
  value: string;
  detail: string;
  tone: ZavorthTransactionZavorthControlTone;
};

export type ZavorthTransactionZavorthControlTimelineItem = {
  id: string;
  label: string;
  detail: string;
  status: ZavorthTransactionZavorthControlTimelineStatus;
};

export type ZavorthTransactionZavorthControlOperatorAction = {
  id: string;
  sourceActionId: ZavorthTransactionSurfaceAction['id'];
  label: string;
  description: string;
  enabled: boolean;
  placement: ZavorthTransactionZavorthControlActionPlacement;
  requiresConfirmation: boolean;
  command?: string;
};

export type ZavorthTransactionZavorthControlNotification = {
  id: string;
  channel: ZavorthTransactionSurfaceKind;
  title: string;
  body: string;
  tone: ZavorthTransactionZavorthControlTone;
};

export type ZavorthTransactionZavorthControlSafety = {
  noLiveExecution: true;
  noHiddenLiveAction: true;
  noRawSecretSerialized: true;
  approvalBeforeSimulation: true;
  credentialRefsOnly: true;
  externalSideEffects: false;
  liveExecutionAuthorized: false;
  executableNow: false;
  liveActionApplied: false;
};

export type ZavorthTransactionZavorthControlProjection = {
  version: typeof ZAVORTH_TRANSACTION_ZAVORTH_CONTROL_CONTRACT_VERSION;
  id: string;
  generatedAt: string;
  surface: ZavorthTransactionSurfaceKind;
  status: ZavorthTransactionRuntimeStatus;
  tone: ZavorthTransactionZavorthControlTone;
  headline: string;
  summary: string;
  sourceProjectionId: string;
  surfaceProjection: ZavorthTransactionSurfaceProjection;
  lanes: ZavorthTransactionZavorthControlLane[];
  tiles: ZavorthTransactionZavorthControlTile[];
  timeline: ZavorthTransactionZavorthControlTimelineItem[];
  operatorActions: ZavorthTransactionZavorthControlOperatorAction[];
  notifications: ZavorthTransactionZavorthControlNotification[];
  apiPayload: {
    status: ZavorthTransactionRuntimeStatus;
    tone: ZavorthTransactionZavorthControlTone;
    sourceProjectionId: string;
    laneCount: number;
    actionCount: number;
    safety: ZavorthTransactionZavorthControlSafety;
  };
  safety: ZavorthTransactionZavorthControlSafety;
};

export type ZavorthTransactionZavorthControlProjectInput = {
  text: string;
  /** Structured product kind — free text never activates transaction kinds. */
  kind?: import('./ZavorthTransactionIntentContract.js').ZavorthTransactionIntentKind;
  actionKind?: import('./ZavorthTransactionPlaneContract.js').ZavorthTransactionActionKind;
  targetKind?: import('./ZavorthTransactionIntentContract.js').ZavorthTransactionIntentTargetKind;
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

export type ZavorthTransactionZavorthControlContractSnapshot = {
  version: typeof ZAVORTH_TRANSACTION_ZAVORTH_CONTROL_CONTRACT_VERSION;
  summary: string;
  laneKinds: ZavorthTransactionZavorthControlLaneKind[];
  tileKinds: ZavorthTransactionZavorthControlTileKind[];
  timelineStatuses: ZavorthTransactionZavorthControlTimelineStatus[];
  invariants: string[];
};

export function buildZavorthTransactionZavorthControlContractSnapshot(): ZavorthTransactionZavorthControlContractSnapshot {
  return {
    version: ZAVORTH_TRANSACTION_ZAVORTH_CONTROL_CONTRACT_VERSION,
    summary: 'ZavorthControl projection contract for Zavorth Transaction Plane ZavorthControl controls.',
    laneKinds: ['intake', 'natural-first', 'preview', 'approval', 'credential', 'connector', 'ledger', 'safety'],
    tileKinds: ['status', 'action', 'target', 'amount', 'approval', 'credential', 'connector', 'safety'],
    timelineStatuses: ['done', 'pending', 'blocked', 'skipped'],
    invariants: [
      'ZavorthControl controls is a cockpit projection over Surface controls; it does not introduce execution authority.',
      'Every ZavorthControl projection keeps live execution disabled.',
      'Operator actions are visual affordances backed by governed surface actions.',
      'Approval, rejection and credential prompts remain explicit operator decisions.',
      'Raw transaction secrets must never be serialized into cockpit lanes, tiles, notifications or API payloads.',
      'The ZavorthControl receives the same runtime truth as CLI, API and messaging surfaces.',
    ],
  };
}
