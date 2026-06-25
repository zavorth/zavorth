import { Task } from '../../../../contracts/TaskContract.js';
import type {
  WorkflowKind,
  WorkflowWorkspaceContext,
} from '../../../../runtime/workflows/WorkflowRunService.js';

export class TelegramTaskWorkflowWorkspaceContextBuilder {
  public build(task: Task): WorkflowWorkspaceContext | null {
    const metadata = task.metadata || {};
    const workspaceOperationalMemory = metadata.workspace_operational_memory || {};
    const activeFocus = Array.isArray(workspaceOperationalMemory.active_focuses)
      ? workspaceOperationalMemory.active_focuses[0]
      : null;
    const recentArtifact = Array.isArray(workspaceOperationalMemory.recent_artifacts)
      ? workspaceOperationalMemory.recent_artifacts[0]
      : null;
    const continuityRecommendation = Array.isArray(workspaceOperationalMemory.continuity_recommendations)
      ? workspaceOperationalMemory.continuity_recommendations[0]
      : null;
    const workflowExecutorRecommendations = Array.isArray(workspaceOperationalMemory.workflow_executor_recommendations)
      ? workspaceOperationalMemory.workflow_executor_recommendations
        .map((entry: unknown) => {
          const workflow = this.normalizeWorkflowKind(entry?.workflow);
          const executor = String(entry?.executor || '').trim().toLowerCase();
          if (!workflow || !executor) {
            return null;
          }
          return {
            workflow,
            executor,
            success_count: Math.max(0, Number(entry?.success_count || 0)),
            pending_count: Math.max(0, Number(entry?.pending_count || 0)),
            failed_count: Math.max(0, Number(entry?.failed_count || 0)),
            confidence: this.normalizeConfidence(entry?.confidence),
            rationale: String(entry?.rationale || '').trim(),
          };
        })
        .filter((entry: unknown): entry is NonNullable<typeof entry> => Boolean(entry))
      : [];
    const workflowStageExecutorRecommendations = Array.isArray(workspaceOperationalMemory.workflow_stage_executor_recommendations)
      ? workspaceOperationalMemory.workflow_stage_executor_recommendations
        .map((entry: unknown) => {
          const workflow = this.normalizeWorkflowKind(entry?.workflow);
          const role = String(entry?.role || '').trim().toLowerCase();
          const executor = String(entry?.executor || '').trim().toLowerCase();
          if (!workflow || !role || !executor) {
            return null;
          }
          return {
            workflow,
            role,
            executor,
            success_count: Math.max(0, Number(entry?.success_count || 0)),
            pending_count: Math.max(0, Number(entry?.pending_count || 0)),
            failed_count: Math.max(0, Number(entry?.failed_count || 0)),
            confidence: this.normalizeConfidence(entry?.confidence),
            rationale: String(entry?.rationale || '').trim(),
          };
        })
        .filter((entry: unknown): entry is NonNullable<typeof entry> => Boolean(entry))
      : [];
    const workflowFrictionRecommendations = Array.isArray(workspaceOperationalMemory.workflow_friction_recommendations)
      ? workspaceOperationalMemory.workflow_friction_recommendations
        .map((entry: unknown) => {
          const workflow = this.normalizeWorkflowKind(entry?.workflow);
          if (!workflow) {
            return null;
          }
          return {
            workflow,
            approval_pending_count: Math.max(0, Number(entry?.approval_pending_count || 0)),
            blocked_count: Math.max(0, Number(entry?.blocked_count || 0)),
            failed_count: Math.max(0, Number(entry?.failed_count || 0)),
            last_resume_stage_label: String(entry?.last_resume_stage_label || '').trim() || null,
            confidence: this.normalizeConfidence(entry?.confidence),
            rationale: String(entry?.rationale || '').trim(),
          };
        })
        .filter((entry: unknown): entry is NonNullable<typeof entry> => Boolean(entry))
      : [];
    const approvalFrictionRecommendations = Array.isArray(workspaceOperationalMemory.approval_friction_recommendations)
      ? workspaceOperationalMemory.approval_friction_recommendations
        .map((entry: unknown) => {
          const executor = String(entry?.executor || '').trim().toLowerCase();
          if (!executor) {
            return null;
          }
          return {
            executor,
            kind: String(entry?.kind || 'general').trim() || 'general',
            subtype: String(entry?.subtype || 'general').trim() || 'general',
            pending_count: Math.max(0, Number(entry?.pending_count || 0)),
            rejected_count: Math.max(0, Number(entry?.rejected_count || 0)),
            high_risk_count: Math.max(0, Number(entry?.high_risk_count || 0)),
            permission_count: Math.max(0, Number(entry?.permission_count || 0)),
            confidence: this.normalizeConfidence(entry?.confidence),
            rationale: String(entry?.rationale || '').trim(),
          };
        })
        .filter((entry: unknown): entry is NonNullable<typeof entry> => Boolean(entry))
      : [];

    const context: WorkflowWorkspaceContext = {
      profile_summary: metadata.workspace_profile_summary || null,
      operational_summary: metadata.workspace_operational_memory_summary || null,
      profile_notes: Array.isArray(metadata.workspace_profile_notes) ? metadata.workspace_profile_notes : [],
      operational_notes: Array.isArray(metadata.workspace_operational_notes) ? metadata.workspace_operational_notes : [],
      active_focus: activeFocus
        ? {
            summary: String(activeFocus.summary || activeFocus.short_id || 'Foco em andamento').trim(),
            executor: activeFocus.executor || null,
            status: activeFocus.status || null,
          }
        : null,
      recent_artifact: recentArtifact
        ? {
            name: String(recentArtifact.name || 'entrega-recente').trim(),
            kind: recentArtifact.kind || null,
            summary: recentArtifact.summary || null,
          }
        : null,
      continuity_recommendation: continuityRecommendation
        ? {
            label: String(continuityRecommendation.label || 'Continuar a partir do contexto atual').trim(),
            reason: String(continuityRecommendation.reason || 'Contexto operacional recente encontrado.').trim(),
            executor: continuityRecommendation.executor || null,
          }
        : null,
      workflow_executor_recommendations: workflowExecutorRecommendations,
      workflow_stage_executor_recommendations: workflowStageExecutorRecommendations,
      workflow_friction_recommendations: workflowFrictionRecommendations,
      approval_friction_recommendations: approvalFrictionRecommendations,
    };

    const hasSignal = Boolean(
      context.profile_summary
      || context.operational_summary
      || context.profile_notes.length > 0
      || context.operational_notes.length > 0
      || context.active_focus
      || context.recent_artifact
      || context.continuity_recommendation
      || workflowExecutorRecommendations.length > 0
      || workflowStageExecutorRecommendations.length > 0
      || workflowFrictionRecommendations.length > 0
      || approvalFrictionRecommendations.length > 0,
    );

    return hasSignal ? context : null;
  }

  private normalizeWorkflowKind(input: unknown): WorkflowKind | null {
    const normalized = String(input || '').trim().toLowerCase();
    if (normalized === 'review' || normalized === 'ship' || normalized === 'research') {
      return normalized;
    }
    return null;
  }

  private normalizeConfidence(input: unknown): 'low' | 'medium' | 'high' {
    const normalized = String(input || '').trim().toLowerCase();
    if (normalized === 'high' || normalized === 'medium') {
      return normalized;
    }
    return 'low';
  }
}
