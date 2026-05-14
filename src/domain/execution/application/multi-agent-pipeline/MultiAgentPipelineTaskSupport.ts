import { v4 as uuidv4 } from 'uuid';
import type { ExecutionResult } from '../../../../contracts/ExecutionContract.js';
import type { Plan } from '../../../../contracts/PlanContract.js';
import type { Task } from '../../../../contracts/TaskContract.js';
import { ArtifactPipelineService } from '../../../../runtime/artifacts/ArtifactPipelineService.js';
import type {
  WorkflowKind,
  WorkflowRunService,
  WorkflowRunSnapshot,
  WorkflowWorkspaceContext,
} from '../../../../services/WorkflowRunService.js';
import type { WorkflowStage } from './MultiAgentPipelineTypes.js';
import type { MultiAgentPipelinePresentation } from './MultiAgentPipelinePresentation.js';

type MultiAgentPipelineTaskSupportDeps = {
  workflowRuns: WorkflowRunService;
  presentation: MultiAgentPipelinePresentation;
  artifactPipeline?: ArtifactPipelineService;
};

export class MultiAgentPipelineTaskSupport {
  private readonly artifactPipeline: ArtifactPipelineService;

  constructor(private readonly deps: MultiAgentPipelineTaskSupportDeps) {
    this.artifactPipeline = deps.artifactPipeline || new ArtifactPipelineService();
  }

  public createTask(
    workflow: WorkflowKind,
    objective: string,
    workspace: string,
    stage: WorkflowStage,
    run: WorkflowRunSnapshot,
    stageIndex: number,
    handoffSummary: string | null,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): Task {
    const now = new Date().toISOString();
    const previousStageAttempt = run.stages.find((entry) => entry.id === stage.id) || null;
    const runtimeUserId = String(run.origin.runtime_user_id || run.origin.origin_user_id || '').trim() || 'workflow';
    const parentTaskId = previousStageAttempt?.task_id || run.origin.origin_task_id || null;
    const writeScopeMetadata = this.buildWorkflowWriteScopeMetadata(workflow, workspace, stage);

    return {
      task_id: uuidv4(),
      created_at: now,
      updated_at: now,
      source: 'system',
      chat_id: `workflow:${run.workflow_run_id}`,
      user_id: runtimeUserId,
      raw_message: objective,
      normalized_message: objective.toLowerCase(),
      command_type: '/workflow',
      intent: `workflow_${workflow}`,
      target: null,
      workspace,
      risk_level: 1,
      status: 'running',
      requires_planning: false,
      requires_approval: false,
      approval_status: 'not_required',
      planner_used: null,
      executor_used: stage.executor,
      fallback_used: false,
      parent_task_id: parentTaskId,
      actions_planned: [],
      actions_executed: [],
      target_files: [],
      artifacts: [],
      stdout_summary: null,
      stderr_summary: null,
      diff_summary: null,
      result_summary: null,
      error_summary: null,
      rollback_available: false,
      metadata: {
        ...this.deps.workflowRuns.buildTaskMetadata(run, stage, stageIndex, handoffSummary, workspaceContext),
        ...writeScopeMetadata,
        target_agent: stage.role,
        workflow_stage_attempt: Math.max(0, Number(previousStageAttempt?.attempt_count || 0)) + 1,
        workflow_previous_task_id: previousStageAttempt?.task_id || null,
        ...(stage.executor === 'external_executor'
          ? {
              external_executor_agent_id: stage.role,
              external_executor_agent_role: stage.role,
            }
          : {}),
      },
    };
  }

  public createPlan(
    task: Task,
    objective: string,
    workspace: string,
    stage: WorkflowStage,
    run: WorkflowRunSnapshot,
    handoffSummary: string | null,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): Plan {
    const fileTargets = Array.isArray(stage.writeScope) && stage.writeScope.length > 0
      ? [...stage.writeScope]
      : [workspace];
    return {
      plan_id: uuidv4(),
      task_id: task.task_id,
      objective,
      context: this.deps.presentation.buildPlanContext(run.workflow_name, stage, workspaceContext),
      assumptions: [
        `${stage.label} deve atuar apenas no workspace aprovado.`,
        ...(workspaceContext?.active_focus ? [`Respeitar o foco ativo do workspace: ${workspaceContext.active_focus.summary}`] : []),
      ],
      executor_recommendation: stage.executor,
      workspace_recommendation: workspace,
      risk_level: 1,
      requires_approval: false,
      steps: [
        {
          step_id: `${task.task_id}-step-1`,
          type: 'exec',
          description: objective,
          tool: null,
          args: null,
          command: objective,
          file_targets: fileTargets,
          expected_output: 'Resumo do que foi feito e risco restante.',
          sensitive: false,
        },
      ],
      validation_steps: [],
      success_condition: 'A etapa conclui sem violar politicas.',
      rollback_condition: null,
      notes: [
        ...this.deps.workflowRuns.buildPlanNotes(run, stage, handoffSummary, workspaceContext),
        ...(stage.executor === 'external_executor' ? [`external_executor_agent_id=${task.metadata.external_executor_agent_id}`] : []),
        ...(fileTargets.length > 0 ? [`write_scope=${fileTargets.join(' | ')}`] : []),
      ],
    };
  }

  public applyExecutionResult(task: Task, result: ExecutionResult, summary: string): void {
    task.stdout_summary = String(result.stdout || '').trim() || null;
    task.stderr_summary = String(result.stderr || '').trim() || null;
    task.diff_summary = String(result.diff_summary || '').trim() || null;
    task.result_summary = summary || null;
    task.error_summary = result.success
      ? null
      : String(result.error_message || result.stderr || '').trim() || null;
    task.rollback_available = Boolean(result.rollback_available);
    task.artifacts = this.artifactPipeline.normalizeArtifacts(
      Array.isArray(result.artifacts) ? result.artifacts : [],
      task.executor_used || 'workflow',
    );
  }

  private buildWorkflowWriteScopeMetadata(
    workflow: WorkflowKind,
    workspace: string,
    stage: WorkflowStage,
  ): Record<string, unknown> {
    const writeScope = Array.isArray(stage.writeScope)
      ? Array.from(new Set(stage.writeScope.map((item) => String(item || '').trim()).filter(Boolean)))
      : [];
    if (workflow !== 'sdd' || writeScope.length === 0) {
      return {};
    }

    const normalizedWorkspace = String(workspace || '').trim();
    const extraAllowedPathPolicies = [
      ...(normalizedWorkspace
        ? [
            {
              path: normalizedWorkspace,
              access_level: 'read_only',
              scope: 'once',
              source: 'workflow_write_scope',
            },
          ]
        : []),
      ...writeScope.map((pathValue) => ({
        path: pathValue,
        access_level: 'read_write',
        scope: 'once',
        source: 'workflow_write_scope',
      })),
    ];

    return {
      workflow_write_scope: writeScope,
      workflow_write_scope_enforced: true,
      extra_allowed_paths: writeScope,
      extra_allowed_path_policies: extraAllowedPathPolicies,
    };
  }
}
