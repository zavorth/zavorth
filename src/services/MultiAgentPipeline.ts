import { Context } from 'grammy';
import { SddOrchestratorService } from './SddOrchestratorService.js';
import {
  WorkflowRunService,
  type WorkflowRunCreateOptions,
  type WorkflowKind,
  type WorkflowWorkspaceContext,
} from './WorkflowRunService.js';
import { createMultiAgentExecutionGateway } from '../domain/execution/application/multi-agent-pipeline/MultiAgentPipelineGateway.js';
import { MultiAgentPipelinePresentation } from '../domain/execution/application/multi-agent-pipeline/MultiAgentPipelinePresentation.js';
import { MultiAgentPipelineRunner } from '../domain/execution/application/multi-agent-pipeline/MultiAgentPipelineRunner.js';
import { MultiAgentPipelineTaskSupport } from '../domain/execution/application/multi-agent-pipeline/MultiAgentPipelineTaskSupport.js';
import type {
  PipelineGateway,
  PipelineRuntime,
  WorkflowStage,
} from '../domain/execution/application/multi-agent-pipeline/MultiAgentPipelineTypes.js';
import { MultiAgentWorkflowPlannerService } from '../domain/execution/application/multi-agent-pipeline/MultiAgentWorkflowPlannerService.js';

export class MultiAgentPipeline {
  private readonly executionGateway: PipelineGateway;
  private readonly workflowRuns: WorkflowRunService;
  private readonly taskManager: PipelineRuntime['taskManager'] | null;
  private readonly sddOrchestrator: NonNullable<PipelineRuntime['sddOrchestrator']>;
  private readonly workflowPlanner: MultiAgentWorkflowPlannerService;
  private readonly presentation: MultiAgentPipelinePresentation;
  private readonly taskSupport: MultiAgentPipelineTaskSupport;
  private readonly runner: MultiAgentPipelineRunner;

  constructor(executionGateway?: PipelineGateway, runtime: PipelineRuntime = {}) {
    this.executionGateway = executionGateway || createMultiAgentExecutionGateway();
    this.workflowRuns = runtime.workflowRuns || new WorkflowRunService();
    this.taskManager = runtime.taskManager || null;
    this.sddOrchestrator = runtime.sddOrchestrator || new SddOrchestratorService();
    this.workflowPlanner = new MultiAgentWorkflowPlannerService({
      sddOrchestrator: this.sddOrchestrator,
    });
    this.presentation = new MultiAgentPipelinePresentation({
      workflowPlanner: this.workflowPlanner,
      workflowRuns: this.workflowRuns,
    });
    this.taskSupport = new MultiAgentPipelineTaskSupport({
      workflowRuns: this.workflowRuns,
      presentation: this.presentation,
    });
    this.runner = new MultiAgentPipelineRunner({
      executionGateway: this.executionGateway,
      workflowRuns: this.workflowRuns,
      taskManager: this.taskManager,
      sddOrchestrator: this.sddOrchestrator,
      workflowPlanner: this.workflowPlanner,
      presentation: this.presentation,
      taskSupport: this.taskSupport,
    });
  }

  public async runReviewPipeline(ctx: Context, objective: string, workspace: string): Promise<void> {
    await this.runWorkflow(ctx, 'review', objective, workspace);
  }

  public async runSddLoop(
    ctx: Context,
    featureId: string,
    workspace: string,
    workspaceContext?: WorkflowWorkspaceContext | null,
    options: WorkflowRunCreateOptions = {},
  ): Promise<void> {
    if (this.sddOrchestrator.isKnownFeature && !this.sddOrchestrator.isKnownFeature(featureId)) {
      await ctx.reply(
        [
          `A feature ${featureId} ainda nao existe no workspace SDD oficial.`,
          'Crie primeiro spec/plan/tasks via scaffold antes de rodar /workflow sdd nela.',
        ].join('\n'),
      );
      return;
    }

    const workOrder = this.sddOrchestrator.inspect(featureId);
    const phase = this.workflowPlanner.buildSddWorkflowStage(workOrder, workspaceContext);
    const objective = `Executar o loop SDD da feature ${workOrder.featureId}.`;

    await this.runWorkflow(
      ctx,
      'sdd',
      objective,
      workspace,
      workspaceContext,
      {
        ...options,
        trigger: {
          ...(options.trigger || {}),
          task_kind: 'sdd_loop',
          task_subtype: workOrder.nextRole,
          feature_id: workOrder.featureId,
        },
      },
      [phase],
    );
  }

  public async runWorkflow(
    ctx: Context,
    workflow: WorkflowKind,
    objective: string,
    workspace: string,
    workspaceContext?: WorkflowWorkspaceContext | null,
    options: WorkflowRunCreateOptions = {},
    stageOverrides?: WorkflowStage[],
  ): Promise<void> {
    try {
      const phases = stageOverrides || this.workflowPlanner.buildWorkflowStages(workflow, workspaceContext);
      const run = this.workflowRuns.createRun(workflow, objective, workspace, phases, workspaceContext, options);
      await ctx.reply(this.presentation.formatWorkflowIntro(workflow, objective, workspace, phases, run, workspaceContext));
      await this.runner.continueWorkflow(ctx, run, phases, 0, [], workspaceContext);
    } catch (e: any) {
      await ctx.reply(`Workflow interrompido.\n\nMotivo: ${e.message}`);
    }
  }

  public async resumeWorkflow(
    ctx: Context,
    workflowRunId: string,
    options: {
      stageId?: string | null;
      workspaceContext?: WorkflowWorkspaceContext | null;
    } = {},
  ): Promise<void> {
    const run = this.workflowRuns.getRun(workflowRunId);
    if (!run) {
      await ctx.reply(`Nao encontrei o workflow ${workflowRunId}.`);
      return;
    }

    const workspaceContext = options.workspaceContext ?? run.workspace_context ?? null;
    const phases = this.workflowPlanner.buildResumeStages(run, workspaceContext);
    const resumeIndex = this.runner.resolveResumeStageIndex(run, options.stageId);
    if (resumeIndex < 0) {
      await ctx.reply(
        run.status === 'completed'
          ? 'Esse workflow ja terminou. Nao existe etapa pendente para retomar.'
          : `Nao achei uma etapa retomavel para o run ${workflowRunId}.`,
      );
      return;
    }

    const phase = phases[resumeIndex];
    const persistedStage = run.phases.find((entry) => entry.id === phase.id) || null;
    const stageVerb = String(persistedStage?.status || '').trim().toLowerCase() === 'completed'
      ? 'Reexecutando'
      : 'Retomando';
    await ctx.reply(
      [
        `${stageVerb} workflow ${run.workflow_run_id}.`,
        `Fluxo: ${this.presentation.describeWorkflow(run.workflow_name)}`,
        `Etapa: ${phase.label}`,
      ].join('\n'),
    );

    const previousResults = this.runner.buildHistoricalResults(run, resumeIndex);
    await this.runner.continueWorkflow(ctx, run, phases, resumeIndex, previousResults, workspaceContext);
  }

  public async closeWorkflowRun(
    ctx: Context,
    workflowRunId: string,
    options: {
      reason?: string | null;
      surface?: string | null;
    } = {},
  ): Promise<void> {
    const run = this.workflowRuns.getRun(workflowRunId);
    if (!run) {
      await ctx.reply(`Nao encontrei o workflow ${workflowRunId}.`);
      return;
    }

    if (!['blocked', 'failed'].includes(run.status)) {
      await ctx.reply(`O workflow ${workflowRunId} so pode ser encerrado quando estiver bloqueado ou com falha.`);
      return;
    }

    const closed = this.workflowRuns.closeRun({
      workflowRunId,
      reason: options.reason || null,
      surface: options.surface || null,
    });
    if (!closed) {
      await ctx.reply(`Nao consegui encerrar o workflow ${workflowRunId}.`);
      return;
    }

    await ctx.reply(
      [
        `Workflow ${workflowRunId} encerrado pelo operador.`,
        `Fluxo: ${this.presentation.describeWorkflow(run.workflow_name)}`,
        options.reason ? `Motivo: ${options.reason}` : 'Esse run deixa de aparecer como retomada sugerida.',
      ].join('\n'),
    );
  }
}
