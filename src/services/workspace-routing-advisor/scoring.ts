import { formatDurationMs } from './shared.js';
import type {
  ApprovedPolicyAggregate,
  ApprovalFrictionRecommendation,
  RouteOutcomeAggregate,
  RoutingCandidate,
  WorkflowFrictionRecommendation,
} from './types.js';
import type { WorkspaceTaskKind, WorkspaceTaskSubtype } from '../WorkspaceTaskKind.js';

export function applyApprovalFrictionPenalty(baseConfidence: number, friction: ApprovalFrictionRecommendation): number {
  if (!friction) {
    return baseConfidence;
  }

  const weight =
    Number(friction.rejected_count || 0) * 0.12
    + Number(friction.high_risk_count || 0) * 0.07
    + Number(friction.permission_count || 0) * 0.04
    + Number(friction.pending_count || 0) * 0.03;
  const positiveOffset =
    Number(friction.granted_count || 0) * 0.03
    + Number(friction.delivered_after_approval_count || 0) * 0.07;
  const waitPenalty = Math.min(0.08, Number(friction.average_wait_ms || 0) / (2 * 60 * 60 * 1000) * 0.04);
  const recoveryPenalty = Math.min(0.08, Number(friction.average_recovery_ms || 0) / (2 * 60 * 60 * 1000) * 0.04);
  const fastRecoveryOffset =
    Number(friction.average_recovery_ms || 0) > 0
    && Number(friction.average_recovery_ms || 0) <= 20 * 60 * 1000
    && Number(friction.delivered_after_approval_count || 0) > 0
      ? 0.04
      : 0;
  return Math.max(
    0.18,
    Math.min(0.98, baseConfidence - Math.max(0, weight + waitPenalty + recoveryPenalty - positiveOffset - fastRecoveryOffset)),
  );
}

export function applyWorkflowFrictionPenalty(baseConfidence: number, friction: WorkflowFrictionRecommendation): number {
  if (!friction) {
    return baseConfidence;
  }

  const weight =
    Number(friction.failed_count || 0) * 0.14
    + Number(friction.blocked_count || 0) * 0.08
    + Number(friction.approval_pending_count || 0) * 0.06;
  const recoveryOffset = Math.min(0.08, Number(friction.recovered_count || 0) * 0.03);
  return Math.max(0.24, Math.min(0.98, baseConfidence - Math.max(0, weight - recoveryOffset)));
}

export function appendApprovalFrictionRationale(base: string, friction: ApprovalFrictionRecommendation): string {
  if (!friction) {
    return base;
  }

  const details = [
    friction.rejected_count ? `${friction.rejected_count} rejeicao(oes)` : null,
    friction.high_risk_count ? `${friction.high_risk_count} gate(s) de alto risco` : null,
    friction.permission_count ? `${friction.permission_count} pedido(s) de permissao` : null,
    friction.pending_count ? `${friction.pending_count} espera(s) de confirmacao` : null,
    friction.granted_count ? `${friction.granted_count} liberacao(oes) concluida(s)` : null,
    friction.delivered_after_approval_count ? `${friction.delivered_after_approval_count} entrega(s) apos aprovacao` : null,
    Number(friction.average_wait_ms || 0) > 0 ? `espera media ${formatDurationMs(Number(friction.average_wait_ms || 0))}` : null,
    Number(friction.average_recovery_ms || 0) > 0 ? `retomada media ${formatDurationMs(Number(friction.average_recovery_ms || 0))}` : null,
  ].filter(Boolean).join(', ');

  return `${base} Ha friccao operacional recente com ${friction.executor} neste contexto (${details}).`;
}

export function shouldUseCheckpointedStyle(friction: ApprovalFrictionRecommendation): boolean {
  if (!friction) {
    return false;
  }

  const weight =
    Number(friction.rejected_count || 0) * 3
    + Number(friction.high_risk_count || 0) * 2
    + Number(friction.permission_count || 0)
    + Number(friction.pending_count || 0)
    - Number(friction.granted_count || 0)
    - Number(friction.delivered_after_approval_count || 0) * 2;
  return weight >= 3;
}

export function shouldUseCheckpointedWorkflowStyle(friction: WorkflowFrictionRecommendation): boolean {
  if (!friction) {
    return false;
  }

  const weight =
    Number(friction.failed_count || 0) * 3
    + Number(friction.blocked_count || 0) * 2
    + Number(friction.approval_pending_count || 0) * 2
    - Number(friction.recovered_count || 0);
  return weight >= 2;
}

export function shouldBlockByApprovalFriction(friction: ApprovalFrictionRecommendation): boolean {
  if (!friction) {
    return false;
  }

  const weight =
    Number(friction.rejected_count || 0) * 3
    + Number(friction.high_risk_count || 0) * 2
    + Number(friction.permission_count || 0)
    + Number(friction.pending_count || 0)
    - Number(friction.granted_count || 0)
    - Number(friction.delivered_after_approval_count || 0) * 2;
  if (Number(friction.delivered_after_approval_count || 0) > 0 && Number(friction.rejected_count || 0) < 2) {
    return false;
  }
  return Number(friction.rejected_count || 0) >= 2 || weight >= 8;
}

export function shouldBlockByRouteOutcome(routeOutcome: RouteOutcomeAggregate): boolean {
  if (!routeOutcome) {
    return false;
  }

  const recoveryDeliveryWeight =
    Number(routeOutcome.workflow_recovery_success_count || 0)
    + Number(routeOutcome.workflow_recovery_artifactful_count || 0) * 2;
  const gatedDeliveryWeight =
    Number(routeOutcome.gated_completion_count || 0)
    + Number(routeOutcome.gated_artifactful_count || 0) * 2;
  if (
    (recoveryDeliveryWeight >= 3 || gatedDeliveryWeight >= 3)
    && Number(routeOutcome.completed_count || 0) > 0
  ) {
    return false;
  }

  const rejectionWeight =
    Number(routeOutcome.rejected_count || 0)
    + Number(routeOutcome.approval_rejected_count || 0)
    + Number(routeOutcome.permission_rejected_count || 0);
  if (rejectionWeight >= 3 && Number(routeOutcome.friction_rate || 0) >= 0.45) {
    return true;
  }

  if (
    Number(routeOutcome.failed_count || 0) >= 3
    && Number(routeOutcome.completed_count || 0) === 0
  ) {
    return true;
  }

  if (
    Number(routeOutcome.average_approval_wait_ms || 0) >= 4 * 60 * 60 * 1000
    && Number(routeOutcome.gated_artifactful_count || 0) === 0
    && Number(routeOutcome.workflow_recovery_artifactful_count || 0) === 0
  ) {
    return true;
  }

  return false;
}

export function buildBlockedExecutorReason(
  routeOutcomes: RouteOutcomeAggregate[],
  approvalFrictionRecommendations: ApprovalFrictionRecommendation[],
  executor: string,
  kind: WorkspaceTaskKind,
  subtype: WorkspaceTaskSubtype,
  surfaceSource: string | null,
  findRouteOutcome: (routeOutcomes: RouteOutcomeAggregate[], executor: string, kind: WorkspaceTaskKind, subtype: WorkspaceTaskSubtype, surfaceSource: string | null) => RouteOutcomeAggregate,
  findApprovalFriction: (recommendations: ApprovalFrictionRecommendation[], executor: string | null, kind: WorkspaceTaskKind, subtype: WorkspaceTaskSubtype) => ApprovalFrictionRecommendation,
): string | null {
  const routeOutcome = findRouteOutcome(routeOutcomes, executor, kind, subtype, surfaceSource);
  if (routeOutcome && shouldBlockByRouteOutcome(routeOutcome)) {
    return `Mantive ${executor} fora desta rota por rejeicoes recentes ou friccao acumulada (${routeOutcome.rationale}).`;
  }

  const approvalFriction = findApprovalFriction(
    approvalFrictionRecommendations,
    executor,
    kind,
    subtype,
  );
  if (approvalFriction && shouldBlockByApprovalFriction(approvalFriction)) {
    return `Mantive ${executor} fora desta rota por friccao operacional forte (${approvalFriction.rationale}).`;
  }

  return null;
}

export function enrichCandidate(
  candidate: RoutingCandidate,
  input: {
    approvedPolicies: ApprovedPolicyAggregate[];
    routeOutcomes: RouteOutcomeAggregate[];
    taskKind: WorkspaceTaskKind;
    taskSubtype: WorkspaceTaskSubtype;
    surfaceSource: string | null;
  },
  findRouteOutcome: (routeOutcomes: RouteOutcomeAggregate[], executor: string, kind: WorkspaceTaskKind, subtype: WorkspaceTaskSubtype, surfaceSource: string | null) => RouteOutcomeAggregate,
  findApprovedPolicyBoost: (approvedPolicies: ApprovedPolicyAggregate[], executor: string, kind: WorkspaceTaskKind, subtype: WorkspaceTaskSubtype) => ApprovedPolicyAggregate,
): RoutingCandidate {
  const routeOutcome = findRouteOutcome(
    input.routeOutcomes,
    candidate.executor,
    input.taskKind,
    input.taskSubtype,
    input.surfaceSource,
  );
  const approvedPolicy = findApprovedPolicyBoost(
    input.approvedPolicies,
    candidate.executor,
    input.taskKind,
    input.taskSubtype,
  );

  let confidence = candidate.confidence;
  let rationale = candidate.rationale;

  if (routeOutcome) {
    if (
      Number(routeOutcome.success_rate || 0) >= 0.8
      && routeOutcome.completed_count > 0
      && routeOutcome.completed_count >= routeOutcome.failed_count
    ) {
      confidence = Math.min(0.98, confidence + 0.08);
      rationale = `${rationale} Esse executor ja concluiu rotas parecidas neste workspace (${routeOutcome.rationale}).`.trim();
    } else if (routeOutcome.failed_count > routeOutcome.completed_count) {
      confidence = Math.max(0.2, confidence - 0.08);
      rationale = `${rationale} Considerei tambem que esse executor falhou mais do que concluiu em rotas parecidas (${routeOutcome.rationale}).`.trim();
    }
    if (routeOutcome.source_surface && input.surfaceSource && routeOutcome.source_surface === input.surfaceSource) {
      confidence = Math.min(0.98, confidence + 0.03);
      rationale = `${rationale} Esse historico veio da mesma superficie (${routeOutcome.source_surface}), entao ganhou mais peso.`.trim();
    }
    if (routeOutcome.approval_pending_count > 0 || routeOutcome.permission_pending_count > 0) {
      confidence = Math.max(0.2, confidence - 0.03);
    }
    if (Number(routeOutcome.approval_granted_count || 0) > 0 || Number(routeOutcome.permission_granted_count || 0) > 0) {
      confidence = Math.min(
        0.98,
        confidence + Math.min(0.05, (Number(routeOutcome.approval_granted_count || 0) + Number(routeOutcome.permission_granted_count || 0)) * 0.02),
      );
    }
    if (Number(routeOutcome.approval_rejected_count || 0) > 0 || Number(routeOutcome.permission_rejected_count || 0) > 0) {
      confidence = Math.max(
        0.18,
        confidence - Math.min(0.14, (Number(routeOutcome.approval_rejected_count || 0) + Number(routeOutcome.permission_rejected_count || 0)) * 0.04),
      );
    }
    if (Number(routeOutcome.rejected_count || 0) > 0) {
      confidence = Math.max(0.18, confidence - Math.min(0.18, Number(routeOutcome.rejected_count || 0) * 0.05));
      rationale = `${rationale} Tambem considerei rejeicoes recentes nesta rota (${routeOutcome.rejected_count}).`.trim();
    }
    if (Number(routeOutcome.high_risk_count || 0) > 0) {
      confidence = Math.max(0.18, confidence - Math.min(0.1, Number(routeOutcome.high_risk_count || 0) * 0.04));
    }
    if (Number(routeOutcome.friction_rate || 0) >= 0.5) {
      confidence = Math.max(0.18, confidence - 0.08);
    }
    if (Number(routeOutcome.rejected_count || 0) >= 2 && Number(routeOutcome.friction_rate || 0) >= 0.5) {
      confidence = Math.max(0.18, confidence - 0.06);
    }
    const recoverySuccessCount = Number(routeOutcome.workflow_recovery_success_count || 0);
    const recoveryArtifactfulCount = Number(routeOutcome.workflow_recovery_artifactful_count || 0);
    if (recoverySuccessCount > 0) {
      confidence = Math.min(
        0.98,
        confidence + Math.min(0.14, recoverySuccessCount * 0.04 + recoveryArtifactfulCount * 0.03),
      );
      rationale = `${rationale} Essa rota ja recuperou interrupcoes recentes${recoveryArtifactfulCount > 0 ? ` e entregou ${recoveryArtifactfulCount} artefato(s) final(is)` : ''}.`.trim();
      if (Number(routeOutcome.friction_rate || 0) >= 0.5 && recoveryArtifactfulCount > 0) {
        confidence = Math.min(0.98, confidence + 0.04);
      }
    }
    const gatedCompletionCount = Number(routeOutcome.gated_completion_count || 0);
    const gatedArtifactfulCount = Number(routeOutcome.gated_artifactful_count || 0);
    if (gatedCompletionCount > 0) {
      confidence = Math.min(
        0.98,
        confidence + Math.min(0.12, gatedCompletionCount * 0.03 + gatedArtifactfulCount * 0.03),
      );
      rationale = `${rationale} Essa rota costuma passar pelo gate humano e ainda concluir${gatedArtifactfulCount > 0 ? ` com ${gatedArtifactfulCount} entrega(s) apos liberacao` : ''}.`.trim();
      if (Number(routeOutcome.approval_pending_count || 0) > 0 && gatedArtifactfulCount > 0) {
        confidence = Math.min(0.98, confidence + 0.03);
      }
    }
    const averageApprovalWaitMs = Number(routeOutcome.average_approval_wait_ms || 0);
    const averageRecoveryMs = Number(routeOutcome.average_post_approval_recovery_ms || 0);
    const averageArtifactDeliveryMs = Number(routeOutcome.average_artifact_delivery_after_approval_ms || 0);
    if (averageApprovalWaitMs >= 2 * 60 * 60 * 1000) {
      confidence = Math.max(0.18, confidence - 0.08);
      rationale = `${rationale} O gate humano costuma segurar essa rota por ${formatDurationMs(averageApprovalWaitMs)} em media.`.trim();
    } else if (averageApprovalWaitMs > 0 && averageApprovalWaitMs <= 15 * 60 * 1000 && gatedCompletionCount > 0) {
      confidence = Math.min(0.98, confidence + 0.03);
    }
    if (averageRecoveryMs >= 60 * 60 * 1000 && gatedCompletionCount > 0 && gatedArtifactfulCount === 0) {
      confidence = Math.max(0.18, confidence - 0.05);
      rationale = `${rationale} Mesmo depois da liberacao, a retomada ainda demora ${formatDurationMs(averageRecoveryMs)} em media.`.trim();
    } else if (averageRecoveryMs > 0 && averageRecoveryMs <= 20 * 60 * 1000 && gatedCompletionCount > 0) {
      confidence = Math.min(0.98, confidence + 0.03);
    }
    if (averageArtifactDeliveryMs > 0 && averageArtifactDeliveryMs <= 20 * 60 * 1000 && gatedArtifactfulCount > 0) {
      confidence = Math.min(0.98, confidence + 0.04);
    }
  }

  if (approvedPolicy) {
    confidence = Math.min(0.98, confidence + 0.05);
    rationale = `${rationale} Ja existem politicas aprovadas que reduzem atrito para ${candidate.executor} (${approvedPolicy.rationale}).`.trim();
  }

  return {
    ...candidate,
    confidence,
    rationale,
  };
}
