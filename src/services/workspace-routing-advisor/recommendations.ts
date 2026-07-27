import type {
  ApprovedPolicyAggregate,
  ContinuityRecommendation,
  RecentArtifactAggregate,
  RouteOutcomeAggregate,
  TaskKindLlmRecommendation,
  TaskSubtypeLlmRecommendation,
  WorkflowExecutorRecommendationAggregate,
  WorkflowRecommendationAggregate,
} from '../WorkspaceOperationalMemoryService.js';
import type {
  LlmRecommendation,
  RoutingCandidate,
  WorkflowFrictionRecommendation,
  WorkflowRecommendation,
  WorkflowStageExecutorRecommendation,
} from './types.js';

export function resolveWorkflowStageRole(
  workflow: string,
  taskKind: string,
  taskSubtype: string,
): 'maker' | 'reviewer' | 'researcher' | 'synthesizer' | null {
  if (workflow === 'review') {
    return 'reviewer';
  }
  if (workflow === 'research') {
    return taskSubtype === 'summarization' ? 'synthesizer' : 'researcher';
  }
  if (workflow === 'ship') {
    if (taskKind === 'code' && taskSubtype === 'review') {
      return 'reviewer';
    }
    return 'maker';
  }
  return null;
}

export function applyWorkflowStagePerformanceBoost(
  baseConfidence: number,
  recommendation: WorkflowStageExecutorRecommendation | null,
): number {
  if (!recommendation) {
    return baseConfidence;
  }

  const successWeight = Number(recommendation.success_count || 0) * 0.03;
  const recoveredWeight = Number(recommendation.recovered_count || 0) * 0.05;
  const pendingPenalty = Number(recommendation.pending_count || 0) * 0.02;
  const failedPenalty = Number(recommendation.failed_count || 0) * 0.04;
  return Math.max(0.2, Math.min(0.97, baseConfidence + successWeight + recoveredWeight - pendingPenalty - failedPenalty));
}

export function applyWorkflowExecutorPerformanceBoost(
  baseConfidence: number,
  recommendation: WorkflowExecutorRecommendationAggregate | null,
): number {
  if (!recommendation) {
    return baseConfidence;
  }

  const successWeight = Number(recommendation.success_count || 0) * 0.02;
  const recoveredWeight = Number(recommendation.recovered_count || 0) * 0.04;
  const pendingPenalty = Number(recommendation.pending_count || 0) * 0.02;
  const failedPenalty = Number(recommendation.failed_count || 0) * 0.04;
  return Math.max(0.2, Math.min(0.97, baseConfidence + successWeight + recoveredWeight - pendingPenalty - failedPenalty));
}

export function shouldDeferWorkflowRecommendation(
  workflowRecommendation: WorkflowRecommendation | null,
  workflowFriction: WorkflowFrictionRecommendation | null,
  routeOutcome: RouteOutcomeAggregate | null,
  approvedPolicy: ApprovedPolicyAggregate | null,
): boolean {
  if (!workflowRecommendation || !workflowFriction || !routeOutcome) {
    return false;
  }

  if (approvedPolicy) {
    return false;
  }

  const frictionWeight =
    Number(workflowFriction.failed_count || 0) * 3
    + Number(workflowFriction.blocked_count || 0) * 2
    + Number(workflowFriction.approval_pending_count || 0) * 2;
  const recoveryWeight = Number(workflowFriction.recovered_count || 0) * 2;
  const routeFailureWeight =
    Number(routeOutcome.failed_count || 0) * 3
    + Number(routeOutcome.approval_pending_count || 0) * 2
    + Number(routeOutcome.permission_pending_count || 0);
  const routeSuccessWeight =
    Number(routeOutcome.completed_count || 0) * 2
    + Number(routeOutcome.artifactful_count || 0)
    + Number(routeOutcome.gated_completion_count || 0) * 2
    + Number(routeOutcome.gated_artifactful_count || 0) * 2
    + Number(routeOutcome.workflow_recovery_success_count || 0) * 2
    + Number(routeOutcome.workflow_recovery_artifactful_count || 0) * 2;

  return frictionWeight - recoveryWeight >= 5 && routeFailureWeight > routeSuccessWeight + recoveryWeight;
}

export function buildLlmRecommendation(
  subtypeEntry: TaskSubtypeLlmRecommendation | null,
  kindEntry: TaskKindLlmRecommendation | null,
): LlmRecommendation {
  const subtypeProvider = String(subtypeEntry?.preferred_provider || '').trim();
  if (subtypeProvider) {
    return {
      provider: subtypeProvider,
      model: String(subtypeEntry?.preferred_model || '').trim() || null,
      source: 'subtype_memory',
      confidence: subtypeEntry?.confidence || 'medium',
      rationale: String(subtypeEntry?.rationale || '').trim() || 'Historico recente por subtipo.',
    };
  }

  const kindProvider = String(kindEntry?.preferred_provider || '').trim();
  if (kindProvider) {
    return {
      provider: kindProvider,
      model: String(kindEntry?.preferred_model || '').trim() || null,
      source: 'kind_memory',
      confidence: kindEntry?.confidence || 'medium',
      rationale: String(kindEntry?.rationale || '').trim() || 'Historico recente por tipo.',
    };
  }

  return null;
}

export function buildWorkflowRecommendation(input: {
  taskKind: string;
  taskSubtype: string;
  selectedCandidate: RoutingCandidate | null;
  activeFocusMatch: { kind?: string; subtype?: string; executor?: string } | null;
  recentArtifacts: RecentArtifactAggregate[];
  continuityRecommendations: ContinuityRecommendation[];
  workflowRecommendations: WorkflowRecommendationAggregate[];
}): WorkflowRecommendation | null {
  const hasStrongContinuitySignal = Boolean(
    input.activeFocusMatch ||
      input.recentArtifacts.length > 0 ||
      input.continuityRecommendations.length > 0,
  );
  const topContinuityKind = String(input.continuityRecommendations[0]?.kind || '').trim().toLowerCase();
  const topWorkflowRecommendation = input.workflowRecommendations[0] || null;
  const selectedConfidence = Number(input.selectedCandidate?.confidence || 0);
  const recoveredWorkflowBoost = Math.min(0.04, Number(topWorkflowRecommendation?.recovered_count || 0) * 0.02);

  if (input.taskKind === 'research') {
    if (
      String(topWorkflowRecommendation?.workflow || '').trim().toLowerCase() === 'research'
      || hasStrongContinuitySignal
      || selectedConfidence >= 0.82
    ) {
      return {
        workflow: 'research',
        confidence: Math.max(selectedConfidence, topWorkflowRecommendation ? 0.9 + recoveredWorkflowBoost : 0.84),
        rationale:
          String(topWorkflowRecommendation?.workflow || '').trim().toLowerCase() === 'research'
            ? String(topWorkflowRecommendation?.rationale || '').trim() || 'The workspace already has strong research workflow history.'
            : 'Pesquisa com contexto recente ganha mais value when already nasce como coleta mais final synthesis.',
      };
    }
    return null;
  }

  if (input.taskKind !== 'code') {
    return null;
  }

  if (input.taskSubtype === 'review') {
    if (
      String(topWorkflowRecommendation?.workflow || '').trim().toLowerCase() === 'review'
      || hasStrongContinuitySignal
      || ['active_focus', 'subtype_memory'].includes(String(input.selectedCandidate?.source || ''))
    ) {
      return {
        workflow: 'review',
        confidence: Math.max(selectedConfidence, topWorkflowRecommendation ? 0.91 + recoveredWorkflowBoost : 0.86),
        rationale:
          String(topWorkflowRecommendation?.workflow || '').trim().toLowerCase() === 'review'
            ? String(topWorkflowRecommendation?.rationale || '').trim() || 'The workspace already has strong review workflow history.'
            : 'Review with workspace continuity works better when execution and audit run in dedicated steps.',
      };
    }
    return null;
  }

  const shipLikeSubtype = ['implementation', 'debugging', 'testing', 'general'].includes(input.taskSubtype);
  const shipLikeContinuity = ['resume_active', 'continue_from_success', 'reuse_recent_artifact', 'resolve_approval'].includes(topContinuityKind);
  if (
    shipLikeSubtype &&
    (
      String(topWorkflowRecommendation?.workflow || '').trim().toLowerCase() === 'ship'
      || shipLikeContinuity
      || (hasStrongContinuitySignal && selectedConfidence >= 0.78)
    )
  ) {
    return {
      workflow: 'ship',
      confidence: Math.max(selectedConfidence, topWorkflowRecommendation ? 0.89 + recoveredWorkflowBoost : 0.82),
      rationale:
        String(topWorkflowRecommendation?.workflow || '').trim().toLowerCase() === 'ship'
          ? String(topWorkflowRecommendation?.rationale || '').trim() || 'The workspace already has strong delivery workflow history.'
          : 'Multi-step delivery reduces rework when the workspace already has focus, artifacts, or recent approval.',
    };
  }

  return null;
}
