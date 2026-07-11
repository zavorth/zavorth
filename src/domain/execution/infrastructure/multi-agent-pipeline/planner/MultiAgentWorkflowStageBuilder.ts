import type { WorkflowKind, WorkflowWorkspaceContext } from '../../../../../services/WorkflowRunService.js';
import type {
  WorkflowStage,
} from '../MultiAgentPipelineTypes.js';
import type { MultiAgentWorkflowPlannerSupport } from './MultiAgentWorkflowPlannerSupport.js';

export class MultiAgentWorkflowStageBuilder {
  constructor(private readonly support: MultiAgentWorkflowPlannerSupport) {}

  public buildWorkflowStages(
    workflow: WorkflowKind,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): WorkflowStage[] {
    if (workflow === 'sdd') {
      throw new Error('Use runSddLoop para iniciar workflows SDD.');
    }

    if (workflow === 'ship') {
      return this.buildShipStages(workflow, workspaceContext);
    }

    if (workflow === 'research') {
      return this.buildResearchStages(workflow, workspaceContext);
    }

    return this.buildReviewStages(workflow, workspaceContext);
  }

  private buildShipStages(
    workflow: WorkflowKind,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): WorkflowStage[] {
    const preferredExecutor = this.support.resolvePreferredWorkflowExecutor(workspaceContext);
    const makerStage = this.support.resolveWorkflowStageExecutor({
      workflow,
      role: 'maker',
      fallback: preferredExecutor && preferredExecutor !== 'aistudio'
        ? preferredExecutor
        : 'codex',
      workspaceContext,
    });
    const reviewerStage = this.support.resolveWorkflowStageExecutor({
      workflow,
      role: 'reviewer',
      fallback: this.support.resolveReviewerExecutor(makerStage.executor),
      avoidExecutor: makerStage.executor,
      workspaceContext,
    });

    return [
      this.buildMakerStage(
        makerStage.executor,
        'Passo 1/2: {executor} Maker assumindo a implementacao.',
        makerStage.strategyNote,
        workflow,
      ),
      this.buildReviewerStage(
        reviewerStage.executor,
        'Passo 2/2: {executor} Reviewer auditando o resultado.',
        reviewerStage.strategyNote,
        workflow,
        'Procure bugs, regressao, risco tecnico e aderencia ao projeto. Ajuste se necessario.',
      ),
    ];
  }

  private buildResearchStages(
    workflow: WorkflowKind,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): WorkflowStage[] {
    const preferredExecutor = this.support.resolvePreferredWorkflowExecutor(workspaceContext);
    const synthesizerStage = this.support.resolveWorkflowStageExecutor({
      workflow,
      role: 'synthesizer',
      fallback: preferredExecutor && preferredExecutor !== 'aistudio'
        ? preferredExecutor
        : 'codex',
      workspaceContext,
    });

    return [
      {
        id: 'researcher',
        executor: 'aistudio',
        role: 'researcher',
        label: `${this.support.getExecutorDisplayName('aistudio')} Researcher`,
        intro: `Passo 1/2: ${this.support.getExecutorDisplayName('aistudio')} pesquisando e reunindo contexto.`,
        buildObjective: ({ originalObjective, workspaceContext: stageContext }) => this.support.joinObjectiveParts([
          'Pesquise e responda de forma estruturada ao seguinte objetivo:',
          originalObjective,
          this.support.buildStageWorkspaceGuidance('researcher', workflow, stageContext),
        ]),
      },
      {
        id: 'synthesizer',
        executor: synthesizerStage.executor,
        role: 'synthesizer',
        label: `${this.support.getExecutorDisplayName(synthesizerStage.executor)} Synthesizer`,
        intro: `Passo 2/2: ${this.support.getExecutorDisplayName(synthesizerStage.executor)} condensando a pesquisa em um briefing final.`,
        strategy_note: synthesizerStage.strategyNote,
        buildObjective: ({ originalObjective, previousResults, workspaceContext: stageContext }) => {
          const researchOut = this.support.summarizeResult(previousResults[0]);
          return this.support.joinObjectiveParts([
            'Use a pesquisa abaixo para escrever um briefing final curto, claro e acionavel.',
            `Objetivo original: ${originalObjective}`,
            `Pesquisa bruta: ${researchOut}`,
            'Entregue um resumo objetivo em portugues, com pontos principais e proximo passo recomendado.',
            this.support.buildStageWorkspaceGuidance('synthesizer', workflow, stageContext),
          ]);
        },
      },
    ];
  }

  private buildReviewStages(
    workflow: WorkflowKind,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): WorkflowStage[] {
    const preferredExecutor = this.support.resolvePreferredWorkflowExecutor(workspaceContext);
    const makerStage = this.support.resolveWorkflowStageExecutor({
      workflow,
      role: 'maker',
      fallback: preferredExecutor && preferredExecutor !== 'aistudio'
        ? preferredExecutor
        : 'external_executor',
      workspaceContext,
    });
    const reviewerStage = this.support.resolveWorkflowStageExecutor({
      workflow,
      role: 'reviewer',
      fallback: preferredExecutor && preferredExecutor !== 'aistudio'
        ? this.support.resolveReviewerExecutor(makerStage.executor)
        : 'external_executor',
      avoidExecutor: makerStage.executor,
      workspaceContext,
    });

    return [
      this.buildMakerStage(
        makerStage.executor,
        'Passo 1/2: {executor} Maker assumindo a execucao.',
        makerStage.strategyNote,
        workflow,
      ),
      this.buildReviewerStage(
        reviewerStage.executor,
        'Passo 2/2: {executor} Reviewer auditando o resultado.',
        reviewerStage.strategyNote,
        workflow,
        'Verifique bugs, padroes de projeto e seguranca. Faca alteracoes se necessario.',
      ),
    ];
  }

  private buildMakerStage(
    executor: WorkflowStage['executor'],
    introTemplate: string,
    strategyNote: string | null,
    workflow: WorkflowKind,
  ): WorkflowStage {
    const executorName = this.support.getExecutorDisplayName(executor);
    return {
      id: 'maker',
      executor,
      role: 'maker',
      label: `${executorName} Maker`,
      intro: introTemplate.replace('{executor}', executorName),
      strategy_note: strategyNote,
      buildObjective: ({ originalObjective, workspaceContext: stageContext }) => this.support.joinObjectiveParts([
        originalObjective,
        this.support.buildStageWorkspaceGuidance('maker', workflow, stageContext),
      ]),
    };
  }

  private buildReviewerStage(
    executor: WorkflowStage['executor'],
    introTemplate: string,
    strategyNote: string | null,
    workflow: WorkflowKind,
    reviewInstruction: string,
  ): WorkflowStage {
    const executorName = this.support.getExecutorDisplayName(executor);
    return {
      id: 'reviewer',
      executor,
      role: 'reviewer',
      label: `${executorName} Reviewer`,
      intro: introTemplate.replace('{executor}', executorName),
      strategy_note: strategyNote,
      buildObjective: ({ originalObjective, previousResults, workspaceContext: stageContext }) => {
        const makerOut = this.support.summarizeResult(previousResults[0]);
        return this.support.joinObjectiveParts([
          'Revise as mudancas recentes no workspace feitas para atingir o objetivo anterior.',
          `Objetivo original: ${originalObjective}`,
          `Output da etapa anterior: ${makerOut}`,
          reviewInstruction,
          this.support.buildStageWorkspaceGuidance('reviewer', workflow, stageContext),
        ]);
      },
    };
  }
}
