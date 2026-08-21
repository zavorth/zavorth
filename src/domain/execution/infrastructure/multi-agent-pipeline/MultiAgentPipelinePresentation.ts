import type { ExecutionResult } from '../../../../contracts/ExecutionContract.js';
import type {
  WorkflowKind,
  WorkflowRunService,
  WorkflowRunSnapshot,
  WorkflowWorkspaceContext,
} from '../../../../services/WorkflowRunService.js';
import type { WorkflowStage } from './MultiAgentPipelineTypes.js';
import type { MultiAgentWorkflowPlannerService } from './MultiAgentWorkflowPlannerService.js';

type MultiAgentPipelinePresentationDeps = {
  workflowPlanner: MultiAgentWorkflowPlannerService;
  workflowRuns: WorkflowRunService;
};

export class MultiAgentPipelinePresentation {
  constructor(private readonly deps: MultiAgentPipelinePresentationDeps) {}

  public formatWorkflowIntro(
    workflow: WorkflowKind,
    objective: string,
    workspace: string,
    stages: WorkflowStage[],
    run: WorkflowRunSnapshot,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): string {
    const contextLines = this.buildWorkspaceContextPresentation(workspaceContext);
    return [
      `Workflow prepared: ${this.describeWorkflow(workflow)}`,
      '',
      `Run: ${run.workflow_run_id}`,
      `request: ${objective}`,
      `Workspace: ${workspace}`,
      contextLines.length > 0 ? '' : null,
      contextLines.length > 0 ? 'Reused context:' : null,
      ...(contextLines.length > 0 ? contextLines.map((line) => `- ${line}`) : []),
      '',
      'What will happen:',
      ...stages.map((stage, index) => `${index + 1}. ${stage.label}`),
      '',
      'I will keep you updated step by step and deliver a single closure at the end.',
    ].join('\n');
  }

  public formatStageIntro(stage: WorkflowStage, index: number, total: number): string {
    return [
      `Starting step ${index + 1} of ${total}.`,
      `Current step: ${stage.label}`,
      stage.intro,
      stage.strategy_note ? `Strategy: ${stage.strategy_note}` : null,
    ].join('\n');
  }

  public formatWorkflowCompletion(
    workflow: WorkflowKind,
    result: ExecutionResult | null | undefined,
    run: WorkflowRunSnapshot,
  ): string {
    const delivery = this.breakResultForPresentation(result || undefined);
    const workflowSummary = this.deps.workflowRuns.buildCompletionSummary(run);
    return [
      workflowSummary.lead,
      '',
      `Flow: ${this.describeWorkflow(workflow)}`,
      '',
      'What is ready:',
      delivery.lead,
      '',
      'Workflow summary:',
      ...workflowSummary.details.map((line) => `- ${line}`),
      delivery.details.length > 0 ? '' : null,
      delivery.details.length > 0 ? 'Destaques:' : null,
      ...(delivery.details.length > 0 ? delivery.details.map((line) => `- ${line}`) : []),
      '',
      this.describeWorkflowFollowUp(workflow),
    ].filter(Boolean).join('\n');
  }

  public formatWorkflowPauseOrFailure(run: WorkflowRunSnapshot): string {
    const summary = this.deps.workflowRuns.buildCompletionSummary(run);
    return [
      summary.lead,
      '',
      ...summary.details.map((line) => `- ${line}`),
    ].join('\n');
  }

  public describeWorkflow(workflow: WorkflowKind): string {
    switch (workflow) {
      case 'sdd':
        return 'Loop SDD orientado por papeis';
      case 'ship':
        return 'Entrega com implementation e review';
      case 'research':
        return 'Pesquisa com final synthesis';
      case 'review':
      default:
        return 'Review in duas stages';
    }
  }

  public decorateObjectiveWithWorkspaceContext(
    objective: string,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): string {
    const contextLines = this.buildWorkspaceContextPresentation(workspaceContext);
    if (contextLines.length === 0) {
      return objective;
    }

    return [
      objective,
      '',
      'Workspace context:',
      ...contextLines.map((line) => `- ${line}`),
    ].join('\n');
  }

  public buildPlanContext(
    workflowName: string,
    stage: WorkflowStage,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): string {
    const parts = [`Workflow ${workflowName} (${stage.label})`];
    if (workspaceContext?.profile_summary) {
      parts.push(`profile ${workspaceContext.profile_summary}`);
    }
    if (workspaceContext?.active_focus) {
      parts.push(`foco ${workspaceContext.active_focus.summary}`);
    }
    if (workspaceContext?.continuity_recommendation) {
      parts.push(`continuidade ${workspaceContext.continuity_recommendation.label}`);
    }
    return parts.join(' | ');
  }

  private describeWorkflowFollowUp(workflow: WorkflowKind): string {
    switch (workflow) {
      case 'sdd':
        return 'I can run the next SDD role or summarize the feature state.';
      case 'ship':
        return 'I can turn this into a final delivery checklist or next adjustments.';
      case 'research':
        return 'I can turn this into an executive summary, action plan, or comparison.';
      case 'review':
      default:
        return 'I can summarize the risks found or organize the next steps.';
    }
  }

  private breakResultForPresentation(result?: ExecutionResult): { lead: string; details: string[] } {
    const summary = this.deps.workflowPlanner.summarizeResult(result);
    const lines = String(summary || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    return {
      lead: lines[0] || 'completed without additional detail.',
      details: lines
        .slice(1, 5)
        .map((line) => line.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean),
    };
  }

  private buildWorkspaceContextPresentation(workspaceContext?: WorkflowWorkspaceContext | null): string[] {
    if (!workspaceContext) {
      return [];
    }

    const lines = [
      workspaceContext.profile_summary ? `Perfil: ${workspaceContext.profile_summary}` : null,
      workspaceContext.operational_summary ? `Memory: ${workspaceContext.operational_summary}` : null,
      workspaceContext.active_focus ? `Foco active: ${workspaceContext.active_focus.summary}`
        : null,
      workspaceContext.recent_artifact ? `Entrega recente: ${workspaceContext.recent_artifact.name}`
        : null,
      workspaceContext.continuity_recommendation ? `Continuidade sugerida: ${workspaceContext.continuity_recommendation.label} (${workspaceContext.continuity_recommendation.reason})`
        : null,
    ].filter((value): value is string => Boolean(value));

    return lines.slice(0, 5);
  }
}
