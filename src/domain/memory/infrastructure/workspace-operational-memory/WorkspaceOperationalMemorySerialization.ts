import type {
  ApprovedPathAggregate,
  ApprovedPolicyAggregate,
  AutonomousModeRecommendation,
  AutonomousOutcomeAggregate,
  ContinuityRecommendation,
  DirectResponseStyleRecommendation,
  ExecutorAggregate,
  FailureAggregate,
  RecentArtifactAggregate,
  RecentWorkflowRunAggregate,
  RouteOutcomeAggregate,
  TaskKindLlmRecommendation,
  TaskKindRecommendation,
  TaskSubtypeLlmRecommendation,
  TaskSubtypeRecommendation,
  WorkspaceLastSuccessfulTask,
  WorkspaceOperationalMemory,
  WorkflowExecutorRecommendationAggregate,
  WorkflowFrictionRecommendationAggregate,
  WorkflowRecommendationAggregate,
  WorkflowStageExecutorRecommendationAggregate,
} from './WorkspaceOperationalMemoryTypes.js';

export interface WorkspaceOperationalMemoryMetadata {
  workspace: string;
  workspace_name: string;
  successful_executors: ExecutorAggregate[];
  repeated_failures: FailureAggregate[];
  task_kind_recommendations: TaskKindRecommendation[];
  task_subtype_recommendations: TaskSubtypeRecommendation[];
  task_kind_llm_recommendations: TaskKindLlmRecommendation[];
  task_subtype_llm_recommendations: TaskSubtypeLlmRecommendation[];
  approved_paths: ApprovedPathAggregate[];
  approved_policies: ApprovedPolicyAggregate[] | undefined;
  active_focuses: import('./WorkspaceOperationalMemoryTypes.js').ActiveFocusAggregate[];
  recent_artifacts: RecentArtifactAggregate[];
  recent_workflow_runs: RecentWorkflowRunAggregate[];
  workflow_recommendations: WorkflowRecommendationAggregate[];
  workflow_executor_recommendations: WorkflowExecutorRecommendationAggregate[] | undefined;
  workflow_stage_executor_recommendations: WorkflowStageExecutorRecommendationAggregate[] | undefined;
  workflow_friction_recommendations: WorkflowFrictionRecommendationAggregate[] | undefined;
  approval_friction_recommendations: import('./WorkspaceOperationalMemoryTypes.js').ApprovalFrictionAggregate[] | undefined;
  route_outcomes: RouteOutcomeAggregate[] | undefined;
  continuity_recommendations: ContinuityRecommendation[];
  autonomous_outcomes: AutonomousOutcomeAggregate[];
  autonomous_mode_recommendations: AutonomousModeRecommendation[];
  direct_response_style_recommendations: DirectResponseStyleRecommendation[];
  last_successful_task: WorkspaceLastSuccessfulTask | null;
  summary: string;
  last_refreshed: string;
}

export function buildWorkspaceOperationalMemoryMetadata(memory: WorkspaceOperationalMemory): WorkspaceOperationalMemoryMetadata {
  return {
    workspace: memory.workspace,
    workspace_name: memory.workspace_name,
    successful_executors: memory.successful_executors,
    repeated_failures: memory.repeated_failures,
    task_kind_recommendations: memory.task_kind_recommendations,
    task_subtype_recommendations: memory.task_subtype_recommendations,
    task_kind_llm_recommendations: memory.task_kind_llm_recommendations,
    task_subtype_llm_recommendations: memory.task_subtype_llm_recommendations,
    approved_paths: memory.approved_paths,
    approved_policies: memory.approved_policies,
    active_focuses: memory.active_focuses,
    recent_artifacts: memory.recent_artifacts,
    recent_workflow_runs: memory.recent_workflow_runs,
    workflow_recommendations: memory.workflow_recommendations,
    workflow_executor_recommendations: memory.workflow_executor_recommendations,
    workflow_stage_executor_recommendations: memory.workflow_stage_executor_recommendations,
    workflow_friction_recommendations: memory.workflow_friction_recommendations,
    approval_friction_recommendations: memory.approval_friction_recommendations,
    route_outcomes: memory.route_outcomes,
    continuity_recommendations: memory.continuity_recommendations,
    autonomous_outcomes: memory.autonomous_outcomes,
    autonomous_mode_recommendations: memory.autonomous_mode_recommendations,
    direct_response_style_recommendations: memory.direct_response_style_recommendations,
    last_successful_task: memory.last_successful_task,
    summary: memory.summary,
    last_refreshed: memory.last_refreshed,
  };
}
