import type { ExecutionLifecycleRecord } from './ExecutionLifecycleContract.js';

export type NodeMeshNodeKind = 'headless' | 'desktop' | 'mobile' | 'browser';
export type NodeMeshTransport = 'local' | 'bridge' | 'sidecar' | 'remote';
export type NodeMeshPairingStatus = 'pending' | 'paired' | 'revoked';
export type NodeMeshStatus = 'online' | 'idle' | 'offline' | 'blocked' | 'pairing';
export type NodeMeshDeviceProfileId =
  | 'headless-worker'
  | 'desktop-companion'
  | 'mobile-companion'
  | 'browser-companion'
  | string;
export type NodeMeshCapabilityId =
  | 'system.run'
  | 'node.maintenance'
  | 'browser.proxy'
  | 'screen.capture'
  | 'device.info'
  | 'camera.capture'
  | 'notifications.send'
  | 'location.read'
  | 'files.read'
  | 'files.write'
  | 'files.watch'
  | 'clipboard.read'
  | 'clipboard.write'
  | string;

export type NodeMeshLifecycleStaleReason =
  | 'pairing-draft-expired'
  | 'pending-expired'
  | 'claimed-stale';

export type NodeMeshCapabilityDescriptor = {
  id: NodeMeshCapabilityId;
  label: string;
  summary: string;
  category: 'system' | 'browser' | 'device' | 'files' | 'notifications' | 'location' | 'misc';
  risky: boolean;
  actionHint: string | null;
};

export type NodeMeshHostHints = {
  hostname: string | null;
  platform: string | null;
  workspace: string | null;
  surface: string | null;
  arch?: string | null;
  osRelease?: string | null;
  nodeVersion?: string | null;
  deviceModel?: string | null;
  appVersion?: string | null;
  networkType?: string | null;
  batteryLevel?: number | null;
  batteryState?: string | null;
  locationLabel?: string | null;
  latencyMs?: number | null;
  costScore?: number | null;
};

export type NodeMeshDeviceProfileDescriptor = {
  id: NodeMeshDeviceProfileId;
  label: string;
  kind: NodeMeshNodeKind;
  transport: NodeMeshTransport;
  summary: string;
  operatorSummary: string;
  defaultCapabilityIds: NodeMeshCapabilityId[];
  actionHint: string;
};

export type NodeMeshAllowlistAudit = {
  approvedAt: string | null;
  approvedBy: string | null;
  reason: string | null;
  mode: string | null;
};

export type NodeMeshRegistryEntry = {
  id: string;
  label: string;
  profileId?: NodeMeshDeviceProfileId | null;
  kind: NodeMeshNodeKind;
  transport: NodeMeshTransport;
  status: NodeMeshStatus;
  pairingStatus: NodeMeshPairingStatus;
  paired: boolean;
  createdAt: string;
  updatedAt: string;
  pairedAt: string | null;
  lastSeenAt: string | null;
  requestedBy: string | null;
  capabilityIds: NodeMeshCapabilityId[];
  approvedCapabilityIds?: NodeMeshCapabilityId[] | null;
  allowlistAudit?: NodeMeshAllowlistAudit | null;
  hostHints: NodeMeshHostHints;
  notes: string[];
  operatorSummary: string | null;
  lifecycle?: {
    pairingDraftAgeMs?: number | null;
    pairingDraftStale?: boolean;
  } | null;
};

export type NodeMeshState = {
  version: number;
  updatedAt: string;
  entries: Record<string, NodeMeshRegistryEntry>;
};

export type NodeMeshSecretsState = {
  version: number;
  updatedAt: string;
  entries: Record<string, Record<string, string>>;
};

export type NodeMeshPairingDraft = {
  generatedAt: string;
  entry: NodeMeshRegistryEntry;
  profile: NodeMeshDeviceProfileDescriptor | null;
  pairingCode: string;
  actionHint: string;
  instructions: string[];
  bootstrap?: {
    packageScript: string | null;
    command: string;
    fallbackCommand: string | null;
    pairingToken: string;
    workspaceHint: string | null;
    notes: string[];
  };
};

export type NodeInvocationRequest = {
  nodeId: string;
  capabilityId: NodeMeshCapabilityId;
  action: string;
  payload?: Record<string, unknown> | null;
  requestedBy?: string | null;
  surface?: string | null;
  sessionId?: string | null;
  correlation?: {
    traceId?: string | null;
    runId?: string | null;
    sessionId?: string | null;
    approvalId?: string | null;
    artifactId?: string | null;
  } | null;
};

export type NodeInvocationRecordStatus = 'pending' | 'claimed' | 'completed' | 'failed' | 'cancelled';

export type NodeInvocationOutput = {
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  data: Record<string, unknown> | null;
};

export type NodeInvocationRecord = {
  id: string;
  traceId?: string | null;
  runId?: string | null;
  sessionId?: string | null;
  approvalId?: string | null;
  artifactId?: string | null;
  nodeId: string;
  capabilityId: NodeMeshCapabilityId;
  action: string;
  payload: Record<string, unknown> | null;
  requestedBy: string | null;
  transport: NodeMeshTransport | null;
  status: NodeInvocationRecordStatus;
  requestedAt: string;
  queuedAt: string;
  claimedAt: string | null;
  completedAt: string | null;
  ok: boolean | null;
  resultSummary: string | null;
  output: NodeInvocationOutput | null;
  execution_lifecycle?: ExecutionLifecycleRecord[];
  staleAt?: string | null;
  staleReason?: NodeMeshLifecycleStaleReason | null;
};

export type NodeInvocationStoreState = {
  version: number;
  updatedAt: string;
  entries: Record<string, NodeInvocationRecord>;
};

export type NodeInvocationCompletion = {
  invocationId: string;
  ok: boolean;
  resultSummary?: string | null;
  stdout?: string | null;
  stderr?: string | null;
  exitCode?: number | null;
  data?: Record<string, unknown> | null;
};

export type NodeInvocationPolicySource =
  | 'registry-approved-capabilities'
  | 'device-capability-policy'
  | 'declared-capabilities-fallback';

export type NodeInvocationPolicyDecision = {
  source: NodeInvocationPolicySource;
  nodeId: string;
  capabilityId: NodeMeshCapabilityId;
  declaredCapabilityIds: NodeMeshCapabilityId[];
  allowedCapabilityIds: NodeMeshCapabilityId[];
  capabilityDeclared: boolean;
  capabilityAllowed: boolean;
  policyRequired: boolean;
  bypassed: false;
};

export type NodeInvocationResult = {
  ok: boolean;
  status: 'queued' | 'manual' | 'blocked' | 'unavailable';
  traceId?: string | null;
  runId?: string | null;
  sessionId?: string | null;
  approvalId?: string | null;
  artifactId?: string | null;
  nodeId: string | null;
  capabilityId: NodeMeshCapabilityId;
  action: string;
  reason: string;
  transport: NodeMeshTransport | null;
  commandHint: string | null;
  queuedAt: string | null;
  execution_lifecycle?: ExecutionLifecycleRecord[];
  invocationId?: string | null;
  policyDecision?: NodeInvocationPolicyDecision;
};

export type NodeMeshPairingClaim = {
  claimedAt: string;
  node: NodeMeshRegistryEntry;
  sharedSecret: string;
  heartbeatIntervalMs: number;
  operatorSummary: string;
  assignments: NodeInvocationRecord[];
  actionHint: string;
};

export type NodeMeshHeartbeatResult = {
  receivedAt: string;
  node: NodeMeshRegistryEntry;
  heartbeatIntervalMs: number;
  operatorSummary: string;
  acceptedResults: number;
  assignments: NodeInvocationRecord[];
};

export type NodeMeshMaintenanceSnapshot = {
  supported: boolean;
  pending: number;
  claimed: number;
  latestStatus: NodeInvocationRecordStatus | null;
  latestAction: string | null;
  latestResultSummary: string | null;
  recoverKind: 'queue-node-host-maintenance' | null;
};

export type NodeMeshSnapshotEntry = NodeMeshRegistryEntry & {
  capabilities: NodeMeshCapabilityDescriptor[];
  canInvoke: boolean;
  nextAction: string;
  trustLabel: string;
  pendingInvocations: number;
  claimedInvocations: number;
  stalePairingDraft?: boolean;
  stalePendingInvocations?: number;
  staleClaimedInvocations?: number;
  recentInvocation: NodeInvocationRecord | null;
  maintenance: NodeMeshMaintenanceSnapshot;
};

export type NodeMeshSuggestedAction = {
  label: string;
  reason: string;
  actionHint: string | null;
};

export type NodeMeshActivitySnapshot = {
  nodeId: string | null;
  activeInvocations: NodeInvocationRecord[];
  recentInvocations: NodeInvocationRecord[];
  maintenance: NodeMeshMaintenanceSnapshot;
  summary: {
    pending: number;
    claimed: number;
    completedRecently: number;
    active: number;
    recent: number;
    stalePending?: number;
    staleClaimed?: number;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export type NodeMeshCapabilitiesSnapshot = {
  nodeId: string;
  label: string;
  kind: NodeMeshNodeKind;
  transport: NodeMeshTransport;
  paired: boolean;
  capabilities: NodeMeshCapabilityDescriptor[];
  maintenance: NodeMeshMaintenanceSnapshot;
  summary: {
    total: number;
    risky: number;
    categories: string[];
  };
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export type NodeMeshSnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    paired: number;
    pending: number;
    online: number;
    offline: number;
    invokable: number;
    capabilities: number;
    queued: number;
    completedRecently: number;
    expiredDrafts?: number;
    staleQueued?: number;
    staleClaimedInvocations?: number;
  };
  entries: NodeMeshSnapshotEntry[];
  selected: NodeMeshSnapshotEntry | null;
  capabilityCatalog: NodeMeshCapabilityDescriptor[];
  deviceProfiles: NodeMeshDeviceProfileDescriptor[];
  recommendedProfiles: NodeMeshDeviceProfileDescriptor[];
  suggestedActions: NodeMeshSuggestedAction[];
  selectedActivity: NodeMeshActivitySnapshot | null;
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export type NodeMeshDoctorIssueKind =
  | 'expired-pairing-draft'
  | 'stale-claimed-queue'
  | 'stale-queue-debt'
  | 'offline-paired-node';

export type NodeMeshDoctorIssue = {
  nodeId: string;
  label: string;
  kind: NodeMeshDoctorIssueKind;
  recoverable: boolean;
  recoverKind?: NodeMeshRecoveryAction['kind'] | null;
  summary: string;
  actionHint: string | null;
};

export type NodeMeshDoctorReport = {
  checkedAt: string;
  status: 'healthy' | 'attention';
  summary: string;
  selectedNodeId: string | null;
  issues: NodeMeshDoctorIssue[];
};

export type NodeMeshRecoveryAction = {
  kind: 'regenerate-pairing-draft' | 'release-stale-claims' | 'queue-node-host-maintenance';
  summary: string;
};
