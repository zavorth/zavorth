import { ExecutionLifecycleReadModelService, type ExecutionLifecycleReadModelSnapshot } from '../../../../services/ExecutionLifecycleReadModelService.js';
import type { SessionContinuitySnapshot } from '../../../../services/SessionContinuityService.js';
import type { ZavorthMemoryPlaneSnapshot } from '../../../../services/ZavorthMemoryPlaneService.js';
import type { SessionReplaySnapshot } from '../../../../services/SessionReplayService.js';
import type { SessionHandoffSnapshot } from '../../../../services/SessionHandoffService.js';
import type { WorkflowRunSnapshot } from '../../../../services/WorkflowRunService.js';
import type { Task } from '../../../../contracts/TaskContract.js';
import type { SystemOverlordActionRecord } from '../../../../contracts/core/SystemOverlordContract.js';
import { logger } from '../../../../logger';type SessionContinuityLike = {
  buildSnapshot: (sessionId: string, chatId: string, userId: string) => SessionContinuitySnapshot;
};

type MemoryPlaneInput = {
  userId?: string | null;
  platform?: string | null;
  chatId?: string | null;
  sessionId?: string | null;
  sourceUserId?: string | null;
  workspaceHint?: string | null;
};

type MemoryPlaneLike = {
  buildSnapshot: (input: MemoryPlaneInput) => Promise<ZavorthMemoryPlaneSnapshot>;
};

type SessionReplayInput = {
  continuity?: SessionContinuitySnapshot | null;
  tasks?: Array<SessionContinuitySnapshot['recentTasks'][number]> | null;
  permissions?: Array<Record<string, unknown>> | null;
  workflowRuns?: WorkflowRunSnapshot[] | null;
};

type SessionReplayLike = {
  buildSnapshot: (input: SessionReplayInput) => SessionReplaySnapshot;
};

type SessionHandoffInput = {
  continuity?: SessionContinuitySnapshot | null;
  replay?: SessionReplaySnapshot | null;
  workflowRuns?: WorkflowRunSnapshot[] | null;
};

type SessionHandoffLike = {
  buildSnapshot: (input: SessionHandoffInput) => SessionHandoffSnapshot;
};

type WorkflowRunsLike = {
  listRuns: (input: { workspace: string; limit: number }) => WorkflowRunSnapshot[];
};

type TaskManagerLike = {
  getRecentTasks?: (limit?: number, userId?: string) => Task[];
};

type HostActionSourceLike = {
  listActions?: (limit?: number) => SystemOverlordActionRecord[];
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
  ): { available: boolean; reason?: string } & Partial<SessionContinuitySnapshot> {
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
  ): Promise<{ available: boolean } & ZavorthMemoryPlaneSnapshot> {
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
  ): { available: boolean; reason?: string } & Partial<SessionReplaySnapshot> {
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
  ): { available: boolean; reason?: string } & Partial<ExecutionLifecycleReadModelSnapshot> {
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
  ): { available: boolean; reason?: string } & Partial<SessionHandoffSnapshot> {
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
  ): SessionContinuitySnapshot | null {
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
    continuity: SessionContinuitySnapshot,
    deps: ZavorthControlOperationalSnapshotDeps,
    workflowRuns: WorkflowRunSnapshot[] | null = null,
  ): SessionReplaySnapshot {
    return deps.sessionReplay.buildSnapshot({
      continuity,
      tasks: continuity.recentTasks,
      permissions: [],
      workflowRuns: workflowRuns || this.resolveWorkflowRuns(continuity, deps),
    });
  }

  private resolveWorkflowRuns(
    continuity: SessionContinuitySnapshot,
    deps: ZavorthControlOperationalSnapshotDeps,
  ): WorkflowRunSnapshot[] {
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
    continuity: SessionContinuitySnapshot,
    deps: ZavorthControlOperationalSnapshotDeps,
    ): Array<Record<string, unknown>> {
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

  private safeReadRecentTasks(deps: ZavorthControlOperationalSnapshotDeps): Task[] {
    try {
      const tasks = deps.taskManager?.getRecentTasks?.(50, deps.continuityUserId);
      return Array.isArray(tasks) ? tasks : [];
    } catch (error: unknown) {logger.warn('[Zavorth Control Operational Snapshot] operation failed', error); return []; }
  }

  private safeReadHostActions(deps: ZavorthControlOperationalSnapshotDeps): SystemOverlordActionRecord[] {
    try {
      const actions = deps.hostActions?.listActions?.(50);
      return Array.isArray(actions) ? actions : [];
    } catch (error: unknown) {logger.warn('[Zavorth Control Operational Snapshot] operation failed', error); return []; }
  }

  private readTaskId(task: unknown): string | null {
    const record = task && typeof task === 'object' ? task as Record<string, unknown> : {};
    const taskId = String(record.task_id || record.taskId || '').trim();
    return taskId || null;
  }
}
