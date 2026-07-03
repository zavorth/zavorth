import type { ParsedCommand } from '../../gateways/channels/telegram/CommandParser.js';
import type { RouteIntent } from '../../orchestrator/IntentRouter.js';
import type { WorkspaceProfile } from '../WorkspaceProfileService.js';
import type { WorkspaceOperationalMemory } from '../WorkspaceOperationalMemoryService.js';
import {
  classifyWorkspaceTaskProfile,
  resolveWorkspaceResponseStyle,
  type WorkspaceResponseStyle,
  type WorkspaceTaskKind,
  type WorkspaceTaskSubtype,
} from '../WorkspaceTaskKind.js';
import type {
  ActiveFocusAggregate,
  DirectResponseStyleRecommendation,
  TaskKindLlmRecommendation,
  TaskKindRecommendation,
  TaskSubtypeLlmRecommendation,
  TaskSubtypeRecommendation,
  WorkflowExecutorRecommendationAggregate,
} from '../WorkspaceOperationalMemoryService.js';
import {
  collectBlockedExecutors,
  findApprovalFriction,
  findApprovedPolicyBoost,
  findDominantApprovalFriction,
  findRouteOutcome,
  findWorkflowFriction,
  findWorkflowStageExecutorRecommendation,
} from './memory.js';
import {
  applyApprovalFrictionPenalty,
  applyWorkflowFrictionPenalty,
  appendApprovalFrictionRationale,
  buildBlockedExecutorReason,
  enrichCandidate,
  shouldBlockByApprovalFriction,
  shouldBlockByRouteOutcome,
  shouldUseCheckpointedStyle,
  shouldUseCheckpointedWorkflowStyle,
} from './scoring.js';
import {
  applyWorkflowExecutorPerformanceBoost,
  applyWorkflowStagePerformanceBoost,
  buildLlmRecommendation,
  buildWorkflowRecommendation,
  resolveWorkflowStageRole,
  shouldDeferWorkflowRecommendation,
} from './recommendations.js';
import { getProfileExecutor, normalizeExecutor } from './shared.js';
import type {
  AdviceInput,
  LlmRecommendation,
  RoutingCandidate,
  RoutingCandidateSource,
  WorkspaceRoutingAdvice,
  WorkflowRecommendation,
  WorkflowStageExecutorRecommendation,
} from './types.js';

export type { WorkspaceRoutingAdvice } from './types.js';

export class WorkspaceRoutingAdvisor {
  public recommend(input: AdviceInput): WorkspaceRoutingAdvice {
    const taskProfile = classifyWorkspaceTaskProfile({
      commandType: input.parsed.command_type,
      text: input.parsed.command_args || input.parsed.normalized_message,
      intent: input.route.intent,
      executor: input.route.executor_preference,
    });
    const memory = input.workspaceOperationalMemory || {};
    const surfaceSource = String(input.surface_source || '').trim().toLowerCase() || null;
    const preferredExecutors = input.workspaceProfile?.preferred_executors || {};
    const candidates: RoutingCandidate[] = [];
    const rationale: string[] = [];

    const mem = (memory || {}) as Partial<WorkspaceOperationalMemory>;
    const taskKindRecommendations: TaskKindRecommendation[] = Array.isArray(mem.task_kind_recommendations)
      ? mem.task_kind_recommendations
      : [];
    const taskSubtypeRecommendations: TaskSubtypeRecommendation[] = Array.isArray(mem.task_subtype_recommendations)
      ? mem.task_subtype_recommendations
      : [];
    const activeFocuses: ActiveFocusAggregate[] = Array.isArray(mem.active_focuses)
      ? mem.active_focuses
      : [];
    const recentArtifacts = Array.isArray(mem.recent_artifacts)
      ? mem.recent_artifacts
      : [];
    const continuityRecommendations = Array.isArray(mem.continuity_recommendations)
      ? mem.continuity_recommendations
      : [];
    const workflowRecommendations = Array.isArray(mem.workflow_recommendations)
      ? mem.workflow_recommendations
      : [];
    const workflowExecutorRecommendations: WorkflowExecutorRecommendationAggregate[] = Array.isArray(mem.workflow_executor_recommendations)
      ? mem.workflow_executor_recommendations
      : [];
    const workflowStageExecutorRecommendations = Array.isArray(mem.workflow_stage_executor_recommendations)
      ? mem.workflow_stage_executor_recommendations
      : [];
    const workflowFrictionRecommendations = Array.isArray(mem.workflow_friction_recommendations)
      ? mem.workflow_friction_recommendations
      : [];
    const approvalFrictionRecommendations = Array.isArray(mem.approval_friction_recommendations)
      ? mem.approval_friction_recommendations
      : [];
    const approvedPolicies = Array.isArray(mem.approved_policies)
      ? mem.approved_policies
      : [];
    const routeOutcomes = Array.isArray(mem.route_outcomes)
      ? mem.route_outcomes
      : [];
    const blockedExecutors = collectBlockedExecutors(
      memory,
      taskProfile.kind,
      taskProfile.subtype,
      approvedPolicies,
      routeOutcomes,
      findDominantApprovalFriction,
      shouldBlockByApprovalFriction,
      findApprovedPolicyBoost,
      shouldBlockByRouteOutcome,
    );
    const successfulExecutors = Array.isArray(mem.successful_executors)
      ? mem.successful_executors
      : [];
    const directResponseStyleRecommendations: DirectResponseStyleRecommendation[] = Array.isArray(mem.direct_response_style_recommendations)
      ? mem.direct_response_style_recommendations
      : [];
    const taskKindLlmRecommendations: TaskKindLlmRecommendation[] = Array.isArray(mem.task_kind_llm_recommendations)
      ? mem.task_kind_llm_recommendations
      : [];
    const taskSubtypeLlmRecommendations: TaskSubtypeLlmRecommendation[] = Array.isArray(mem.task_subtype_llm_recommendations)
      ? mem.task_subtype_llm_recommendations
      : [];

    const subtypeRecommendation = taskSubtypeRecommendations.find((entry) => {
      return String(entry?.kind || '').trim().toLowerCase() === taskProfile.kind
        && String(entry?.subtype || '').trim().toLowerCase() === taskProfile.subtype;
    }) || null;
    const activeFocusMatch = activeFocuses.find((entry) => {
      const entryKind = String(entry?.kind || '').trim().toLowerCase();
      const entrySubtype = String(entry?.subtype || '').trim().toLowerCase();
      const entryStatus = String(entry?.status || '').trim().toLowerCase();
      return entryKind === taskProfile.kind
        && ['pending', 'parsed', 'planned', 'waiting_approval', 'approved', 'running', 'validating', 'delivery_pending'].includes(entryStatus)
        && (entrySubtype === taskProfile.subtype || entrySubtype === 'general' || taskProfile.subtype === 'general');
    }) || null;
    const kindRecommendation = taskKindRecommendations.find((entry) => {
      return String(entry?.kind || '').trim().toLowerCase() === taskProfile.kind;
    }) || null;

    const activeFocusExecutor = normalizeExecutor(activeFocusMatch?.executor);
    if (activeFocusExecutor && !blockedExecutors.includes(activeFocusExecutor)) {
      const activeFocusFriction = findApprovalFriction(
        approvalFrictionRecommendations,
        activeFocusExecutor,
        taskProfile.kind,
        taskProfile.subtype,
      );
      candidates.push({
        executor: activeFocusExecutor,
        source: 'active_focus',
        confidence: applyApprovalFrictionPenalty(
          String(activeFocusMatch?.subtype || '').trim().toLowerCase() === taskProfile.subtype ? 0.9 : 0.78,
          activeFocusFriction,
        ),
        rationale: appendApprovalFrictionRationale(
          `O workspace ja tem um foco ativo semelhante com ${activeFocusExecutor}; continuar no mesmo executor reduz troca de contexto.`,
          activeFocusFriction,
        ),
      });
    }

    const subtypeExecutor = normalizeExecutor(subtypeRecommendation?.preferred_executor);
    const subtypeSuccessCount = Number(subtypeRecommendation?.success_count || 0);
    if (subtypeExecutor && !blockedExecutors.includes(subtypeExecutor) && subtypeSuccessCount > 0) {
      const subtypeFriction = findApprovalFriction(
        approvalFrictionRecommendations,
        subtypeExecutor,
        taskProfile.kind,
        taskProfile.subtype,
      );
      candidates.push({
        executor: subtypeExecutor,
        source: 'subtype_memory',
        confidence: applyApprovalFrictionPenalty(0.92, subtypeFriction),
        rationale: appendApprovalFrictionRationale(
          `Historico recente do workspace aponta ${subtypeExecutor} como melhor executor para ${taskProfile.subtype}.`,
          subtypeFriction,
        ),
      });
    }

    const kindExecutor = normalizeExecutor(kindRecommendation?.preferred_executor);
    const kindSuccessCount = Number(kindRecommendation?.success_count || 0);
    if (kindExecutor && !blockedExecutors.includes(kindExecutor) && kindSuccessCount > 0) {
      const kindFriction = findApprovalFriction(
        approvalFrictionRecommendations,
        kindExecutor,
        taskProfile.kind,
        taskProfile.subtype,
      );
      candidates.push({
        executor: kindExecutor,
        source: 'kind_memory',
        confidence: applyApprovalFrictionPenalty(0.82, kindFriction),
        rationale: appendApprovalFrictionRationale(
          `Historico recente do workspace favorece ${kindExecutor} para tarefas do tipo ${taskProfile.kind}.`,
          kindFriction,
        ),
      });
    }

    const profileExecutor = getProfileExecutor(preferredExecutors, taskProfile.kind);
    if (profileExecutor && !blockedExecutors.includes(profileExecutor)) {
      const profileFriction = findApprovalFriction(
        approvalFrictionRecommendations,
        profileExecutor,
        taskProfile.kind,
        taskProfile.subtype,
      );
      candidates.push({
        executor: profileExecutor,
        source: 'profile_default',
        confidence: applyApprovalFrictionPenalty(0.68, profileFriction),
        rationale: appendApprovalFrictionRationale(
          `Perfil do workspace define ${profileExecutor} como padrao para ${taskProfile.kind}.`,
          profileFriction,
        ),
      });
    }

    const preliminaryWorkflowRecommendation = buildWorkflowRecommendation({
      taskKind: taskProfile.kind,
      taskSubtype: taskProfile.subtype,
      selectedCandidate: null,
      activeFocusMatch,
      recentArtifacts,
      continuityRecommendations,
      workflowRecommendations,
    });
    const workflowExecutorRecommendation = preliminaryWorkflowRecommendation
      ? workflowExecutorRecommendations.find((entry) => {
          return String(entry?.workflow || '').trim().toLowerCase() === preliminaryWorkflowRecommendation.workflow;
        }) || null
      : null;
    const workflowExecutor = normalizeExecutor(workflowExecutorRecommendation?.executor);
    if (workflowExecutor && !blockedExecutors.includes(workflowExecutor)) {
      const workflowFriction = findApprovalFriction(
        approvalFrictionRecommendations,
        workflowExecutor,
        taskProfile.kind,
        taskProfile.subtype,
      );
      candidates.push({
        executor: workflowExecutor,
        source: 'workflow_memory',
        confidence: applyApprovalFrictionPenalty(
          applyWorkflowExecutorPerformanceBoost(
            preliminaryWorkflowRecommendation?.confidence
              ? Math.min(0.9, Math.max(0.7, preliminaryWorkflowRecommendation.confidence))
              : 0.76,
            workflowExecutorRecommendation,
          ),
          workflowFriction,
        ),
        rationale: appendApprovalFrictionRationale(
          workflowExecutorRecommendation?.rationale
            || `Historico recente do workflow ${preliminaryWorkflowRecommendation?.workflow || 'principal'} favorece ${workflowExecutor}.`,
          workflowFriction,
        ),
      });
    }

    const workflowStageRole = preliminaryWorkflowRecommendation
      ? resolveWorkflowStageRole(preliminaryWorkflowRecommendation.workflow, taskProfile.kind, taskProfile.subtype)
      : null;
    const workflowStageExecutorRecommendation = workflowStageRole && preliminaryWorkflowRecommendation
      ? findWorkflowStageExecutorRecommendation(
          workflowStageExecutorRecommendations,
          preliminaryWorkflowRecommendation.workflow,
          workflowStageRole,
        )
      : null;
    const workflowStageExecutor = normalizeExecutor(workflowStageExecutorRecommendation?.executor);
    if (workflowStageExecutor && !blockedExecutors.includes(workflowStageExecutor)) {
      const workflowStageFriction = findApprovalFriction(
        approvalFrictionRecommendations,
        workflowStageExecutor,
        taskProfile.kind,
        taskProfile.subtype,
      );
      candidates.push({
        executor: workflowStageExecutor,
        source: 'workflow_stage_memory',
        confidence: applyApprovalFrictionPenalty(
          applyWorkflowStagePerformanceBoost(0.84, workflowStageExecutorRecommendation),
          workflowStageFriction,
        ),
        rationale: appendApprovalFrictionRationale(
          workflowStageExecutorRecommendation?.rationale
            || `Historico recente da etapa ${workflowStageRole} do workflow ${preliminaryWorkflowRecommendation?.workflow || 'principal'} favorece ${workflowStageExecutor}.`,
          workflowStageFriction,
        ),
      });
    }

    const topSuccessfulExecutor = normalizeExecutor(successfulExecutors[0]?.executor);
    if (topSuccessfulExecutor && !blockedExecutors.includes(topSuccessfulExecutor)) {
      const historyFriction = findApprovalFriction(
        approvalFrictionRecommendations,
        topSuccessfulExecutor,
        taskProfile.kind,
        taskProfile.subtype,
      );
      candidates.push({
        executor: topSuccessfulExecutor,
        source: 'success_history',
        confidence: applyApprovalFrictionPenalty(0.58, historyFriction),
        rationale: appendApprovalFrictionRationale(
          `Executor com melhor desempenho recente no workspace: ${topSuccessfulExecutor}.`,
          historyFriction,
        ),
      });
    }

    const enrichedCandidates = candidates
      .map((candidate) => enrichCandidate(candidate, {
        approvedPolicies,
        routeOutcomes,
        taskKind: taskProfile.kind,
        taskSubtype: taskProfile.subtype,
        surfaceSource,
      }, findRouteOutcome, findApprovedPolicyBoost))
      .sort((left, right) => right.confidence - left.confidence);
    const selectedCandidate = enrichedCandidates.find(Boolean) || null;
    const dominantApprovalFriction = findDominantApprovalFriction(
      approvalFrictionRecommendations,
      taskProfile.kind,
      taskProfile.subtype,
    );

    if (selectedCandidate) {
      rationale.push(selectedCandidate.rationale);
      const avoidedRejectedRoute = enrichedCandidates.find((candidate) => {
        if (!candidate || candidate.executor === selectedCandidate.executor) {
          return false;
        }
        const routeOutcome = findRouteOutcome(
          routeOutcomes,
          candidate.executor,
          taskProfile.kind,
          taskProfile.subtype,
          surfaceSource,
        );
        return Boolean(routeOutcome && Number(routeOutcome.rejected_count || 0) > 0);
      }) || null;
      if (avoidedRejectedRoute) {
        const avoidedRouteOutcome = findRouteOutcome(
          routeOutcomes,
          avoidedRejectedRoute.executor,
          taskProfile.kind,
          taskProfile.subtype,
          surfaceSource,
        );
        if (avoidedRouteOutcome) {
          rationale.push(
            `Evitei ${avoidedRejectedRoute.executor} porque essa rota acumulou rejeicoes recentes (${avoidedRouteOutcome.rejected_count}) neste workspace.`,
          );
        }
      }
      if (
        dominantApprovalFriction
        && dominantApprovalFriction.executor !== selectedCandidate.executor
      ) {
        rationale.push(
          `Evitei ${dominantApprovalFriction.executor} por friccao operacional recente com ${dominantApprovalFriction.executor} (${dominantApprovalFriction.rationale}).`,
        );
      }
    }
    const blockedExecutorReasons = blockedExecutors
      .filter((executor) => executor !== selectedCandidate?.executor)
      .map((executor) => buildBlockedExecutorReason(
        routeOutcomes,
        approvalFrictionRecommendations,
        executor,
        taskProfile.kind,
        taskProfile.subtype,
        surfaceSource,
        findRouteOutcome,
        findApprovalFriction,
      ))
      .filter((reason): reason is string => Boolean(reason))
      .slice(0, 2);
    if (blockedExecutorReasons.length > 0) {
      rationale.push(...blockedExecutorReasons);
    } else if (!selectedCandidate && blockedExecutors.length > 0) {
      rationale.push(`Executores evitados por friccao ou falhas recorrentes: ${blockedExecutors.join(', ')}.`);
    }

    const responseStyleRecommendation = directResponseStyleRecommendations.find((entry) => {
      const entryKind = String(entry?.kind || '').trim().toLowerCase();
      const entrySubtype = String(entry?.subtype || '').trim().toLowerCase();
      return entryKind === taskProfile.kind && (entrySubtype === taskProfile.subtype || entrySubtype === 'general');
    }) || null;
    const selectedFriction = selectedCandidate
      ? findApprovalFriction(
          approvalFrictionRecommendations,
          selectedCandidate.executor,
          taskProfile.kind,
          taskProfile.subtype,
        )
      : null;
    let responseStyle = responseStyleRecommendation?.preferred_style
      || resolveWorkspaceResponseStyle(taskProfile.kind, taskProfile.subtype);
    if (responseStyleRecommendation?.rationale) {
      rationale.push(`Formato de resposta recomendado: ${responseStyleRecommendation.preferred_style} (${responseStyleRecommendation.rationale}).`);
    } else if (shouldUseCheckpointedStyle(selectedFriction)) {
      responseStyle = 'checkpointed';
      rationale.push(`Formato de resposta ajustado para checkpointed porque ${selectedCandidate?.executor || 'o executor atual'} costuma exigir mais confirmacoes neste workspace.`);
    }

    const subtypeLlmRecommendation = taskSubtypeLlmRecommendations.find((entry) => {
      const entryKind = String(entry?.kind || '').trim().toLowerCase();
      const entrySubtype = String(entry?.subtype || '').trim().toLowerCase();
      return entryKind === taskProfile.kind && entrySubtype === taskProfile.subtype;
    }) || null;
    const kindLlmRecommendation = taskKindLlmRecommendations.find((entry) => {
      return String(entry?.kind || '').trim().toLowerCase() === taskProfile.kind;
    }) || null;
    const llmRecommendation = buildLlmRecommendation(subtypeLlmRecommendation, kindLlmRecommendation);
    if (llmRecommendation) {
      rationale.push(`LLM recomendado: ${llmRecommendation.provider}${llmRecommendation.model ? `/${llmRecommendation.model}` : ''}.`);
    }

    let workflowRecommendation = buildWorkflowRecommendation({
      taskKind: taskProfile.kind,
      taskSubtype: taskProfile.subtype,
      selectedCandidate,
      activeFocusMatch,
      recentArtifacts,
      continuityRecommendations,
      workflowRecommendations,
    });
    const workflowFriction = workflowRecommendation
      ? findWorkflowFriction(workflowFrictionRecommendations, workflowRecommendation.workflow)
      : null;
    const workflowRouteOutcome = workflowRecommendation && selectedCandidate
      ? findRouteOutcome(routeOutcomes, selectedCandidate.executor, taskProfile.kind, taskProfile.subtype, surfaceSource)
      : null;
    const workflowApprovedPolicy = workflowRecommendation && selectedCandidate
      ? findApprovedPolicyBoost(approvedPolicies, selectedCandidate.executor, taskProfile.kind, taskProfile.subtype)
      : null;
    if (workflowRecommendation && workflowFriction) {
      workflowRecommendation = {
        ...workflowRecommendation,
        confidence: applyWorkflowFrictionPenalty(workflowRecommendation.confidence, workflowFriction),
        rationale: `${workflowRecommendation.rationale} ${workflowFriction.rationale}`.trim(),
      };
      rationale.push(`Workflow ${workflowRecommendation.workflow} pede mais controle neste workspace (${workflowFriction.rationale}).`);
      if (Number(workflowFriction.recovered_count || 0) > 0) {
        rationale.push(
          `Tambem considerei que esse workflow ja se recuperou ${Number(workflowFriction.recovered_count || 0)} vez(es) recentemente${workflowFriction.last_recovered_stage_label ? ` via ${workflowFriction.last_recovered_stage_label}` : ''}.`,
        );
      }
      if (!responseStyleRecommendation?.rationale && shouldUseCheckpointedWorkflowStyle(workflowFriction)) {
        responseStyle = 'checkpointed';
        rationale.push(`Formato de resposta ajustado para checkpointed porque o workflow ${workflowRecommendation.workflow} costuma pausar ou falhar neste workspace.`);
      }
    }
    if (workflowRecommendation && workflowApprovedPolicy) {
      workflowRecommendation = {
        ...workflowRecommendation,
        confidence: Math.min(0.96, workflowRecommendation.confidence + 0.04),
        rationale: `${workflowRecommendation.rationale} ${workflowApprovedPolicy.rationale}`.trim(),
      };
      rationale.push(`Workflow ${workflowRecommendation.workflow} ganhou confianca extra porque ja existe politica aprovada para ${selectedCandidate?.executor || 'o executor selecionado'}.`);
    }
    if (
      workflowRecommendation
      && selectedCandidate
      && shouldDeferWorkflowRecommendation(workflowRecommendation, workflowFriction, workflowRouteOutcome, workflowApprovedPolicy)
    ) {
      rationale.push(
        `Evitei o workflow ${workflowRecommendation.workflow} por friccao recente e historico de falhas com ${selectedCandidate.executor}. Vou privilegiar execucao direta ou retomada mais controlada neste pedido.`,
      );
      workflowRecommendation = null;
    }
    if (workflowRecommendation) {
      rationale.push(`Workflow recomendado: ${workflowRecommendation.workflow} (${workflowRecommendation.rationale}).`);
    }

    return {
      executor: selectedCandidate?.executor || null,
      source: selectedCandidate?.source || 'none',
      confidence: selectedCandidate?.confidence || 0,
      task_kind: taskProfile.kind,
      task_subtype: taskProfile.subtype,
      response_style: responseStyle,
      llm_recommendation: llmRecommendation,
      workflow_recommendation: workflowRecommendation,
      rationale,
      blocked_executors: blockedExecutors,
    };
  }
}
