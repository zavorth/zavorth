import type {
  ActiveFocusAggregate,
  ApprovalFrictionAggregate,
  ApprovedPathAggregate,
  ApprovedPolicyAggregate,
  AutonomousModeRecommendation,
  AutonomousOutcomeAggregate,
  ContinuityRecommendation,
  DirectResponseStyleRecommendation,
  ExecutorAggregate,
  FailureAggregate,
  RecentArtifactAggregate,
  RecentWorkflowRunAggregate,
  RouteOutcomeAggregate,
  TaskKindLlmRecommendation,
  TaskKindRecommendation,
  TaskSubtypeLlmRecommendation,
  TaskSubtypeRecommendation,
  WorkflowExecutorRecommendationAggregate,
  WorkflowFrictionRecommendationAggregate,
  WorkflowRecommendationAggregate,
  WorkflowStageExecutorRecommendationAggregate,
} from './WorkspaceOperationalMemoryTypes.js';

type SummaryInput = {
  workspaceName: string;
  successfulExecutors: ExecutorAggregate[];
  repeatedFailures: FailureAggregate[];
  taskKindRecommendations: TaskKindRecommendation[];
  taskSubtypeRecommendations: TaskSubtypeRecommendation[];
  taskKindLlmRecommendations: TaskKindLlmRecommendation[];
  taskSubtypeLlmRecommendations: TaskSubtypeLlmRecommendation[];
  approvedPaths: ApprovedPathAggregate[];
  approvedPolicies: ApprovedPolicyAggregate[];
  activeFocuses: ActiveFocusAggregate[];
  recentArtifacts: RecentArtifactAggregate[];
  recentWorkflowRuns: RecentWorkflowRunAggregate[];
  workflowRecommendations: WorkflowRecommendationAggregate[];
  workflowExecutorRecommendations: WorkflowExecutorRecommendationAggregate[];
  workflowStageExecutorRecommendations: WorkflowStageExecutorRecommendationAggregate[];
  workflowFrictionRecommendations: WorkflowFrictionRecommendationAggregate[];
  approvalFrictionRecommendations: ApprovalFrictionAggregate[];
  routeOutcomes: RouteOutcomeAggregate[];
  continuityRecommendations: ContinuityRecommendation[];
  autonomousOutcomes: AutonomousOutcomeAggregate[];
  autonomousModeRecommendations: AutonomousModeRecommendation[];
  directResponseStyleRecommendations: DirectResponseStyleRecommendation[];
};

export function buildWorkspaceOperationalMemorySummary(input: SummaryInput): string {
  const summaryParts = [
    `Workspace ${input.workspaceName}`,
    input.successfulExecutors[0] ? `melhor executor recente ${input.successfulExecutors[0].executor} (${input.successfulExecutors[0].count} success(s))`
      : null,
    input.repeatedFailures[0] ? `failure recorrente ${input.repeatedFailures[0].executor}: ${input.repeatedFailures[0].summary}`
      : null,
    input.taskKindRecommendations[0]?.preferred_executor ? `preference ${input.taskKindRecommendations[0].kind} -> ${input.taskKindRecommendations[0].preferred_executor}`
      : null,
    input.taskSubtypeRecommendations[0]?.preferred_executor ? `subtipo ${input.taskSubtypeRecommendations[0].subtype} -> ${input.taskSubtypeRecommendations[0].preferred_executor}`
      : null,
    input.taskSubtypeLlmRecommendations[0]?.preferred_provider
      ? `llm ${input.taskSubtypeLlmRecommendations[0].subtype} -> ${input.taskSubtypeLlmRecommendations[0].preferred_provider}${input.taskSubtypeLlmRecommendations[0].preferred_model ? `/${input.taskSubtypeLlmRecommendations[0].preferred_model}` : ''}`
      : null,
    !input.taskSubtypeLlmRecommendations[0]?.preferred_provider && input.taskKindLlmRecommendations[0]?.preferred_provider
      ? `llm ${input.taskKindLlmRecommendations[0].kind} -> ${input.taskKindLlmRecommendations[0].preferred_provider}${input.taskKindLlmRecommendations[0].preferred_model ? `/${input.taskKindLlmRecommendations[0].preferred_model}` : ''}`
      : null,
    input.approvedPaths.length > 0
      ? `approved paths ${input.approvedPaths.slice(0, 2).map((item) => item.path).join(', ')}`
      : null,
    input.approvedPolicies[0] ? `policy ${input.approvedPolicies[0].executor}/${input.approvedPolicies[0].kind}`
      : null,
    input.activeFocuses[0] ? `foco active ${input.activeFocuses[0].summary}`
      : null,
    input.recentArtifacts[0] ? `entrega recente ${input.recentArtifacts[0].name}`
      : null,
    input.recentWorkflowRuns[0] ? `workflow recente ${input.recentWorkflowRuns[0].workflow_name} (${input.recentWorkflowRuns[0].status})`
      : null,
    input.workflowRecommendations[0] ? `workflow sugerido ${input.workflowRecommendations[0].workflow}`
      : null,
    input.workflowExecutorRecommendations[0] ? `executor por workflow ${input.workflowExecutorRecommendations[0].workflow} -> ${input.workflowExecutorRecommendations[0].executor}`
      : null,
    input.workflowStageExecutorRecommendations[0] ? `executor por stage ${input.workflowStageExecutorRecommendations[0].workflow}/${input.workflowStageExecutorRecommendations[0].role} -> ${input.workflowStageExecutorRecommendations[0].executor}`
      : null,
    input.workflowFrictionRecommendations[0]
      ? `workflow friction ${input.workflowFrictionRecommendations[0].workflow}${input.workflowFrictionRecommendations[0].last_resume_stage_label ? ` -> ${input.workflowFrictionRecommendations[0].last_resume_stage_label}` : ''}`
      : null,
    input.approvalFrictionRecommendations[0]
      ? `friction ${input.approvalFrictionRecommendations[0].kind}${input.approvalFrictionRecommendations[0].subtype !== 'general' ? `/${input.approvalFrictionRecommendations[0].subtype}` : ''} -> ${input.approvalFrictionRecommendations[0].executor}`
      : null,
    input.routeOutcomes[0]
      ? `rota ${input.routeOutcomes[0].executor} -> ${input.routeOutcomes[0].task_kind}${input.routeOutcomes[0].task_subtype !== 'general' ? `/${input.routeOutcomes[0].task_subtype}` : ''}`
      : null,
    input.continuityRecommendations[0] ? `next passo ${input.continuityRecommendations[0].label}`
      : null,
    input.autonomousOutcomes[0]
      ? `latest autonomous cycle ${input.autonomousOutcomes[0].status}${input.autonomousOutcomes[0].preferred_executor ? ` com preference ${input.autonomousOutcomes[0].preferred_executor}` : ''}`
      : null,
    input.autonomousModeRecommendations[0]
      ? `modo sugerido ${input.autonomousModeRecommendations[0].subtype !== 'general' ? input.autonomousModeRecommendations[0].subtype : input.autonomousModeRecommendations[0].kind} -> ${input.autonomousModeRecommendations[0].preferred_mode}`
      : null,
    input.directResponseStyleRecommendations[0]
      ? `formato direct ${input.directResponseStyleRecommendations[0].subtype !== 'general' ? input.directResponseStyleRecommendations[0].subtype : input.directResponseStyleRecommendations[0].kind} -> ${input.directResponseStyleRecommendations[0].preferred_style}`
      : null,
  ].filter(Boolean);

  return summaryParts.join(' | ');
}
