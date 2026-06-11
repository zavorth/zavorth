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
  | 'operate-domain'
  | 'set-permission'
  | 'select-model-spec'
  | 'route-model'
  | 'set-provider-connection'
  | 'set-workspace-knowledge'
  | 'register-personal-connector'
  | 'set-mcp-trust'
  | 'recover-scheduled-jobs'
  | 'resume-stream';

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
  connectedModelIds: string[];
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

export type ZavorthRuntimePermissionDecision = 'allow' | 'approval' | 'block' | 'configure';

export type ZavorthRuntimePermissionRule = {
  default: ZavorthRuntimePermissionDecision;
  requiresApproval: boolean;
  scope: 'global' | 'workspace' | 'provider' | 'connector' | 'mcp' | 'skill';
  reason: string;
};

export type ZavorthRuntimePermissionsMatrix = {
  version: 1;
  domains: Record<string, {
    label: string;
    actions: Record<string, ZavorthRuntimePermissionRule>;
  }>;
};

export type ZavorthRuntimeModelSpec = {
  id: 'daily' | 'coding' | 'research' | 'local-private' | 'budget';
  label: string;
  summary: string;
  allowedProviderIds: string[];
  preferredModelIds: string[];
  fallbackModelIds: string[];
  maxEffort: 'low' | 'standard' | 'high' | 'ultra-code';
  estimatedCost: 'low' | 'medium' | 'high';
  allowedSkillIds: string[];
  allowedSubagentIds: string[];
};

export type ZavorthRuntimeDynamicRoute = {
  intent: string;
  providerId: string;
  modelId: string;
  specId: string;
  reason: string;
  fallbackModelIds: string[];
  estimatedCost: 'low' | 'medium' | 'high';
  risk: 'low' | 'medium' | 'high';
  selectedAt: string;
};

export type ZavorthRuntimeProviderConnection = {
  id: string;
  label: string;
  status: 'configured' | 'needs-setup' | 'blocked';
  targetHost: string | null;
  localLoopback: boolean;
  defaultRouteAllowed: boolean;
  blockReason: string | null;
  updatedAt: string;
};

export type ZavorthRuntimeWorkspaceKnowledge = {
  workspaceId: string;
  activeWorkspaceLabel: string;
  isolation: 'chat' | 'runtime-local' | 'folder' | 'project' | 'zavorth-local';
  trustedWorkspaceIds: string[];
  allowedPaths: string[];
  ragSources: Array<{
    id: string;
    kind: 'document' | 'web' | 'email' | 'memory';
    label: string;
    trusted: boolean;
  }>;
  untrustedContextWrapping: true;
};

export type ZavorthRuntimePersonalConnector = {
  id: string;
  kind: 'email' | 'calendar' | 'task';
  label: string;
  provider?: string | null;
  accountEmailDomain?: string | null;
  status: 'disabled' | 'configured' | 'needs-setup' | 'blocked';
  enabled: boolean;
  readAllowed: boolean;
  draftAllowed: boolean;
  sendRequiresApproval: true;
  writeRequiresApproval: true;
  lastReceiptId: string | null;
};

export type ZavorthRuntimeMcpTrustServer = {
  id: string;
  label: string;
  origin: string;
  trustState: 'blocked' | 'review' | 'trusted';
  toolNames: string[];
  risk: 'low' | 'medium' | 'high';
  networkAccess: 'blocked' | 'loopback' | 'restricted';
  exposedToModel: boolean;
  lastReceiptId: string | null;
};

export type ZavorthRuntimeSkillHistoryEntry = {
  id: string;
  skillId: string;
  skillName: string;
  mode: 'manual' | 'always-applied' | 'auto-selected' | 'blocked' | 'approved' | 'executed';
  source: ZavorthRuntimeStateSkill['source'];
  receiptId: string | null;
  at: string;
};

export type ZavorthRuntimeStreamSession = {
  sessionId: string | null;
  status: 'idle' | 'streaming' | 'resumable' | 'completed' | 'failed';
  resumeToken: string | null;
  updatedAt: string;
  resumable: true;
};

export type ZavorthRuntimeCapabilitiesProjection = {
  summary: {
    available: number;
    blocked: number;
    configurable: number;
    pending: number;
  };
  available: Array<{ id: string; label: string; domain: string }>;
  blocked: Array<{ id: string; label: string; reason: string }>;
  configurable: Array<{ id: string; label: string; reason: string }>;
  pending: Array<{ id: string; label: string; reason: string }>;
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
  permissionsMatrix: ZavorthRuntimePermissionsMatrix;
  modelSpec: {
    selectedSpecId: string;
    selectedAt: string;
    specs: ZavorthRuntimeModelSpec[];
  };
  dynamicRouting: {
    selected: ZavorthRuntimeDynamicRoute;
    providerConnections: ZavorthRuntimeProviderConnection[];
  };
  workspaceKnowledge: ZavorthRuntimeWorkspaceKnowledge;
  personalOps: {
    connectors: ZavorthRuntimePersonalConnector[];
  };
  mcpTrust: {
    servers: ZavorthRuntimeMcpTrustServer[];
    policy: {
      externalServersRequireTrust: true;
      quarantinedToolsHidden: true;
      privateNetworkBlockedByDefault: true;
    };
  };
  skillHistory: {
    entries: ZavorthRuntimeSkillHistoryEntry[];
  };
  streamSession: ZavorthRuntimeStreamSession;
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
  capabilities: ZavorthRuntimeCapabilitiesProjection;
  permissionsMatrix: ZavorthRuntimePermissionsMatrix;
  modelSpecs: {
    selectedSpecId: string;
    specs: ZavorthRuntimeModelSpec[];
  };
  dynamicRouting: {
    selected: ZavorthRuntimeDynamicRoute;
    providerConnections: ZavorthRuntimeProviderConnection[];
  };
  workspaceKnowledge: ZavorthRuntimeWorkspaceKnowledge;
  personalOps: {
    connectors: ZavorthRuntimePersonalConnector[];
  };
  mcpTrust: {
    servers: ZavorthRuntimeMcpTrustServer[];
    policy: ZavorthRuntimeStateBusState['mcpTrust']['policy'];
  };
  skillHistory: {
    entries: ZavorthRuntimeSkillHistoryEntry[];
  };
  streamSession: ZavorthRuntimeStreamSession;
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
    permission?: unknown;
    modelSpec?: unknown;
    dynamicRouting?: unknown;
    providerConnection?: unknown;
    workspaceKnowledge?: unknown;
    personalConnector?: unknown;
    mcpTrust?: unknown;
    scheduledJobs?: unknown;
    streamSession?: unknown;
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
