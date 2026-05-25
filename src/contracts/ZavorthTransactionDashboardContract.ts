import type {
  ZavorthTransactionSurfaceAction,
  ZavorthTransactionSurfaceKind,
  ZavorthTransactionSurfaceProjection,
  ZavorthTransactionSurfaceSeverity,
} from './ZavorthTransactionSurfaceContract.js';
import type {
  ZavorthTransactionRuntimeStatus,
} from './ZavorthTransactionRuntimeContract.js';

export const ZAVORTH_TRANSACTION_COMMAND_CENTER_CONTRACT_VERSION = 'zavorth-transaction-dashboard/checkpoint-8' as const;

export type ZavorthTransactionDashboardLaneKind =
  | 'intake'
  | 'natural-first'
  | 'preview'
  | 'approval'
  | 'credential'
  | 'connector'
  | 'ledger'
  | 'safety';

export type ZavorthTransactionDashboardTileKind =
  | 'status'
  | 'action'
  | 'target'
  | 'amount'
  | 'approval'
  | 'credential'
  | 'connector'
  | 'safety';

export type ZavorthTransactionDashboardTimelineStatus =
  | 'done'
  | 'pending'
  | 'blocked'
  | 'skipped';

export type ZavorthTransactionDashboardActionPlacement =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'disabled';

export type ZavorthTransactionDashboardTone = 'ready' | 'attention' | 'blocked' | 'success';

export type ZavorthTransactionDashboardLane = {
  id: string;
  kind: ZavorthTransactionDashboardLaneKind;
  title: string;
  summary: string;
  severity: ZavorthTransactionSurfaceSeverity;
  status: string;
  facts: Array<{
    label: string;
    value: string;
  }>;
};

export type ZavorthTransactionDashboardTile = {
  id: string;
  kind: ZavorthTransactionDashboardTileKind;
  label: string;
  value: string;
  detail: string;
  tone: ZavorthTransactionDashboardTone;
};

export type ZavorthTransactionDashboardTimelineItem = {
  id: string;
  label: string;
  detail: string;
  status: ZavorthTransactionDashboardTimelineStatus;
};

export type ZavorthTransactionDashboardOperatorAction = {
  id: string;
  sourceActionId: ZavorthTransactionSurfaceAction['id'];
  label: string;
  description: string;
  enabled: boolean;
  placement: ZavorthTransactionDashboardActionPlacement;
  requiresConfirmation: boolean;
  command?: string;
};

export type ZavorthTransactionDashboardNotification = {
  id: string;
  channel: ZavorthTransactionSurfaceKind;
  title: string;
  body: string;
  tone: ZavorthTransactionDashboardTone;
};

export type ZavorthTransactionDashboardSafety = {
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

export type ZavorthTransactionDashboardProjection = {
  version: typeof ZAVORTH_TRANSACTION_COMMAND_CENTER_CONTRACT_VERSION;
  id: string;
  generatedAt: string;
  surface: ZavorthTransactionSurfaceKind;
  status: ZavorthTransactionRuntimeStatus;
  tone: ZavorthTransactionDashboardTone;
  headline: string;
  summary: string;
  sourceProjectionId: string;
  surfaceProjection: ZavorthTransactionSurfaceProjection;
  lanes: ZavorthTransactionDashboardLane[];
  tiles: ZavorthTransactionDashboardTile[];
  timeline: ZavorthTransactionDashboardTimelineItem[];
  operatorActions: ZavorthTransactionDashboardOperatorAction[];
  notifications: ZavorthTransactionDashboardNotification[];
  apiPayload: {
    status: ZavorthTransactionRuntimeStatus;
    tone: ZavorthTransactionDashboardTone;
    sourceProjectionId: string;
    laneCount: number;
    actionCount: number;
    safety: ZavorthTransactionDashboardSafety;
  };
  safety: ZavorthTransactionDashboardSafety;
};

export type ZavorthTransactionDashboardProjectInput = {
  text: string;
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

export type ZavorthTransactionDashboardContractSnapshot = {
  version: typeof ZAVORTH_TRANSACTION_COMMAND_CENTER_CONTRACT_VERSION;
  summary: string;
  laneKinds: ZavorthTransactionDashboardLaneKind[];
  tileKinds: ZavorthTransactionDashboardTileKind[];
  timelineStatuses: ZavorthTransactionDashboardTimelineStatus[];
  invariants: string[];
};

export function buildZavorthTransactionDashboardContractSnapshot(): ZavorthTransactionDashboardContractSnapshot {
  return {
    version: ZAVORTH_TRANSACTION_COMMAND_CENTER_CONTRACT_VERSION,
    summary: 'Dashboard projection contract for Zavorth Transaction Plane Dashboard controls.',
    laneKinds: ['intake', 'natural-first', 'preview', 'approval', 'credential', 'connector', 'ledger', 'safety'],
    tileKinds: ['status', 'action', 'target', 'amount', 'approval', 'credential', 'connector', 'safety'],
    timelineStatuses: ['done', 'pending', 'blocked', 'skipped'],
    invariants: [
      'Dashboard controls is a cockpit projection over Surface controls; it does not introduce execution authority.',
      'Every Dashboard projection keeps live execution disabled.',
      'Operator actions are visual affordances backed by governed surface actions.',
      'Approval, rejection and credential prompts remain explicit operator decisions.',
      'Raw transaction secrets must never be serialized into cockpit lanes, tiles, notifications or API payloads.',
      'The Dashboard receives the same runtime truth as CLI, API and messaging surfaces.',
    ],
  };
}
