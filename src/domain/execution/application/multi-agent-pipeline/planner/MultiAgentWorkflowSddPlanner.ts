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
    const currentTask = workOrder.currentTask
      ? `Task ativa: ${workOrder.currentTask}`
      : 'Sem task aberta identificada.';

    return {
      id: workOrder.nextRole,
      executor,
      role: workOrder.nextRole,
      label: `${this.support.getExecutorDisplayName(executor)} ${workOrder.brief.label}`,
      intro: `Etapa SDD: ${workOrder.brief.label} para ${workOrder.featureId}.`,
      strategy_note: `feature=${workOrder.featureId} | lifecycle=${workOrder.lifecycle} | ${currentTask}`,
      writeScope: [...workOrder.brief.writeScope],
      buildObjective: () => this.buildSddObjective(workOrder),
    };
  }

  public buildSddResumeStages(run: WorkflowRunSnapshot): WorkflowStage[] {
    const persistedStage = run.stages.find((stage) => stage.id === run.resume_stage?.id) || run.stages[0];
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
        intro: `Retomando a etapa SDD ${persistedStage.label}.`,
        strategy_note:
          persistedStage.strategy_note ||
          persistedStage.handoff_summary ||
          persistedStage.result_summary ||
          null,
        writeScope,
        buildObjective: ({ originalObjective }) =>
          originalObjective || persistedStage.objective || 'Retome a etapa SDD pendente.',
      },
    ];
  }

  private buildSddObjective(workOrder: SddWorkOrder): string {
    return [
      `Voce esta operando o loop SDD da feature ${workOrder.featureId}.`,
      `Titulo da feature: ${workOrder.title}`,
      `Lifecycle atual: ${workOrder.lifecycle}`,
      workOrder.currentTask ? `Task ativa: ${workOrder.currentTask}` : '',
      '',
      workOrder.brief.prompt,
      '',
      'Checklist desta etapa:',
      ...workOrder.brief.checklist.map((item) => `- ${item}`),
      '',
      'Write scope permitido:',
      ...workOrder.brief.writeScope.map((item) => `- ${item}`),
      '',
      'Ao finalizar, entregue um resumo curto do que mudou, o risco restante e qual deve ser o proximo papel do loop.',
    ]
      .filter(Boolean)
      .join('\n');
  }
}
