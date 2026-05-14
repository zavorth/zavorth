import type { ArtifactRecord } from '../contracts/ArtifactContract.js';
import type { Task } from '../contracts/TaskContract.js';
import { TaskStateMachine, type ZavorthTaskOsState } from '../orchestrator/TaskStateMachine.js';

type TaskRepositoryLike = {
  getById: (taskId: string) => Task | undefined;
  getRecentTasks: (limit?: number, userId?: string) => Task[];
  getPendingTasks: () => Task[];
};

export type TaskLedgerTaskSnapshot = {
  taskId: string;
  shortId: string;
  createdAt: string;
  updatedAt: string;
  source: string;
  chatId: string;
  userId: string;
  commandType: string;
  intent: string;
  workspace: string | null;
  executor: string | null;
  legacyStatus: Task['status'];
  state: ReturnType<typeof TaskStateMachine.describe>;
  approval: {
    required: boolean;
    status: Task['approval_status'];
    pendingPermissionId: string | null;
    resumesTask: boolean;
  };
  artifacts: {
    total: number;
    manifest: unknown;
    kinds: Record<string, number>;
    redeliverable: boolean;
    command: string;
  };
  retry: {
    available: boolean;
    command: string;
    reason: string;
  };
  resume: {
    available: boolean;
    command: string;
    reason: string;
  };
  relation: {
    conversation: string | null;
    workspace: string | null;
    executor: string | null;
    approvals: string[];
    artifacts: string[];
  };
  summary: string;
};

export type TaskLedgerSummary = {
  total: number;
  active: number;
  terminal: number;
  awaitingPermission: number;
  awaitingArtifact: number;
  redeliverableArtifacts: number;
  retryable: number;
  resumable: number;
  byState: Record<ZavorthTaskOsState, number>;
};

export type TaskLedgerSnapshot = {
  generatedAt: string;
  phase: '27';
  surface: 'task-ledger';
  summary: TaskLedgerSummary;
  tasks: TaskLedgerTaskSnapshot[];
  selected: TaskLedgerTaskSnapshot | null;
};

export class TaskLedgerService {
  constructor(private readonly taskRepository: TaskRepositoryLike) {}

  public buildSnapshot(input: {
    generatedAt: string;
    limit?: number;
    userId?: string | null;
    taskId?: string | null;
  }): TaskLedgerSnapshot {
    const selected = input.taskId ? this.taskRepository.getById(input.taskId) || null : null;
    const recent = this.taskRepository.getRecentTasks(input.limit || 20, input.userId || undefined);
    const pending = this.taskRepository.getPendingTasks();
    const taskMap = new Map<string, Task>();
    for (const task of [...(selected ? [selected] : []), ...pending, ...recent]) {
      taskMap.set(task.task_id, task);
    }
    const tasks = Array.from(taskMap.values())
      .sort((left, right) => String(right.updated_at).localeCompare(String(left.updated_at)))
      .slice(0, Math.max(1, Math.min(input.limit || 20, 100)))
      .map((task) => this.toSnapshot(task));

    return {
      generatedAt: input.generatedAt,
      phase: '27',
      surface: 'task-ledger',
      summary: this.summarize(tasks),
      tasks,
      selected: selected ? this.toSnapshot(selected) : null,
    };
  }

  public resolveTask(taskId: string): Task | null {
    const normalized = String(taskId || '').trim();
    if (!normalized || normalized === 'latest') {
      return this.taskRepository.getRecentTasks(1)[0] || null;
    }
    return this.taskRepository.getById(normalized) || null;
  }

  public toSnapshot(task: Task): TaskLedgerTaskSnapshot {
    const state = TaskStateMachine.describe(task);
    const artifacts = Array.isArray(task.artifacts) ? task.artifacts : [];
    const artifactManifest = task.metadata?.artifacts_manifest || null;
    const pendingPermissionId = this.firstText([
      task.metadata?.pendingPermissionId,
      task.metadata?.pending_permission_id,
      task.metadata?.permission_id,
    ]);
    const approvals = this.collectApprovalRefs(task);
    const artifactRefs = artifacts.map((artifact) => artifact.key || artifact.id || artifact.name).filter(Boolean);

    return {
      taskId: task.task_id,
      shortId: task.task_id.slice(0, 8),
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      source: task.source,
      chatId: task.chat_id,
      userId: task.user_id,
      commandType: task.command_type,
      intent: task.intent,
      workspace: task.workspace,
      executor: task.executor_used || task.planner_used || null,
      legacyStatus: task.status,
      state,
      approval: {
        required: task.requires_approval || state.approvalResumesTask,
        status: task.approval_status,
        pendingPermissionId,
        resumesTask: state.approvalResumesTask,
      },
      artifacts: {
        total: artifacts.length,
        manifest: artifactManifest,
        kinds: this.countArtifactKinds(artifacts),
        redeliverable: artifacts.length > 0,
        command: `zavorth artifacts task ${task.task_id}`,
      },
      retry: {
        available: state.retryable,
        command: `zavorth tasks retry ${task.task_id}`,
        reason: state.retryable
          ? 'Estado terminal pode ser reexecutado com novo ledger.'
          : 'Retry fica bloqueado ate a task chegar em estado terminal.',
      },
      resume: {
        available: state.resumable,
        command: state.approvalResumesTask
          ? `zavorth approve ${task.task_id}`
          : `zavorth tasks resume ${task.task_id}`,
        reason: state.approvalResumesTask
          ? 'Aprovacao retoma esta task pelo vinculo task/permissao.'
          : 'Resume usa task, conversa, workspace e executor persistidos.',
      },
      relation: {
        conversation: task.chat_id || null,
        workspace: task.workspace || null,
        executor: task.executor_used || task.planner_used || null,
        approvals,
        artifacts: artifactRefs,
      },
      summary: this.resolveSummary(task),
    };
  }

  private summarize(tasks: TaskLedgerTaskSnapshot[]): TaskLedgerSummary {
    const byState = TaskStateMachine.FORMAL_STATES.reduce((acc, state) => {
      acc[state] = 0;
      return acc;
    }, {} as Record<ZavorthTaskOsState, number>);
    for (const task of tasks) {
      byState[task.state.state] += 1;
    }
    return {
      total: tasks.length,
      active: tasks.filter((task) => task.state.active).length,
      terminal: tasks.filter((task) => task.state.terminal).length,
      awaitingPermission: byState.awaiting_permission,
      awaitingArtifact: byState.awaiting_artifact,
      redeliverableArtifacts: tasks.filter((task) => task.artifacts.redeliverable).length,
      retryable: tasks.filter((task) => task.retry.available).length,
      resumable: tasks.filter((task) => task.resume.available).length,
      byState,
    };
  }

  private countArtifactKinds(artifacts: ArtifactRecord[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const artifact of artifacts) {
      const kind = String(artifact.kind || artifact.type || 'file').trim().toLowerCase() || 'file';
      counts[kind] = (counts[kind] || 0) + 1;
    }
    return counts;
  }

  private collectApprovalRefs(task: Task): string[] {
    const refs = new Set<string>();
    for (const value of [
      task.metadata?.pendingPermissionId,
      task.metadata?.pending_permission_id,
      task.metadata?.permission_id,
      task.metadata?.approvalId,
      task.metadata?.approval_id,
    ]) {
      const normalized = String(value || '').trim();
      if (normalized) {
        refs.add(normalized);
      }
    }
    for (const entry of Array.isArray(task.metadata?.permission_history) ? task.metadata.permission_history : []) {
      const normalized = String(entry?.permission_id || entry?.permissionId || '').trim();
      if (normalized) {
        refs.add(normalized);
      }
    }
    return Array.from(refs);
  }

  private resolveSummary(task: Task): string {
    return String(
      task.result_summary ||
      task.error_summary ||
      task.stdout_summary ||
      task.raw_message ||
      task.normalized_message ||
      'Task sem resumo registrado.',
    ).trim();
  }

  private firstText(values: unknown[]): string | null {
    for (const value of values) {
      const normalized = String(value || '').trim();
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }
}
