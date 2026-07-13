import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { Task } from '../../../../contracts/TaskContract.js';
import { StateMachine } from '../../../../orchestrator/StateMachine.js';
import type {
  SurfaceControllerContext,
  SurfaceTaskDispatcherLike,
} from '../../../../services/SurfaceRuntime.js';
import { RecentTaskResolver } from '../../../../services/RecentTaskResolver.js';

import type { SharedSurfaceWorkflowGovernanceCommandPack } from './SharedSurfaceWorkflowGovernanceCommandPack.js';
import {
  extractRecentTaskContextKeywords,
  normalizeNaturalTaskText,
} from './SharedSurfaceTaskNaturalLanguage.js';

type TaskApprovalController = {
  handleApproval: (ctx: SurfaceControllerContext, args: string) => Promise<void>;
  handleRejection: (ctx: SurfaceControllerContext, taskId: string) => Promise<void>;
};

type TaskExecutionController = {
  handleUndo: (ctx: SurfaceControllerContext, taskId: string) => Promise<void>;
  resumeTaskExecution: (ctx: SurfaceControllerContext, task: Task) => Promise<void>;
};

type TaskAdvanceOptions = {
  actor?: string | null;
  reason?: string;
};

type TaskManager = {
  getRecentTasks?: (limit?: number, userId?: string) => Task[];
  getTask?: (taskId: string) => Task | undefined;
  advanceState?: (task: Task, nextStatus: Task['status'], options?: TaskAdvanceOptions) => void;
};

type ErrorWithMessage = { message?: string };

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as ErrorWithMessage).message || 'unknown error');
  }
  return 'unknown error';
}

export type SharedSurfaceTaskControlCommandPackDeps = {
  workflowGovernanceCommandPack: Pick<SharedSurfaceWorkflowGovernanceCommandPack, 'maybeHandleCommand'>;
  taskApprovalController?: TaskApprovalController | null;
  taskExecutionController?: TaskExecutionController | null;
  surfaceTaskDispatcher?: SurfaceTaskDispatcherLike | null;
  taskManager?: TaskManager | null;
};

export class SharedSurfaceTaskControlCommandPack {
  public constructor(private readonly deps: SharedSurfaceTaskControlCommandPackDeps) {}

  public async handleTaskApprovalCommand(ctx: IMessageContext, args: string): Promise<void> {
    if (!this.deps.taskApprovalController) {
      await ctx.reply('Task approval is not available on this shared surface.');
      return;
    }

    const surfaceCtx: SurfaceControllerContext = {
      userId: String(ctx.userId || '').trim() || undefined,
      chatId: ctx.chatId,
      platform: ctx.platform,
    };

    try {
      await this.deps.taskApprovalController.handleApproval(surfaceCtx, args);
    } catch (error: unknown) {await ctx.reply(
        `Could not approve that task right now.\n\nReason: ${getErrorMessage(error)}`,
      );
    }
  }

  public async handleTaskRejectionCommand(ctx: IMessageContext, args: string): Promise<void> {
    if (!this.deps.taskApprovalController) {
      await ctx.reply('Task approval is not available on this shared surface.');
      return;
    }

    const taskId = String(args || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)[0];
    if (!taskId) {
      await ctx.reply('Use /reject <task_id>.');
      return;
    }

    const surfaceCtx: SurfaceControllerContext = {
      userId: String(ctx.userId || '').trim() || undefined,
      chatId: ctx.chatId,
      platform: ctx.platform,
    };

    try {
      await this.deps.taskApprovalController.handleRejection(surfaceCtx, taskId);
    } catch (error: unknown) {await ctx.reply(
        `Could not reject that task right now.\n\nReason: ${getErrorMessage(error)}`,
      );
    }
  }

  public async handleTaskUndoCommand(ctx: IMessageContext, args: string): Promise<void> {
    if (!this.deps.taskExecutionController) {
      await ctx.reply('Task undo is not available on this shared surface.');
      return;
    }

    const explicitRef = String(args || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)[0];
    const task =
      (explicitRef ? this.resolveTaskReference(explicitRef, ctx) : null) ||
      this.resolveRecentTaskControl(ctx, 'undo', []);
    if (!task) {
      await ctx.reply(
        'Could not find a recent task with rollback available. Use /undo <task_id> if you want to be more explicit.',
      );
      return;
    }

    const surfaceCtx: SurfaceControllerContext = {
      userId: String(ctx.userId || '').trim() || undefined,
      chatId: ctx.chatId,
      platform: ctx.platform,
    };

    try {
      await this.deps.taskExecutionController.handleUndo(surfaceCtx, task.task_id);
    } catch (error: unknown) {await ctx.reply(
        `Could not undo that task right now.\n\nReason: ${getErrorMessage(error)}`,
      );
    }
  }

  public extractRecentTaskContextKeywords(rawText: string): string[] {
    return extractRecentTaskContextKeywords(rawText);
  }

  private async handleTaskRetry(ctx: IMessageContext, task: Task): Promise<void> {
    const workflowRunId = String(task.metadata?.workflow_run_id || '').trim();
    if (workflowRunId && this.isSurfaceResumableTask(task)) {
      await ctx.reply(
        'This task is still linked to a resumable workflow. I will resume the workflow instead of opening a new copy.',
      );
      await this.handleTaskResume(ctx, task);
      return;
    }

    if (!StateMachine.canRetry(String(task.status || '').trim() as Task['status'])) {
      await ctx.reply(
        `${RecentTaskResolver.formatTaskStatus(task)}\n\nThis task is not in a state I can safely reopen as a retry.`,
      );
      return;
    }

    if (!this.deps.surfaceTaskDispatcher) {
      await ctx.reply(
        `${RecentTaskResolver.formatTaskStatus(task)}\n\nThis runtime does not expose the canonical dispatcher to reopen the task as a new request.`,
      );
      return;
    }

    const originalText = String(task.raw_message || task.normalized_message || '').trim();
    if (!originalText) {
      await ctx.reply('Could not find the original request for this task to open a canonical retry.');
      return;
    }

    const surfaceCtx: SurfaceControllerContext = {
      userId: String(ctx.userId || '').trim() || undefined,
      chatId: ctx.chatId,
      platform: ctx.platform,
    };

    const result = await this.deps.surfaceTaskDispatcher.dispatchTaskMessage({
      ctx: surfaceCtx,
      platform: ctx.platform,
      chatId: ctx.chatId,
      text: originalText,
      sourceUserId: String(ctx.userId || '').trim(),
      source: ctx.platform,
      threadId: ctx.threadId || null,
      composerPayload: ctx.composerPayload || null,
      surfacePolicy: {
        transport: ctx.transport || null,
      },
    });

    await ctx.reply(
      [
        'I reopened that request as a new canonical task.',
        '',
        `Task original: ${task.task_id}`,
        `Nova task: ${String(result.task?.task_id || '').trim() || 'n/d'}`,
        `Pedido reaproveitado: ${originalText}`,
      ].join('\n'),
    );
  }

  public resolveTaskReference(
    ref: string,
    ctx: Pick<IMessageContext, 'userId'>,
  ): Task | null {
    const normalized = String(ref || '').trim();
    if (!normalized || !this.deps.taskManager) {
      return null;
    }

    const exact = this.deps.taskManager.getTask?.(normalized);
    if (exact) {
      return exact;
    }

    if (!this.deps.taskManager.getRecentTasks) {
      return null;
    }

    const requestedBy = String(ctx.userId || '').trim() || undefined;
    const recentTasks = this.deps.taskManager.getRecentTasks(100, requestedBy) || [];
    const match = recentTasks.find((task) => String(task.task_id || '').startsWith(normalized));
    return match || null;
  }

  public resolveRecentTaskReference(
    ctx: Pick<IMessageContext, 'userId'>,
    keywords: string[],
  ): Task | null {
    if (!this.deps.taskManager?.getRecentTasks) {
      return null;
    }

    const requestedBy = String(ctx.userId || '').trim() || undefined;
    const recentTasks = this.deps.taskManager.getRecentTasks(20, requestedBy) || [];
    let bestMatch: { task: Task; score: number } | null = null;

    for (const task of recentTasks) {
      if (String(task.command_type || '').trim() === '/task' && String(task.intent || '').trim() === 'unknown') {
        continue;
      }

      const score = this.scoreRecentTaskReferenceMatch(task, keywords);
      if (keywords.length > 0 && score <= 0) {
        continue;
      }

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { task, score };
      }
    }

    return bestMatch?.task || null;
  }

  private resolveRecentTaskControl(
    ctx: Pick<IMessageContext, 'userId'>,
    action: 'resume' | 'undo' | 'retry',
    keywords: string[],
  ): Task | null {
    if (!this.deps.taskManager?.getRecentTasks) {
      return null;
    }

    const requestedBy = String(ctx.userId || '').trim() || undefined;
    const recentTasks = this.deps.taskManager.getRecentTasks(50, requestedBy) || [];
    let bestMatch: { task: Task; score: number } | null = null;

    for (const task of recentTasks) {
      if (action === 'undo' && !this.isUndoableTask(task)) {
        continue;
      }
      if (action === 'resume' && !this.isSurfaceResumableTask(task)) {
        continue;
      }
      if (action === 'retry' && !this.isSurfaceRetryableTask(task)) {
        continue;
      }

      const score =
        action === 'undo'
          ? this.scoreUndoTaskMatch(task, keywords)
          : action === 'retry'
            ? this.scoreRetryTaskMatch(task, keywords)
            : this.scoreResumeTaskMatch(task, keywords);
      if (keywords.length > 0 && score <= 0) {
        continue;
      }

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { task, score };
      }
    }

    return bestMatch?.task || null;
  }

  private scoreRecentTaskReferenceMatch(task: Task, keywords: string[]): number {
    const haystack = normalizeNaturalTaskText(
      [
        task.raw_message,
        task.result_summary,
        task.error_summary,
        task.intent,
        task.target,
        task.metadata?.workflow_objective,
        task.metadata?.workflow_label,
      ]
        .filter(Boolean)
        .join(' '),
    );

    let score = 2;
    if (StateMachine.isActive(String(task.status || '').trim() as Task['status'])) {
      score += 2;
    }
    for (const keyword of keywords) {
      if (haystack.includes(keyword)) {
        score += 3;
      }
    }
    return score;
  }

  private resolveRecentTaskApprovalId(
    ctx: Pick<IMessageContext, 'userId'>,
    keywords: string[],
  ): string | null {
    if (!this.deps.taskManager?.getRecentTasks) {
      return null;
    }

    const requestedBy = String(ctx.userId || '').trim() || undefined;
    const recentTasks = this.deps.taskManager.getRecentTasks(50, requestedBy) || [];
    let bestMatch: { taskId: string; score: number } | null = null;

    for (const task of recentTasks) {
      if (!this.isPendingTaskApproval(task)) {
        continue;
      }

      const score = this.scoreTaskApprovalMatch(task, keywords);
      if (keywords.length > 0 && score <= 0) {
        continue;
      }

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { taskId: task.task_id, score };
      }
    }

    return bestMatch?.taskId || null;
  }

  private scoreUndoTaskMatch(task: Task, keywords: string[]): number {
    const haystack = normalizeNaturalTaskText(
      [
        task.raw_message,
        task.result_summary,
        task.error_summary,
        task.intent,
        task.target,
      ]
        .filter(Boolean)
        .join(' '),
    );

    let score = this.isUndoableTask(task) ? 5 : 0;
    for (const keyword of keywords) {
      if (haystack.includes(keyword)) {
        score += 3;
      }
    }
    return score;
  }

  private scoreResumeTaskMatch(task: Task, keywords: string[]): number {
    const haystack = normalizeNaturalTaskText(
      [
        task.raw_message,
        task.result_summary,
        task.error_summary,
        task.intent,
        task.target,
        task.metadata?.workflow_objective,
        task.metadata?.workflow_label,
      ]
        .filter(Boolean)
        .join(' '),
    );

    let score = this.isSurfaceResumableTask(task) ? 4 : 0;
    if (String(task.metadata?.workflow_run_id || '').trim()) {
      score += 3;
    }
    for (const keyword of keywords) {
      if (haystack.includes(keyword)) {
        score += 3;
      }
    }
    return score;
  }

  private scoreRetryTaskMatch(task: Task, keywords: string[]): number {
    const haystack = normalizeNaturalTaskText(
      [
        task.raw_message,
        task.result_summary,
        task.error_summary,
        task.intent,
        task.target,
        task.metadata?.workflow_objective,
        task.metadata?.workflow_label,
      ]
        .filter(Boolean)
        .join(' '),
    );

    let score = this.isSurfaceRetryableTask(task) ? 5 : 0;
    if (StateMachine.canRetry(String(task.status || '').trim() as Task['status'])) {
      score += 2;
    }
    for (const keyword of keywords) {
      if (haystack.includes(keyword)) {
        score += 3;
      }
    }
    return score;
  }

  private isPendingTaskApproval(task: Task): boolean {
    return (
      task.requires_approval === true ||
      String(task.approval_status || '').trim() === 'pending' ||
      String(task.status || '').trim() === 'waiting_approval'
    );
  }

  private scoreTaskApprovalMatch(task: Task, keywords: string[]): number {
    const haystack = normalizeNaturalTaskText(
      [
        task.raw_message,
        task.result_summary,
        task.error_summary,
        task.intent,
        task.target,
        task.metadata?.workflow_objective,
        task.metadata?.workflow_label,
        task.metadata?.summary,
      ]
        .filter(Boolean)
        .join(' '),
    );

    let score = this.isPendingTaskApproval(task) ? 4 : 0;
    if (String(task.status || '').trim() === 'waiting_approval') {
      score += 2;
    }
    for (const keyword of keywords) {
      if (haystack.includes(keyword)) {
        score += 3;
      }
    }
    return score;
  }

  private formatRecentTaskNextStepReply(task: Task): string {
    return [
      RecentTaskResolver.formatTaskStatus(task),
      '',
      `Next step: ${this.describeRecentTaskNextStep(task)}`,
    ].join('\n');
  }

  private describeRecentTaskNextStep(task: Task): string {
    const workflowRunId = String(task.metadata?.workflow_run_id || '').trim();

    if (this.isPendingTaskApproval(task)) {
      return `approve the task with /approve ${task.task_id} to allow execution.`;
    }

    if (workflowRunId) {
      return `resume the workflow with "continue the task" or /workflow resume ${workflowRunId}.`;
    }

    if (this.isUndoableTask(task)) {
      return `if you want to undo what it changed, use /undo ${task.task_id} or say "undo the last task".`;
    }

    if (StateMachine.isActive(String(task.status || '').trim() as Task['status'])) {
      return 'watch the run or ask for status again in a moment.';
    }

    if (StateMachine.canRetry(String(task.status || '').trim() as Task['status']) && this.canCanonicallyResumeTaskExecution(task)) {
      return 'this task can be redone as a new request, but the shared surface still avoids an implicit retry for this task id.';
    }

    return 'review the delivered summary and, if needed, open a new request from that context.';
  }

  private isUndoableTask(task: Task): boolean {
    return Boolean(task.rollback_available);
  }

  private isSurfaceRetryableTask(task: Task): boolean {
    const status = String(task.status || '').trim() as Task['status'];
    if (!status) {
      return false;
    }

    if (String(task.metadata?.workflow_run_id || '').trim() && this.isSurfaceResumableTask(task)) {
      return true;
    }

    return StateMachine.canRetry(status);
  }

  private isSurfaceResumableTask(task: Task): boolean {
    const status = String(task.status || '').trim() as Task['status'];
    if (!status || !StateMachine.canResume(status)) {
      return false;
    }
    if (this.isPendingTaskApproval(task)) {
      return true;
    }
    if (String(task.metadata?.workflow_run_id || '').trim()) {
      return true;
    }
    if (status === 'approved' || status === 'running') {
      return this.canCanonicallyResumeTaskExecution(task);
    }
    return false;
  }

  private canCanonicallyResumeTaskExecution(task: Task): boolean {
    return Boolean(
      task.executor_used ||
        task.metadata?.auto_route_executor ||
        task.metadata?.gateway_plan ||
        (Array.isArray(task.actions_planned) && task.actions_planned.length > 0) ||
        ['/run', '/dryrun', '/codex', '/external', '/gemini', '/aistudio', '/stitch', '/jules', '/ag', '/bridge'].includes(
          String(task.command_type || '').trim(),
        ),
    );
  }

  private async handleTaskResume(ctx: IMessageContext, task: Task): Promise<void> {
    const workflowRunId = String(task.metadata?.workflow_run_id || '').trim();
    const workflowStageId = String(
      task.metadata?.workflow_stage_id || task.metadata?.workflow_resume_stage_id || '',
    ).trim();
    if (workflowRunId) {
      const resumeArgs = ['resume', workflowRunId, workflowStageId].filter(Boolean).join(' ');
      await this.deps.workflowGovernanceCommandPack.maybeHandleCommand(ctx, '/workflow', resumeArgs);
      return;
    }

    if (this.isPendingTaskApproval(task)) {
      await ctx.reply(
        `${RecentTaskResolver.formatTaskStatus(task)}\n\nNext step: approve the task before asking to resume.`,
      );
      return;
    }

    if (!this.deps.taskExecutionController || !this.deps.taskManager?.advanceState) {
      await ctx.reply(
        `${RecentTaskResolver.formatTaskStatus(task)}\n\nThis runtime does not expose canonical task resume on the shared surface.`,
      );
      return;
    }

    if (!this.canCanonicallyResumeTaskExecution(task)) {
      await ctx.reply(
        `${RecentTaskResolver.formatTaskStatus(task)}\n\nThis task does not have enough canonical resume state for me to continue safely from here.`,
      );
      return;
    }

    if (String(task.status || '').trim() !== 'running') {
      this.deps.taskManager.advanceState(task, 'running', {
        actor: String(ctx.userId || '').trim() || null,
        reason: 'Retomada pedida via shared surface.',
      });
    }

    const surfaceCtx: SurfaceControllerContext = {
      userId: String(ctx.userId || '').trim() || undefined,
      chatId: ctx.chatId,
      platform: ctx.platform,
    };

    await this.deps.taskExecutionController.resumeTaskExecution(surfaceCtx, task);
  }

}
