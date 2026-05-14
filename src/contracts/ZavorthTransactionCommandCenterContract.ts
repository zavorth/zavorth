import type {
  ZavorthTransactionSurfaceAction,
  ZavorthTransactionSurfaceKind,
  ZavorthTransactionSurfaceProjection,
  ZavorthTransactionSurfaceSeverity,
} from './ZavorthTransactionSurfaceContract.js';
import type {
  ZavorthTransactionRuntimeStatus,
} from './ZavorthTransactionRuntimeContract.js';

export const ZAVORTH_TRANSACTION_COMMAND_CENTER_CONTRACT_VERSION = 'zavorth-transaction-command-center/phase-8' as const;

export type ZavorthTransactionCommandCenterLaneKind =
  | 'intake'
  | 'natural-first'
  | 'preview'
  | 'approval'
  | 'credential'
  | 'connector'
  | 'ledger'
  | 'safety';

export type ZavorthTransactionCommandCenterTileKind =
  | 'status'
  | 'action'
  | 'target'
  | 'amount'
  | 'approval'
  | 'credential'
  | 'connector'
  | 'safety';

export type ZavorthTransactionCommandCenterTimelineStatus =
  | 'done'
  | 'pending'
  | 'blocked'
  | 'skipped';

export type ZavorthTransactionCommandCenterActionPlacement =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'disabled';

export type ZavorthTransactionCommandCenterTone = 'ready' | 'attention' | 'blocked' | 'success';

export type ZavorthTransactionCommandCenterLane = {
  id: string;
  kind: ZavorthTransactionCommandCenterLaneKind;
  title: string;
  summary: string;
  severity: ZavorthTransactionSurfaceSeverity;
  status: string;
  facts: Array<{
    label: string;
    value: string;
  }>;
};

export type ZavorthTransactionCommandCenterTile = {
  id: string;
  kind: ZavorthTransactionCommandCenterTileKind;
  label: string;
  value: string;
  detail: string;
  tone: ZavorthTransactionCommandCenterTone;
};

export type ZavorthTransactionCommandCenterTimelineItem = {
  id: string;
  label: string;
  detail: string;
  status: ZavorthTransactionCommandCenterTimelineStatus;
};

export type ZavorthTransactionCommandCenterOperatorAction = {
  id: string;
  sourceActionId: ZavorthTransactionSurfaceAction['id'];
  label: string;
  description: string;
  enabled: boolean;
  placement: ZavorthTransactionCommandCenterActionPlacement;
  requiresConfirmation: boolean;
  command?: string;
};

export type ZavorthTransactionCommandCenterNotification = {
  id: string;
  channel: ZavorthTransactionSurfaceKind;
  title: string;
  body: string;
  tone: ZavorthTransactionCommandCenterTone;
};

export type ZavorthTransactionCommandCenterSafety = {
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

export type ZavorthTransactionCommandCenterProjection = {
  version: typeof ZAVORTH_TRANSACTION_COMMAND_CENTER_CONTRACT_VERSION;
  id: string;
  generatedAt: string;
  surface: ZavorthTransactionSurfaceKind;
  status: ZavorthTransactionRuntimeStatus;
  tone: ZavorthTransactionCommandCenterTone;
  headline: string;
  summary: string;
  sourceProjectionId: string;
  surfaceProjection: ZavorthTransactionSurfaceProjection;
  lanes: ZavorthTransactionCommandCenterLane[];
  tiles: ZavorthTransactionCommandCenterTile[];
  timeline: ZavorthTransactionCommandCenterTimelineItem[];
  operatorActions: ZavorthTransactionCommandCenterOperatorAction[];
  notifications: ZavorthTransactionCommandCenterNotification[];
  apiPayload: {
    status: ZavorthTransactionRuntimeStatus;
    tone: ZavorthTransactionCommandCenterTone;
    sourceProjectionId: string;
    laneCount: number;
    actionCount: number;
    safety: ZavorthTransactionCommandCenterSafety;
  };
  safety: ZavorthTransactionCommandCenterSafety;
};

export type ZavorthTransactionCommandCenterProjectInput = {
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

export type ZavorthTransactionCommandCenterContractSnapshot = {
  version: typeof ZAVORTH_TRANSACTION_COMMAND_CENTER_CONTRACT_VERSION;
  summary: string;
  laneKinds: ZavorthTransactionCommandCenterLaneKind[];
  tileKinds: ZavorthTransactionCommandCenterTileKind[];
  timelineStatuses: ZavorthTransactionCommandCenterTimelineStatus[];
  invariants: string[];
};

export function buildZavorthTransactionCommandCenterContractSnapshot(): ZavorthTransactionCommandCenterContractSnapshot {
  return {
    version: ZAVORTH_TRANSACTION_COMMAND_CENTER_CONTRACT_VERSION,
    summary: 'Command Center projection contract for Zavorth Transaction Plane Phase 8.',
    laneKinds: ['intake', 'natural-first', 'preview', 'approval', 'credential', 'connector', 'ledger', 'safety'],
    tileKinds: ['status', 'action', 'target', 'amount', 'approval', 'credential', 'connector', 'safety'],
    timelineStatuses: ['done', 'pending', 'blocked', 'skipped'],
    invariants: [
      'Phase 8 is a cockpit projection over Phase 7; it does not introduce execution authority.',
      'Every Command Center projection keeps live execution disabled.',
      'Operator actions are visual affordances backed by governed surface actions.',
      'Approval, rejection and credential prompts remain explicit operator decisions.',
      'Raw transaction secrets must never be serialized into cockpit lanes, tiles, notifications or API payloads.',
      'The Command Center receives the same runtime truth as CLI, API and messaging surfaces.',
    ],
  };
}
