import { WorkflowRunService } from '../runtime/workflows/WorkflowRunService.js';
import {
  collectApprovedPolicyLearning,
  collectApprovalExecutorStats,
  collectArtifactStats,
  collectExecutorStats,
  collectOperatorCostSummary,
  collectRouteKinds,
  collectRouteLearning,
  collectRouteStrategies,
  collectRouteSubtypes,
  collectSurfaceSources,
  collectWorkspaceStats,
  collectWorkflowOverviews,
  collectWorkflowResumeStages,
} from './product-observability/builders.js';
import { buildInsights } from './product-observability/narrative.js';
import { isSince, normalizeOptionalString } from './product-observability/shared.js';

import {
  isHighRiskTask,
  matchesPermissionScope,
  matchesTaskScope,
  matchesWorkflowScope,
} from './product-observability/readers.js';

import type {
  PermissionServiceLike,
  ProductObservabilityBuildInput,
  ProductObservabilityRuntime,
  ProductObservabilityScope,
  ProductObservabilitySnapshot,
  TaskManagerLike,
} from './product-observability/types.js';

export type { ProductObservabilitySnapshot } from './product-observability/types.js';

export class ProductObservabilityService {
  private readonly now: () => Date;
  private readonly taskLimit: number;
  private readonly permissionLimit: number;
  private readonly workflowLimit: number;
  private readonly windowHours: number;
  private readonly workflowRunService: Pick<WorkflowRunService, 'listRuns'>;

  constructor(
    private readonly taskManager?: TaskManagerLike | null,
    private readonly permissionService?: PermissionServiceLike | null,
    runtime: ProductObservabilityRuntime = {},
  ) {
    this.now = runtime.now || (() => new Date());
    this.taskLimit = Math.max(20, Math.min(runtime.taskLimit || 240, 1000));
    this.permissionLimit = Math.max(20, Math.min(runtime.permissionLimit || 240, 1000));
    this.workflowLimit = Math.max(10, Math.min(runtime.workflowLimit || 48, 200));
    this.windowHours = Math.max(1, Math.min(runtime.windowHours || 24 * 7, 24 * 90));
    this.workflowRunService = runtime.workflowRunService || new WorkflowRunService();
  }

  public async buildSnapshot(input: ProductObservabilityBuildInput = {}): Promise<ProductObservabilitySnapshot> {
    const normalizedInput: Partial<ProductObservabilityScope & { referenceDate: Date }> =
      input instanceof Date ? { referenceDate: input } : (input || {});
    const referenceDate = normalizedInput.referenceDate || this.now();
    const scope: ProductObservabilitySnapshot['scope'] = {
      workspace: normalizeOptionalString(normalizedInput.workspace),
      sourceSurface: normalizeOptionalString(normalizedInput.sourceSurface),
      executor: normalizeOptionalString(normalizedInput.executor),
      workflow: normalizeOptionalString(normalizedInput.workflow),
      scoped: false,
    };
    scope.scoped = Boolean(scope.workspace || scope.sourceSurface || scope.executor || scope.workflow);
    const since = new Date(referenceDate.getTime() - this.windowHours * 60 * 60 * 1000).getTime();
    const tasks = (this.taskManager?.getRecentTasks(this.taskLimit) || [])
      .filter((task) => isSince(task.updated_at, since));
    const filteredTasks = tasks.filter((task) => matchesTaskScope(task, scope));
    const filteredTaskIds = new Set(filteredTasks.map((task) => task.task_id));
    const permissions = this.permissionService
      ? (await this.permissionService.listRequests('all', this.permissionLimit))
        .filter((permission) => isSince(permission.updated_at, since))
        .filter((permission) => matchesPermissionScope(permission, scope, filteredTaskIds))
      : [];
    const workflowRuns = this.workflowRunService
      .listRuns({ limit: this.workflowLimit })
      .filter((run) => isSince(run.updated_at, since))
      .filter((run) => matchesWorkflowScope(run, scope));

    const routeStrategies = collectRouteStrategies(filteredTasks);
    const routeKinds = collectRouteKinds(filteredTasks);
    const routeSubtypes = collectRouteSubtypes(filteredTasks);
    const workspaceStats = collectWorkspaceStats(filteredTasks, workflowRuns);
    const surfaceSources = collectSurfaceSources(filteredTasks);
    const executorStats = collectExecutorStats(filteredTasks);
    const approvalExecutorStats = collectApprovalExecutorStats(filteredTasks);
    const artifactStats = collectArtifactStats(filteredTasks);
    const workflowOverviews = collectWorkflowOverviews(workflowRuns);
    const routeLearning = collectRouteLearning(filteredTasks, workflowRuns);
    const approvedPolicyLearning = collectApprovedPolicyLearning(permissions);
    const workflowResumeStages = collectWorkflowResumeStages(workflowRuns);
    const operatorCost = collectOperatorCostSummary(routeLearning.highestOperatorCost);

    const totals = {
      tasks: filteredTasks.length,
      completed: filteredTasks.filter((task) => task.status === 'completed').length,
      failed: filteredTasks.filter((task) => ['failed', 'rejected', 'cancelled'].includes(String(task.status || ''))).length,
      waitingApproval: filteredTasks.filter((task) => task.status === 'waiting_approval' || task.approval_status === 'pending').length,
      workflowRuns: workflowRuns.length,
      resumableWorkflowRuns: workflowRuns.filter((run) => Boolean(run.resume_stage)).length,
      artifacts: filteredTasks.reduce((sum, task) => sum + (Array.isArray(task.artifacts) ? task.artifacts.length : 0), 0),
      approvals: permissions.length,
    };

    const approvals = {
      pending: filteredTasks.filter((task) => task.approval_status === 'pending' || task.status === 'waiting_approval').length,
      approved: filteredTasks.filter((task) => task.approval_status === 'approved').length,
      rejected: filteredTasks.filter((task) => task.approval_status === 'rejected').length,
      highRisk: filteredTasks.filter((task) => isHighRiskTask(task)).length,
      permissionPending: permissions.filter((permission) => permission.status === 'pending').length,
      permissionRejected: permissions.filter((permission) => permission.status === 'rejected').length,
    };

    return {
      generatedAt: referenceDate.toISOString(),
      windowHours: this.windowHours,
      scope,
      totals,
      routes: {
        strategies: routeStrategies.slice(0, 5),
        taskKinds: routeKinds.slice(0, 5),
        taskSubtypes: routeSubtypes.slice(0, 6),
      },
      workspaces: {
        top: workspaceStats.slice(0, 6),
      },
      surfaces: {
        sources: surfaceSources.slice(0, 5),
      },
      workflows: {
        active: workflowRuns.filter((run) => run.status === 'running').length,
        resumable: workflowRuns.filter((run) => Boolean(run.resume_stage)).length,
        completed: workflowRuns.filter((run) => run.status === 'completed').length,
        failed: workflowRuns.filter((run) => ['failed', 'blocked', 'approval_pending'].includes(String(run.status || ''))).length,
        recent: workflowOverviews.slice(0, 6),
      },
      executors: {
        top: executorStats.slice(0, 6),
        friction: approvalExecutorStats.slice(0, 6),
      },
      approvals,
      operatorCost,
      artifacts: {
        topKinds: artifactStats.topKinds.slice(0, 6),
        recent: artifactStats.recent.slice(0, 6),
      },
      learning: {
        routes: {
          topSuccessful: routeLearning.topSuccessful.slice(0, 6),
          highestFriction: routeLearning.highestFriction.slice(0, 6),
          highestOperatorCost: routeLearning.highestOperatorCost.slice(0, 6),
        },
        approvedPolicies: approvedPolicyLearning.slice(0, 6),
        workflowResumeStages: workflowResumeStages.slice(0, 6),
      },
      insights: buildInsights({
        scope,
        routeStrategies,
        workspaceStats,
        surfaceSources,
        workflowOverviews,
        executorStats,
        approvalExecutorStats,
        routeLearning,
        approvedPolicyLearning,
        workflowResumeStages,
        approvals,
        operatorCost,
        totals,
      }),
    };
  }
}
