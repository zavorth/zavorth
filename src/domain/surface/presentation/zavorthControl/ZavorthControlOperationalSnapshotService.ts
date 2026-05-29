import { ExecutionLifecycleReadModelService } from '../../../../services/ExecutionLifecycleReadModelService.js';

type SessionContinuityLike = {
  buildSnapshot: (sessionId: string, chatId: string, userId: string) => any;
};

type MemoryPlaneLike = {
  buildSnapshot: (input: any) => Promise<any>;
};

type SessionReplayLike = {
  buildSnapshot: (input: any) => any;
};

type SessionHandoffLike = {
  buildSnapshot: (input: any) => any;
};

type WorkflowRunsLike = {
  listRuns: (input: { workspace: string; limit: number }) => any[];
};

type TaskManagerLike = {
  getRecentTasks?: (limit?: number, userId?: string) => any[];
};

type HostActionSourceLike = {
  listActions?: (limit?: number) => any[];
};

export type ZavorthControlOperationalSnapshotDeps = {
  continuityUserId: string;
  sessionContinuity: SessionContinuityLike | null;
  memoryPlane: MemoryPlaneLike;
  sessionReplay: SessionReplayLike;
  sessionHandoff: SessionHandoffLike;
  workflowRuns: WorkflowRunsLike;
  taskManager?: TaskManagerLike | null;
  hostActions?: HostActionSourceLike | null;
};

const CLASSIC_SESSION_ID = 'classic-zavorthControl';
const CLASSIC_CHAT_ID = 'zavorthControl:classic';
const CLASSIC_SOURCE_USER_ID = 'classic-zavorthControl';

export class ZavorthControlOperationalSnapshotService {
  private readonly lifecycleReadModel = new ExecutionLifecycleReadModelService();

  public readContinuitySnapshot(
    deps: ZavorthControlOperationalSnapshotDeps,
  ): Record<string, any> {
    const continuity = this.readContinuity(deps);
    if (!continuity) {
      return {
        available: false,
        reason: 'Runtime de chat ainda nao anexado ao zavorthControl classico.',
      };
    }

    return {
      available: true,
      ...continuity,
    };
  }

  public async readMemoryPlaneSnapshot(
    deps: ZavorthControlOperationalSnapshotDeps,
  ): Promise<Record<string, any>> {
    const snapshot = await deps.memoryPlane.buildSnapshot({
      userId: deps.continuityUserId,
      platform: 'web',
      sessionId: CLASSIC_SESSION_ID,
      chatId: CLASSIC_CHAT_ID,
      sourceUserId: CLASSIC_SOURCE_USER_ID,
    });

    return {
      available: true,
      ...snapshot,
    };
  }

  public readReplaySnapshot(
    deps: ZavorthControlOperationalSnapshotDeps,
  ): Record<string, any> {
    const continuity = this.readContinuity(deps);
    if (!continuity) {
      return {
        available: false,
        reason: 'Runtime de chat ainda nao anexado ao zavorthControl classico.',
      };
    }

    return {
      available: true,
      ...this.buildReplaySnapshot(continuity, deps),
    };
  }

  public readLifecycleSnapshot(
    deps: ZavorthControlOperationalSnapshotDeps,
  ): Record<string, any> {
    const continuity = this.readContinuity(deps);
    if (!continuity) {
      return {
        available: false,
        reason: 'Runtime de chat ainda nao anexado ao zavorthControl classico.',
      };
    }

    const workflowRuns = this.resolveWorkflowRuns(continuity, deps);
    const replay = this.buildReplaySnapshot(continuity, deps, workflowRuns);

    return {
      available: true,
      ...this.lifecycleReadModel.buildSnapshot({
        tasks: this.resolveLifecycleTasks(continuity, deps),
        workflowRuns,
        hostActions: this.safeReadHostActions(deps),
        replay,
        limit: 50,
      }),
    };
  }

  public readHandoffSnapshot(
    deps: ZavorthControlOperationalSnapshotDeps,
  ): Record<string, any> {
    const continuity = this.readContinuity(deps);
    if (!continuity) {
      return {
        available: false,
        reason: 'Runtime de chat ainda nao anexado ao zavorthControl classico.',
      };
    }

    const workflowRuns = this.resolveWorkflowRuns(continuity, deps);
    const replay = this.buildReplaySnapshot(continuity, deps, workflowRuns);

    return {
      available: true,
      ...deps.sessionHandoff.buildSnapshot({
        continuity,
        replay,
        workflowRuns,
      }),
    };
  }

  private readContinuity(
    deps: ZavorthControlOperationalSnapshotDeps,
  ): any | null {
    if (!deps.sessionContinuity) {
      return null;
    }

    return deps.sessionContinuity.buildSnapshot(
      CLASSIC_SESSION_ID,
      CLASSIC_CHAT_ID,
      deps.continuityUserId,
    );
  }

  private buildReplaySnapshot(
    continuity: any,
    deps: ZavorthControlOperationalSnapshotDeps,
    workflowRuns: any[] | null = null,
  ): any {
    return deps.sessionReplay.buildSnapshot({
      continuity,
      tasks: continuity.recentTasks,
      permissions: [],
      workflowRuns: workflowRuns || this.resolveWorkflowRuns(continuity, deps),
    });
  }

  private resolveWorkflowRuns(
    continuity: any,
    deps: ZavorthControlOperationalSnapshotDeps,
  ): any[] {
    const workspaceHint = String(
      continuity.focusTask?.workspace
      || continuity.currentSurfaceTask?.workspace
      || continuity.latestTelegramTask?.workspace
      || continuity.latestWebTask?.workspace
      || '',
    ).trim();

    return workspaceHint
      ? deps.workflowRuns.listRuns({ workspace: workspaceHint, limit: 5 })
      : [];
  }

  private resolveLifecycleTasks(
    continuity: any,
    deps: ZavorthControlOperationalSnapshotDeps,
  ): any[] {
    const continuityTasks = Array.isArray(continuity?.recentTasks) ? continuity.recentTasks : [];
    const rawTasks = this.safeReadRecentTasks(deps);
    const deduped = new Map<string, any>();
    for (const task of rawTasks) {
      const taskId = this.readTaskId(task);
      if (!taskId) {
        continue;
      }
      deduped.set(taskId, task);
    }
    for (const task of continuityTasks) {
      const taskId = this.readTaskId(task);
      if (!taskId || deduped.has(taskId)) {
        continue;
      }
      deduped.set(taskId, task);
    }
    return Array.from(deduped.values());
  }

  private safeReadRecentTasks(deps: ZavorthControlOperationalSnapshotDeps): any[] {
    try {
      const tasks = deps.taskManager?.getRecentTasks?.(50, deps.continuityUserId);
      return Array.isArray(tasks) ? tasks : [];
    } catch {
      return [];
    }
  }

  private safeReadHostActions(deps: ZavorthControlOperationalSnapshotDeps): any[] {
    try {
      const actions = deps.hostActions?.listActions?.(50);
      return Array.isArray(actions) ? actions : [];
    } catch {
      return [];
    }
  }

  private readTaskId(task: any): string | null {
    const taskId = String(task?.task_id || task?.taskId || '').trim();
    return taskId || null;
  }
}


