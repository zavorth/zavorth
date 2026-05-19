import type { ArtifactRecord } from "../../contracts/ArtifactContract.js";
import type { ExecutionResult } from "../../contracts/ExecutionContract.js";
import type { ExecutionLifecycleRecord } from "../../contracts/ExecutionLifecycleContract.js";
import type { WorkflowRunExternalizedStateSnapshot } from "../WorkflowExternalizedStateService.js";

export type WorkflowKind = "review" | "ship" | "research" | "sdd";
export type WorkflowStageExecutor = "external_executor" | "codex" | "aistudio";
export type WorkflowStageStatus =
  | "pending"
  | "running"
  | "completed"
  | "blocked"
  | "failed"
  | "approval_pending";

export type WorkflowStageDefinition = {
  id: string;
  executor: WorkflowStageExecutor;
  role: string;
  label: string;
  intro: string;
  strategy_note?: string | null;
  writeScope?: string[] | null;
  buildObjective: (input: {
    originalObjective: string;
    previousResults: ExecutionResult[];
    workspaceContext?: WorkflowWorkspaceContext | null;
  }) => string;
};

export type WorkflowWorkspaceExecutorRecommendation = {
  workflow: WorkflowKind;
  executor: string;
  success_count: number;
  pending_count: number;
  failed_count: number;
  confidence: "low" | "medium" | "high";
  rationale: string;
};

export type WorkflowWorkspaceStageExecutorRecommendation = {
  workflow: WorkflowKind;
  role: string;
  executor: string;
  success_count: number;
  pending_count: number;
  failed_count: number;
  confidence: "low" | "medium" | "high";
  rationale: string;
};

export type WorkflowWorkspaceFrictionRecommendation = {
  workflow: WorkflowKind;
  approval_pending_count: number;
  blocked_count: number;
  failed_count: number;
  last_resume_stage_label: string | null;
  confidence: "low" | "medium" | "high";
  rationale: string;
};

export type WorkflowWorkspaceApprovalFrictionRecommendation = {
  executor: string;
  kind: string;
  subtype: string;
  pending_count: number;
  rejected_count: number;
  high_risk_count: number;
  permission_count: number;
  confidence: "low" | "medium" | "high";
  rationale: string;
};

export type WorkflowRunOriginSnapshot = {
  origin_task_id: string | null;
  origin_user_id: string | null;
  runtime_user_id: string | null;
  tenant_id: string | null;
  source_surface: string | null;
  route_strategy: string | null;
  route_source: string | null;
  parent_chat_id: string | null;
};

export type WorkflowRunTriggerSnapshot = {
  task_kind: string | null;
  task_subtype: string | null;
  feature_id: string | null;
};

export type WorkflowWorkspaceContext = {
  profile_summary: string | null;
  operational_summary: string | null;
  profile_notes: string[];
  operational_notes: string[];
  active_focus: {
    summary: string;
    executor: string | null;
    status: string | null;
  } | null;
  recent_artifact: {
    name: string;
    kind: string | null;
    summary: string | null;
  } | null;
  continuity_recommendation: {
    label: string;
    reason: string;
    executor: string | null;
  } | null;
  workflow_executor_recommendations?: WorkflowWorkspaceExecutorRecommendation[];
  workflow_stage_executor_recommendations?: WorkflowWorkspaceStageExecutorRecommendation[];
  workflow_friction_recommendations?: WorkflowWorkspaceFrictionRecommendation[];
  approval_friction_recommendations?: WorkflowWorkspaceApprovalFrictionRecommendation[];
};

export type WorkflowRunStageSnapshot = {
  id: string;
  label: string;
  executor: WorkflowStageExecutor;
  role: string;
  strategy_note: string | null;
  index: number;
  status: WorkflowStageStatus;
  task_id: string | null;
  attempt_count: number;
  objective: string | null;
  handoff_summary: string | null;
  started_at: string | null;
  finished_at: string | null;
  result_summary: string | null;
  artifact_count: number;
};

export type WorkflowRunResumeStageSnapshot = {
  id: string;
  label: string;
  executor: WorkflowStageExecutor;
  strategy_note: string | null;
  status: Extract<
    WorkflowStageStatus,
    "approval_pending" | "blocked" | "failed"
  >;
  index: number;
  attempt_count: number;
  task_id: string | null;
  objective: string | null;
  handoff_summary: string | null;
  result_summary: string | null;
  reason: string;
};

export type WorkflowRunActionableStageSnapshot = {
  id: string;
  label: string;
  executor: WorkflowStageExecutor;
  status: Extract<
    WorkflowStageStatus,
    "approval_pending" | "blocked" | "failed" | "completed"
  >;
  index: number;
  task_id: string | null;
  objective: string | null;
  handoff_summary: string | null;
  result_summary: string | null;
  reason: string;
  action: "continue" | "destravar" | "refazer" | "reexecutar";
};

export type WorkflowRunSnapshot = {
  workflow_run_id: string;
  workflow_name: WorkflowKind;
  objective: string;
  workspace: string;
  origin: WorkflowRunOriginSnapshot;
  trigger: WorkflowRunTriggerSnapshot;
  workspace_context: WorkflowWorkspaceContext | null;
  created_at: string;
  updated_at: string;
  status: "running" | "completed" | "blocked" | "failed" | "approval_pending";
  operator_state: "active" | "closed";
  operator_closed_at: string | null;
  operator_close_reason: string | null;
  operator_closed_by_surface: string | null;
  phases: WorkflowRunStageSnapshot[];
  resume_stage: WorkflowRunResumeStageSnapshot | null;
  actionable_stages: WorkflowRunActionableStageSnapshot[];
  resume_prompt: string | null;
  artifacts: ArtifactRecord[];
  artifacts_manifest: Record<string, any>;
  execution_lifecycle?: ExecutionLifecycleRecord[];
  externalized_state: WorkflowRunExternalizedStateSnapshot | null;
};

export type WorkflowRunServiceRuntime = {
  storageDir?: string;
  persist?: boolean;
  now?: () => Date;
};

export type WorkflowRunCreateOptions = {
  origin?: Partial<WorkflowRunOriginSnapshot> | null;
  trigger?: Partial<WorkflowRunTriggerSnapshot> | null;
};

export type WorkflowStageDecisionAction = "approve" | "reject";
