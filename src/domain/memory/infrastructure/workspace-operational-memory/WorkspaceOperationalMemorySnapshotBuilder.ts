import path from 'path';
import type { Task } from '../../../../contracts/TaskContract.js';
import type { WorkflowRunService } from '../../../../runtime/workflows/WorkflowRunService.js';
import { slugifyWorkspaceMemoryValue } from './WorkspaceOperationalMemoryTaskUtilities.js';
import type {
  ApprovedPathAggregate,
  ApprovedPolicyAggregate,
  WorkspaceOperationalMemory,
} from './WorkspaceOperationalMemoryTypes.js';
import { WorkspaceOperationalMemoryWorkflowAnalytics } from './WorkspaceOperationalMemoryWorkflowAnalytics.js';
import {
  buildApprovalFrictionRecommendations,
  buildContinuityRecommendations,
  collectAutonomousOutcomes,
  buildRouteOutcomes,
  collectActiveFocuses,
  collectRecentArtifacts,
  findLastSuccessfulTask,
} from './WorkspaceOperationalMemoryInsights.js';
import { buildWorkspaceOperationalMemorySummary } from './WorkspaceOperationalMemorySummary.js';

import {
  aggregateFailures,
  aggregateSuccessfulExecutors,
  buildAutonomousModeRecommendations,
  buildDirectResponseStyleRecommendations,
  buildTaskKindLlmRecommendations,
  buildTaskKindRecommendations,
  buildTaskSubtypeLlmRecommendations,
  buildTaskSubtypeRecommendations,
} from './WorkspaceOperationalMemoryScoring.js';


type SnapshotInput = {
  workspace: string;
  recentTasks: Task[];
  approvedPaths: ApprovedPathAggregate[];
  approvedPolicies: ApprovedPolicyAggregate[];
  workflowRunService: Pick<WorkflowRunService, 'listRuns'>;
};

export function buildWorkspaceOperationalMemorySnapshot(input: SnapshotInput): WorkspaceOperationalMemory {
  const workflowAnalytics = new WorkspaceOperationalMemoryWorkflowAnalytics(input.workflowRunService);
  const successfulExecutors = aggregateSuccessfulExecutors(input.recentTasks);
  const repeatedFailures = aggregateFailures(input.recentTasks);
  const taskKindRecommendations = buildTaskKindRecommendations(input.recentTasks);
  const taskSubtypeRecommendations = buildTaskSubtypeRecommendations(input.recentTasks);
  const taskKindLlmRecommendations = buildTaskKindLlmRecommendations(input.recentTasks);
  const taskSubtypeLlmRecommendations = buildTaskSubtypeLlmRecommendations(input.recentTasks);
  const lastSuccessfulTask = findLastSuccessfulTask(input.recentTasks);
  const activeFocuses = collectActiveFocuses(input.recentTasks);
  const recentArtifacts = collectRecentArtifacts(input.recentTasks);
  const recentWorkflowRuns = workflowAnalytics.collectRecentWorkflowRuns(input.workspace);
  const workflowRecommendations = workflowAnalytics.buildWorkflowRecommendations(recentWorkflowRuns);
  const workflowExecutorRecommendations = workflowAnalytics.buildWorkflowExecutorRecommendations(recentWorkflowRuns);
  const workflowStageExecutorRecommendations = workflowAnalytics.buildWorkflowStageExecutorRecommendations(recentWorkflowRuns);
  const workflowFrictionRecommendations = workflowAnalytics.buildWorkflowFrictionRecommendations(recentWorkflowRuns);
  const approvalFrictionRecommendations = buildApprovalFrictionRecommendations(input.recentTasks);
  const routeOutcomes = buildRouteOutcomes(input.recentTasks, recentWorkflowRuns);
  const autonomousOutcomes = collectAutonomousOutcomes(input.recentTasks);
  const autonomousModeRecommendations = buildAutonomousModeRecommendations(autonomousOutcomes);
  const directResponseStyleRecommendations = buildDirectResponseStyleRecommendations(input.recentTasks);
  const continuityRecommendations = buildContinuityRecommendations({
    activeFocuses,
    repeatedFailures,
    recentArtifacts,
    recentWorkflowRuns,
    workflowRecommendations,
    lastSuccessfulTask,
  });
  const workspaceName = path.basename(input.workspace);

  return {
    workspace: input.workspace,
    workspace_name: workspaceName,
    slug: slugifyWorkspaceMemoryValue(input.workspace),
    last_refreshed: new Date().toISOString(),
    successful_executors: successfulExecutors,
    repeated_failures: repeatedFailures,
    task_kind_recommendations: taskKindRecommendations,
    task_subtype_recommendations: taskSubtypeRecommendations,
    task_kind_llm_recommendations: taskKindLlmRecommendations,
    task_subtype_llm_recommendations: taskSubtypeLlmRecommendations,
    approved_paths: input.approvedPaths,
    approved_policies: input.approvedPolicies,
    active_focuses: activeFocuses,
    recent_artifacts: recentArtifacts,
    recent_workflow_runs: recentWorkflowRuns,
    workflow_recommendations: workflowRecommendations,
    workflow_executor_recommendations: workflowExecutorRecommendations,
    workflow_stage_executor_recommendations: workflowStageExecutorRecommendations,
    workflow_friction_recommendations: workflowFrictionRecommendations,
    approval_friction_recommendations: approvalFrictionRecommendations,
    route_outcomes: routeOutcomes,
    continuity_recommendations: continuityRecommendations,
    autonomous_outcomes: autonomousOutcomes,
    autonomous_mode_recommendations: autonomousModeRecommendations,
    direct_response_style_recommendations: directResponseStyleRecommendations,
    last_successful_task: lastSuccessfulTask,
    summary: buildWorkspaceOperationalMemorySummary({
      workspaceName,
      successfulExecutors,
      repeatedFailures,
      taskKindRecommendations,
      taskSubtypeRecommendations,
      taskKindLlmRecommendations,
      taskSubtypeLlmRecommendations,
      approvedPaths: input.approvedPaths,
      approvedPolicies: input.approvedPolicies,
      activeFocuses,
      recentArtifacts,
      recentWorkflowRuns,
      workflowRecommendations,
      workflowExecutorRecommendations,
      workflowStageExecutorRecommendations,
      workflowFrictionRecommendations,
      approvalFrictionRecommendations,
      routeOutcomes,
      continuityRecommendations,
      autonomousOutcomes,
      autonomousModeRecommendations,
      directResponseStyleRecommendations,
    }),
  };
}
