import type { PermissionRequest } from '../../../../contracts/PermissionRequest.js';
import type { Task } from '../../../../contracts/TaskContract.js';
import type {
  WorkflowKind,
  WorkflowRunSnapshot,
} from '../../../../runtime/workflows/WorkflowRunService.js';
import type {
  WorkspaceResponseStyle,
  WorkspaceTaskKind,
  WorkspaceTaskSubtype,
} from '../../../../services/WorkspaceTaskKind.js';

export interface PermissionMetadataMatch {
  [key: string]: string | number | boolean | null | undefined;
}

export type MemoryConfidence = 'low' | 'medium' | 'high';

export interface ApprovalHistoryEntry {
  action?: string;
  required_high_risk_pin?: boolean;
  [key: string]: unknown;
}

export interface PermissionHistoryEntry {
  action?: string;
  [key: string]: unknown;
}

export type WorkspaceOperationalMemoryRecord = {
  [K in keyof WorkspaceOperationalMemory]?: WorkspaceOperationalMemory[K];
};

export type PartialWorkspaceOperationalMemory =
  | WorkspaceOperationalMemory
  | Record<string, unknown>;

export type TaskManagerLike = {
  getRecentTasks(limit?: number, userId?: string): Task[];
};

export type PermissionServiceLike = {
  listApprovedRequests(
    executor?: string,
    kind?: string,
    workspace?: string | null,
    metadataMatch?: Record<string, string | number | boolean | null>,
  ): Promise<PermissionRequest[]>;
};

export type ExecutorAggregate = {
  executor: string;
  count: number;
  last_seen_at: string;
};

export type FailureAggregate = {
  executor: string;
  summary: string;
  count: number;
  last_seen_at: string;
};

export type ApprovedPathAggregate = {
  executor: string;
  path: string;
  scope: string;
  last_seen_at: string;
};

export type AutonomousOutcomeAggregate = {
  status: string;
  approved: boolean;
  iterations: number;
  trace_id: string | null;
  summary: string;
  task_kind: WorkspaceTaskKind;
  task_subtype: WorkspaceTaskSubtype;
  preferred_executor: string | null;
  updated_at: string;
};

export type AutonomousModeRecommendation = {
  kind: WorkspaceTaskKind;
  subtype: WorkspaceTaskSubtype;
  preferred_mode: 'autonomous' | 'direct';
  approved_count: number;
  failed_count: number;
  last_seen_at: string;
  confidence: MemoryConfidence;
  rationale: string;
};

export type DirectResponseStyleRecommendation = {
  kind: WorkspaceTaskKind;
  subtype: WorkspaceTaskSubtype;
  preferred_style: WorkspaceResponseStyle;
  success_count: number;
  last_seen_at: string;
  confidence: MemoryConfidence;
  rationale: string;
};

export type TaskKindLlmRecommendation = {
  kind: WorkspaceTaskKind;
  subtype: 'general';
  preferred_provider: string;
  preferred_model: string | null;
  success_count: number;
  last_seen_at: string;
  confidence: MemoryConfidence;
  rationale: string;
};

export type TaskSubtypeLlmRecommendation = {
  kind: WorkspaceTaskKind;
  subtype: WorkspaceTaskSubtype;
  preferred_provider: string;
  preferred_model: string | null;
  success_count: number;
  last_seen_at: string;
  confidence: MemoryConfidence;
  rationale: string;
};

export type TaskKindRecommendation = {
  kind: WorkspaceTaskKind;
  preferred_executor: string | null;
  success_count: number;
  repeated_failure_executor: string | null;
  repeated_failure_summary: string | null;
  repeated_failure_count: number;
  last_seen_at: string;
};

export type TaskSubtypeRecommendation = {
  kind: WorkspaceTaskKind;
  subtype: WorkspaceTaskSubtype;
  preferred_executor: string | null;
  success_count: number;
  repeated_failure_executor: string | null;
  repeated_failure_summary: string | null;
  repeated_failure_count: number;
  last_seen_at: string;
};

export type ActiveFocusAggregate = {
  task_id: string;
  short_id: string;
  status: Task['status'];
  approval_status: Task['approval_status'];
  executor: string;
  kind: WorkspaceTaskKind;
  subtype: WorkspaceTaskSubtype;
  summary: string;
  updated_at: string;
};

export type RecentArtifactAggregate = {
  task_id: string;
  artifact_id: string;
  name: string;
  kind: string;
  type: string;
  path: string | null;
  url: string | null;
  summary: string | null;
  created_at: string;
  executor: string;
};

export type ContinuityRecommendation = {
  kind:
    | 'resolve_approval'
    | 'resume_active'
    | 'resume_workflow'
    | 'revisit_failure'
    | 'reuse_recent_artifact'
    | 'continue_from_success';
  label: string;
  reason: string;
  task_id: string | null;
  artifact_name: string | null;
  executor: string | null;
};

export type RecentWorkflowRunAggregate = {
  workflow_run_id: string;
  workflow_name: WorkflowKind;
  status: WorkflowRunSnapshot['status'];
  operator_state?: 'active' | 'closed';
  operator_close_reason?: string | null;
  completed_stages: number;
  total_stages: number;
  primary_artifact_name: string | null;
  resume_stage_label?: string | null;
  resume_stage_status?: 'approval_pending' | 'blocked' | 'failed' | null;
  resume_stage_reason?: string | null;
  interruption_count?: number;
  recovered_from_interruption?: boolean;
  last_interrupted_stage_label?: string | null;
  recent_checkpoint_events?: string[];
  updated_at: string;
  stage_executors?: Array<{
    executor: string;
    role: string;
    status: WorkflowRunSnapshot['phases'][number]['status'];
    attempt_count: number;
  }>;
};

export type WorkflowRecommendationAggregate = {
  workflow: WorkflowKind;
  success_count: number;
  pending_count: number;
  failed_count: number;
  recovered_count: number;
  last_recovered_stage_label: string | null;
  last_seen_at: string;
  confidence: MemoryConfidence;
  rationale: string;
};

export type WorkflowExecutorRecommendationAggregate = {
  workflow: WorkflowKind;
  executor: string;
  success_count: number;
  recovered_count: number;
  pending_count: number;
  failed_count: number;
  last_seen_at: string;
  confidence: MemoryConfidence;
  rationale: string;
};

export type WorkflowStageExecutorRecommendationAggregate = {
  workflow: WorkflowKind;
  role: string;
  executor: string;
  success_count: number;
  recovered_count: number;
  pending_count: number;
  failed_count: number;
  last_seen_at: string;
  confidence: MemoryConfidence;
  rationale: string;
};

export type WorkflowFrictionRecommendationAggregate = {
  workflow: WorkflowKind;
  approval_pending_count: number;
  blocked_count: number;
  failed_count: number;
  recovered_count: number;
  last_resume_stage_label: string | null;
  last_recovered_stage_label: string | null;
  last_seen_at: string;
  confidence: MemoryConfidence;
  rationale: string;
};

export type ApprovalFrictionAggregate = {
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
  last_seen_at: string;
  confidence: MemoryConfidence;
  rationale: string;
};

export type ApprovedPolicyAggregate = {
  executor: string;
  kind: string;
  scope: string | null;
  policy_family: string | null;
  requested_value: string | null;
  resolved_value: string | null;
  access_level: string | null;
  match_type: string | null;
  last_seen_at: string;
  confidence: MemoryConfidence;
  rationale: string;
};

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
  gated_completion_count: number;
  gated_artifactful_count: number;
  rejected_count: number;
  high_risk_count: number;
  artifactful_count: number;
  workflow_recovered_count: number;
  workflow_recovery_success_count: number;
  workflow_recovery_artifactful_count: number;
  average_duration_ms: number;
  average_approval_wait_ms: number;
  average_post_approval_recovery_ms: number;
  average_artifact_delivery_after_approval_ms: number;
  operator_cost_score: number;
  success_rate: number;
  friction_rate: number;
  last_seen_at: string;
  confidence: MemoryConfidence;
  rationale: string;
};

export type MutableApprovalFrictionAggregate = ApprovalFrictionAggregate & {
  wait_total_ms: number;
  wait_samples: number;
  recovery_total_ms: number;
  recovery_samples: number;
};

export type MutableRouteOutcomeAggregate = RouteOutcomeAggregate & {
  approval_wait_total_ms: number;
  approval_wait_samples: number;
  post_approval_recovery_total_ms: number;
  post_approval_recovery_samples: number;
  artifact_delivery_after_approval_total_ms: number;
  artifact_delivery_after_approval_samples: number;
};

export type WorkspaceLastSuccessfulTask = {
  executor: string;
  summary: string | null;
  updated_at: string;
  task_id: string;
};

export interface WorkspaceOperationalMemory {
  workspace: string;
  workspace_name: string;
  slug: string;
  last_refreshed: string;
  successful_executors: ExecutorAggregate[];
  repeated_failures: FailureAggregate[];
  task_kind_recommendations: TaskKindRecommendation[];
  task_subtype_recommendations: TaskSubtypeRecommendation[];
  task_kind_llm_recommendations: TaskKindLlmRecommendation[];
  task_subtype_llm_recommendations: TaskSubtypeLlmRecommendation[];
  approved_paths: ApprovedPathAggregate[];
  approved_policies?: ApprovedPolicyAggregate[];
  active_focuses: ActiveFocusAggregate[];
  recent_artifacts: RecentArtifactAggregate[];
  recent_workflow_runs: RecentWorkflowRunAggregate[];
  workflow_recommendations: WorkflowRecommendationAggregate[];
  workflow_executor_recommendations?: WorkflowExecutorRecommendationAggregate[];
  workflow_stage_executor_recommendations?: WorkflowStageExecutorRecommendationAggregate[];
  workflow_friction_recommendations?: WorkflowFrictionRecommendationAggregate[];
  approval_friction_recommendations?: ApprovalFrictionAggregate[];
  route_outcomes?: RouteOutcomeAggregate[];
  continuity_recommendations: ContinuityRecommendation[];
  autonomous_outcomes: AutonomousOutcomeAggregate[];
  autonomous_mode_recommendations: AutonomousModeRecommendation[];
  direct_response_style_recommendations: DirectResponseStyleRecommendation[];
  last_successful_task: WorkspaceLastSuccessfulTask | null;
  summary: string;
}
