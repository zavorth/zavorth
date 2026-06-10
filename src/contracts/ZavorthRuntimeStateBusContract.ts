import type { ZavorthEffortControlSnapshot } from './ZavorthEffortControlContract.js';

export const ZAVORTH_RUNTIME_STATE_BUS_CONTRACT_VERSION = 'zavorth-runtime-state-bus/1' as const;

export type ZavorthRuntimeStateDomain =
  | 'gateway'
  | 'agents'
  | 'cron'
  | 'context'
  | 'session'
  | 'skills'
  | 'model'
  | 'workspace'
  | 'effort';

export type ZavorthRuntimeStateStatus =
  | 'offline'
  | 'ready'
  | 'running'
  | 'paused'
  | 'attention'
  | 'blocked';

export type ZavorthRuntimeStateActionType =
  | 'sync-command'
  | 'set-effort'
  | 'set-model'
  | 'set-workspace'
  | 'surface-event'
  | 'skill-lifecycle'
  | 'domain-state'
  | 'operate-domain';

export type ZavorthRuntimeStateReceiptStatus =
  | 'preview'
  | 'pending-approval'
  | 'applied'
  | 'blocked'
  | 'failed'
  | 'noop';

export type ZavorthRuntimeStateWorkspace = {
  id: string;
  label: string;
  kind: 'chat' | 'local' | 'folder' | 'project' | 'zavorth';
  path: string | null;
  confinement: 'none' | 'runtime-local' | 'folder' | 'project' | 'zavorth-local';
  locked: boolean;
};

export type ZavorthRuntimeStateModel = {
  id: string;
  label: string;
  provider: string;
  connected: boolean;
  selectedAt: string;
  source: string;
};

export type ZavorthRuntimeStateSkill = {
  id: string;
  name: string;
  source: 'native' | 'imported' | 'preview' | 'review' | 'unknown';
  status: 'available' | 'preview' | 'approved' | 'executing' | 'blocked' | 'quarantined';
  lastReceiptId: string | null;
};

export type ZavorthRuntimeStateDomainState = {
  domain: ZavorthRuntimeStateDomain;
  status: ZavorthRuntimeStateStatus;
  summary: string;
  updatedAt: string;
  actionIds: string[];
};

export type ZavorthRuntimeStateReceipt = {
  id: string;
  createdAt: string;
  domain: ZavorthRuntimeStateDomain;
  action: ZavorthRuntimeStateActionType;
  status: ZavorthRuntimeStateReceiptStatus;
  phase: 'preview' | 'approval' | 'execution' | 'receipt' | 'learning';
  summary: string;
  preview: {
    mutation: string;
    requiresApproval: boolean;
    reason: string;
  };
  approval: {
    required: boolean;
    approved: boolean;
    approvalId: string | null;
  };
  safety: {
    pathValidated: boolean;
    rawSecretsSerialized: false;
    receiptSpoofingPrevented: true;
    approvalBypassPrevented: true;
  };
  metadata: Record<string, unknown>;
};

export type ZavorthRuntimeStateBusState = {
  gateway: ZavorthRuntimeStateDomainState;
  agents: ZavorthRuntimeStateDomainState;
  cron: ZavorthRuntimeStateDomainState;
  context: ZavorthRuntimeStateDomainState;
  session: ZavorthRuntimeStateDomainState & {
    sessionId: string | null;
    userId: string | null;
    surface: string | null;
  };
  skills: ZavorthRuntimeStateDomainState & {
    nativeCount: number;
    importedQuarantined: boolean;
    active: ZavorthRuntimeStateSkill[];
  };
  model: ZavorthRuntimeStateModel;
  workspace: ZavorthRuntimeStateWorkspace;
  effort: {
    level: string;
    snapshot: ZavorthEffortControlSnapshot;
    selectedAt: string;
  };
};

export type ZavorthRuntimeStateBusProjection = {
  statusbar: {
    runtimeStatus: ZavorthRuntimeStateStatus;
    modelLabel: string;
    effortLabel: string;
    workspaceLabel: string;
    pendingApprovals: number;
  };
  commandBar: {
    selectedModelId: string;
    selectedEffort: string;
    workspace: ZavorthRuntimeStateWorkspace;
    connectedModelIds: string[];
  };
  lifecycle: {
    everyImportantActionRequiresReceipt: true;
    defaultFlow: 'preview -> approval -> execution -> receipt -> learning';
    lastReceiptId: string | null;
  };
  safety: {
    uiProjectionOnly: true;
    runtimeOwnsState: true;
    importedSkillsQuarantined: boolean;
    rawSecretsSerialized: false;
  };
};

export type ZavorthRuntimeStateBusSnapshot = {
  contractVersion: typeof ZAVORTH_RUNTIME_STATE_BUS_CONTRACT_VERSION;
  generatedAt: string;
  restoredFromDisk: boolean;
  state: ZavorthRuntimeStateBusState;
  projections: ZavorthRuntimeStateBusProjection;
  receipts: ZavorthRuntimeStateReceipt[];
  replay: {
    receiptCount: number;
    replayableReceiptIds: string[];
    lastReplayAt: string | null;
  };
};

export type ZavorthRuntimeStateBusActionInput = {
  type: ZavorthRuntimeStateActionType;
  surface?: string | null;
  userId?: string | null;
  sessionId?: string | null;
  text?: string | null;
  source?: string | null;
  approved?: boolean | null;
  previewOnly?: boolean | null;
  connectedModelIds?: string[] | null;
  payload?: {
    effort?: unknown;
    model?: unknown;
    workspace?: unknown;
    skill?: unknown;
    domain?: unknown;
    metadata?: unknown;
  } | null;
};

export type ZavorthRuntimeStateBusDispatchResult = {
  ok: boolean;
  applied: boolean;
  receipt: ZavorthRuntimeStateReceipt;
  snapshot: ZavorthRuntimeStateBusSnapshot;
  error: string | null;
};
