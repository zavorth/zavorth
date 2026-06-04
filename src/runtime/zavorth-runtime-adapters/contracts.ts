import type {
  NormalizedInboundMessage,
  ToolExposurePolicyContractInput,
} from '../agent/contracts/index.js';
import type {
  UniversalAgentChannel,
  UniversalApprovalRequest,
  UniversalArtifactSummary,
  UniversalToolRiskLevel,
} from '../agent/UniversalAgentRuntimeTypes.js';
import type {
  ImportedCapabilityTrustState,
} from '../agent/security/index.js';

export type RuntimeAdapterAdapterLifecycleStatus = 'created' | 'starting' | 'ready' | 'stopped' | 'degraded' | 'offline';

export type RuntimeAdapterAdapterLifecycleContract = {
  stage: 'contract-layer' | 'sidecar-adapter';
  startBehavior: 'health-discovery-only' | 'connect-existing-runtime-only';
  stopBehavior: 'local-adapter-state-only' | 'disconnect-client-only';
  canSpawnSourceRuntime: false;
  canMutateSourceRuntime: false;
  allowedTransitions: Readonly<Record<RuntimeAdapterAdapterLifecycleStatus, readonly RuntimeAdapterAdapterLifecycleStatus[]>>;
};

export type RuntimeAdapterRuntimeDescriptor = {
  id: string;
  label: string;
  adapterKind: 'sidecar';
  runtimeKind: 'runtime-adapter-runtime';
  transport: 'fixture' | 'stdio' | 'http' | 'websocket';
  version?: string;
  diagnostics?: RuntimeAdapterAdapterDiagnostics;
  namingQuarantine: RuntimeAdapterNamingQuarantine;
  boundary: RuntimeAdapterAdapterBoundaryPolicy;
};

export type RuntimeAdapterAdapterDiagnostics = {
  sourceRuntimeName?: string;
  sourceRuntimeVersion?: string;
  endpointHint?: string;
  notes?: string[];
};

export type RuntimeAdapterNamingQuarantine = {
  sourceNamesQuarantined: true;
  publicIdPrefix: string;
  allowedSourceNameScopes: readonly ['adapter-diagnostics', 'inventory-evidence'];
};

export type RuntimeAdapterAdapterBoundaryPolicy = {
  requiresZavorthGateway: true;
  requiresToolExposurePolicy: true;
  requiresApprovalPolicy: true;
  requiresReplyPipeline: true;
  mayMutateFiles: false;
  maySendUserFacingMessages: false;
  mayExecuteTools: false;
  mayLaunchWorkers: false;
  prohibitedActions: readonly [
    'mutate-files',
    'send-user-facing-output',
    'execute-tools',
    'launch-workers',
    'call-legacy-dispatch',
  ];
};

export type RuntimeAdapterCapabilityKind =
  | 'tool'
  | 'skill'
  | 'mcp'
  | 'channel'
  | 'session'
  | 'worker'
  | 'memory';

export type RuntimeAdapterInventoryEvidence = {
  sourceRuntimeName?: string;
  sourceCapabilityName?: string;
  rawKind?: string;
  observedAt: string;
  notes?: string[];
};

export type RuntimeAdapterCapabilityDescriptor = {
  id: string;
  label: string;
  kind: RuntimeAdapterCapabilityKind;
  summary?: string;
  risk: UniversalToolRiskLevel;
  trustState: ImportedCapabilityTrustState;
  toolNames?: string[];
  requiresApproval?: boolean;
  inventoryEvidence?: RuntimeAdapterInventoryEvidence;
  metadata?: Record<string, unknown>;
};

export type RuntimeAdapterCapabilityProviderContract = {
  id: string;
  runtimeId: string;
  label: string;
  capabilities: RuntimeAdapterZavorthCapabilityContract[];
  toolExposurePolicyInput: ToolExposurePolicyContractInput;
  nativeContract: 'ToolExposurePolicyInput';
  boundary: RuntimeAdapterAdapterBoundaryPolicy;
};

export type RuntimeAdapterSessionDescriptor = {
  id: string;
  userId: string;
  channel: UniversalAgentChannel;
  title?: string;
  workspace?: string | null;
  lastEventAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type RuntimeAdapterSessionEnvelope = {
  id: string;
  runtimeId: string;
  descriptor: RuntimeAdapterSessionDescriptor;
  observedAt: string;
  diagnostics?: RuntimeAdapterAdapterDiagnostics;
};

export type RuntimeAdapterEventEnvelope = {
  id: string;
  runtimeId: string;
  sessionId: string;
  kind: 'message' | 'capability-event' | 'health' | 'diagnostic';
  occurredAt: string;
  actor: {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'worker';
  };
  payload: {
    text?: string;
    channel?: UniversalAgentChannel | string;
    workspace?: string | null;
    requestedTools?: string[];
    rawType?: string;
    data?: Record<string, unknown>;
  };
  diagnostics?: RuntimeAdapterAdapterDiagnostics;
};

export type RuntimeAdapterApprovalEnvelope = {
  id: string;
  runtimeId: string;
  sessionId?: string | null;
  eventId?: string | null;
  requestedAt: string;
  title: string;
  reason: string;
  risk: UniversalToolRiskLevel;
  status: UniversalApprovalRequest['status'];
  action: {
    kind: 'tool' | 'message' | 'worker' | 'file' | 'network' | 'unknown';
    label: string;
    requestedToolNames?: string[];
    data?: Record<string, unknown>;
  };
  diagnostics?: RuntimeAdapterAdapterDiagnostics;
};

export type RuntimeAdapterArtifactEnvelope = {
  id: string;
  runtimeId: string;
  sessionId?: string | null;
  eventId?: string | null;
  createdAt: string;
  title: string;
  kind: UniversalArtifactSummary['kind'];
  status: UniversalArtifactSummary['status'];
  uri?: string | null;
  summary?: string;
  diagnostics?: RuntimeAdapterAdapterDiagnostics;
};

export type RuntimeAdapterOutboundActionKind = 'message' | 'tool' | 'worker' | 'health-probe' | 'diagnostic';

export type RuntimeAdapterOutboundActionEnvelope = {
  id: string;
  runtimeId: string;
  sessionId?: string | null;
  requestedAt: string;
  kind: RuntimeAdapterOutboundActionKind;
  label: string;
  risk: UniversalToolRiskLevel;
  dryRun: boolean;
  replyBoundary: 'zavorth-reply-port-only';
  payload: {
    text?: string;
    target?: string;
    toolName?: string;
    data?: Record<string, unknown>;
  };
  approval?: {
    id: string;
    status: UniversalApprovalRequest['status'];
  } | null;
  diagnostics?: RuntimeAdapterAdapterDiagnostics;
};

export type RuntimeAdapterOutboundActionDecision = {
  ok: boolean;
  reason: 'allowed' | 'requires-zavorth-approval' | 'reply-pipeline-required' | 'blocked-by-boundary-policy';
  requiresApproval: boolean;
  actionId: string;
};

export type RuntimeAdapterOutboundActionResult = {
  actionId: string;
  runtimeId: string;
  status: 'dispatched' | 'dry-run' | 'blocked' | 'failed';
  dryRun: boolean;
  decision: RuntimeAdapterOutboundActionDecision;
  dispatchedAt: string;
  receipt?: {
    id: string;
    label: string;
    data?: Record<string, unknown>;
  };
  diagnostics?: RuntimeAdapterAdapterDiagnostics;
};

export type RuntimeAdapterChannelDescriptor = {
  id: string;
  label: string;
  channel: UniversalAgentChannel;
  status: 'available' | 'degraded' | 'offline';
  inbound: boolean;
  outbound: false;
  replyBoundary: 'zavorth-reply-port-only';
};

export type RuntimeAdapterHealthSnapshot = {
  runtimeId: string;
  status: RuntimeAdapterAdapterLifecycleStatus;
  generatedAt: string;
  capabilities: {
    total: number;
    trusted: number;
    safe: number;
    quarantined: number;
  };
  approvals?: {
    total: number;
    pending: number;
  };
  artifacts?: {
    total: number;
    ready: number;
  };
  channels: RuntimeAdapterChannelDescriptor[];
  diagnostics?: RuntimeAdapterAdapterDiagnostics;
};

export type RuntimeAdapterZavorthCapabilityContract = {
  id: string;
  label: string;
  kind: RuntimeAdapterCapabilityKind;
  risk: UniversalToolRiskLevel;
  trustState: ImportedCapabilityTrustState;
  toolNames: string[];
  toolExposurePolicyInput: ToolExposurePolicyContractInput;
  inventoryEvidence?: RuntimeAdapterInventoryEvidence;
  nativeContract: 'ToolExposurePolicyInput';
};

export type RuntimeAdapterAdapter = {
  readonly descriptor: RuntimeAdapterRuntimeDescriptor;
  readonly lifecycle: RuntimeAdapterAdapterLifecycleContract;
  start(): Promise<RuntimeAdapterHealthSnapshot>;
  stop(): Promise<RuntimeAdapterHealthSnapshot>;
  getHealth(): Promise<RuntimeAdapterHealthSnapshot>;
  listCapabilities(): Promise<RuntimeAdapterCapabilityDescriptor[]>;
  listChannels(): Promise<RuntimeAdapterChannelDescriptor[]>;
  listSessions(): Promise<RuntimeAdapterSessionDescriptor[]>;
  listSessionEnvelopes(): Promise<RuntimeAdapterSessionEnvelope[]>;
  listApprovalEnvelopes(): Promise<RuntimeAdapterApprovalEnvelope[]>;
  listArtifactEnvelopes(): Promise<RuntimeAdapterArtifactEnvelope[]>;
  pullTestEvents(): Promise<RuntimeAdapterEventEnvelope[]>;
  normalizeEvent(event: RuntimeAdapterEventEnvelope): NormalizedInboundMessage;
  normalizeCapability(capability: RuntimeAdapterCapabilityDescriptor): RuntimeAdapterZavorthCapabilityContract;
  normalizeCapabilityProvider(capabilities: RuntimeAdapterCapabilityDescriptor[]): RuntimeAdapterCapabilityProviderContract;
  normalizeApproval(approval: RuntimeAdapterApprovalEnvelope): UniversalApprovalRequest;
  normalizeArtifact(artifact: RuntimeAdapterArtifactEnvelope): UniversalArtifactSummary;
};

export const RUNTIME_ADAPTER_ADAPTER_LIFECYCLE_CONTRACT: RuntimeAdapterAdapterLifecycleContract = {
  stage: 'contract-layer',
  startBehavior: 'health-discovery-only',
  stopBehavior: 'local-adapter-state-only',
  canSpawnSourceRuntime: false,
  canMutateSourceRuntime: false,
  allowedTransitions: {
    created: ['starting', 'stopped'],
    starting: ['ready', 'degraded', 'offline', 'stopped'],
    ready: ['degraded', 'offline', 'stopped'],
    degraded: ['ready', 'offline', 'stopped'],
    offline: ['starting', 'stopped'],
    stopped: ['starting'],
  },
};

export const RUNTIME_ADAPTER_ADAPTER_BOUNDARY_POLICY: RuntimeAdapterAdapterBoundaryPolicy = {
  requiresZavorthGateway: true,
  requiresToolExposurePolicy: true,
  requiresApprovalPolicy: true,
  requiresReplyPipeline: true,
  mayMutateFiles: false,
  maySendUserFacingMessages: false,
  mayExecuteTools: false,
  mayLaunchWorkers: false,
  prohibitedActions: [
    'mutate-files',
    'send-user-facing-output',
    'execute-tools',
    'launch-workers',
    'call-legacy-dispatch',
  ],
};

export const RUNTIME_ADAPTER_NAMING_QUARANTINE: RuntimeAdapterNamingQuarantine = {
  sourceNamesQuarantined: true,
  publicIdPrefix: 'external-capability',
  allowedSourceNameScopes: ['adapter-diagnostics', 'inventory-evidence'],
};
