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
      `Workflow preparado: ${this.describeWorkflow(workflow)}`,
      '',
      `Run: ${run.workflow_run_id}`,
      `Pedido: ${objective}`,
      `Workspace: ${workspace}`,
      contextLines.length > 0 ? '' : null,
      contextLines.length > 0 ? 'Contexto aproveitado:' : null,
      ...(contextLines.length > 0 ? contextLines.map((line) => `- ${line}`) : []),
      '',
      'O que vai acontecer:',
      ...stages.map((stage, index) => `${index + 1}. ${stage.label}`),
      '',
      'Vou te atualizando etapa por etapa e, no final, entrego um fechamento unico.',
    ].join('\n');
  }

  public formatStageIntro(stage: WorkflowStage, index: number, total: number): string {
    return [
      `Agora vou para a etapa ${index + 1} de ${total}.`,
      `Etapa atual: ${stage.label}`,
      stage.intro,
      stage.strategy_note ? `Estrategia: ${stage.strategy_note}` : null,
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
      `Fluxo: ${this.describeWorkflow(workflow)}`,
      '',
      'O que ficou pronto:',
      delivery.lead,
      '',
      'Resumo do workflow:',
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
        return 'Entrega com implementacao e revisao';
      case 'research':
        return 'Pesquisa com sintese final';
      case 'review':
      default:
        return 'Revisao em duas etapas';
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
      'Contexto do workspace:',
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
      parts.push(`perfil ${workspaceContext.profile_summary}`);
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
        return 'Se quiser, eu posso rodar o proximo papel SDD ou resumir o estado da feature.';
      case 'ship':
        return 'Se quiser, eu posso transformar isso em checklist final de entrega ou proximos ajustes.';
      case 'research':
        return 'Se quiser, eu posso transformar isso em resumo executivo, plano de acao ou comparativo.';
      case 'review':
      default:
        return 'Se quiser, eu posso resumir os riscos encontrados ou organizar os proximos passos.';
    }
  }

  private breakResultForPresentation(result?: ExecutionResult): { lead: string; details: string[] } {
    const summary = this.deps.workflowPlanner.summarizeResult(result);
    const lines = String(summary || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    return {
      lead: lines[0] || 'Concluido sem detalhe adicional.',
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
      workspaceContext.operational_summary ? `Memoria: ${workspaceContext.operational_summary}` : null,
      workspaceContext.active_focus
        ? `Foco ativo: ${workspaceContext.active_focus.summary}`
        : null,
      workspaceContext.recent_artifact
        ? `Entrega recente: ${workspaceContext.recent_artifact.name}`
        : null,
      workspaceContext.continuity_recommendation
        ? `Continuidade sugerida: ${workspaceContext.continuity_recommendation.label} (${workspaceContext.continuity_recommendation.reason})`
        : null,
    ].filter((value): value is string => Boolean(value));

    return lines.slice(0, 5);
  }
}
