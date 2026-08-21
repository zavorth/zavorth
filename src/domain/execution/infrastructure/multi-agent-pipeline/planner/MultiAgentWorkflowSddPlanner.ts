import type { SddWorkOrder } from '../../../../../services/SddOrchestratorService.js';
import type { WorkflowRunSnapshot, WorkflowWorkspaceContext } from '../../../../../services/WorkflowRunService.js';
import type { WorkflowStage } from '../MultiAgentPipelineTypes.js';
import type { MultiAgentWorkflowPlannerServiceDeps } from './MultiAgentWorkflowPlannerContracts.js';
import type { MultiAgentWorkflowPlannerSupport } from './MultiAgentWorkflowPlannerSupport.js';

export class MultiAgentWorkflowSddPlanner {
  constructor(
    private readonly deps: MultiAgentWorkflowPlannerServiceDeps,
    private readonly support: MultiAgentWorkflowPlannerSupport,
  ) {}

  public buildSddWorkflowStage(
    workOrder: SddWorkOrder,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): WorkflowStage {
    const executor = this.support.resolveSddExecutor(workOrder.nextRole, workspaceContext);
    const currentTask = workOrder.currentTask ? `Active task: ${workOrder.currentTask}`
      : 'without an identified open task.';

    return {
      id: workOrder.nextRole,
      executor,
      role: workOrder.nextRole,
      label: `${this.support.getExecutorDisplayName(executor)} ${workOrder.brief.label}`,
      intro: `SDD step: ${workOrder.brief.label} for ${workOrder.featureId}.`,
      strategy_note: `feature=${workOrder.featureId} | lifecycle=${workOrder.lifecycle} | ${currentTask}`,
      writeScope: [...workOrder.brief.writeScope],
      buildObjective: () => this.buildSddObjective(workOrder),
    };
  }

  public buildSddResumeStages(run: WorkflowRunSnapshot): WorkflowStage[] {
    const persistedStage = run.phases.find((stage) => stage.id === run.resume_stage?.id) || run.phases[0];
    if (!persistedStage) {
      return [];
    }

    const featureId = String(run.trigger.feature_id || '').trim();
    const writeScope = featureId && this.deps.sddOrchestrator?.isKnownFeature?.(featureId)
      ? [...this.deps.sddOrchestrator.inspect(featureId).brief.writeScope]
      : null;

    return [
      {
        id: persistedStage.id,
        executor: persistedStage.executor,
        role: persistedStage.role,
        label: persistedStage.label,
        intro: `Resumesndo a stage SDD ${persistedStage.label}.`,
        strategy_note:
          persistedStage.strategy_note ||
          persistedStage.handoff_summary ||
          persistedStage.result_summary ||
          null,
        writeScope,
        buildObjective: ({ originalObjective }) =>
          originalObjective || persistedStage.objective || 'Resume the pending SDD step.',
      },
    ];
  }

  private buildSddObjective(workOrder: SddWorkOrder): string {
    return [
      `You are operating the SDD loop for feature ${workOrder.featureId}.`,
      `Feature title: ${workOrder.title}`,
      `Current lifecycle: ${workOrder.lifecycle}`,
      workOrder.currentTask ? `Active task: ${workOrder.currentTask}` : '',
      '',
      workOrder.brief.prompt,
      '',
      'Current step checklist:',
      ...workOrder.brief.checklist.map((item) => `- ${item}`),
      '',
      'Allowed write scope:',
      ...workOrder.brief.writeScope.map((item) => `- ${item}`),
      '',
      'When finished, deliver a short summary of what changed, remaining risk, and the next loop role.',
    ]
      .filter(Boolean)
      .join('\n');
  }
}
