import type { ExecutionResult } from '../../../../../contracts/ExecutionContract.js';
import type { WorkflowKind, WorkflowRunSnapshot, WorkflowWorkspaceContext } from '../../../../../services/WorkflowRunService.js';
import type {
  WorkflowAdaptiveRole,
  WorkflowStage,
} from '../MultiAgentPipelineTypes.js';
import type { MultiAgentWorkflowPlannerSupport } from './MultiAgentWorkflowPlannerSupport.js';
import type { MultiAgentWorkflowSddPlanner } from './MultiAgentWorkflowSddPlanner.js';

export class MultiAgentWorkflowResumePlanner {
  constructor(
    private readonly support: MultiAgentWorkflowPlannerSupport,
    private readonly sddPlanner: MultiAgentWorkflowSddPlanner,
  ) {}

  public buildResumeStages(
    run: WorkflowRunSnapshot,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): WorkflowStage[] {
    if (run.workflow_name === 'sdd') {
      return this.sddPlanner.buildSddResumeStages(run);
    }
    return this.buildPersistedWorkflowStages(run, workspaceContext);
  }

  private buildPersistedWorkflowStages(
    run: WorkflowRunSnapshot,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): WorkflowStage[] {
    const persistedStages = [...run.stages].sort((left, right) => left.index - right.index);
    return persistedStages.map((stage, index) => ({
      id: stage.id,
      executor: stage.executor,
      role: stage.role,
      label: stage.label,
      intro: `Etapa ${index + 1}/${persistedStages.length}: retomando ${stage.label} do plano persistido.`,
      strategy_note: stage.strategy_note || stage.handoff_summary || stage.result_summary || null,
      buildObjective: ({ originalObjective, previousResults, workspaceContext: stageContext }) => {
        if (stage.objective) {
          return stage.objective;
        }
        return this.buildPersistedWorkflowStageObjective(
          run.workflow_name,
          stage,
          originalObjective,
          previousResults,
          stageContext ?? workspaceContext ?? null,
        );
      },
    }));
  }

  private buildPersistedWorkflowStageObjective(
    workflow: WorkflowKind,
    stage: WorkflowRunSnapshot['stages'][number],
    originalObjective: string,
    previousResults: ExecutionResult[],
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): string {
    if (workflow === 'research' && stage.id === 'researcher') {
      return this.support.joinObjectiveParts([
        'Pesquise e responda de forma estruturada ao seguinte objetivo:',
        originalObjective,
        this.support.buildStageWorkspaceGuidance('researcher', workflow, workspaceContext),
      ]);
    }

    if (workflow === 'research' && stage.id === 'synthesizer') {
      const researchOut =
        this.support.summarizeResult(previousResults[0]) ||
        stage.handoff_summary ||
        stage.result_summary ||
        '';
      return this.support.joinObjectiveParts([
        'Use a pesquisa abaixo para escrever um briefing final curto, claro e acionavel.',
        `Objetivo original: ${originalObjective}`,
        researchOut ? `Pesquisa bruta: ${researchOut}` : null,
        'Entregue um resumo objetivo em portugues, com pontos principais e proximo passo recomendado.',
        this.support.buildStageWorkspaceGuidance('synthesizer', workflow, workspaceContext),
      ]);
    }

    if (stage.role === 'reviewer') {
      const previousOut =
        this.support.summarizeResult(previousResults[0]) ||
        stage.handoff_summary ||
        stage.result_summary ||
        '';
      return this.support.joinObjectiveParts([
        'Revise as mudancas recentes no workspace feitas para atingir o objetivo anterior.',
        `Objetivo original: ${originalObjective}`,
        previousOut ? `Output da etapa anterior: ${previousOut}` : null,
        workflow === 'ship'
          ? 'Procure bugs, regressao, risco tecnico e aderencia ao projeto. Ajuste se necessario.'
          : 'Verifique bugs, padroes de projeto e seguranca. Faca alteracoes se necessario.',
        this.support.buildStageWorkspaceGuidance('reviewer', workflow, workspaceContext),
      ]);
    }

    if (stage.role === 'maker') {
      return this.support.joinObjectiveParts([
        originalObjective,
        this.support.buildStageWorkspaceGuidance('maker', workflow, workspaceContext),
      ]);
    }

    return this.support.joinObjectiveParts([
      stage.handoff_summary || stage.result_summary || originalObjective,
      this.support.buildStageWorkspaceGuidance(
        this.toAdaptiveRole(stage.role),
        workflow,
        workspaceContext,
      ),
    ]);
  }

  private toAdaptiveRole(role: string | null | undefined): WorkflowAdaptiveRole {
    const normalized = String(role || '').trim().toLowerCase();
    if (
      normalized === 'maker' ||
      normalized === 'reviewer' ||
      normalized === 'researcher' ||
      normalized === 'synthesizer'
    ) {
      return normalized;
    }
    return 'maker';
  }
}
