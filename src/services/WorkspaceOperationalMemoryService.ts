import fs from 'fs';
import path from 'path';
import { Task } from '../contracts/TaskContract.js';
import { config } from '../config/index.js';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';
import { WorkflowRunService } from '../runtime/workflows/WorkflowRunService.js';
import { WorkspaceOperationalMemoryNotesBuilder } from '../domain/memory/infrastructure/workspace-operational-memory/WorkspaceOperationalMemoryNotesBuilder.js';
import type { PermissionServiceLike, TaskManagerLike, WorkspaceOperationalMemory } from '../domain/memory/infrastructure/workspace-operational-memory/WorkspaceOperationalMemoryTypes.js';
import { buildWorkspaceOperationalMemoryMetadata } from '../domain/memory/infrastructure/workspace-operational-memory/WorkspaceOperationalMemorySerialization.js';
import { buildApprovedPathsFromPolicies, collectApprovedPoliciesFromRequests } from '../domain/memory/infrastructure/workspace-operational-memory/WorkspaceOperationalMemoryInsights.js';
import { buildWorkspaceOperationalMemorySnapshot } from '../domain/memory/infrastructure/workspace-operational-memory/WorkspaceOperationalMemorySnapshotBuilder.js';

export type {
  WorkspaceOperationalMemory,
  TaskSubtypeRecommendation,
  TaskKindRecommendation,
  ActiveFocusAggregate,
  DirectResponseStyleRecommendation,
  TaskKindLlmRecommendation,
  TaskSubtypeLlmRecommendation,
  WorkflowExecutorRecommendationAggregate,
  ContinuityRecommendation,
  RecentArtifactAggregate,
  RouteOutcomeAggregate,
  ApprovedPolicyAggregate,
  WorkflowRecommendationAggregate,
  WorkflowFrictionRecommendationAggregate,
  ApprovalFrictionAggregate,
  WorkflowStageExecutorRecommendationAggregate,
} from '../domain/memory/infrastructure/workspace-operational-memory/WorkspaceOperationalMemoryTypes.js';

export class WorkspaceOperationalMemoryService {
  private readonly notesBuilder = new WorkspaceOperationalMemoryNotesBuilder();

  private readonly workflowAnalytics: Pick<WorkflowRunService, 'listRuns'>;

  constructor(
    private readonly taskManager?: TaskManagerLike,
    private readonly permissionService?: PermissionServiceLike,
    private readonly memoryDir = config.operationalMemoryDir,
    private readonly workflowRunService: Pick<WorkflowRunService, 'listRuns'> = new WorkflowRunService(),
  ) {
    this.workflowAnalytics = this.workflowRunService;
  }

  public async getMemory(workspaceHint: string | null | undefined, userId?: string): Promise<WorkspaceOperationalMemory | null> {
    if (!workspaceHint || !this.taskManager || !this.permissionService) {
      return null;
    }

    const workspace = WorkspaceResolver.resolve(workspaceHint);
    const recentTasks = this.taskManager.getRecentTasks(120, userId).filter((task) => this.workspaceMemoryTaskBelongsToWorkspace(task, workspace));
    const approvedPolicies = collectApprovedPoliciesFromRequests(await this.permissionService.listApprovedRequests(undefined, undefined, workspace));
    const approvedPaths = buildApprovedPathsFromPolicies(approvedPolicies);
    const memory = buildWorkspaceOperationalMemorySnapshot({
      workspace,
      recentTasks,
      approvedPaths,
      approvedPolicies,
      workflowRunService: this.workflowAnalytics,
    });

    await fs.promises.mkdir(this.memoryDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(this.memoryDir, `${memory.slug}.json`),
      JSON.stringify(memory, null, 2),
      'utf8',
    );

    return memory;
  }

  public buildTaskMetadata(memory: WorkspaceOperationalMemory): Record<string, any> { // eslint-disable-line @typescript-eslint/no-explicit-any
    return buildWorkspaceOperationalMemoryMetadata(memory);
  }

  public buildPlanNotes(// eslint-disable-next-line @typescript-eslint/no-explicit-any
    memory: WorkspaceOperationalMemory | Record<string, any> | null | undefined): string[] {
    return this.notesBuilder.buildPlanNotes(memory);
  }

  private workspaceMemoryTaskBelongsToWorkspace(task: Task, workspace: string): boolean {
    const taskWorkspace = String(task.workspace || '').trim();
    if (!taskWorkspace) {
      return false;
    }

    return WorkspaceResolver.resolve(taskWorkspace) === workspace;
  }
}
