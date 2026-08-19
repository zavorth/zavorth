export type KanbanColumnId = 'TODO' | 'READY' | 'RUNNING' | 'REVIEW' | 'AUTO_REPAIR' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface KanbanTask {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly column: KanbanColumnId;
  readonly priority: TaskPriority;
  readonly assigneeSubagentId?: string;
  readonly tokensConsumed: number;
  readonly elapsedSeconds: number;
  readonly blockedBy: readonly string[];
  readonly incidentLog?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface KanbanBoardState {
  readonly columns: Record<KanbanColumnId, readonly KanbanTask[]>;
  readonly totalTasks: number;
  readonly activeSubagentsCount: number;
  readonly totalTokensConsumed: number;
}

export class ZavorthKanbanBoardService {
  private tasks: Map<string, KanbanTask> = new Map();

  public createTask(params: {
    readonly id?: string;
    readonly title: string;
    readonly description?: string;
    readonly priority?: TaskPriority;
    readonly blockedBy?: readonly string[];
    readonly column?: KanbanColumnId;
  }): KanbanTask {
    const id = params.id || `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const task: KanbanTask = {
      id,
      title: params.title,
      description: params.description,
      column: params.column || (params.blockedBy && params.blockedBy.length > 0 ? 'TODO' : 'READY'),
      priority: params.priority || 'MEDIUM',
      tokensConsumed: 0,
      elapsedSeconds: 0,
      blockedBy: params.blockedBy ? [...params.blockedBy] : [],
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(id, task);
    return task;
  }

  public getTask(id: string): KanbanTask | undefined {
    return this.tasks.get(id);
  }

  public getAllTasks(): readonly KanbanTask[] {
    return Array.from(this.tasks.values());
  }

  public moveTask(taskId: string, targetColumn: KanbanColumnId): { success: boolean; task?: KanbanTask; error?: string } {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { success: false, error: `Task "${taskId}" not found` };
    }

    if (targetColumn === 'RUNNING' || targetColumn === 'READY') {
      const unresolvedBlockers = task.blockedBy.filter((blockerId) => {
        const blocker = this.tasks.get(blockerId);
        return !blocker || blocker.column !== 'DONE';
      });

      if (unresolvedBlockers.length > 0) {
        return {
          success: false,
          error: `Task is blocked by unfinished tasks: ${unresolvedBlockers.join(', ')}`,
        };
      }
    }

    const updatedTask: KanbanTask = {
      ...task,
      column: targetColumn,
      updatedAt: Date.now(),
    };

    this.tasks.set(taskId, updatedTask);
    this.refreshDependencyReadiness();

    return { success: true, task: updatedTask };
  }

  public assignSubagent(taskId: string, subagentId: string): { success: boolean; task?: KanbanTask; error?: string } {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { success: false, error: `Task "${taskId}" not found` };
    }

    const updatedTask: KanbanTask = {
      ...task,
      assigneeSubagentId: subagentId,
      column: task.column === 'TODO' || task.column === 'READY' ? 'RUNNING' : task.column,
      updatedAt: Date.now(),
    };

    this.tasks.set(taskId, updatedTask);
    return { success: true, task: updatedTask };
  }

  public updateTelemetry(taskId: string, tokensDelta: number, elapsedSecondsDelta: number): KanbanTask | undefined {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;

    const updatedTask: KanbanTask = {
      ...task,
      tokensConsumed: task.tokensConsumed + Math.max(0, tokensDelta),
      elapsedSeconds: task.elapsedSeconds + Math.max(0, elapsedSecondsDelta),
      updatedAt: Date.now(),
    };

    this.tasks.set(taskId, updatedTask);
    return updatedTask;
  }

  public triggerAutoRepair(taskId: string, incidentDetails: string): { success: boolean; task?: KanbanTask; error?: string } {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { success: false, error: `Task "${taskId}" not found` };
    }

    const updatedTask: KanbanTask = {
      ...task,
      column: 'AUTO_REPAIR',
      incidentLog: `[${new Date().toISOString()}] Fault detected: ${incidentDetails}`,
      updatedAt: Date.now(),
    };

    this.tasks.set(taskId, updatedTask);
    return { success: true, task: updatedTask };
  }

  public getBoardState(): KanbanBoardState {
    const columns: Record<KanbanColumnId, KanbanTask[]> = {
      TODO: [],
      READY: [],
      RUNNING: [],
      REVIEW: [],
      AUTO_REPAIR: [],
      DONE: [],
    };

    let totalTokens = 0;
    const activeSubagents = new Set<string>();

    for (const task of this.tasks.values()) {
      columns[task.column].push(task);
      totalTokens += task.tokensConsumed;
      if (task.assigneeSubagentId && task.column === 'RUNNING') {
        activeSubagents.add(task.assigneeSubagentId);
      }
    }

    const priorityWeight: Record<TaskPriority, number> = {
      URGENT: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    for (const key of Object.keys(columns) as KanbanColumnId[]) {
      columns[key].sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority] || a.createdAt - b.createdAt);
    }

    return {
      columns,
      totalTasks: this.tasks.size,
      activeSubagentsCount: activeSubagents.size,
      totalTokensConsumed: totalTokens,
    };
  }

  public decomposeGoal(goalTitle: string, subtaskTitles: readonly string[]): readonly KanbanTask[] {
    const created: KanbanTask[] = [];
    let previousTaskId: string | undefined;

    for (let i = 0; i < subtaskTitles.length; i++) {
      const title = subtaskTitles[i];
      const task = this.createTask({
        title: `[${goalTitle}] ${title}`,
        blockedBy: previousTaskId ? [previousTaskId] : [],
        priority: i === 0 ? 'HIGH' : 'MEDIUM',
      });
      created.push(task);
      previousTaskId = task.id;
    }

    return created;
  }

  private refreshDependencyReadiness(): void {
    for (const task of this.tasks.values()) {
      if (task.column === 'TODO') {
        const allBlockersDone = task.blockedBy.every((id) => {
          const blocker = this.tasks.get(id);
          return blocker && blocker.column === 'DONE';
        });

        if (allBlockersDone) {
          this.tasks.set(task.id, {
            ...task,
            column: 'READY',
            updatedAt: Date.now(),
          });
        }
      }
    }
  }
}
