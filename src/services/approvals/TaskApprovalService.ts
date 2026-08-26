import { Task } from '../../contracts/TaskContract.js';
import { ApprovalManager } from '../../orchestrator/ApprovalManager.js';
import { TaskManager } from '../../orchestrator/TaskManager.js';
import { HighRiskConfirmationService } from '../HighRiskConfirmationService.js';
import { TelemetryRuntimeService } from '../../observability/telemetry/TelemetryRuntimeService.js';
import { AuditLogger } from '../../monitoring/AuditLogger.js';
import { TaskSecurityPostureService } from '../TaskSecurityPostureService.js';
import type { WorkflowRunService } from '../../runtime/workflows/WorkflowRunService.js';
import { logger } from '../../logger';
import { asErrorLike } from '../../utils/errorLike.js';
import { getAgentPermissionService } from '../permission/AgentPermissionService.js';

export interface TaskDecisionContext {
  reply(text: string, options?: Record<string, unknown>): Promise<unknown>;
  from?: { id?: number | string } | null;
  chat?: { id?: number | string | null; type?: string } | null;
}

export type TaskApprovalServiceDeps = {
  taskManager: TaskManager;
  persistTask: (task: Task) => void;
  resumeTaskExecution(ctx: TaskDecisionContext, task: Task): Promise<void>;
  resumeWorkflowExecution?(ctx: TaskDecisionContext, task: Task): Promise<boolean>;
  workflowRunService?: Pick<WorkflowRunService, 'applyStageApprovalDecision'>;
  telemetryRuntime?: TelemetryRuntimeService;
  auditLogger?: AuditLogger;
  highRiskConfirmation?: HighRiskConfirmationService;
  taskSecurityPosture: TaskSecurityPostureService;
};

export class TaskApprovalService {
  private readonly highRiskConfirmation: HighRiskConfirmationService;

  constructor(private readonly deps: TaskApprovalServiceDeps) {
    this.highRiskConfirmation = this.deps.highRiskConfirmation || new HighRiskConfirmationService();
  }

  public requiresHighRiskConfirmation(taskId: string): boolean {
    const task = this.deps.taskManager.getTask(taskId);
    return this.highRiskConfirmation.requiresPin(task);
  }

  public async handleApproval(ctx: TaskDecisionContext, args: string): Promise<void> {
    const approvalManager = new ApprovalManager(this.deps.taskManager);
    const userId = ctx.from?.id?.toString() || null;
    let taskId = '';
    let choice: 'once' | 'session' | 'always' | 'deny' | 'approve' = 'once';

    try {
      ({ taskId, choice } = this.parseTaskApprovalInput(args, ctx));
      const currentTask = this.deps.taskManager.getTask(taskId);
      if (!currentTask) {
        throw new Error(
          `No pending task matched that reference. Use /approve, /approve 1, or tap Approve — not a long id.`,
        );
      }

      if (choice === 'deny') {
        await this.handleRejection(ctx, taskId);
        return;
      }

      // Agent-wide permission memory (once | session | always)
      const permissions = getAgentPermissionService({ projectRoot: process.cwd() });
      const remembered = permissions.respond({
        choice: choice === 'approve' ? 'once' : choice,
        toolName: String(currentTask.executor_used || currentTask.command_type || 'task'),
        pattern: String(currentTask.normalized_message || currentTask.task_id),
        risk: this.highRiskConfirmation.requiresPin(currentTask) ? 'danger' : 'attention',
        workspaceId: currentTask.workspace || null,
        sessionId: currentTask.chat_id || null,
        actorId: userId,
        surface: 'telegram',
      });

      const requiredHighRiskPin = this.highRiskConfirmation.requiresPin(currentTask);
      const task = approvalManager.processApproval(taskId, 'approve', {
        surface: 'telegram',
        actor: userId,
        highRiskConfirmation: this.highRiskConfirmation,
      });
      task.requires_approval = false;
      task.approval_status = 'approved';
      task.metadata = this.deps.taskSecurityPosture.appendApprovalDecision(task.metadata, {
        action: 'approve',
        actor: userId,
        at: new Date().toISOString(),
        required_high_risk_pin: requiredHighRiskPin,
        source: 'telegram_approve',
        permissionChoice: remembered.choice,
        permissionScope: remembered.scope,
      });
      task.metadata = {
        ...(task.metadata || {}),
        highRiskApprovedAt: new Date().toISOString(),
        explicitTaskApprovalAt: new Date().toISOString(),
        permissionChoice: remembered.choice,
      };
      this.deps.persistTask(task);
      await this.recordTaskApprovalAudit(task, 'approve', userId, {
        requiredHighRiskPin,
        choice: remembered.choice,
      });
      this.syncWorkflowApprovalDecision(task, 'approve', `Approval recorded (${remembered.choice}).`);
      await ctx.reply(
        [
          `Allowed (${remembered.choice}).`,
          remembered.message,
          `Short reference: ${task.task_id.substring(0, 8)}`,
          'Resuming execution now.',
        ].join('\n'),
      );
      await this.recordTaskApprovalTelemetry(task, 'approve', 'approved', userId, {
        requiredHighRiskPin,
        choice: remembered.choice,
      });
      await this.resumeApprovedTaskOrWorkflow(ctx, task);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : String(error);
      const task = this.deps.taskManager.getTask(taskId);
      if (task && task.status === 'running') {
        this.deps.taskManager.advanceState(task, 'failed');
      }
      await this.recordTaskApprovalTelemetry(task, 'approve', 'failed', userId, {
        taskId,
        errorMessage: message,
      });
      await ctx.reply(`I could not process this approval.\n\nReason: ${message}`);
    }
  }

  public async handleRejection(ctx: TaskDecisionContext, taskIdOrArgs: string): Promise<void> {
    const approvalManager = new ApprovalManager(this.deps.taskManager);
    const userId = ctx.from?.id?.toString() || null;
    let taskId =
      String(taskIdOrArgs || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)[0] || '';

    try {
      if (!taskId || /^\d+$/.test(taskId)) {
        taskId = this.resolvePendingTaskReference(taskId, ctx);
      } else {
        const resolved = this.resolveExplicitTaskReference(taskId, ctx);
        if (resolved) {
          taskId = resolved;
        }
      }

      const task = approvalManager.processApproval(taskId, 'reject');
      task.approval_status = 'rejected';
      task.metadata = this.deps.taskSecurityPosture.appendApprovalDecision(task.metadata, {
        action: 'reject',
        actor: userId,
        at: new Date().toISOString(),
        source: 'telegram_reject',
      });
      this.deps.persistTask(task);
      await this.recordTaskApprovalAudit(task, 'reject', userId);
      this.syncWorkflowApprovalDecision(task, 'reject', 'Approval rejected by the operator.');
      await this.recordTaskApprovalTelemetry(task, 'reject', 'rejected', userId);
      await ctx.reply(`Done. Task ${task.task_id.substring(0, 8)} was rejected and I will not continue it.`);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : String(error);
      await this.recordTaskApprovalTelemetry(undefined, 'reject', 'failed', userId, {
        taskId,
        errorMessage: message,
      });
      await ctx.reply(`I could not record this rejection.\n\nReason: ${message}`);
    }
  }

  private parseTaskApprovalInput(
    args: string,
    ctx: TaskDecisionContext,
  ): {
    taskId: string;
    choice: 'once' | 'session' | 'always' | 'deny' | 'approve';
  } {
    const parts = String(args || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    const CHOICES = new Set(['once', 'session', 'always', 'deny', 'approve']);
    let taskRef = String(parts[0] || '').trim();
    let choiceRaw = 'once';

    if (taskRef && CHOICES.has(taskRef.toLowerCase()) && parts.length === 1) {
      // `/approve once` (bare approve + scope) — no task ref.
      choiceRaw = taskRef.toLowerCase();
      taskRef = '';
    } else if (taskRef) {
      choiceRaw = String(parts[1] || 'once')
        .trim()
        .toLowerCase();
    }

    const choice =
      choiceRaw === 'session' ||
      choiceRaw === 'always' ||
      choiceRaw === 'deny' ||
      choiceRaw === 'once' ||
      choiceRaw === 'approve'
        ? (choiceRaw as 'once' | 'session' | 'always' | 'deny' | 'approve')
        : 'once';

    const taskId = this.resolvePendingTaskReference(taskRef, ctx);
    return { taskId, choice };
  }

  /**
   * Resolve bare /approve, ordinal /approve 1, short prefix, or full task id
   * against pending tasks for this user/session (newest first).
   */
  private resolvePendingTaskReference(ref: string, ctx: TaskDecisionContext): string {
    const normalized = String(ref || '').trim();
    const pending = this.listPendingTasksForContext(ctx);

    if (!normalized) {
      if (pending.length === 1) {
        return pending[0].task_id;
      }
      if (pending.length === 0) {
        throw new Error('No pending task to approve. Use /approve, /approve 1, or tap Approve — not a long id.');
      }
      throw new Error(
        `Several tasks are waiting (${pending.length}). Use /approve 1 (or 2…), or tap Approve — not a long id.`,
      );
    }

    if (/^\d+$/.test(normalized)) {
      const index = Number.parseInt(normalized, 10);
      if (index >= 1 && index <= pending.length) {
        return pending[index - 1].task_id;
      }
      throw new Error(
        pending.length === 0
          ? 'No pending task to approve. Use /approve, /approve 1, or tap Approve — not a long id.'
          : `No pending task at position ${index}. Use /approve 1${pending.length > 1 ? `…${pending.length}` : ''}, or tap Approve — not a long id.`,
      );
    }

    const explicit = this.resolveExplicitTaskReference(normalized, ctx);
    if (explicit) {
      return explicit;
    }

    // Fall through with the raw ref so getTask can still surface a clear miss.
    return normalized;
  }

  private resolveExplicitTaskReference(ref: string, ctx: TaskDecisionContext): string | null {
    const normalized = String(ref || '').trim();
    if (!normalized) {
      return null;
    }

    const exact = this.deps.taskManager.getTask(normalized);
    if (exact) {
      return exact.task_id;
    }

    const userId = ctx.from?.id?.toString() || undefined;
    const recent =
      this.deps.taskManager.getRecentTasks?.(100, userId) || this.deps.taskManager.getRecentTasks?.(100) || [];
    const prefixMatch = recent.find((task) => String(task.task_id || '').startsWith(normalized));
    return prefixMatch?.task_id || null;
  }

  private listPendingTasksForContext(ctx: TaskDecisionContext): Task[] {
    const userId = ctx.from?.id?.toString() || undefined;
    const chatId = ctx.chat?.id != null ? String(ctx.chat.id) : undefined;
    const recentByUser =
      (userId ? this.deps.taskManager.getRecentTasks?.(50, userId) : null) ||
      this.deps.taskManager.getRecentTasks?.(50) ||
      [];
    const recentByChat =
      chatId && this.deps.taskManager.getRecentTasksByChat
        ? this.deps.taskManager.getRecentTasksByChat(chatId, 50) || []
        : [];

    const seen = new Set<string>();
    const pending: Task[] = [];
    for (const task of [...recentByUser, ...recentByChat]) {
      const id = String(task.task_id || '').trim();
      if (!id || seen.has(id)) {
        continue;
      }
      if (!this.isPendingTaskApproval(task)) {
        continue;
      }
      if (userId && String(task.user_id || '').trim() && String(task.user_id) !== userId) {
        // Prefer same user; allow chat-scoped matches when user_id is empty.
        if (!chatId || String(task.chat_id || '') !== chatId) {
          continue;
        }
      }
      seen.add(id);
      pending.push(task);
    }

    // Newest first (getRecentTasks is updated_at DESC; re-sort for merged list).
    pending.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
    return pending;
  }

  private isPendingTaskApproval(task: Task): boolean {
    return (
      task.requires_approval === true ||
      String(task.approval_status || '').trim() === 'pending' ||
      String(task.status || '').trim() === 'waiting_approval'
    );
  }

  private async recordTaskApprovalTelemetry(
    task: Task | undefined,
    action: 'approve' | 'reject',
    status: 'approved' | 'rejected' | 'failed',
    userId: string | null,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    if (!this.deps.telemetryRuntime) {
      return;
    }

    try {
      await this.deps.telemetryRuntime.record({
        traceId: this.resolveTaskApprovalTraceId(task, payload.taskId),
        source: 'telegram-permission-controller',
        eventType: `task.approval.${action}`,
        status,
        payload: {
          taskId: task?.task_id || payload.taskId || null,
          userId,
          taskStatus: task?.status || null,
          requiresApproval: task?.requires_approval ?? null,
          approvalStatus: task?.approval_status || null,
          ...payload,
        },
      });
    } catch (error: unknown) {
      // telemetry should never block approval handling
      logger.warn('[TaskApproval] telemetry recording failed', error);
    }
  }

  private async recordTaskApprovalAudit(
    task: Task | undefined,
    action: 'approve' | 'reject',
    userId: string | null,
    details: Record<string, unknown> = {},
  ): Promise<void> {
    if (!this.deps.auditLogger || !task) {
      return;
    }

    try {
      await this.deps.auditLogger.logApprovalDecision(task, action, userId, details);
    } catch (error: unknown) {
      // audit should never block approval handling
      logger.warn('[Telegram Task Approval] operation failed', error);
    }
  }

  private async resumeApprovedTaskOrWorkflow(ctx: TaskDecisionContext, task: Task): Promise<void> {
    const resumedWorkflow = await this.tryResumeWorkflowExecution(ctx, task);
    if (resumedWorkflow) {
      return;
    }

    this.deps.taskManager.advanceState(task, 'running');
    await this.deps.resumeTaskExecution(ctx, task);
  }

  private async tryResumeWorkflowExecution(ctx: TaskDecisionContext, task: Task): Promise<boolean> {
    if (!this.deps.resumeWorkflowExecution) {
      return false;
    }

    const workflowRunId = String(task.metadata?.workflow_run_id || '').trim();
    if (!workflowRunId) {
      return false;
    }

    return this.deps.resumeWorkflowExecution(ctx, task);
  }

  private syncWorkflowApprovalDecision(task: Task | undefined, action: 'approve' | 'reject', summary: string): void {
    if (!task || !this.deps.workflowRunService) {
      return;
    }

    const workflowRunId = String(task.metadata?.workflow_run_id || '').trim();
    if (!workflowRunId) {
      return;
    }

    this.deps.workflowRunService.applyStageApprovalDecision({
      workflowRunId,
      stageId: String(task.metadata?.workflow_stage_id || task.metadata?.workflow_resume_stage_id || '').trim() || null,
      taskId: task.task_id,
      action,
      summary,
    });
  }

  private resolveTaskApprovalTraceId(task: Task | undefined, fallbackTaskId?: unknown): string {
    const candidates = [
      task?.metadata?.traceId,
      task?.metadata?.trace_id,
      task?.task_id ? `task:${task.task_id}` : null,
      fallbackTaskId ? `task:${String(fallbackTaskId)}` : null,
    ];

    for (const candidate of candidates) {
      const normalized = String(candidate || '').trim();
      if (normalized) {
        return normalized;
      }
    }

    return 'task:approval:unknown';
  }
}
