import type { ParsedCommand } from '../../telegram/CommandParser.js';
import type { RouteIntent } from '../../orchestrator/IntentRouter.js';
import type { WorkspaceProfile } from '../WorkspaceProfileService.js';
import type { WorkspaceOperationalMemory } from '../WorkspaceOperationalMemoryService.js';
import type {
  WorkspaceResponseStyle,
  WorkspaceTaskKind,
  WorkspaceTaskSubtype,
} from '../WorkspaceTaskKind.js';

export type RoutingCandidateSource =
  | 'active_focus'
  | 'workflow_memory'
  | 'workflow_stage_memory'
  | 'subtype_memory'
  | 'kind_memory'
  | 'profile_default'
  | 'success_history';

export type RoutingCandidate = {
  executor: string;
  source: RoutingCandidateSource;
  confidence: number;
  rationale: string;
};

export type LlmRecommendation = {
  provider: string;
  model: string | null;
  source: 'subtype_memory' | 'kind_memory';
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
} | null;

export type WorkflowRecommendation = {
  workflow: 'review' | 'ship' | 'research';
  confidence: number;
  rationale: string;
  recovered_count?: number;
} | null;

export type WorkflowStageExecutorRecommendation = {
  workflow: 'review' | 'ship' | 'research';
  role: 'maker' | 'reviewer' | 'researcher' | 'synthesizer';
  executor: string;
  success_count: number;
  recovered_count?: number;
  pending_count: number;
  failed_count: number;
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
} | null;

export type WorkflowFrictionRecommendation = {
  workflow: 'review' | 'ship' | 'research';
  approval_pending_count: number;
  blocked_count: number;
  failed_count: number;
  recovered_count?: number;
  last_resume_stage_label: string | null;
  last_recovered_stage_label?: string | null;
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
} | null;

export type ApprovalFrictionRecommendation = {
  executor: string;
  kind: WorkspaceTaskKind;
  subtype: WorkspaceTaskSubtype;
  pending_count: number;
  rejected_count: number;
  high_risk_count: number;
  permission_count: number;
  granted_count: number;
  delivered_after_approval_count: number;
  average_wait_ms: number;
  average_recovery_ms: number;
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
} | null;

export type ApprovedPolicyAggregate = {
  executor: string;
  kind: string;
  scope: string | null;
  policy_family: string | null;
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
} | null;

export type RouteOutcomeAggregate = {
  executor: string;
  source: string | null;
  source_surface: string | null;
  strategy: string | null;
  workflow_name: string | null;
  task_kind: WorkspaceTaskKind;
  task_subtype: WorkspaceTaskSubtype;
  total_count: number;
  completed_count: number;
  failed_count: number;
  approval_pending_count: number;
  approval_granted_count: number;
  approval_rejected_count: number;
  permission_pending_count: number;
  permission_granted_count: number;
  permission_rejected_count: number;
  gated_completion_count?: number;
  gated_artifactful_count?: number;
  rejected_count: number;
  high_risk_count: number;
  artifactful_count: number;
  workflow_recovered_count?: number;
  workflow_recovery_success_count?: number;
  workflow_recovery_artifactful_count?: number;
  average_duration_ms: number;
  average_approval_wait_ms?: number;
  average_post_approval_recovery_ms?: number;
  average_artifact_delivery_after_approval_ms?: number;
  operator_cost_score?: number;
  success_rate: number;
  friction_rate: number;
  last_seen_at: string;
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
} | null;

export type AdviceInput = {
  parsed: ParsedCommand;
  route: RouteIntent;
  surface_source?: string | null;
  workspaceProfile?: WorkspaceProfile | null;
  workspaceOperationalMemory?: WorkspaceOperationalMemory | Record<string, any> | null;
};

export type WorkspaceRoutingAdvice = {
  executor: string | null;
  source: RoutingCandidateSource | 'none';
  confidence: number;
  task_kind: WorkspaceTaskKind;
  task_subtype: WorkspaceTaskSubtype;
  response_style: WorkspaceResponseStyle;
  llm_recommendation: LlmRecommendation;
  workflow_recommendation: WorkflowRecommendation;
  rationale: string[];
  blocked_executors: string[];
};
