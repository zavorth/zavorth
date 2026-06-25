import type { Context } from 'grammy';
import type { ExecutionResult } from '../../../../contracts/ExecutionContract.js';
import type { Task } from '../../../../contracts/TaskContract.js';
import type { SddAgentRole } from '../../../../services/SddFeatureWorkspaceService.js';
import type { WorkflowRunSnapshot, WorkflowWorkspaceContext } from '../../../../services/WorkflowRunService.js';
import type {
  PipelineGateway,
  PipelineSddOrchestrator,
  PipelineTaskManager,
  WorkflowStage,
} from './MultiAgentPipelineTypes.js';
import type { MultiAgentPipelinePresentation } from './MultiAgentPipelinePresentation.js';
import type { MultiAgentPipelineTaskSupport } from './MultiAgentPipelineTaskSupport.js';
import type { MultiAgentWorkflowPlannerService } from './MultiAgentWorkflowPlannerService.js';
import {
  replyWorkflowOperationalSurfaceResponse,
  replyWorkflowStageSurfaceResponse,
  type TelegramWorkflowSurfaceReceiptStatus,
} from '../../../../gateways/channels/telegram/TelegramWorkflowSurfaceResponses.js';

type MultiAgentPipelineRunnerDeps = {
  executionGateway: PipelineGateway;
  workflowRuns: {
    markStageStarted: (
      run: WorkflowRunSnapshot,
      stageId: string,
      objective: string,
      handoffSummary: string | null,
      taskId: string,
    ) => void;
    markStageInterrupted: (
      run: WorkflowRunSnapshot,
      stageId: string,
      status: 'approval_pending' | 'blocked' | 'failed',
      reason: string,
    ) => void;
    markStageCompleted: (
      run: WorkflowRunSnapshot,
      stageId: string,
      result: ExecutionResult,
      summary: string,
    ) => void;
    buildCompletionSummary: (run: WorkflowRunSnapshot) => {
      lead: string;
      details: string[];
    };
  };
  taskManager: PipelineTaskManager | null;
  sddOrchestrator: PipelineSddOrchestrator;
  workflowPlanner: MultiAgentWorkflowPlannerService;
  presentation: MultiAgentPipelinePresentation;
  taskSupport: MultiAgentPipelineTaskSupport;
};

export class MultiAgentPipelineRunner {
  constructor(private readonly deps: MultiAgentPipelineRunnerDeps) {}

  public async continueWorkflow(
    ctx: Context,
    run: WorkflowRunSnapshot,
    stages: WorkflowStage[],
    startIndex: number,
    stageResults: ExecutionResult[],
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): Promise<void> {
    for (let index = startIndex; index < stages.length; index += 1) {
      const stage = stages[index];
      await this.replyWorkflowNotice(
        ctx,
        run,
        stage,
        `Etapa ${index + 1}/${stages.length}`,
        stage.label,
        this.deps.presentation.formatStageIntro(stage, index, stages.length),
      );
      const handoffSummary = stageResults.length > 0
        ? this.deps.workflowPlanner.summarizeResult(stageResults[stageResults.length - 1])
        : null;
      const existingStage = run.phases.find((entry) => entry.id === stage.id);
      const shouldReuseObjective = Boolean(existingStage?.objective)
        && ((startIndex > 0 && index === startIndex) || run.workflow_name === 'sdd');
      const stageObjectiveBase = shouldReuseObjective
        ? String(existingStage?.objective || '')
        : stage.buildObjective({
            originalObjective: run.objective,
            previousResults: stageResults,
            workspaceContext,
          });
      const stageObjective = shouldReuseObjective
        ? stageObjectiveBase
        : this.deps.presentation.decorateObjectiveWithWorkspaceContext(stageObjectiveBase, workspaceContext);
      const result = await this.runStage(
        ctx,
        stage,
        stageObjective,
        run.workspace,
        run,
        index,
        handoffSummary ?? existingStage?.handoff_summary ?? null,
        workspaceContext,
      );
      if (!result) {
        await replyWorkflowOperationalSurfaceResponse(
          ctx,
          {
            id: `workflow-${run.workflow_run_id}-pause`,
            intent: 'receipt',
            title: 'Workflow pausado',
            summary: `Run: ${run.workflow_run_id}`,
            tone: 'warning',
            text: this.deps.presentation.formatWorkflowPauseOrFailure(run),
            receipt: {
              id: run.workflow_run_id,
              title: `${run.workflow_name} workflow`,
              status: 'require_user_confirmation',
              reason: 'Workflow pausado antes da conclusao.',
              policyProfile: 'workflow-runtime',
              redacted: true,
              riskBlocked: false,
            },
          },
        );
        return;
      }
      stageResults.push(result);
    }

    const finalResult = stageResults[stageResults.length - 1];
    await replyWorkflowOperationalSurfaceResponse(
      ctx,
      {
        id: `workflow-${run.workflow_run_id}-complete`,
        intent: 'receipt',
        title: 'Workflow concluido',
        summary: this.deps.presentation.describeWorkflow(run.workflow_name),
        tone: 'success',
        text: this.deps.presentation.formatWorkflowCompletion(run.workflow_name, finalResult, run),
        receipt: {
          id: run.workflow_run_id,
          title: `${run.workflow_name} workflow`,
          status: 'done',
          reason: 'Todas as etapas disponiveis foram processadas.',
          policyProfile: 'workflow-runtime',
          redacted: true,
          riskBlocked: false,
        },
      },
    );
  }

  public resolveResumeStageIndex(run: WorkflowRunSnapshot, requestedStageId?: string | null): number {
    const requested = String(requestedStageId || '').trim();
    if (requested) {
      return run.phases.findIndex((stage) => stage.id === requested);
    }

    const resumableStatus = new Set<WorkflowRunSnapshot['phases'][number]['status']>([
      'approval_pending',
      'blocked',
      'failed',
      'running',
      'pending',
    ]);
    return run.phases.findIndex((stage) => resumableStatus.has(stage.status));
  }

  public buildHistoricalResults(run: WorkflowRunSnapshot, untilStageIndex: number): ExecutionResult[] {
    return run.phases
      .filter((stage) => stage.index < untilStageIndex && stage.status === 'completed')
      .sort((left, right) => left.index - right.index)
      .map((stage) => this.toHistoricalExecutionResult(run, stage));
  }

  private async runStage(
    ctx: Context,
    stage: WorkflowStage,
    objective: string,
    workspace: string,
    run: WorkflowRunSnapshot,
    stageIndex: number,
    handoffSummary: string | null,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): Promise<ExecutionResult | null> {
    const task = this.deps.taskSupport.createTask(
      run.workflow_name,
      objective,
      workspace,
      stage,
      run,
      stageIndex,
      handoffSummary,
      workspaceContext,
    );
    const plan = this.deps.taskSupport.createPlan(
      task,
      objective,
      workspace,
      stage,
      run,
      handoffSummary,
      workspaceContext,
    );
    this.deps.taskManager?.saveTask(task);
    this.deps.workflowRuns.markStageStarted(run, stage.id, objective, handoffSummary, task.task_id);

    try {
      const decision = await this.deps.executionGateway.submit(task, plan, false);
      return this.handleDecision(ctx, decision, stage, run, task);
    } catch (err: any) {
      task.error_summary = err.message;
      task.result_summary = null;
      this.deps.taskManager?.advanceState(task, 'failed', {
        reason: 'workflow_stage_failed',
        actor: 'workflow',
        metadataPatch: {
          workflow_pause_reason: err.message,
        },
      });
      this.deps.workflowRuns.markStageInterrupted(run, stage.id, 'failed', err.message);
      await this.replyWorkflowStageEvent(ctx, run, stage, task.task_id, {
        title: 'Etapa falhou',
        summary: err.message,
        text: `Nao consegui concluir a etapa ${stage.label}.\n\nMotivo: ${err.message}`,
        status: 'failed',
        reason: err.message,
      });
      return null;
    }
  }

  private async handleDecision(
    ctx: Context,
    decision: Awaited<ReturnType<PipelineGateway['submit']>>,
    stage: WorkflowStage,
    run: WorkflowRunSnapshot,
    task: Task,
  ): Promise<ExecutionResult | null> {
    if (decision.requires_confirmation) {
      task.requires_approval = true;
      task.result_summary = decision.reason || null;
      this.deps.taskManager?.advanceState(task, 'waiting_approval', {
        reason: 'workflow_stage_approval_required',
        actor: 'workflow',
        metadataPatch: {
          workflow_pause_reason: decision.reason,
          workflow_pause_kind: 'approval_required',
        },
      });
      this.deps.workflowRuns.markStageInterrupted(run, stage.id, 'approval_pending', decision.reason);
      await this.replyWorkflowStageEvent(ctx, run, stage, task.task_id, {
        title: 'Etapa aguardando aprovacao',
        summary: decision.reason,
        text: [
          `A etapa ${stage.label} ficou aguardando aprovacao.`,
          '',
          `Motivo: ${decision.reason}`,
          'Assim que voce aprovar, o fluxo pode continuar a partir daqui.',
        ].join('\n'),
        status: 'require_user_confirmation',
        reason: decision.reason,
      });
      return null;
    }

    if (!decision.allowed || !decision.execution_result) {
      task.error_summary = decision.reason;
      task.result_summary = null;
      this.deps.taskManager?.advanceState(task, 'failed', {
        reason: 'workflow_stage_blocked',
        actor: 'workflow',
        metadataPatch: {
          workflow_pause_reason: decision.reason,
          workflow_pause_kind: 'blocked',
        },
      });
      this.deps.workflowRuns.markStageInterrupted(run, stage.id, 'blocked', decision.reason);
      await this.replyWorkflowStageEvent(ctx, run, stage, task.task_id, {
        title: 'Etapa bloqueada',
        summary: decision.reason,
        text: [
          `A etapa ${stage.label} foi bloqueada antes de executar.`,
          '',
          `Motivo: ${decision.reason}`,
        ].join('\n'),
        status: 'blocked',
        reason: decision.reason,
      });
      return null;
    }

    if (!decision.execution_result.success) {
      const errorMsg =
        decision.execution_result.error_message ||
        decision.execution_result.stderr ||
        decision.reason ||
        'Falha de timeout ou erro desconhecido.';
      this.deps.taskSupport.applyExecutionResult(task, decision.execution_result, errorMsg);
      this.deps.taskManager?.advanceState(task, 'failed', {
        reason: 'workflow_stage_failed',
        actor: 'workflow',
        metadataPatch: {
          workflow_pause_reason: errorMsg,
          workflow_pause_kind: 'failed',
        },
      });
      this.deps.workflowRuns.markStageInterrupted(run, stage.id, 'failed', errorMsg);
      await this.replyWorkflowStageEvent(ctx, run, stage, task.task_id, {
        title: 'Etapa falhou',
        summary: errorMsg,
        text: [
          `A etapa ${stage.label} falhou.`,
          '',
          `Motivo: ${errorMsg}`,
        ].join('\n'),
        status: 'failed',
        reason: errorMsg,
      });
      return null;
    }

    const summary = this.deps.workflowPlanner.summarizeResult(decision.execution_result);
    this.deps.taskSupport.applyExecutionResult(task, decision.execution_result, summary);
    if (run.workflow_name === 'sdd') {
      await this.syncSddWorkOrderAfterCompletion(ctx, run, stage, summary);
    }
    this.deps.taskManager?.advanceState(task, 'completed', {
      reason: 'workflow_stage_completed',
      actor: 'workflow',
    });
    this.deps.workflowRuns.markStageCompleted(run, stage.id, decision.execution_result, summary);
    await this.replyWorkflowStageEvent(ctx, run, stage, task.task_id, {
      title: 'Etapa concluida',
      summary,
      text: `Etapa concluida: ${stage.label}.`,
      status: 'done',
      reason: summary,
    });

    return decision.execution_result;
  }

  private async syncSddWorkOrderAfterCompletion(
    ctx: Context,
    run: WorkflowRunSnapshot,
    stage: WorkflowStage,
    summary: string,
  ): Promise<void> {
    const featureId = String(run.trigger.feature_id || '').trim();
    const role = String(stage.id || '').trim().toLowerCase() as SddAgentRole;
    if (!featureId || (role !== 'spec' && role !== 'planner' && role !== 'execution' && role !== 'review')) {
      return;
    }

    const nextWorkOrder = this.deps.sddOrchestrator.handoff(featureId, {
      role,
      actor: stage.executor,
      summary,
      note: summary,
    });

    await replyWorkflowOperationalSurfaceResponse(
      ctx,
      {
        id: `workflow-${run.workflow_run_id}-sdd-${role}`,
        intent: 'receipt',
        title: 'SDD atualizado',
        summary: `Feature: ${featureId}`,
        tone: 'success',
        text: [
          `SDD atualizado para ${featureId}.`,
          `Proximo papel: ${nextWorkOrder.nextRole}`,
          `Lifecycle: ${nextWorkOrder.lifecycle}`,
          nextWorkOrder.currentTask ? `Task atual: ${nextWorkOrder.currentTask}` : 'Task atual: nenhuma',
        ].join('\n'),
        receipt: {
          id: `${run.workflow_run_id}:${stage.id}`,
          title: 'SDD handoff',
          status: 'done',
          reason: summary,
          policyProfile: 'workflow-runtime',
          redacted: true,
          riskBlocked: false,
          metadata: {
            featureId,
            nextRole: nextWorkOrder.nextRole,
            lifecycle: nextWorkOrder.lifecycle,
          },
        },
      },
    );
  }

  private async replyWorkflowNotice(
    ctx: Context,
    run: WorkflowRunSnapshot,
    stage: WorkflowStage,
    title: string,
    summary: string,
    text: string,
  ): Promise<void> {
    await replyWorkflowOperationalSurfaceResponse(
      ctx,
      {
        id: `workflow-${run.workflow_run_id}-${stage.id}-notice`,
        intent: 'generic',
        title,
        summary,
        tone: 'info',
        text,
      },
    );
  }

  private async replyWorkflowStageEvent(
    ctx: Context,
    run: WorkflowRunSnapshot,
    stage: WorkflowStage,
    taskId: string | null | undefined,
    input: {
      title: string;
      summary: string;
      text: string;
      status: TelegramWorkflowSurfaceReceiptStatus;
      reason: string;
    },
  ): Promise<void> {
    await replyWorkflowStageSurfaceResponse(
      ctx,
      {
        workflowRunId: run.workflow_run_id,
        workflowName: run.workflow_name,
        stageId: stage.id,
        stageLabel: stage.label,
        taskId,
        title: input.title,
        summary: input.summary,
        text: input.text,
        status: input.status,
        reason: input.reason,
        metadata: {
          executor: stage.executor,
        },
      },
    );
  }

  private toHistoricalExecutionResult(
    run: WorkflowRunSnapshot,
    stage: WorkflowRunSnapshot['phases'][number],
  ): ExecutionResult {
    const timestamp = stage.finished_at || stage.started_at || run.updated_at || run.created_at;
    return {
      execution_id: `${run.workflow_run_id}:${stage.id}`,
      task_id: stage.task_id || `${run.workflow_run_id}:${stage.id}`,
      executor: stage.executor,
      success: true,
      started_at: stage.started_at || timestamp,
      finished_at: stage.finished_at || timestamp,
      actions_executed: [],
      files_read: [],
      files_written: [],
      files_deleted: [],
      commands_executed: [],
      stdout: stage.result_summary || stage.objective || null,
      stderr: null,
      diff_summary: null,
      artifacts: [],
      rollback_available: false,
      error_code: null,
      error_message: null,
      metadata: {
        historical: true,
        workflow_run_id: run.workflow_run_id,
        workflow_stage_id: stage.id,
      },
    };
  }
}
