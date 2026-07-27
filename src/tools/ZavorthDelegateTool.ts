
import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

interface DelegatedTask {
  id: string;
  task_description: string;
  role: 'orchestrator' | 'leaf' | 'researcher' | 'executor' | 'reviewer';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  parent_id: string | null;
  children_ids: string[];
  result: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  timeout_ms: number;
  max_depth: number;
  current_depth: number;
  batch_id: string | null;
  context: Record<string, unknown>;
}

export class ZavorthDelegateTool extends BaseTool {
  public readonly name = 'zavorth_delegate';

  public readonly description =
    'Delegates tasks to governed subagents with support for parallel batch execution, hierarchical roles, maximum depth, and Zavorth approval integration.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'delegate', 'delegate_batch', 'list', 'status', 'cancel', 'result', 'cancel_batch'.",
      },
      task_id: {
        type: 'string',
        description: 'Delegated task ID (for status, cancel, result).',
      },
      batch_id: {
        type: 'string',
        description: 'Batch ID (for cancel_batch).',
      },
      task_description: {
        type: 'string',
        description: 'Task description for the subagent to execute.',
      },
      tasks: {
        type: 'string',
        description: "JSON array of tasks for batch: [{task_description, role?, context...}].",
      },
      role: {
        type: 'string',
        description: "Subagent role: 'orchestrator', 'leaf', 'researcher', 'executor', 'reviewer'. Default: 'leaf'.",
      },
      parent_id: {
        type: 'string',
        description: 'Parent task ID (for hierarchical delegation).',
      },
      timeout_ms: {
        type: 'number',
        description: 'Timeout in milliseconds. Default: 300000 (5 min).',
      },
      max_depth: {
        type: 'number',
        description: 'Maximum delegation depth. Default: 3.',
      },
      context: {
        type: 'string',
        description: 'JSON with additional context for the subagent.',
      },
    },
    required: ['action'],
  };

  private readonly storageDir: string;

  constructor(options?: { storageDir?: string }) {
    super();
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'delegation');
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: the "action" parameter is required.';

    const validActions = ['delegate', 'delegate_batch', 'list', 'status', 'cancel', 'result', 'cancel_batch'];
    if (!validActions.includes(action)) {
      return `Error: invalid action "${action}". Use: ${validActions.join(', ')}.`;
    }

    this.ensureStorageDir();

    try {
      switch (action) {
        case 'delegate': return this.delegate(args);
        case 'delegate_batch': return this.delegateBatch(args);
        case 'list': return this.listTasks();
        case 'status': return this.taskStatus(args);
        case 'cancel': return this.cancelTask(args);
        case 'result': return this.taskResult(args);
        case 'cancel_batch': return this.cancelBatch(args);
      }
      return 'Internal error.';
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Delegate] filesystem check failed', error);
    const message = error instanceof Error ? err.message : String(error);
      return `Delegate error: ${message}`;
  }
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private taskPath(taskId: string): string {
    return path.join(this.storageDir, `${taskId}.json`);
  }

  private loadTask(taskId: string): DelegatedTask | null {
    const filePath = this.taskPath(taskId);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as DelegatedTask;
  }

  private saveTask(task: DelegatedTask): void {
    fs.writeFileSync(this.taskPath(task.id), JSON.stringify(task, null, 2), 'utf-8');
  }

  private listAllTaskIds(): string[] {
    if (!fs.existsSync(this.storageDir)) return [];
    return fs.readdirSync(this.storageDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''));
  }

  private generateTaskId(): string {
    return `del_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private delegate(args: Record<string, unknown>): string {
    const taskDescription = String(args.task_description || '');
    if (!taskDescription) return 'Error: "task_description" is required.';

    const role = String(args.role || 'leaf') as DelegatedTask['role'];
    const validRoles = ['orchestrator', 'leaf', 'researcher', 'executor', 'reviewer'];
    if (!validRoles.includes(role)) {
      return `Error: invalid role "${role}". Use: ${validRoles.join(', ')}.`;
    }

    const parentId = typeof args.parent_id === 'string' ? args.parent_id : null;
    const maxDepth = typeof args.max_depth === 'number' ? args.max_depth : 3;
    const timeoutMs = typeof args.timeout_ms === 'number' ? args.timeout_ms : 300000;

    let currentDepth = 0;
    if (parentId) {
      const parent = this.loadTask(parentId);
      if (!parent) return `Error: parent task "${parentId}" not found.`;
      currentDepth = parent.current_depth + 1;
      if (currentDepth > maxDepth) {
        return `Error: maximum depth (${maxDepth}) reached. Parent task: ${parentId} (depth ${parent.current_depth}).`;
      }
    }

    let context: Record<string, unknown> = {};
    if (typeof args.context === 'string') {
      try { context = JSON.parse(args.context); } catch (error: unknown) {/* ignore */ logger.warn('[Zavorth Delegate] JSON parse failed', error); }
    } else if (typeof args.context === 'object' && args.context !== null) {
      context = args.context as Record<string, unknown>;
    }

    const taskId = this.generateTaskId();
    const task: DelegatedTask = {
      id: taskId,
      task_description: taskDescription,
      role,
      status: 'pending',
      parent_id: parentId,
      children_ids: [],
      result: null,
      error: null,
      created_at: new Date().toISOString(),
      started_at: null,
      completed_at: null,
      timeout_ms: timeoutMs,
      max_depth: maxDepth,
      current_depth: currentDepth,
      batch_id: null,
      context,
    };

    if (parentId) {
      const parent = this.loadTask(parentId);
      if (parent) {
        parent.children_ids.push(taskId);
        this.saveTask(parent);
      }
    }

    this.saveTask(task);

    const lines: string[] = [
      `Delegated task created.`,
      `  - ID: ${taskId}`,
      `  - Role: ${role}`,
      `  ? Description: ${taskDescription.slice(0, 80)}${taskDescription.length > 80 ? '...' : ''}`,
      `  - Depth: ${currentDepth}/${maxDepth}`,
      `  - Timeout: ${timeoutMs}ms`,
      parentId ? `  ? Parent: ${parentId}` : `  - Root (no parent)`,
    ];
    return lines.join('\n');
  }

  private delegateBatch(args: Record<string, unknown>): string {
    const tasksJson = String(args.tasks || '');
    if (!tasksJson) return 'Error: "tasks" is required (JSON array).';

    let tasks: Array<{ task_description: string; role?: string; context?: Record<string, unknown> }>;
    try {
      tasks = JSON.parse(tasksJson);
    } catch (error: unknown) {logger.warn('[Zavorth Delegate] JSON parse failed', error); return 'Error: invalid JSON for "tasks".'; }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return 'Error: "tasks" must be a non-empty array.';
    }

    if (tasks.length > 20) {
      return 'Error: maximum of 20 tasks per batch.';
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const taskIds: string[] = [];

    for (const t of tasks) {
      if (!t.task_description) continue;

      const validRoles = ['orchestrator', 'leaf', 'researcher', 'executor', 'reviewer'];
      const taskRole = (t.role as DelegatedTask['role']) || 'leaf';
      if (!validRoles.includes(taskRole)) continue;

      const taskId = this.generateTaskId();
      const task: DelegatedTask = {
        id: taskId,
        task_description: t.task_description,
        role: taskRole,
        status: 'pending',
        parent_id: null,
        children_ids: [],
        result: null,
        error: null,
        created_at: new Date().toISOString(),
        started_at: null,
        completed_at: null,
        timeout_ms: typeof args.timeout_ms === 'number' ? args.timeout_ms : 300000,
        max_depth: typeof args.max_depth === 'number' ? args.max_depth : 3,
        current_depth: 0,
        batch_id: batchId,
        context: t.context || {},
      };
      this.saveTask(task);
      taskIds.push(taskId);
    }

    const lines: string[] = [
      `Batch "${batchId}" created with ${taskIds.length} tasks.`,
      `  - IDs: ${taskIds.join(', ')}`,
      `  - Parallelism: ${taskIds.length} simultaneous subagents`,
    ];
    return lines.join('\n');
  }

  private listTasks(): string {
    const taskIds = this.listAllTaskIds();
    if (taskIds.length === 0) return 'No delegated tasks.';

    const tasks: DelegatedTask[] = [];
    for (const id of taskIds) {
      const t = this.loadTask(id);
      if (t) tasks.push(t);
    }

    const byStatus = {
      pending: tasks.filter((t) => t.status === 'pending'),
      running: tasks.filter((t) => t.status === 'running'),
      completed: tasks.filter((t) => t.status === 'completed'),
      failed: tasks.filter((t) => t.status === 'failed'),
      cancelled: tasks.filter((t) => t.status === 'cancelled'),
    };

    const lines: string[] = [`Delegated tasks (${tasks.length} total):`];
    if (byStatus.pending.length) lines.push(`  ⏳ Pending: ${byStatus.pending.length}`);
    if (byStatus.running.length) lines.push(`  🔄 Running: ${byStatus.running.length}`);
    if (byStatus.completed.length) lines.push(`  ✅ Completed: ${byStatus.completed.length}`);
    if (byStatus.failed.length) lines.push(`  ❌ Failed: ${byStatus.failed.length}`);
    if (byStatus.cancelled.length) lines.push(`  🚫 Cancelled: ${byStatus.cancelled.length}`);

    for (const t of tasks.slice(0, 20)) {
      const icon = { pending: '⏳', running: '🔄', completed: '✅', failed: '❌', cancelled: '🚫' }[t.status];
      const batch = t.batch_id ? ` [batch:${t.batch_id}]` : '';
      lines.push(`  ${icon} [${t.id}] ${t.role} — ${t.task_description.slice(0, 60)}${batch}`);
    }

    return lines.join('\n');
  }

  private taskStatus(args: Record<string, unknown>): string {
    const taskId = String(args.task_id || '');
    if (!taskId) return 'Error: "task_id" is required.';

    const task = this.loadTask(taskId);
    if (!task) return `Error: task "${taskId}" not found.`;

    const lines: string[] = [
      `Task: ${task.id}`,
      `  - Description: ${task.task_description}`,
      `  - Role: ${task.role}`,
      `  - Status: ${task.status}`,
      `  - Parent: ${task.parent_id || 'none'}`,
      `  ? Children: ${task.children_ids.length > 0 ? task.children_ids.join(', ') : 'none'}`,
      `  - Batch: ${task.batch_id || 'none'}`,
      `  - Depth: ${task.current_depth}/${task.max_depth}`,
      `  - Timeout: ${task.timeout_ms}ms`,
      `  - Created: ${task.created_at}`,
      `  - Started: ${task.started_at || 'no'}`,
      `  - Completed: ${task.completed_at || 'no'}`,
    ];
    if (task.result) lines.push(`  - Result: ${task.result.slice(0, 200)}`);
    if (task.error) lines.push(`  - Error: ${task.error}`);
    return lines.join('\n');
  }

  private cancelTask(args: Record<string, unknown>): string {
    const taskId = String(args.task_id || '');
    if (!taskId) return 'Error: "task_id" is required.';

    const task = this.loadTask(taskId);
    if (!task) return `Error: task "${taskId}" not found.`;

    if (task.status === 'completed' || task.status === 'cancelled') {
      return `Error: task "${taskId}" is already in status "${task.status}".`;
    }

    task.status = 'cancelled';
    task.completed_at = new Date().toISOString();
    task.error = 'Cancelled by user.';
    this.saveTask(task);

    let cancelledChildren = 0;
    for (const childId of task.children_ids) {
      const child = this.loadTask(childId);
      if (child && child.status !== 'completed' && child.status !== 'cancelled') {
        child.status = 'cancelled';
        child.completed_at = new Date().toISOString();
        child.error = 'Cancelled (parent task cancelled).';
        this.saveTask(child);
        cancelledChildren++;
      }
    }

    return `Task "${taskId}" cancelled.${cancelledChildren > 0 ? ` ${cancelledChildren} child task(s) also cancelled.` : ''}`;
  }

  private cancelBatch(args: Record<string, unknown>): string {
    const batchId = String(args.batch_id || '');
    if (!batchId) return 'Error: "batch_id" is required.';

    const taskIds = this.listAllTaskIds();
    let cancelled = 0;

    for (const id of taskIds) {
      const task = this.loadTask(id);
      if (task && task.batch_id === batchId && task.status !== 'completed' && task.status !== 'cancelled') {
        task.status = 'cancelled';
        task.completed_at = new Date().toISOString();
        task.error = 'Cancelled (batch cancelled).';
        this.saveTask(task);
        cancelled++;
      }
    }

    return `Batch "${batchId}": ${cancelled} task(s) cancelled.`;
  }

  private taskResult(args: Record<string, unknown>): string {
    const taskId = String(args.task_id || '');
    if (!taskId) return 'Error: "task_id" is required.';

    const task = this.loadTask(taskId);
    if (!task) return `Error: task "${taskId}" not found.`;

    if (task.status === 'pending') return `Task "${taskId}" is still pending.`;
    if (task.status === 'running') return `Task "${taskId}" is still running.`;
    if (task.status === 'failed') return `Task "${taskId}" failed: ${task.error}`;
    if (task.status === 'cancelled') return `Task "${taskId}" was cancelled.`;

    return task.result || 'Task completed but no result recorded.';
  }
}
