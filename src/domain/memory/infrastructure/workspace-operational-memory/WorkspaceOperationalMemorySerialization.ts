import type { WorkspaceOperationalMemory } from './WorkspaceOperationalMemoryTypes.js';

export function buildWorkspaceOperationalMemoryMetadata(memory: WorkspaceOperationalMemory): Record<string, any> {
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
