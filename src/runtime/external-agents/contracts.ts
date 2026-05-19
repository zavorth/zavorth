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

export type ExternalAgentAdapterLifecycleStatus = 'created' | 'starting' | 'ready' | 'stopped' | 'degraded' | 'offline';

export type ExternalAgentAdapterLifecycleContract = {
  stage: 'contract-layer' | 'sidecar-adapter';
  startBehavior: 'health-discovery-only' | 'connect-existing-runtime-only';
  stopBehavior: 'local-adapter-state-only' | 'disconnect-client-only';
  canSpawnSourceRuntime: false;
  canMutateSourceRuntime: false;
  allowedTransitions: Readonly<Record<ExternalAgentAdapterLifecycleStatus, readonly ExternalAgentAdapterLifecycleStatus[]>>;
};

export type ExternalAgentRuntimeDescriptor = {
  id: string;
  label: string;
  adapterKind: 'sidecar';
  runtimeKind: 'external-agent-runtime';
  transport: 'fixture' | 'stdio' | 'http' | 'websocket';
  version?: string;
  diagnostics?: ExternalAgentAdapterDiagnostics;
  namingQuarantine: ExternalAgentNamingQuarantine;
  boundary: ExternalAgentAdapterBoundaryPolicy;
};

export type ExternalAgentAdapterDiagnostics = {
  sourceRuntimeName?: string;
  sourceRuntimeVersion?: string;
  endpointHint?: string;
  notes?: string[];
};

export type ExternalAgentNamingQuarantine = {
  sourceNamesQuarantined: true;
  publicIdPrefix: string;
  allowedSourceNameScopes: readonly ['adapter-diagnostics', 'inventory-evidence'];
};

export type ExternalAgentAdapterBoundaryPolicy = {
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

export type ExternalAgentCapabilityKind =
  | 'tool'
  | 'skill'
  | 'mcp'
  | 'channel'
  | 'session'
  | 'worker'
  | 'memory';

export type ExternalAgentInventoryEvidence = {
  sourceRuntimeName?: string;
  sourceCapabilityName?: string;
  rawKind?: string;
  observedAt: string;
  notes?: string[];
};

export type ExternalAgentCapabilityDescriptor = {
  id: string;
  label: string;
  kind: ExternalAgentCapabilityKind;
  summary?: string;
  risk: UniversalToolRiskLevel;
  trustState: ImportedCapabilityTrustState;
  toolNames?: string[];
  requiresApproval?: boolean;
  inventoryEvidence?: ExternalAgentInventoryEvidence;
  metadata?: Record<string, unknown>;
};

export type ExternalAgentCapabilityProviderContract = {
  id: string;
  runtimeId: string;
  label: string;
  capabilities: ExternalAgentZavorthCapabilityContract[];
  toolExposurePolicyInput: ToolExposurePolicyContractInput;
  nativeContract: 'ToolExposurePolicyInput';
  boundary: ExternalAgentAdapterBoundaryPolicy;
};

export type ExternalAgentSessionDescriptor = {
  id: string;
  userId: string;
  channel: UniversalAgentChannel;
  title?: string;
  workspace?: string | null;
  lastEventAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type ExternalAgentSessionEnvelope = {
  id: string;
  runtimeId: string;
  descriptor: ExternalAgentSessionDescriptor;
  observedAt: string;
  diagnostics?: ExternalAgentAdapterDiagnostics;
};

export type ExternalAgentEventEnvelope = {
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
  diagnostics?: ExternalAgentAdapterDiagnostics;
};

export type ExternalAgentApprovalEnvelope = {
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
  diagnostics?: ExternalAgentAdapterDiagnostics;
};

export type ExternalAgentArtifactEnvelope = {
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
  diagnostics?: ExternalAgentAdapterDiagnostics;
};

export type ExternalAgentOutboundActionKind = 'message' | 'tool' | 'worker' | 'health-probe' | 'diagnostic';

export type ExternalAgentOutboundActionEnvelope = {
  id: string;
  runtimeId: string;
  sessionId?: string | null;
  requestedAt: string;
  kind: ExternalAgentOutboundActionKind;
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
  diagnostics?: ExternalAgentAdapterDiagnostics;
};

export type ExternalAgentOutboundActionDecision = {
  ok: boolean;
  reason: 'allowed' | 'requires-zavorth-approval' | 'reply-pipeline-required' | 'blocked-by-boundary-policy';
  requiresApproval: boolean;
  actionId: string;
};

export type ExternalAgentOutboundActionResult = {
  actionId: string;
  runtimeId: string;
  status: 'dispatched' | 'dry-run' | 'blocked' | 'failed';
  dryRun: boolean;
  decision: ExternalAgentOutboundActionDecision;
  dispatchedAt: string;
  receipt?: {
    id: string;
    label: string;
    data?: Record<string, unknown>;
  };
  diagnostics?: ExternalAgentAdapterDiagnostics;
};

export type ExternalAgentChannelDescriptor = {
  id: string;
  label: string;
  channel: UniversalAgentChannel;
  status: 'available' | 'degraded' | 'offline';
  inbound: boolean;
  outbound: false;
  replyBoundary: 'zavorth-reply-port-only';
};

export type ExternalAgentHealthSnapshot = {
  runtimeId: string;
  status: ExternalAgentAdapterLifecycleStatus;
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
  channels: ExternalAgentChannelDescriptor[];
  diagnostics?: ExternalAgentAdapterDiagnostics;
};

export type ExternalAgentZavorthCapabilityContract = {
  id: string;
  label: string;
  kind: ExternalAgentCapabilityKind;
  risk: UniversalToolRiskLevel;
  trustState: ImportedCapabilityTrustState;
  toolNames: string[];
  toolExposurePolicyInput: ToolExposurePolicyContractInput;
  inventoryEvidence?: ExternalAgentInventoryEvidence;
  nativeContract: 'ToolExposurePolicyInput';
};

export type ExternalAgentAdapter = {
  readonly descriptor: ExternalAgentRuntimeDescriptor;
  readonly lifecycle: ExternalAgentAdapterLifecycleContract;
  start(): Promise<ExternalAgentHealthSnapshot>;
  stop(): Promise<ExternalAgentHealthSnapshot>;
  getHealth(): Promise<ExternalAgentHealthSnapshot>;
  listCapabilities(): Promise<ExternalAgentCapabilityDescriptor[]>;
  listChannels(): Promise<ExternalAgentChannelDescriptor[]>;
  listSessions(): Promise<ExternalAgentSessionDescriptor[]>;
  listSessionEnvelopes(): Promise<ExternalAgentSessionEnvelope[]>;
  listApprovalEnvelopes(): Promise<ExternalAgentApprovalEnvelope[]>;
  listArtifactEnvelopes(): Promise<ExternalAgentArtifactEnvelope[]>;
  pullTestEvents(): Promise<ExternalAgentEventEnvelope[]>;
  normalizeEvent(event: ExternalAgentEventEnvelope): NormalizedInboundMessage;
  normalizeCapability(capability: ExternalAgentCapabilityDescriptor): ExternalAgentZavorthCapabilityContract;
  normalizeCapabilityProvider(capabilities: ExternalAgentCapabilityDescriptor[]): ExternalAgentCapabilityProviderContract;
  normalizeApproval(approval: ExternalAgentApprovalEnvelope): UniversalApprovalRequest;
  normalizeArtifact(artifact: ExternalAgentArtifactEnvelope): UniversalArtifactSummary;
};

export const EXTERNAL_AGENT_ADAPTER_LIFECYCLE_CONTRACT: ExternalAgentAdapterLifecycleContract = {
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

export const EXTERNAL_AGENT_ADAPTER_BOUNDARY_POLICY: ExternalAgentAdapterBoundaryPolicy = {
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

export const EXTERNAL_AGENT_NAMING_QUARANTINE: ExternalAgentNamingQuarantine = {
  sourceNamesQuarantined: true,
  publicIdPrefix: 'external-capability',
  allowedSourceNameScopes: ['adapter-diagnostics', 'inventory-evidence'],
};
