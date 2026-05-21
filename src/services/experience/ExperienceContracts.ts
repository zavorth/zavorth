import type {
  UniversalAgentChannel,
  UniversalAgentRunStatus,
  UniversalToolRiskLevel,
} from '../../runtime/agent/UniversalAgentRuntimeTypes.js';

export const EXPERIENCE_SNAPSHOT_CONTRACT_VERSION = 'ExperienceSnapshot/v1' as const;
export const EXPERIENCE_COMMAND_CONTRACT_VERSION = 'ExperienceCommand/v1' as const;
export const EXPERIENCE_PLAN_CONTRACT_VERSION = 'ExperiencePlan/v1' as const;
export const LEARNING_CANDIDATE_CONTRACT_VERSION = 'LearningCandidate/v1' as const;

export type ExperienceSurface = UniversalAgentChannel;

export type ExperienceHealthStatus = 'ready' | 'attention' | 'blocked' | 'offline';

export type ExperienceJourneyKind =
  | 'conversation'
  | 'first-run'
  | 'provider-setup'
  | 'channel-setup'
  | 'workspace-review'
  | 'code-task'
  | 'security-audit'
  | 'explain-block'
  | 'approval'
  | 'memory'
  | 'learning'
  | 'dashboard'
  | 'diagnostics'
  | 'release'
  | 'automation';

export type ExperienceLearningCandidateState =
  | 'pending'
  | 'promoted'
  | 'rejected'
  | 'quarantined'
  | 'revoked';

export type ExperienceLearningDecision = 'approve' | 'reject' | 'promote' | 'revoke' | 'reset' | 'export';

export type ExperienceApprovalDecision = 'approve' | 'reject';

export type ExperienceCommandIntent =
  | 'ask'
  | 'run'
  | 'open-dashboard'
  | 'diagnose'
  | 'approve'
  | 'reject'
  | 'learn'
  | 'memory'
  | 'setup'
  | 'unknown';

export type ExperienceCommand = {
  contractVersion: typeof EXPERIENCE_COMMAND_CONTRACT_VERSION;
  text: string;
  intent?: ExperienceCommandIntent;
  surface: ExperienceSurface;
  userId: string;
  sessionId?: string | null;
  workspace?: string | null;
  trustMode?: 'protected' | 'collaborator' | 'autonomous' | 'unknown';
  approval?: {
    id: string;
    decision: ExperienceApprovalDecision;
  } | null;
  learning?: {
    candidateId?: string | null;
    decision: ExperienceLearningDecision;
  } | null;
  metadata?: Record<string, unknown>;
};

export type ExperienceAction = {
  id: string;
  label: string;
  kind: 'natural' | 'navigation' | 'approval' | 'learning' | 'diagnostic' | 'safety' | 'execution';
  command?: string | null;
  route?: string | null;
  risk: UniversalToolRiskLevel;
  requiresApproval: boolean;
  reason: string;
};

export type ExperiencePlanStep = {
  id: string;
  title: string;
  detail: string;
  status: 'pending' | 'running' | 'done' | 'blocked';
};

export type ExperiencePlan = {
  contractVersion: typeof EXPERIENCE_PLAN_CONTRACT_VERSION;
  id: string;
  kind: ExperienceJourneyKind;
  title: string;
  summary: string;
  nextSafeAction: string;
  risk: UniversalToolRiskLevel;
  requiresApproval: boolean;
  shouldExecuteAgent: boolean;
  steps: ExperiencePlanStep[];
  actions: ExperienceAction[];
  metadata?: Record<string, unknown>;
};

export type ExperienceAgentState = {
  status: ExperienceHealthStatus;
  label: string;
  summary: string;
  activeRunId: string | null;
  activeRunStatus: UniversalAgentRunStatus | null;
  modelLabel: string | null;
  providerLabel: string | null;
};

export type ExperienceChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  text: string;
  createdAt: string;
  runId?: string | null;
};

export type ExperienceApproval = {
  id: string;
  runId: string;
  title: string;
  reason: string;
  risk: UniversalToolRiskLevel;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  actions: ExperienceAction[];
};

export type ExperienceTimelineItem = {
  id: string;
  runId?: string | null;
  title: string;
  detail: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'blocked';
  kind: 'intent' | 'planning' | 'tool' | 'approval' | 'memory' | 'reply' | 'receipt' | 'learning' | 'status';
  createdAt: string;
};

export type ExperienceReceipt = {
  id: string;
  title: string;
  detail: string;
  status: 'ready' | 'pending' | 'blocked' | 'failed';
  source: 'run' | 'approval' | 'learning' | 'safety' | 'system';
  createdAt: string;
};

export type ExperienceMemorySignal = {
  id: string;
  title: string;
  summary: string;
  layer: string;
  confidence?: number | null;
};

export type ExperienceLearningCandidate = {
  contractVersion: typeof LEARNING_CANDIDATE_CONTRACT_VERSION;
  id: string;
  title: string;
  origin: string;
  observedPattern: string;
  recommendation: string;
  confidence: number;
  impact: string;
  dataUsed: string[];
  suggestedAction: string;
  state: ExperienceLearningCandidateState;
  createdAt: string;
  updatedAt: string;
};

export type ExperienceTrustLens = {
  status: ExperienceHealthStatus;
  title: string;
  summary: string;
  risk: UniversalToolRiskLevel;
  approvalCount: number;
  sandbox: {
    mode: string;
    available: boolean;
    detail: string;
  };
  preferences: Array<{
    id: string;
    label: string;
    enabled: boolean;
    revocable: boolean;
  }>;
  actions: ExperienceAction[];
};

export type ExperienceJourneySnapshot = {
  id: string;
  kind: ExperienceJourneyKind;
  title: string;
  summary: string;
  status: 'idle' | 'planning' | 'running' | 'waiting_approval' | 'completed' | 'blocked';
  steps: ExperiencePlanStep[];
};

export type ExperienceSnapshot = {
  contractVersion: typeof EXPERIENCE_SNAPSHOT_CONTRACT_VERSION;
  generatedAt: string;
  surface: ExperienceSurface;
  sessionId: string | null;
  workspace: string | null;
  agent: ExperienceAgentState;
  journey: ExperienceJourneySnapshot;
  chat: {
    messages: ExperienceChatMessage[];
    suggestions: string[];
  };
  approvals: ExperienceApproval[];
  timeline: ExperienceTimelineItem[];
  receipts: ExperienceReceipt[];
  memory: {
    signals: ExperienceMemorySignal[];
    summary: string;
  };
  learning: {
    candidates: ExperienceLearningCandidate[];
    summary: string;
    pending: number;
  };
  trust: ExperienceTrustLens;
  nextActions: ExperienceAction[];
  health: {
    status: ExperienceHealthStatus;
    summary: string;
    warnings: string[];
  };
  raw?: Record<string, unknown>;
};

export type ExperienceCommandResult = {
  ok: boolean;
  handled: boolean;
  plan: ExperiencePlan;
  snapshot: ExperienceSnapshot;
  replies: ExperienceChatMessage[];
  receipts: ExperienceReceipt[];
  error: string | null;
};
