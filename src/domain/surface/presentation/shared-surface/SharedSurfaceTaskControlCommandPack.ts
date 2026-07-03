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
  parseNaturalRecentTaskFollowupIntent,
  parseNaturalTaskApprovalIntent,
  parseNaturalTaskControlIntent,
  type NaturalRecentTaskFollowupIntent,
  type NaturalTaskApprovalIntent,
  type NaturalTaskControlIntent,
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

  public async maybeHandleNaturalTaskApproval(ctx: IMessageContext, rawText: string): Promise<boolean> {
    const intent =
      !String(rawText || '').trim().startsWith('/')
        ? parseNaturalTaskApprovalIntent(rawText)
        : null;
    if (!intent) {
      return false;
    }

    await this.handleNaturalTaskApprovalIntent(ctx, intent);
    return true;
  }

  public async maybeHandleNaturalTaskControl(ctx: IMessageContext, rawText: string): Promise<boolean> {
    const intent =
      !String(rawText || '').trim().startsWith('/')
        ? parseNaturalTaskControlIntent(rawText)
        : null;
    if (!intent) {
      return false;
    }

    await this.handleNaturalTaskControlIntent(ctx, intent);
    return true;
  }

  public async maybeHandleNaturalRecentTaskFollowup(ctx: IMessageContext, rawText: string): Promise<boolean> {
    const intent =
      !String(rawText || '').trim().startsWith('/')
        ? parseNaturalRecentTaskFollowupIntent(rawText)
        : null;
    if (!intent) {
      return false;
    }

    await this.handleNaturalRecentTaskFollowupIntent(ctx, intent);
    return true;
  }

  public async handleTaskApprovalCommand(ctx: IMessageContext, args: string): Promise<void> {
    if (!this.deps.taskApprovalController) {
      await ctx.reply('Task approval indisponivel nesta surface compartilhada.');
      return;
    }

    const surfaceCtx: SurfaceControllerContext = {
      userId: String(ctx.userId || '').trim() || undefined,
      chatId: ctx.chatId,
      platform: ctx.platform,
    };

    try {
      await this.deps.taskApprovalController.handleApproval(surfaceCtx, args);
    } catch (error: unknown) {
      await ctx.reply(
        `Nao consegui aprovar essa tarefa agora.\n\nMotivo: ${getErrorMessage(error)}`,
      );
    }
  }

  public async handleTaskRejectionCommand(ctx: IMessageContext, args: string): Promise<void> {
    if (!this.deps.taskApprovalController) {
      await ctx.reply('Task approval indisponivel nesta surface compartilhada.');
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
    } catch (error: unknown) {
      await ctx.reply(
        `Nao consegui rejeitar essa tarefa agora.\n\nMotivo: ${getErrorMessage(error)}`,
      );
    }
  }

  public async handleTaskUndoCommand(ctx: IMessageContext, args: string): Promise<void> {
    if (!this.deps.taskExecutionController) {
      await ctx.reply('Undo de tarefa indisponivel nesta surface compartilhada.');
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
        'Nao encontrei uma tarefa recente com rollback disponivel. Use /undo <task_id> se quiser ser mais explicito.',
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
    } catch (error: unknown) {
      await ctx.reply(
        `Nao consegui desfazer essa tarefa agora.\n\nMotivo: ${getErrorMessage(error)}`,
      );
    }
  }

  private async handleNaturalTaskApprovalIntent(
    ctx: IMessageContext,
    intent: NaturalTaskApprovalIntent,
  ): Promise<void> {
    await ctx.reply(intent.intro);
    const taskId =
      intent.taskId ||
      (intent.resolveRecent
        ? this.resolveRecentTaskApprovalId(ctx, intent.resolveRecent.keywords)
        : null);
    if (!taskId) {
      await ctx.reply(
        'Nao encontrei uma tarefa recente com approval pendente para essa referencia. Use /approve <task_id> ou /reject <task_id> se quiser ser mais explicito.',
      );
      return;
    }

    if (intent.command === 'approve') {
      await this.handleTaskApprovalCommand(ctx, taskId);
      return;
    }
    await this.handleTaskRejectionCommand(ctx, taskId);
  }

  private async handleNaturalTaskControlIntent(
    ctx: IMessageContext,
    intent: NaturalTaskControlIntent,
  ): Promise<void> {
    await ctx.reply(intent.intro);
    const task =
      (intent.taskId ? this.resolveTaskReference(intent.taskId, ctx) : null) ||
      (intent.resolveRecent
        ? this.resolveRecentTaskControl(ctx, intent.action, intent.resolveRecent.keywords)
        : null);
    if (!task) {
      const actionLabel = intent.action === 'resume' ? 'retomada' : 'rollback';
      await ctx.reply(
        `Nao encontrei uma tarefa recente com ${actionLabel} disponivel para essa referencia.`,
      );
      return;
    }

    if (intent.action === 'undo') {
      await this.handleTaskUndoCommand(ctx, task.task_id);
      return;
    }

    if (intent.action === 'retry') {
      await this.handleTaskRetry(ctx, task);
      return;
    }

    await this.handleTaskResume(ctx, task);
  }

  private async handleNaturalRecentTaskFollowupIntent(
    ctx: IMessageContext,
    intent: NaturalRecentTaskFollowupIntent,
  ): Promise<void> {
    await ctx.reply(intent.intro);
    const task = this.resolveRecentTaskReference(ctx, intent.keywords);
    if (!task) {
      await ctx.reply('Nao encontrei nenhuma tarefa recente sua para correlacionar com essa pergunta.');
      return;
    }

    if (intent.kind === 'next') {
      await ctx.reply(this.formatRecentTaskNextStepReply(task));
      return;
    }

    await ctx.reply(RecentTaskResolver.formatTaskStatus(task));
  }

  public extractRecentTaskContextKeywords(rawText: string): string[] {
    return extractRecentTaskContextKeywords(rawText);
  }

  private async handleTaskRetry(ctx: IMessageContext, task: Task): Promise<void> {
    const workflowRunId = String(task.metadata?.workflow_run_id || '').trim();
    if (workflowRunId && this.isSurfaceResumableTask(task)) {
      await ctx.reply(
        'Essa tarefa ainda esta ligada a um workflow com retomada canonica. Vou retomar o workflow em vez de abrir uma copia nova.',
      );
      await this.handleTaskResume(ctx, task);
      return;
    }

    if (!StateMachine.canRetry(String(task.status || '').trim() as Task['status'])) {
      await ctx.reply(
        `${RecentTaskResolver.formatTaskStatus(task)}\n\nEssa tarefa nao esta em um estado que eu possa reabrir com seguranca como retry.`,
      );
      return;
    }

    if (!this.deps.surfaceTaskDispatcher) {
      await ctx.reply(
        `${RecentTaskResolver.formatTaskStatus(task)}\n\nEste runtime nao expoe o dispatcher canonico para reabrir a tarefa como um novo pedido.`,
      );
      return;
    }

    const originalText = String(task.raw_message || task.normalized_message || '').trim();
    if (!originalText) {
      await ctx.reply('Nao encontrei o pedido original dessa tarefa para abrir um retry canonico.');
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
        'Reabri esse pedido como uma nova tarefa canonica.',
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
      `Proximo passo: ${this.describeRecentTaskNextStep(task)}`,
    ].join('\n');
  }

  private describeRecentTaskNextStep(task: Task): string {
    const workflowRunId = String(task.metadata?.workflow_run_id || '').trim();

    if (this.isPendingTaskApproval(task)) {
      return `aprovar a tarefa com /approve ${task.task_id} para liberar a execucao.`;
    }

    if (workflowRunId) {
      return `retomar o workflow com "continue a tarefa" ou /workflow resume ${workflowRunId}.`;
    }

    if (this.isUndoableTask(task)) {
      return `se quiser desfazer o que ela alterou, use /undo ${task.task_id} ou diga "desfaca a ultima tarefa".`;
    }

    if (StateMachine.isActive(String(task.status || '').trim() as Task['status'])) {
      return 'acompanhar a execucao ou pedir status novamente em alguns instantes.';
    }

    if (StateMachine.canRetry(String(task.status || '').trim() as Task['status']) && this.canCanonicallyResumeTaskExecution(task)) {
      return 'essa tarefa pode ser refeita como um novo pedido, mas a shared surface ainda evita retry implicito desse task id.';
    }

    return 'revisar o resumo entregue e, se necessario, abrir um novo pedido a partir desse contexto.';
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
        `${RecentTaskResolver.formatTaskStatus(task)}\n\nProximo passo: aprove a tarefa antes de pedir retomada.`,
      );
      return;
    }

    if (!this.deps.taskExecutionController || !this.deps.taskManager?.advanceState) {
      await ctx.reply(
        `${RecentTaskResolver.formatTaskStatus(task)}\n\nEste runtime nao expoe retomada canonica de tarefa pela shared surface.`,
      );
      return;
    }

    if (!this.canCanonicallyResumeTaskExecution(task)) {
      await ctx.reply(
        `${RecentTaskResolver.formatTaskStatus(task)}\n\nEssa tarefa nao tem retomada canonica suficiente para eu continuar daqui com seguranca.`,
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
