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
      throw new Error('Use runSddLoop to start SDD workflows.');
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
        'Step 1/2: {executor} Maker taking implementation ownership.',
        makerStage.strategyNote,
        workflow,
      ),
      this.buildReviewerStage(
        reviewerStage.executor,
        'Step 2/2: {executor} Reviewer auditing the result.',
        reviewerStage.strategyNote,
        workflow,
        'Look for bugs, regressions, technical risk, and project fit. Adjust when necessary.',
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
        intro: `Step 1/2: ${this.support.getExecutorDisplayName('aistudio')} researching and gathering context.`,
        buildObjective: ({ originalObjective, workspaceContext: stageContext }) => this.support.joinObjectiveParts([
          'Research and answer the following objective in a structured way:',
          originalObjective,
          this.support.buildStageWorkspaceGuidance('researcher', workflow, stageContext),
        ]),
      },
      {
        id: 'synthesizer',
        executor: synthesizerStage.executor,
        role: 'synthesizer',
        label: `${this.support.getExecutorDisplayName(synthesizerStage.executor)} Synthesizer`,
        intro: `Step 2/2: ${this.support.getExecutorDisplayName(synthesizerStage.executor)} condensing the research into a final brief.`,
        strategy_note: synthesizerStage.strategyNote,
        buildObjective: ({ originalObjective, previousResults, workspaceContext: stageContext }) => {
          const researchOut = this.support.summarizeResult(previousResults[0]);
          return this.support.joinObjectiveParts([
            'Use the research below to write a short, clear, actionable final brief.',
            `Original objective: ${originalObjective}`,
            `Raw research: ${researchOut}`,
            'Deliver an objective summary with key points and a recommended next step.',
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
        '{executor} maker takes execution ownership.',
        makerStage.strategyNote,
        workflow,
      ),
      this.buildReviewerStage(
        reviewerStage.executor,
        'Step 2/2: {executor} Reviewer auditing the result.',
        reviewerStage.strategyNote,
        workflow,
        'Check bugs, project patterns, and safety. Make changes only when necessary.',
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
          'Revise as changes recentes no workspace feitas para atingir o objetivo anterior.',
          `Objetivo original: ${originalObjective}`,
          `Output da stage anterior: ${makerOut}`,
          reviewInstruction,
          this.support.buildStageWorkspaceGuidance('reviewer', workflow, stageContext),
        ]);
      },
    };
  }
}
