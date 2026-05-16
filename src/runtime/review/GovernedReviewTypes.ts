import type { AgentTeamCompilerSnapshot } from '../agent/AgentTeamCompilerService.js';
import type { SubagentResultReceipt } from '../agent/subagents/index.js';

export const GOVERNED_REVIEW_CONTRACT_VERSION = '2026-05-15.phase-4' as const;

export type GovernedReviewMode =
  | 'code-review'
  | 'security-review'
  | 'policy-review'
  | 'regression-review';

export type GovernedReviewStatus =
  | 'completed'
  | 'waiting_approval'
  | 'blocked'
  | 'failed';

export type GovernedReviewSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type GovernedReviewAgentRoleKind =
  | 'context'
  | 'bug-review'
  | 'security-review'
  | 'policy-review'
  | 'regression-review'
  | 'verifier';

export type GovernedReviewAgentRole = {
  id: string;
  kind: GovernedReviewAgentRoleKind;
  label: string;
  objective: string;
  readOnly: true;
  requiresApprovalBeforeMutation: true;
  policyTags: string[];
};

export type GovernedReviewContextFile = {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'unknown';
  additions?: number;
  deletions?: number;
  language?: string;
  summary?: string;
};

export type GovernedReviewContext = {
  source: 'provided' | 'empty';
  workspace: string | null;
  targetRef: string | null;
  baseRef: string | null;
  diffSummary: string;
  files: GovernedReviewContextFile[];
  instructions: string[];
  metadata: Record<string, unknown>;
};

export type GovernedReviewFinding = {
  id: string;
  title: string;
  severity: GovernedReviewSeverity;
  confidence: number;
  file?: string;
  line?: number;
  evidence: string[];
  recommendation: string;
  sourceAgentId: string;
  tags: string[];
  metadata: Record<string, unknown>;
};

export type GovernedReviewFindingVerificationStatus =
  | 'accepted'
  | 'needs-human-review'
  | 'discarded';

export type GovernedReviewVerifiedFinding = GovernedReviewFinding & {
  verification: {
    source: 'ReviewFindingVerifier';
    status: GovernedReviewFindingVerificationStatus;
    originalConfidence: number;
    adjustedConfidence: number;
    acceptedThreshold: number;
    humanReviewThreshold: number;
    reasons: string[];
  };
};

export type GovernedReviewVerificationSummary = {
  source: 'ReviewFindingVerifier';
  acceptedThreshold: number;
  humanReviewThreshold: number;
  inputFindingCount: number;
  acceptedFindingCount: number;
  needsHumanReviewFindingCount: number;
  discardedFindingCount: number;
  acceptedFindings: GovernedReviewVerifiedFinding[];
  needsHumanReviewFindings: GovernedReviewVerifiedFinding[];
  discardedFindings: GovernedReviewVerifiedFinding[];
  policyTags: string[];
};

export type GovernedReviewPolicyGateAction =
  | 'show-findings'
  | 'request-human-review'
  | 'comment-on-pr'
  | 'apply-patch'
  | 'launch-live-agents';

export type GovernedReviewPolicyGateDecision = {
  action: GovernedReviewPolicyGateAction;
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
  policyTags: string[];
};

export type GovernedReviewPolicyGate = {
  source: 'ReviewPolicyGate';
  status: 'allow-read-only' | 'allow-approved-actions' | 'approval-required' | 'blocked';
  decisions: GovernedReviewPolicyGateDecision[];
  summary: string;
};

export type GovernedReviewLiveAgentMode =
  | 'governed-in-process'
  | 'mock-live'
  | 'live-llm';

export type GovernedReviewPatchRequest = {
  filePath: string;
  patch: string;
  dryRun?: boolean | null;
};

export type GovernedReviewRequestedActions = {
  approvalId?: string | null;
  launchLiveAgents?: boolean | null;
  liveAgentMode?: GovernedReviewLiveAgentMode | null;
  maxLiveWorkers?: number | null;
  maxToolCalls?: number | null;
  persistSubagentState?: boolean | null;
  commentOnPr?: boolean | null;
  prTarget?: string | null;
  applyPatch?: boolean | null;
  patch?: GovernedReviewPatchRequest | null;
};

export type GovernedReviewActionStatus =
  | 'not-requested'
  | 'approval-required'
  | 'prepared'
  | 'completed'
  | 'blocked'
  | 'failed';

export type GovernedReviewActionOutcome = {
  action: GovernedReviewPolicyGateAction;
  status: GovernedReviewActionStatus;
  allowed: boolean;
  approvalId: string | null;
  summary: string;
  receiptId: string;
  metadata: Record<string, unknown>;
};

export type GovernedReviewExecutionSummary = {
  source: 'ReviewActionExecutor';
  status: 'not-requested' | 'approval-required' | 'completed' | 'partial' | 'blocked' | 'failed';
  approvalId: string | null;
  requestedActions: GovernedReviewPolicyGateAction[];
  outcomes: GovernedReviewActionOutcome[];
  liveAgentSnapshot: {
    status: string;
    selectedRunId: string | null;
    workerResults: number;
    failedWorkerResults: number;
    liveRuns: number;
    externalIoPerformed: boolean;
    outputPreview: string;
  } | null;
  summary: string;
  nextSafeAction: string;
};

export type GovernedReviewReceiptKind =
  | 'review-created'
  | 'context-collected'
  | 'agent-plan-created'
  | 'agent-team-compiled'
  | 'subagent-receipts-prepared'
  | 'finding-normalized'
  | 'finding-scored'
  | 'finding-verified'
  | 'policy-gate-evaluated'
  | 'live-agents-launched'
  | 'pr-comment-prepared'
  | 'patch-applied'
  | 'policy-boundary'
  | 'review-completed';

export type GovernedReviewReceipt = {
  id: string;
  kind: GovernedReviewReceiptKind;
  generatedAt: string;
  source: string;
  status: 'ready' | 'empty' | 'blocked' | 'needs-approval';
  detail: string;
  metadata: Record<string, unknown>;
};

export type GovernedReviewRequest = {
  reviewId?: string | null;
  mode?: GovernedReviewMode | null;
  objective: string;
  workspace?: string | null;
  targetRef?: string | null;
  baseRef?: string | null;
  diffSummary?: string | null;
  files?: GovernedReviewContextFile[] | null;
  instructions?: string[] | null;
  rawFindings?: Array<Partial<GovernedReviewFinding>> | null;
  actions?: GovernedReviewRequestedActions | null;
  metadata?: Record<string, unknown> | null;
};

export type GovernedReviewAgentRuntimePlan = {
  source: 'ReviewAgentOrchestrator';
  status: 'not-needed' | 'compiled' | 'waiting-approval' | 'blocked';
  reviewId: string;
  runId: string;
  teamCompiler: AgentTeamCompilerSnapshot;
  subagentReceipts: SubagentResultReceipt[];
  roleLinks: Array<{
    reviewRoleId: string;
    compilerRoleId: string;
    roleId: string;
    scopeMode: 'blocked' | 'read_only' | 'tool_limited' | 'workspace_patch';
    approvalRequired: boolean;
    budgetZero: boolean;
  }>;
  policy: {
    noSubagentsLaunched: true;
    compilerOnly: true;
    budgetsDefaultToZero: true;
    approvalRequiredBeforeLaunch: true;
    reviewAgentsReadOnly: true;
  };
  nextSafeAction: string;
};

export type GovernedReviewResult = {
  contractVersion: typeof GOVERNED_REVIEW_CONTRACT_VERSION;
  reviewId: string;
  mode: GovernedReviewMode;
  status: GovernedReviewStatus;
  objective: string;
  context: GovernedReviewContext;
  agentPlan: GovernedReviewAgentRole[];
  agentRuntimePlan: GovernedReviewAgentRuntimePlan;
  verification: GovernedReviewVerificationSummary;
  policyGate: GovernedReviewPolicyGate;
  execution: GovernedReviewExecutionSummary;
  findings: GovernedReviewVerifiedFinding[];
  receipts: GovernedReviewReceipt[];
  summary: string;
  nextSafeAction: string;
  policy: {
    readOnlyPhase: true;
    noMutationApplied: boolean;
    approvalRequiredBeforeMutation: true;
    externalEgressNotPerformed: boolean;
  };
};
