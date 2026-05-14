import type { ExecutionResult } from '../../../../contracts/ExecutionContract.js';
import type { WorkflowKind, WorkflowRunSnapshot, WorkflowWorkspaceContext } from '../../../../services/WorkflowRunService.js';
import type { SddWorkOrder } from '../../../../services/SddOrchestratorService.js';
import type { WorkflowStage } from './MultiAgentPipelineTypes.js';
import { MultiAgentWorkflowResumePlanner } from './planner/MultiAgentWorkflowResumePlanner.js';
import { MultiAgentWorkflowPlannerSupport } from './planner/MultiAgentWorkflowPlannerSupport.js';
import { MultiAgentWorkflowSddPlanner } from './planner/MultiAgentWorkflowSddPlanner.js';
import { MultiAgentWorkflowStageBuilder } from './planner/MultiAgentWorkflowStageBuilder.js';
import type { MultiAgentWorkflowPlannerServiceDeps } from './planner/MultiAgentWorkflowPlannerContracts.js';

export type { MultiAgentWorkflowPlannerServiceDeps } from './planner/MultiAgentWorkflowPlannerContracts.js';

export class MultiAgentWorkflowPlannerService {
  private readonly support: MultiAgentWorkflowPlannerSupport;
  private readonly sddPlanner: MultiAgentWorkflowSddPlanner;
  private readonly stageBuilder: MultiAgentWorkflowStageBuilder;
  private readonly resumePlanner: MultiAgentWorkflowResumePlanner;

  constructor(private readonly deps: MultiAgentWorkflowPlannerServiceDeps = {}) {
    this.support = new MultiAgentWorkflowPlannerSupport();
    this.sddPlanner = new MultiAgentWorkflowSddPlanner(this.deps, this.support);
    this.stageBuilder = new MultiAgentWorkflowStageBuilder(this.support);
    this.resumePlanner = new MultiAgentWorkflowResumePlanner(this.support, this.sddPlanner);
  }

  public buildSddWorkflowStage(
    workOrder: SddWorkOrder,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): WorkflowStage {
    return this.sddPlanner.buildSddWorkflowStage(workOrder, workspaceContext);
  }

  public buildResumeStages(
    run: WorkflowRunSnapshot,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): WorkflowStage[] {
    return this.resumePlanner.buildResumeStages(run, workspaceContext);
  }

  public buildWorkflowStages(
    workflow: WorkflowKind,
    workspaceContext?: WorkflowWorkspaceContext | null,
  ): WorkflowStage[] {
    return this.stageBuilder.buildWorkflowStages(workflow, workspaceContext);
  }

  public summarizeResult(result?: ExecutionResult): string {
    return this.support.summarizeResult(result);
  }
}
