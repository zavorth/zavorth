import type { ExecutionResult } from '../../../../../contracts/ExecutionContract.js';
import type {
  WorkflowKind,
  WorkflowStageExecutor,
  WorkflowWorkspaceContext,
} from '../../../../../services/WorkflowRunService.js';
import type {
  WorkflowAdaptiveRole,
  WorkflowApprovalFrictionRecommendation,
  WorkflowExecutorCandidateScore,
  WorkflowExecutorRecommendation,
  WorkflowFrictionRecommendation,
  WorkflowStageExecutorRecommendation,
  WorkflowStageSelection,
} from '../MultiAgentPipelineTypes.js';
import type { SddAgentRole } from '../../../../../services/SddFeatureWorkspaceService.js';

type WorkflowStageExecutorSelectionInput = {
  workflow: WorkflowKind;
  role: WorkflowAdaptiveRole;
  fallback: WorkflowStageExecutor;
  avoidExecutor?: WorkflowStageExecutor | null;
  workspaceContext?: WorkflowWorkspaceContext | null;
};

export class MultiAgentWorkflowPlannerSupport {
  public summarizeResult(result?: ExecutionResult): string {
    const text =
      result?.stdout ||
      result?.stderr ||
      result?.error_message ||
      'Concluido sem log relevante.';
    return text.length > 600 ? `${text.substring(0, 600)}...` : text;
  }

  public resolveSddExecutor(
    role: SddAgentRole,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): WorkflowStageExecutor {
    if (role === 'review') {
      const preferred = this.resolvePreferredWorkflowExecutor(workspaceContext);
      return preferred && preferred !== 'aistudio'
        ? this.resolveReviewerExecutor(preferred)
        : 'external_executor';
    }

    const preferred = this.resolvePreferredWorkflowExecutor(workspaceContext);
    return preferred && preferred !== 'aistudio' ? preferred : 'codex';
  }

  public resolveWorkflowStageExecutor(
    input: WorkflowStageExecutorSelectionInput,
  ): WorkflowStageSelection {
    const candidates = Array.from(
      new Set<WorkflowStageExecutor>([
        ...this.getAllowedExecutorsForRole(input.role),
        input.fallback,
        ...(input.avoidExecutor ? [input.avoidExecutor] : []),
      ]),
    );
    const scored = candidates
      .map((executor) => this.scoreWorkflowStageExecutorCandidate(executor, input))
      .sort((left, right) => right.score - left.score);
    const selected = scored[0] || this.scoreWorkflowStageExecutorCandidate(input.fallback, input);

    return {
      executor: selected.executor,
      strategyNote: this.buildWorkflowStageStrategyNote(input, selected),
    };
  }

  public resolvePreferredWorkflowExecutor(
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): WorkflowStageExecutor | null {
    const workflowRecommendation = Array.isArray(workspaceContext?.workflow_executor_recommendations)
      ? [...workspaceContext.workflow_executor_recommendations]
        .sort((left, right) => {
          const leftScore =
            Number(left.success_count || 0) -
            Number(left.pending_count || 0) -
            Number(left.failed_count || 0);
          const rightScore =
            Number(right.success_count || 0) -
            Number(right.pending_count || 0) -
            Number(right.failed_count || 0);
          return rightScore - leftScore;
        })[0]
      : null;
    const workflowExecutor = this.normalizeWorkflowExecutor(workflowRecommendation?.executor);
    if (workflowExecutor && workflowExecutor !== 'aistudio') {
      return workflowExecutor;
    }

    const continuityExecutor = this.normalizeWorkflowExecutor(
      workspaceContext?.continuity_recommendation?.executor,
    );
    if (continuityExecutor) {
      return continuityExecutor;
    }

    return this.normalizeWorkflowExecutor(workspaceContext?.active_focus?.executor);
  }

  public resolveReviewerExecutor(primary: WorkflowStageExecutor): WorkflowStageExecutor {
    if (primary === 'external_executor') {
      return 'codex';
    }
    if (primary === 'codex') {
      return 'external_executor';
    }
    return 'external_executor';
  }

  public normalizeWorkflowExecutor(value: unknown): WorkflowStageExecutor | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'external_executor' || normalized === 'codex' || normalized === 'aistudio') {
      return normalized;
    }
    return null;
  }

  public getExecutorDisplayName(executor: WorkflowStageExecutor): string {
    switch (executor) {
      case 'codex':
        return 'Codex';
      case 'aistudio':
        return 'AI Studio';
      case 'external_executor':
      default:
        return 'ExternalExecutor';
    }
  }

  public buildStageWorkspaceGuidance(
    stageRole: WorkflowAdaptiveRole,
    workflow: WorkflowKind,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): string {
    if (!workspaceContext) {
      return '';
    }

    const parts = [
      workspaceContext.active_focus?.summary
        ? `Prioridade operacional atual: ${workspaceContext.active_focus.summary}.`
        : '',
      workspaceContext.continuity_recommendation?.reason
        ? `Continuidade sugerida: ${workspaceContext.continuity_recommendation.reason}.`
        : '',
    ];

    if (workspaceContext.recent_artifact?.name) {
      const artifactName = workspaceContext.recent_artifact.name;
      if (stageRole === 'reviewer') {
        parts.push(`Confirme se o resultado continua coerente com ${artifactName}.`);
      } else if (stageRole === 'synthesizer') {
        parts.push(`Use ${artifactName} como apoio para consolidar a sintese final.`);
      } else if (workflow === 'ship') {
        parts.push(`Use ${artifactName} como base e preserve consistencia com a entrega recente.`);
      } else if (workflow === 'research') {
        parts.push(`Considere ${artifactName} como uma referencia pratica durante a coleta e a sintese.`);
      } else {
        parts.push(`Leve ${artifactName} em conta ao decidir o proximo passo.`);
      }
    }

    if (workspaceContext.operational_summary && stageRole !== 'researcher') {
      parts.push(`Memoria operacional: ${workspaceContext.operational_summary}.`);
    }

    return parts.filter(Boolean).join(' ');
  }

  public joinObjectiveParts(parts: Array<string | null | undefined>): string {
    return parts
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join('\n');
  }

  private getAllowedExecutorsForRole(role: WorkflowAdaptiveRole): WorkflowStageExecutor[] {
    if (role === 'researcher') {
      return ['aistudio'];
    }
    return ['external_executor', 'codex'];
  }

  private scoreWorkflowStageExecutorCandidate(
    executor: WorkflowStageExecutor,
    input: WorkflowStageExecutorSelectionInput,
  ): WorkflowExecutorCandidateScore {
    const workflowRecommendation = this.getWorkflowExecutorRecommendation(
      input.workflow,
      executor,
      input.workspaceContext,
    );
    const stageRecommendation = this.getWorkflowStageExecutorRecommendation(
      input.workflow,
      input.role,
      executor,
      input.workspaceContext,
    );
    const workflowFriction = this.getWorkflowFrictionRecommendation(
      input.workflow,
      input.workspaceContext,
    );
    const approvalFriction = this.getApprovalFrictionRecommendation(
      executor,
      input.workspaceContext,
    );
    const hasStageSpecificGuidance = this.hasWorkflowStageRecommendation(
      input.workflow,
      input.role,
      input.workspaceContext,
    );
    const continuityExecutor = this.normalizeWorkflowExecutor(
      input.workspaceContext?.continuity_recommendation?.executor,
    );
    const activeFocusExecutor = this.normalizeWorkflowExecutor(
      input.workspaceContext?.active_focus?.executor,
    );
    const stageTargetsRecentFriction = this.matchesStageRoleLabel(
      input.role,
      workflowFriction?.last_resume_stage_label || null,
    );

    let score = executor === input.fallback ? 20 : 0;

    if (continuityExecutor === executor) {
      score += 12;
    }
    if (activeFocusExecutor === executor) {
      score += 7;
    }
    if (input.avoidExecutor) {
      score += input.avoidExecutor === executor ? -6 : 5;
    }
    if (workflowRecommendation) {
      const successWeight = hasStageSpecificGuidance ? 2 : 6;
      const pendingWeight = hasStageSpecificGuidance ? 2 : 5;
      const failedWeight = hasStageSpecificGuidance ? 3 : 7;
      score += workflowRecommendation.success_count * successWeight;
      score -= workflowRecommendation.pending_count * pendingWeight;
      score -= workflowRecommendation.failed_count * failedWeight;
      score += hasStageSpecificGuidance
        ? Math.max(1, this.getConfidenceScore(workflowRecommendation.confidence) - 2)
        : this.getConfidenceScore(workflowRecommendation.confidence);
    }
    if (stageRecommendation) {
      score += stageRecommendation.success_count * 7;
      score -= stageRecommendation.pending_count * 6;
      score -= stageRecommendation.failed_count * 8;
      score += this.getConfidenceScore(stageRecommendation.confidence) + 2;
    } else if (hasStageSpecificGuidance) {
      score -= 10;
    }
    if (approvalFriction) {
      score -= approvalFriction.pending_count * 3;
      score -= approvalFriction.rejected_count * 5;
      score -= approvalFriction.high_risk_count * 2;
      score -= approvalFriction.permission_count;
    }
    if (stageTargetsRecentFriction && workflowFriction) {
      score -= workflowFriction.approval_pending_count * 2;
      score -= workflowFriction.blocked_count * 4;
      score -= workflowFriction.failed_count * 5;
      if (this.labelReferencesExecutor(workflowFriction.last_resume_stage_label || null, executor)) {
        score -= 28;
      }
      if (workflowRecommendation) {
        score -= workflowRecommendation.pending_count * 4;
        score -= workflowRecommendation.failed_count * 6;
      }
      if (approvalFriction) {
        score -= approvalFriction.pending_count * 2;
        score -= approvalFriction.rejected_count * 3;
      }
    }

    return {
      executor,
      score,
      stageRecommendation,
      workflowRecommendation,
      workflowFriction,
      approvalFriction,
      stageTargetsRecentFriction,
    };
  }

  private buildWorkflowStageStrategyNote(
    input: WorkflowStageExecutorSelectionInput,
    selected: WorkflowExecutorCandidateScore,
  ): string | null {
    const executorName = this.getExecutorDisplayName(selected.executor);
    if (selected.stageTargetsRecentFriction && selected.workflowFriction) {
      const stageLabel =
        selected.workflowFriction.last_resume_stage_label ||
        this.getExecutorDisplayName(input.fallback);
      return `Workflow recente travou em ${stageLabel}; usando ${executorName} para reduzir nova pausa.`;
    }
    if (selected.stageRecommendation && selected.stageRecommendation.success_count > 0) {
      return `Historico desta etapa favorece ${executorName} para ${selected.stageRecommendation.role}.`;
    }
    if (selected.workflowRecommendation && selected.workflowRecommendation.success_count > 0) {
      return `Historico deste workflow favorece ${executorName} nesta etapa.`;
    }
    if (
      selected.approvalFriction &&
      (selected.approvalFriction.pending_count > 0 ||
        selected.approvalFriction.rejected_count > 0 ||
        selected.approvalFriction.permission_count > 0)
    ) {
      return `${executorName} chega com menos atrito recente de aprovacao neste workspace.`;
    }
    if (
      input.avoidExecutor &&
      selected.executor !== input.avoidExecutor &&
      (input.role === 'reviewer' || input.role === 'synthesizer')
    ) {
      return 'Mantendo contraste entre etapas para revisar com outro executor.';
    }
    return null;
  }

  private getWorkflowExecutorRecommendation(
    workflow: WorkflowKind,
    executor: WorkflowStageExecutor,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): WorkflowExecutorRecommendation | null {
    const recommendations = Array.isArray(workspaceContext?.workflow_executor_recommendations)
      ? workspaceContext.workflow_executor_recommendations
      : [];
    return (
      recommendations.find((entry) => {
        return entry.workflow === workflow
          && this.normalizeWorkflowExecutor(entry.executor) === executor;
      }) || null
    );
  }

  private getWorkflowStageExecutorRecommendation(
    workflow: WorkflowKind,
    role: WorkflowAdaptiveRole,
    executor: WorkflowStageExecutor,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): WorkflowStageExecutorRecommendation | null {
    const recommendations = Array.isArray(workspaceContext?.workflow_stage_executor_recommendations)
      ? workspaceContext.workflow_stage_executor_recommendations
      : [];
    return (
      recommendations.find((entry) => {
        return entry.workflow === workflow
          && String(entry.role || '').trim().toLowerCase() === role
          && this.normalizeWorkflowExecutor(entry.executor) === executor;
      }) || null
    );
  }

  private hasWorkflowStageRecommendation(
    workflow: WorkflowKind,
    role: WorkflowAdaptiveRole,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): boolean {
    const recommendations = Array.isArray(workspaceContext?.workflow_stage_executor_recommendations)
      ? workspaceContext.workflow_stage_executor_recommendations
      : [];
    return recommendations.some((entry) => {
      return entry.workflow === workflow
        && String(entry.role || '').trim().toLowerCase() === role;
    });
  }

  private getWorkflowFrictionRecommendation(
    workflow: WorkflowKind,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): WorkflowFrictionRecommendation | null {
    const recommendations = Array.isArray(workspaceContext?.workflow_friction_recommendations)
      ? workspaceContext.workflow_friction_recommendations
      : [];
    return recommendations.find((entry) => entry.workflow === workflow) || null;
  }

  private getApprovalFrictionRecommendation(
    executor: WorkflowStageExecutor,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): WorkflowApprovalFrictionRecommendation | null {
    const recommendations = Array.isArray(workspaceContext?.approval_friction_recommendations)
      ? workspaceContext.approval_friction_recommendations
      : [];
    return (
      recommendations.find((entry) => {
        return this.normalizeWorkflowExecutor(entry.executor) === executor;
      }) || null
    );
  }

  private matchesStageRoleLabel(role: WorkflowAdaptiveRole, label: string | null): boolean {
    const normalized = String(label || '').trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    const token = role === 'maker'
      ? 'maker'
      : role === 'reviewer'
        ? 'reviewer'
        : role === 'researcher'
          ? 'researcher'
          : 'synthesizer';
    return normalized.includes(token);
  }

  private labelReferencesExecutor(label: string | null, executor: WorkflowStageExecutor): boolean {
    const normalized = String(label || '').trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    if (executor === 'aistudio') {
      return normalized.includes('ai studio') || normalized.includes('aistudio');
    }
    if (executor === 'external_executor') {
      return normalized.includes('externalexecutor') ||
        normalized.includes('external executor') ||
        normalized.includes('external_executor') ||
        normalized.includes('external-executor');
    }
    return normalized.includes(executor);
  }

  private getConfidenceScore(confidence: string | null | undefined): number {
    if (confidence === 'high') {
      return 6;
    }
    if (confidence === 'medium') {
      return 3;
    }
    return 1;
  }
}
