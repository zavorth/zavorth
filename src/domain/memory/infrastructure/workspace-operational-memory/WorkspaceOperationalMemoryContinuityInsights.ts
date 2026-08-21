import type {
  ActiveFocusAggregate,
  ContinuityRecommendation,
  RecentArtifactAggregate,
  RecentWorkflowRunAggregate,
  WorkflowRecommendationAggregate,
  WorkspaceOperationalMemory,
} from './WorkspaceOperationalMemoryTypes.js';

type ContinuityRecommendationInput = {
  activeFocuses: ActiveFocusAggregate[];
  repeatedFailures: Array<{ executor: string; summary: string }>;
  recentArtifacts: RecentArtifactAggregate[];
  recentWorkflowRuns: RecentWorkflowRunAggregate[];
  workflowRecommendations: WorkflowRecommendationAggregate[];
  lastSuccessfulTask: WorkspaceOperationalMemory['last_successful_task'];
};

export function buildContinuityRecommendations(input: ContinuityRecommendationInput): ContinuityRecommendation[] {
  const recommendations: ContinuityRecommendation[] = [];

  const approvalFocus = input.activeFocuses.find((focus) => focus.approval_status === 'pending') || null;
  if (approvalFocus) {
    recommendations.push({
      kind: 'resolve_approval',
      label: `Resolver ${approvalFocus.short_id}`,
      reason: 'Existe uma stage waiting for human confirmation in this workspace.',
      task_id: approvalFocus.task_id,
      artifact_name: null,
      executor: approvalFocus.executor,
    });
  }

  const activeFocus = input.activeFocuses[0] || null;
  if (activeFocus) {
    recommendations.push({
      kind: 'resume_active',
      label: `resume ${activeFocus.short_id}`,
      reason: `Ha um foco active de ${activeFocus.kind}${activeFocus.subtype !== 'general' ? `/${activeFocus.subtype}` : ''} ainda running.`,
      task_id: activeFocus.task_id,
      artifact_name: null,
      executor: activeFocus.executor,
    });
  }

  const resumableWorkflow = input.recentWorkflowRuns.find((run) => {
    return (
      run.operator_state !== 'closed'
      && (run.status === 'running' || run.status === 'approval_pending' || run.status === 'blocked')
    );
  }) || null;
  if (resumableWorkflow) {
    recommendations.push({
      kind: 'resume_workflow',
      label: resumableWorkflow.resume_stage_label ? `Resume workflow ${resumableWorkflow.workflow_name} at ${resumableWorkflow.resume_stage_label}`
        : `Resume workflow ${resumableWorkflow.workflow_name}`,
      reason: resumableWorkflow.resume_stage_label ? `There is an open ${resumableWorkflow.workflow_name} workflow with ${resumableWorkflow.completed_stages}/${resumableWorkflow.total_stages} completed stage(s), and the most useful resumption now is ${resumableWorkflow.resume_stage_label}.`
        : `There is an open ${resumableWorkflow.workflow_name} workflow with ${resumableWorkflow.completed_stages}/${resumableWorkflow.total_stages} completed stage(s).`,
      task_id: null,
      artifact_name: resumableWorkflow.primary_artifact_name,
      executor: null,
    });
  }

  const recoveredWorkflow = input.recentWorkflowRuns.find((run) => {
    return run.status === 'completed' && run.recovered_from_interruption === true;
  }) || null;
  if (recoveredWorkflow) {
    recommendations.push({
      kind: 'continue_from_success',
      label: recoveredWorkflow.last_interrupted_stage_label ? `Continue after ${recoveredWorkflow.workflow_name} at ${recoveredWorkflow.last_interrupted_stage_label}`
        : `Continue after workflow ${recoveredWorkflow.workflow_name}`,
      reason: recoveredWorkflow.primary_artifact_name ? `Workflow ${recoveredWorkflow.workflow_name} just completed a resumption successfully and delivered ${recoveredWorkflow.primary_artifact_name}.`
        : `Workflow ${recoveredWorkflow.workflow_name} just completed a resumption successfully in this workspace.`,
      task_id: null,
      artifact_name: recoveredWorkflow.primary_artifact_name,
      executor: null,
    });
  }

  const repeatedFailure = input.repeatedFailures[0] || null;
  if (repeatedFailure) {
    recommendations.push({
      kind: 'revisit_failure',
      label: `Review failure in ${repeatedFailure.executor}`,
      reason: repeatedFailure.summary,
      task_id: null,
      artifact_name: null,
      executor: repeatedFailure.executor,
    });
  }

  const recentArtifact = input.recentArtifacts[0] || null;
  if (recentArtifact) {
    recommendations.push({
      kind: 'reuse_recent_artifact',
      label: `Reuse ${recentArtifact.name}`,
      reason: 'A recent delivery already exists that can serve as the base for the next iteration.',
      task_id: recentArtifact.task_id,
      artifact_name: recentArtifact.name,
      executor: recentArtifact.executor,
    });
  }

  if (input.lastSuccessfulTask) {
    recommendations.push({
      kind: 'continue_from_success',
      label: `Continuar de ${input.lastSuccessfulTask.task_id.substring(0, 8)}`,
      reason: input.lastSuccessfulTask.summary || 'There is a recent successful execution in this workspace.',
      task_id: input.lastSuccessfulTask.task_id,
      artifact_name: null,
      executor: input.lastSuccessfulTask.executor,
    });
  }

  const workflowRecommendation = input.workflowRecommendations[0] || null;
  if (workflowRecommendation && !recommendations.some((entry) => entry.kind === 'resume_workflow')) {
    recommendations.push({
      kind: 'continue_from_success',
      label: `Seguir com workflow ${workflowRecommendation.workflow}`,
      reason: workflowRecommendation.rationale,
      task_id: null,
      artifact_name: null,
      executor: null,
    });
  }

  return recommendations.slice(0, 5);
}
