import type {
  UniversalAgentChannel,
  UniversalAgentRunStatus,
  UniversalToolRiskLevel,
} from '../../runtime/agent/UniversalAgentRuntimeTypes.js';

export const EXPERIENCE_SNAPSHOT_CONTRACT_VERSION = 'ExperienceSnapshot/v1' as const;
export const EXPERIENCE_COMMAND_CONTRACT_VERSION = 'ExperienceCommand/v1' as const;
export const EXPERIENCE_PLAN_CONTRACT_VERSION = 'ExperiencePlan/v1' as const;
export const LEARNING_CANDIDATE_CONTRACT_VERSION = 'LearningCandidate/v1' as const;
export const EXPERIENCE_ACTION_CARD_CONTRACT_VERSION = 'ExperienceActionCard/v1' as const;
export const EXPERIENCE_DIFF_REVIEW_CONTRACT_VERSION = 'ExperienceDiffReview/v1' as const;
export const EXPERIENCE_EXECUTION_GRAPH_CONTRACT_VERSION = 'ExperienceExecutionGraph/v1' as const;
export const EXPERIENCE_CONTEXT_RECOVERY_CONTRACT_VERSION = 'ExperienceContextRecovery/v1' as const;
export const EXPERIENCE_AUTO_HEALING_CONTRACT_VERSION = 'ExperienceAutoHealing/v1' as const;

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

export type ExperienceAutonomyMode = 'manual' | 'governed' | 'speculative';

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
  autonomyMode?: ExperienceAutonomyMode;
  approval?: {
    id: string;
    decision: ExperienceApprovalDecision;
  } | null;
  actionCardDecision?: {
    cardId: string;
    actionId: string;
  } | null;
  diffDecision?: {
    reviewId: string;
    targetId: string;
    decision: 'approve-plan' | 'approve-file' | 'approve-hunk' | 'reject-hunk' | 'retry-without-hunk';
  } | null;
  contextRecoveryDecision?: {
    recoveryId: string;
    optionId: string;
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
  kind: 'natural' | 'navigation' | 'approval' | 'learning' | 'diagnostic' | 'safety' | 'execution' | 'diff' | 'context' | 'healing';
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

export type ExperienceDailySnapshot = {
  summary: string;
  activeTask: string | null;
  health: ExperienceHealthStatus;
  nextSteps: string[];
  pendingApprovals: number;
  pendingLearning: number;
};

export type ExperienceActionCard = {
  contractVersion: typeof EXPERIENCE_ACTION_CARD_CONTRACT_VERSION;
  id: string;
  source: 'approval' | 'mutation' | 'sandbox' | 'learning' | 'context-recovery' | 'system';
  title: string;
  summary: string;
  risk: UniversalToolRiskLevel;
  status: 'pending' | 'approved' | 'rejected' | 'blocked' | 'ready';
  scope: string;
  sandbox: string;
  affectedFiles: string[];
  affectedCommands: string[];
  ttlSeconds: number | null;
  receiptHint: string;
  actions: ExperienceAction[];
  createdAt: string;
};

export type ExperienceDiffHunk = {
  id: string;
  header: string;
  status: 'pending' | 'approved' | 'rejected';
  addedLines: number;
  removedLines: number;
  preview: string[];
  risk: UniversalToolRiskLevel;
};

export type ExperienceDiffFile = {
  id: string;
  path: string;
  status: 'pending' | 'approved' | 'rejected';
  addedLines: number;
  removedLines: number;
  hunks: ExperienceDiffHunk[];
};

export type ExperienceDiffReview = {
  contractVersion: typeof EXPERIENCE_DIFF_REVIEW_CONTRACT_VERSION;
  id: string;
  runId: string | null;
  title: string;
  summary: string;
  status: 'empty' | 'pending' | 'partially-approved' | 'approved' | 'rejected';
  risk: UniversalToolRiskLevel;
  files: ExperienceDiffFile[];
  actions: ExperienceAction[];
};

export type ExperienceExecutionGraphNode = {
  id: string;
  label: string;
  kind: 'prompt' | 'safety' | 'router' | 'llm' | 'tool' | 'sandbox' | 'critic' | 'receipt' | 'approval';
  status: 'pending' | 'running' | 'done' | 'blocked' | 'failed';
  detail: string;
  createdAt: string;
};

export type ExperienceExecutionGraph = {
  contractVersion: typeof EXPERIENCE_EXECUTION_GRAPH_CONTRACT_VERSION;
  nodes: ExperienceExecutionGraphNode[];
  edges: Array<{ from: string; to: string; label: string }>;
};

export type ExperienceContextRecoveryOption = {
  id: string;
  label: string;
  detail: string;
  command: string;
  confidence: number;
};

export type ExperienceContextRecovery = {
  contractVersion: typeof EXPERIENCE_CONTEXT_RECOVERY_CONTRACT_VERSION;
  id: string;
  status: 'idle' | 'needs-selection' | 'resolved';
  question: string;
  options: ExperienceContextRecoveryOption[];
};

export type ExperienceAutoHealing = {
  contractVersion: typeof EXPERIENCE_AUTO_HEALING_CONTRACT_VERSION;
  status: 'idle' | 'running' | 'passed' | 'failed' | 'blocked';
  attempt: number;
  maxAttempts: number;
  lastErrorSummary: string | null;
  proposedCorrection: string | null;
  validationCommand: string | null;
};

export type ExperienceReasoningSummary = {
  understood: string;
  risk: UniversalToolRiskLevel;
  tools: string[];
  approvalReason: string | null;
  result: string;
  nextAction: string;
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
  daily?: ExperienceDailySnapshot;
  actionCards?: ExperienceActionCard[];
  diffReviews?: ExperienceDiffReview[];
  executionGraph?: ExperienceExecutionGraph;
  autoHealing?: ExperienceAutoHealing;
  contextRecovery?: ExperienceContextRecovery;
  reasoningSummary?: ExperienceReasoningSummary;
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
