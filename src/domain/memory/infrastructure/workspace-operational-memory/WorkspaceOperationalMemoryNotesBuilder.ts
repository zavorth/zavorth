import type {
  ApprovedPolicyAggregate,
  PartialWorkspaceOperationalMemory,
  RouteOutcomeAggregate,
  WorkspaceOperationalMemory,
} from './WorkspaceOperationalMemoryTypes.js';

export class WorkspaceOperationalMemoryNotesBuilder {
  public buildPlanNotes(memory: WorkspaceOperationalMemory | PartialWorkspaceOperationalMemory | null | undefined): string[] {
    if (!memory) {
      return [];
    }

    const repeatedFailures = Array.isArray(memory.repeated_failures) ? memory.repeated_failures : [];
    const successfulExecutors = Array.isArray(memory.successful_executors) ? memory.successful_executors : [];
    const taskKindRecommendations = Array.isArray(memory.task_kind_recommendations) ? memory.task_kind_recommendations : [];
    const taskSubtypeRecommendations = Array.isArray(memory.task_subtype_recommendations) ? memory.task_subtype_recommendations : [];
    const taskKindLlmRecommendations = Array.isArray(memory.task_kind_llm_recommendations)
      ? memory.task_kind_llm_recommendations
      : [];
    const taskSubtypeLlmRecommendations = Array.isArray(memory.task_subtype_llm_recommendations)
      ? memory.task_subtype_llm_recommendations
      : [];
    const approvedPaths = Array.isArray(memory.approved_paths) ? memory.approved_paths : [];
    const approvedPolicies = Array.isArray((memory as PartialWorkspaceOperationalMemory).approved_policies)
      ? (memory as PartialWorkspaceOperationalMemory).approved_policies as ApprovedPolicyAggregate[]
      : [];
    const autonomousOutcomes = Array.isArray(memory.autonomous_outcomes) ? memory.autonomous_outcomes : [];
    const activeFocuses = Array.isArray(memory.active_focuses) ? memory.active_focuses : [];
    const recentArtifacts = Array.isArray(memory.recent_artifacts) ? memory.recent_artifacts : [];
    const recentWorkflowRuns = Array.isArray(memory.recent_workflow_runs) ? memory.recent_workflow_runs : [];
    const workflowRecommendations = Array.isArray(memory.workflow_recommendations) ? memory.workflow_recommendations : [];
    const workflowExecutorRecommendations = Array.isArray(memory.workflow_executor_recommendations)
      ? memory.workflow_executor_recommendations
      : [];
    const workflowStageExecutorRecommendations = Array.isArray(memory.workflow_stage_executor_recommendations)
      ? memory.workflow_stage_executor_recommendations
      : [];
    const workflowFrictionRecommendations = Array.isArray(memory.workflow_friction_recommendations)
      ? memory.workflow_friction_recommendations
      : [];
    const approvalFrictionRecommendations = Array.isArray(memory.approval_friction_recommendations)
      ? memory.approval_friction_recommendations
      : [];
    const routeOutcomes = Array.isArray((memory as PartialWorkspaceOperationalMemory).route_outcomes)
      ? (memory as PartialWorkspaceOperationalMemory).route_outcomes as RouteOutcomeAggregate[]
      : [];
    const continuityRecommendations = Array.isArray(memory.continuity_recommendations)
      ? memory.continuity_recommendations
      : [];
    const autonomousModeRecommendations = Array.isArray(memory.autonomous_mode_recommendations)
      ? memory.autonomous_mode_recommendations
      : [];
    const directResponseStyleRecommendations = Array.isArray(memory.direct_response_style_recommendations)
      ? memory.direct_response_style_recommendations
      : [];
    const notes = [
      memory.summary ? `Operational memory: ${memory.summary}` : null,
    ];

    if (successfulExecutors[0]) {
      notes.push(`Executor with the best recent history: ${successfulExecutors[0].executor} (${successfulExecutors[0].count} success(es)).`);
    }
    if (repeatedFailures[0]) {
      notes.push(`Failure recorrente recente: ${repeatedFailures[0].executor} -> ${repeatedFailures[0].summary}`);
    }
    if (taskKindRecommendations.length > 0) {
      const taskKindSummary = taskKindRecommendations
        .slice(0, 2)
        .map((entry) => {
          const kind = String(entry.kind || 'unknown').trim();
          const executor = String(entry.preferred_executor || '').trim();
          const count = Number(entry.success_count || 0);
          return executor ? `${kind} -> ${executor} (${count} success(s))` : null;
        })
        .filter((entry): entry is string => Boolean(entry))
        .join(' | ');
      if (taskKindSummary) {
        notes.push(`Recent preferences by type: ${taskKindSummary}`);
      }
    }
    if (taskSubtypeRecommendations.length > 0) {
      const taskSubtypeSummary = taskSubtypeRecommendations
        .slice(0, 2)
        .map((entry) => {
          const subtype = String(entry.subtype || 'unknown').trim();
          const executor = String(entry.preferred_executor || '').trim();
          const count = Number(entry.success_count || 0);
          return executor ? `${subtype} -> ${executor} (${count} success(s))` : null;
        })
        .filter((entry): entry is string => Boolean(entry))
        .join(' | ');
      if (taskSubtypeSummary) {
        notes.push(`Recent preferences by subtype: ${taskSubtypeSummary}`);
      }
    }
    if (taskSubtypeLlmRecommendations.length > 0) {
      const taskSubtypeLlmSummary = taskSubtypeLlmRecommendations
        .slice(0, 2)
        .map((entry) => {
          const subtype = String(entry.subtype || 'unknown').trim();
          const provider = String(entry.preferred_provider || '').trim();
          const model = String(entry.preferred_model || '').trim();
          return provider ? `${subtype} -> ${provider}${model ? `/${model}` : ''}` : null;
        })
        .filter((entry): entry is string => Boolean(entry))
        .join(' | ');
      if (taskSubtypeLlmSummary) {
        notes.push(`Recent LLM preferences by subtype: ${taskSubtypeLlmSummary}`);
      }
    } else if (taskKindLlmRecommendations.length > 0) {
      const taskKindLlmSummary = taskKindLlmRecommendations
        .slice(0, 2)
        .map((entry) => {
          const kind = String(entry.kind || 'unknown').trim();
          const provider = String(entry.preferred_provider || '').trim();
          const model = String(entry.preferred_model || '').trim();
          return provider ? `${kind} -> ${provider}${model ? `/${model}` : ''}` : null;
        })
        .filter((entry): entry is string => Boolean(entry))
        .join(' | ');
      if (taskKindLlmSummary) {
        notes.push(`Recent LLM preferences by type: ${taskKindLlmSummary}`);
      }
    }
    if (approvedPaths.length > 0) {
      notes.push(`Recently approved paths recentemente: ${approvedPaths.slice(0, 3).map((item) => item.path).join(', ')}`);
    }
    if (approvedPolicies.length > 0) {
      notes.push(
        `Approved policies recentes: ${approvedPolicies.slice(0, 3).map((item: ApprovedPolicyAggregate) => `${item.executor}/${item.kind}`).join(', ')}.`,
      );
    }
    if (activeFocuses[0]) {
      notes.push(
        `Active workspace focus: ${activeFocuses[0].summary} (${activeFocuses[0].status}${activeFocuses[0].approval_status === 'pending' ? ' | waiting approval' : ''}).`,
      );
    }
    if (recentArtifacts.length > 0) {
      notes.push(
        `Entregas recentes do workspace: ${recentArtifacts.slice(0, 3).map((item) => item.name).join(', ')}`,
      );
    }
    if (recentWorkflowRuns[0]) {
      notes.push(
        `Workflow recente do workspace: ${recentWorkflowRuns[0].workflow_name} (${recentWorkflowRuns[0].status}, ${recentWorkflowRuns[0].completed_stages}/${recentWorkflowRuns[0].total_stages} stages).`,
      );
    }
    if (workflowExecutorRecommendations[0]) {
      notes.push(
        `Most trusted executor by workflow: ${workflowExecutorRecommendations[0].workflow} -> ${workflowExecutorRecommendations[0].executor} (${workflowExecutorRecommendations[0].success_count} stage(s) completed(s)).`,
      );
    }
    if (workflowStageExecutorRecommendations[0]) {
      notes.push(
        `Most trusted executor by stage: ${workflowStageExecutorRecommendations[0].workflow}/${workflowStageExecutorRecommendations[0].role} -> ${workflowStageExecutorRecommendations[0].executor} (${workflowStageExecutorRecommendations[0].success_count} stage(s) completed(s)).`,
      );
    }
    if (workflowRecommendations[0]) {
      notes.push(
        `Workflow sugerido para continuidade: ${workflowRecommendations[0].workflow} (${workflowRecommendations[0].rationale}).`,
      );
    }
    if (workflowFrictionRecommendations[0]) {
      const topWorkflowFriction = workflowFrictionRecommendations[0];
      notes.push(
        `Workflow com mais atrito recente: ${topWorkflowFriction.workflow}${topWorkflowFriction.last_resume_stage_label ? ` -> ${topWorkflowFriction.last_resume_stage_label}` : ''} (${topWorkflowFriction.rationale}).`,
      );
    }
    if (approvalFrictionRecommendations[0]) {
      const topFriction = approvalFrictionRecommendations[0];
      notes.push(
        `Friccao operational recente: ${topFriction.executor} em ${topFriction.kind}${topFriction.subtype !== 'general' ? `/${topFriction.subtype}` : ''} (${topFriction.rationale}).`,
      );
    }
    if (routeOutcomes[0]) {
      const topRouteOutcome = routeOutcomes[0];
      notes.push(
        `Rota recente mais forte: ${topRouteOutcome.executor} em ${topRouteOutcome.task_kind}${topRouteOutcome.task_subtype !== 'general' ? `/${topRouteOutcome.task_subtype}` : ''} (${topRouteOutcome.rationale}).`,
      );
    }
    if (continuityRecommendations[0]) {
      notes.push(`next passo sugerido: ${continuityRecommendations[0].label} (${continuityRecommendations[0].reason}).`);
    }
    if (autonomousOutcomes[0]) {
      notes.push(
        `Latest autonomous cycle: ${autonomousOutcomes[0].status} em ${autonomousOutcomes[0].iterations} iteration(oes)${autonomousOutcomes[0].preferred_executor ? ` | preference ${autonomousOutcomes[0].preferred_executor}` : ''}.`,
      );
    }
    if (autonomousModeRecommendations[0]) {
      const topRecommendation = autonomousModeRecommendations[0];
      notes.push(
        `Modo sugerido para ${topRecommendation.subtype !== 'general' ? topRecommendation.subtype : topRecommendation.kind}: ${topRecommendation.preferred_mode} (${topRecommendation.rationale}).`,
      );
    }
    if (directResponseStyleRecommendations[0]) {
      const topRecommendation = directResponseStyleRecommendations[0];
      notes.push(
        `Formato direct sugerido para ${topRecommendation.subtype !== 'general' ? topRecommendation.subtype : topRecommendation.kind}: ${topRecommendation.preferred_style} (${topRecommendation.rationale}).`,
      );
    }

    return notes.filter((value): value is string => Boolean(value));
  }
}
