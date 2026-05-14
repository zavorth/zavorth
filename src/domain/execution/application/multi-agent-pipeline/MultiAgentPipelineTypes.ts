import type { WorkflowWorkspaceContext } from '../../../../services/WorkflowRunService.js';
import type { ExecutionGateway } from '../../../../execution/ExecutionGateway.js';
import type { SddOrchestratorService } from '../../../../services/SddOrchestratorService.js';
import type { TaskManager } from '../../../../orchestrator/TaskManager.js';
import type { WorkflowRunService, WorkflowStageDefinition, WorkflowStageExecutor } from '../../../../services/WorkflowRunService.js';

export type PipelineGateway = Pick<ExecutionGateway, 'submit'>;
export type WorkflowStage = WorkflowStageDefinition;
export type PipelineTaskManager = Pick<TaskManager, 'saveTask' | 'advanceState'>;
export type PipelineSddOrchestrator =
  Pick<SddOrchestratorService, 'inspect' | 'handoff' | 'isKnownFeature'>;
export type PipelineRuntime = {
  workflowRuns?: WorkflowRunService;
  taskManager?: PipelineTaskManager;
  sddOrchestrator?: PipelineSddOrchestrator;
};

export type WorkflowAdaptiveRole = 'maker' | 'reviewer' | 'researcher' | 'synthesizer';
export type WorkflowStageSelection = {
  executor: WorkflowStageExecutor;
  strategyNote: string | null;
};
export type WorkflowExecutorRecommendation =
  NonNullable<WorkflowWorkspaceContext['workflow_executor_recommendations']>[number];
export type WorkflowStageExecutorRecommendation =
  NonNullable<WorkflowWorkspaceContext['workflow_stage_executor_recommendations']>[number];
export type WorkflowFrictionRecommendation =
  NonNullable<WorkflowWorkspaceContext['workflow_friction_recommendations']>[number];
export type WorkflowApprovalFrictionRecommendation =
  NonNullable<WorkflowWorkspaceContext['approval_friction_recommendations']>[number];
export type WorkflowExecutorCandidateScore = {
  executor: WorkflowStageExecutor;
  score: number;
  stageRecommendation: WorkflowStageExecutorRecommendation | null;
  workflowRecommendation: WorkflowExecutorRecommendation | null;
  workflowFriction: WorkflowFrictionRecommendation | null;
  approvalFriction: WorkflowApprovalFrictionRecommendation | null;
  stageTargetsRecentFriction: boolean;
};
