import type { ModelPickerReadiness, SelectedModelProfile } from '../../contracts/ModelPickerContract.js';

export type UniversalAgentChannel =
  | 'web'
  | 'cli'
  | 'telegram'
  | 'discord'
  | 'api'
  | 'slack'
  | 'whatsapp'
  | 'signal'
  | 'email'
  | 'teams'
  | 'unknown';

export type UniversalAgentRunStatus =
  | 'queued'
  | 'thinking'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type UniversalAgentEventKind =
  | 'input'
  | 'planning'
  | 'memory'
  | 'tool'
  | 'approval'
  | 'steering'
  | 'artifact'
  | 'reply'
  | 'error'
  | 'status';

export type UniversalAgentEventStatus = 'pending' | 'running' | 'done' | 'failed';

export type UniversalToolRiskLevel = 'safe' | 'attention' | 'danger' | 'unknown';

export type UniversalToolExposureMode = 'safe' | 'confirm' | 'restricted' | 'unknown';

export type UniversalReplyPortKind = UniversalAgentChannel;

export type UniversalReplyPortStatus = 'available' | 'degraded' | 'blocked' | 'offline';

export type UniversalAgentModelProfile = {
  providerLabel: string;
  modelLabel: string;
  routingPolicy: 'direct' | 'gateway' | 'fallback' | 'unknown';
  fallbackModelLabel?: string;
  routeId?: string;
  familyId?: string;
  selectionSource?: SelectedModelProfile['source'];
  readiness?: ModelPickerReadiness;
  ready?: boolean;
  fallbackOrder?: string[];
  selectionExplanation?: string[];
  supportsTools?: boolean;
  supportsVision?: boolean;
  supportsStreaming?: boolean;
};

export type UniversalReplyPort = {
  id: string;
  label: string;
  kind: UniversalReplyPortKind;
  status: UniversalReplyPortStatus;
  primary?: boolean;
  description?: string;
};

export type UniversalAgentRequest = {
  requestId?: string;
  traceId?: string | null;
  userId: string;
  sessionId?: string | null;
  channel: UniversalAgentChannel;
  text: string;
  workspace?: string | null;
  replyPort?: UniversalReplyPort;
  requestedTools?: string[];
  modelProfile?: Partial<UniversalAgentModelProfile>;
  metadata?: Record<string, unknown>;
};

export type UniversalAgentEvent = {
  id: string;
  runId: string;
  kind: UniversalAgentEventKind;
  title: string;
  detail?: string;
  status: UniversalAgentEventStatus;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type UniversalToolExposure = {
  id: string;
  label: string;
  capabilityId?: string;
  group?: string;
  risk: UniversalToolRiskLevel;
  requiresApproval: boolean;
  description?: string;
  policyTags?: string[];
};

export type UniversalBlockedToolExposure = {
  id: string;
  label: string;
  reason: string;
};

export type UniversalToolExposureProfile = {
  mode: UniversalToolExposureMode;
  /** Unified presentation tier aligned with Trusted Operator lanes and classifier risk. */
  tier?: import('../../contracts/runtime/CapabilityTierPresentation.js').CapabilityTier;
  summary: string;
  tools: UniversalToolExposure[];
  blockedTools?: UniversalBlockedToolExposure[];
  toolExposureGatedByImportedCapabilityTrust?: boolean;
  toolExposureGatedByCognitiveFirewall?: boolean;
};

export type UniversalArtifactSummary = {
  id: string;
  title: string;
  kind: 'file' | 'report' | 'diff' | 'log' | 'plan' | 'handoff';
  createdAt: string;
  sessionId?: string;
  status: 'draft' | 'ready' | 'failed';
};

export type UniversalMemorySignal = {
  id: string;
  title: string;
  layer: 'working' | 'episodic' | 'semantic' | 'procedural';
  summary: string;
  confidence?: number;
};

export type UniversalApprovalRequest = {
  id: string;
  runId: string;
  title: string;
  reason: string;
  risk: UniversalToolRiskLevel;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
};

export type UniversalAgentSteeringStatus =
  | 'accepted'
  | 'applied'
  | 'cancelled'
  | 'superseded';

export type UniversalAgentSteeringEntry = {
  id: string;
  runId: string;
  sessionId: string;
  text: string;
  source: string;
  status: UniversalAgentSteeringStatus;
  createdAt: string;
  updatedAt: string;
  ackId: string;
  queueItemId?: string | null;
  replaceTargetId?: string | null;
  replacedById?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  attempts: number;
  maxAttempts: number;
  backoffMs: number;
  nextRetryAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type UniversalAgentRun = {
  id: string;
  traceId: string;
  requestId: string;
  sessionId: string;
  userId: string;
  channel: UniversalAgentChannel;
  title: string;
  input: string;
  workspace?: string | null;
  status: UniversalAgentRunStatus;
  createdAt: string;
  updatedAt: string;
  summary: string;
  events: UniversalAgentEvent[];
  toolExposure: UniversalToolExposureProfile;
  replyPorts: UniversalReplyPort[];
  modelProfile: UniversalAgentModelProfile;
  approvals: UniversalApprovalRequest[];
  steering?: UniversalAgentSteeringEntry[];
  artifacts: UniversalArtifactSummary[];
  memorySignals: UniversalMemorySignal[];
  metadata: Record<string, unknown>;
};

export type UniversalReplyPacket = {
  id: string;
  runId: string;
  port: UniversalReplyPort;
  text: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type UniversalAgentRunResult = {
  ok: boolean;
  run: UniversalAgentRun;
  replies: UniversalReplyPacket[];
};

export type UniversalAgentWorkflowJobKind = 'resume_after_approval';

export type UniversalAgentWorkflowJobStatus =
  | 'waiting_approval'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type UniversalAgentWorkflowJob = {
  id: string;
  kind: UniversalAgentWorkflowJobKind;
  runId: string;
  approvalId: string;
  request: UniversalAgentRequest;
  status: UniversalAgentWorkflowJobStatus;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  maxAttempts: number;
  leaseOwner?: string | null;
  leaseExpiresAt?: string | null;
  lockedAt?: string | null;
  heartbeatAt?: string | null;
  nextRunAt?: string | null;
  backoffMs?: number;
  completedAt?: string | null;
  failedAt?: string | null;
  cancelledAt?: string | null;
  lastError?: string | null;
  resultRunStatus?: UniversalAgentRunStatus;
  metadata?: Record<string, unknown>;
};

export type UniversalApprovalDecision = 'approved' | 'rejected';

export type UniversalAgentApprovalDecisionResult = UniversalAgentRunResult & {
  approval: UniversalApprovalRequest | null;
  decision: UniversalApprovalDecision;
  resumed: boolean;
  queued?: boolean;
  workflowJob?: UniversalAgentWorkflowJob | null;
  error?: string | null;
};

export type UniversalAgentExecutorInput = {
  request: UniversalAgentRequest;
  run: UniversalAgentRun;
};

export type UniversalAgentExecutorResult = {
  summary?: string;
  replyText?: string;
  status?: UniversalAgentRunStatus;
  events?: Array<Omit<UniversalAgentEvent, 'runId' | 'createdAt' | 'id'> & Partial<Pick<UniversalAgentEvent, 'id' | 'createdAt'>>>;
  artifacts?: UniversalArtifactSummary[];
  memorySignals?: UniversalMemorySignal[];
  metadata?: Record<string, unknown>;
};

export type UniversalAgentExecutor = (
  input: UniversalAgentExecutorInput,
) => Promise<UniversalAgentExecutorResult> | UniversalAgentExecutorResult;
