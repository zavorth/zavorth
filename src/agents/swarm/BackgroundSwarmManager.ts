/**
 * Background Swarm Task Manager.
 * Enables non-blocking asynchronous swarm delegation, allowing the CLI loop and interactive user
 * to continue working while multi-agent specialists execute tasks in background daemon workers.
 */

import { TerminalAudioNotifier } from '../../cli/presentation/TerminalAudioNotifier.js';
import type { SwarmExecutionReport } from '../DynamicSwarmCoordinator.js';

export interface BackgroundSwarmTask {
  id: string;
  description: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  report?: SwarmExecutionReport;
  error?: string;
}

export class BackgroundSwarmManager {
  private static tasks = new Map<string, BackgroundSwarmTask>();
  private static abortControllers = new Map<string, AbortController>();

  /**
   * Spawns a multi-agent swarm task asynchronously in the background.
   */
  static startTask(
    taskId: string,
    description: string,
    executor: () => Promise<SwarmExecutionReport>
  ): BackgroundSwarmTask {
    const task: BackgroundSwarmTask = {
      id: taskId,
      description,
      status: 'running',
      startedAt: new Date().toISOString(),
    };

    this.tasks.set(taskId, task);
    const abortController = new AbortController();
    this.abortControllers.set(taskId, abortController);

    // Launch background execution worker
    const startTime = Date.now();
    (async () => {
      try {
        const report = await executor();
        const existing = this.tasks.get(taskId);
        if (existing && existing.status !== 'cancelled') {
          existing.status = 'completed';
          existing.completedAt = new Date().toISOString();
          existing.durationMs = Date.now() - startTime;
          existing.report = report;

          // Play subtle notification chime upon async task completion
          TerminalAudioNotifier.playCompletionChime();
        }
      } catch (err: unknown) {
        const existing = this.tasks.get(taskId);
        if (existing && existing.status !== 'cancelled') {
          existing.status = 'failed';
          existing.completedAt = new Date().toISOString();
          existing.durationMs = Date.now() - startTime;
          existing.error = err instanceof Error ? err.message : String(err);
        }
      } finally {
        this.abortControllers.delete(taskId);
      }
    })();

    return task;
  }

  /**
   * Lists all background swarm tasks.
   */
  static listTasks(): BackgroundSwarmTask[] {
    return Array.from(this.tasks.values()).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  /**
   * Retrieves a specific background task.
   */
  static getTask(taskId: string): BackgroundSwarmTask | null {
    return this.tasks.get(taskId) || null;
  }

  /**
   * Cancels a running background task.
   */
  static cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status === 'running') {
      task.status = 'cancelled';
      task.completedAt = new Date().toISOString();
      const ctrl = this.abortControllers.get(taskId);
      if (ctrl) {
        ctrl.abort();
        this.abortControllers.delete(taskId);
      }
      return true;
    }
    return false;
  }

  /**
   * Clears finished tasks from memory.
   */
  static clearCompleted(): void {
    for (const [id, task] of this.tasks.entries()) {
      if (task.status !== 'running') {
        this.tasks.delete(id);
      }
    }
  }
}
