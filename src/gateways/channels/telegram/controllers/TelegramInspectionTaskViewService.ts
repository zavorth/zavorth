import { Context } from 'grammy';
import { Task } from '@zavorth/contracts/TaskContract.js';
import { TaskManager } from '../../../../orchestrator/TaskManager.js';
import { StateMachine } from '../../../../orchestrator/StateMachine.js';
import { ArtifactPipelineService } from '@zavorth/runtime/artifacts/ArtifactPipelineService.js';
import { SmartOutputService } from '@zavorth/services/SmartOutputService.js';
import { safeParseInt } from '../../../../ai-gateway/shared/utils/safeParseInt.js';

type TaskListFilter = 'recent' | 'active' | 'approval' | 'failed' | 'completed';

export class TelegramInspectionTaskViewService {
  private readonly artifactPipeline = new ArtifactPipelineService();

  constructor(private readonly taskManager: TaskManager) {}

  public async handleTasks(ctx: Context, args: string, userId: string): Promise<void> {
    const parsed = this.parseTaskListArgs(args);
    const recentTasks = this.taskManager.getRecentTasks(Math.max(parsed.limit, 20), userId);
    const activeTasks = this.taskManager.getPendingTasks().filter((task) => task.user_id === userId);
    const tasks = this.selectTasksForView(parsed.filter, recentTasks, activeTasks, parsed.limit);

    if (tasks.length === 0) {
      await ctx.reply(
        parsed.filter === 'active' || parsed.filter === 'approval'
          ? 'No active tasks from you in this period.'
          : parsed.filter === 'failed'
            ? 'No recent failures from you in this period.'
            : parsed.filter === 'completed'
              ? 'No recently completed tasks from you in this period.'
              : 'No recent tasks found for this user yet.',
      );
      return;
    }

    const summary = this.buildTaskSummary(recentTasks, activeTasks);
    const lines = tasks.map((task) => this.formatTaskEntry(task));

    await SmartOutputService.reply(
      ctx,
      [
        this.getTaskListTitle(parsed.filter, tasks.length),
        '',
        summary,
        '',
        ...lines,
        '',
        'Useful shortcuts: /tasks active | /tasks approval | /tasks failed | /tasks completed | /files <id> | /diff <id>',
      ].join('\n'),
    );
  }

  public async handleTaskFiles(ctx: Context, args: string, userId: string): Promise<Task | null> {
    const task = this.resolveTaskReference(String(args || '').trim(), userId);
    if (!task) {
      await ctx.reply(
        'Could not locate that task. Use /tasks to find the correct short ID or describe the inspection better.',
      );
      return null;
    }

    await this.renderTaskFiles(ctx, task);
    return task;
  }

  public async renderTaskFiles(ctx: Context, task: Task): Promise<void> {
    const targetFiles = Array.isArray(task.target_files) ? task.target_files : [];
    const normalizedArtifacts = this.artifactPipeline.normalizeArtifacts(
      Array.isArray(task.artifacts) ? task.artifacts : [],
      task.executor_used || String(task.command_type || '').replace(/^\//, '') || 'executor',
    );
    const artifactManifest = this.artifactPipeline.buildManifest(normalizedArtifacts, {
      traceId: task.metadata?.traceId || task.metadata?.trace_id || null,
      runId: task.metadata?.runId || task.metadata?.run_id || task.task_id,
      sessionId: task.metadata?.sessionId || task.metadata?.session_id || task.chat_id || null,
      taskId: task.task_id,
      surface: task.source,
      source: task.executor_used || 'telegram-inspection',
    });
    const artifactLines = normalizedArtifacts
      .map((artifact) => this.artifactPipeline.formatArtifactLine(artifact))
      .filter(Boolean);

    if (targetFiles.length === 0 && artifactLines.length === 0) {
      await ctx.reply(`Task ${task.task_id.substring(0, 8)} has not recorded files or artifacts yet.`);
      return;
    }

    const lines = [`Files and artifacts for task ${task.task_id.substring(0, 8)}`, ''];

    if (targetFiles.length > 0) {
      lines.push('*Target files*');
      lines.push(...targetFiles.map((file) => `- ${file}`));
      lines.push('');
    }

    if (artifactLines.length > 0) {
      lines.push('*Artifacts*');
      lines.push(
        `Total: ${artifactManifest.total} | images: ${artifactManifest.photos} | files: ${artifactManifest.documents} | links: ${artifactManifest.links}`,
      );
      lines.push(...artifactLines.map((artifact) => `- ${artifact}`));
    }

    await SmartOutputService.reply(ctx, lines.join('\n'), { parse_mode: 'Markdown' });
  }

  public async handleTaskDiff(ctx: Context, args: string, userId: string): Promise<void> {
    const task = this.resolveTaskReference(String(args || '').trim(), userId);
    if (!task) {
      await ctx.reply('Could not locate that task. Use /tasks to get the correct ID and try /diff <id>.');
      return;
    }

    const diffText =
      task.diff_summary || task.result_summary || task.stdout_summary || task.stderr_summary || task.error_summary;

    if (!diffText) {
      await ctx.reply(`Task ${task.task_id.substring(0, 8)} has not recorded a diff or final summary yet.`);
      return;
    }

    await SmartOutputService.reply(ctx, `Diff/Summary for task ${task.task_id.substring(0, 8)}\n\n${diffText}`);
  }

  public resolveTaskReference(taskRef: string, userId: string): Task | undefined {
    const normalized = String(taskRef || '').trim();
    if (!normalized) {
      return this.taskManager.getRecentTasks(1, userId)[0];
    }

    const exact = this.taskManager.getTask(normalized);
    if (exact) {
      return exact;
    }

    const candidates = [...this.taskManager.getRecentTasks(25, userId), ...this.taskManager.getRecentTasks(25)];

    return candidates.find((task) => task.task_id.startsWith(normalized));
  }

  private truncateForTelegram(content: string, maxLength: number): string {
    const text = String(content || '').trim();
    if (text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, maxLength)}\n[...]`;
  }

  private parseTaskListArgs(args: string): { filter: TaskListFilter; limit: number } {
    const tokens = String(args || '')
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    let filter: TaskListFilter = 'recent';
    let limit = 8;

    const FILTER_ALIASES: Record<string, TaskListFilter> = {
      pending: 'active',
      pendente: 'active',
      pendentes: 'active',
      active: 'active',
      ativo: 'active',
      ativos: 'active',
      approval: 'approval',
      approvals: 'approval',
      aprovacao: 'approval',
      aprovacoes: 'approval',
      waiting_approval: 'approval',
      failed: 'failed',
      falha: 'failed',
      falhas: 'failed',
      erro: 'failed',
      erros: 'failed',
      completed: 'completed',
      done: 'completed',
      finished: 'completed',
    };

    for (const token of tokens) {
      const mapped = FILTER_ALIASES[token];
      if (mapped) {
        filter = mapped;
        continue;
      }
      const numeric = safeParseInt(token, 0);
      if (numeric > 0) {
        limit = Math.max(1, Math.min(numeric, 20));
      }
    }

    return { filter, limit };
  }

  private selectTasksForView(filter: TaskListFilter, recentTasks: Task[], activeTasks: Task[], limit: number): Task[] {
    switch (filter) {
      case 'active':
        return activeTasks.slice(0, limit);
      case 'approval':
        return activeTasks
          .filter((task) => task.status === 'waiting_approval' || task.approval_status === 'pending')
          .slice(0, limit);
      case 'failed':
        return recentTasks.filter((task) => ['failed', 'rejected', 'cancelled'].includes(task.status)).slice(0, limit);
      case 'completed':
        return recentTasks.filter((task) => ['completed', 'reverted'].includes(task.status)).slice(0, limit);
      case 'recent':
      default:
        return recentTasks.slice(0, limit);
    }
  }

  private buildTaskSummary(recentTasks: Task[], activeTasks: Task[]): string {
    const recentCounts = recentTasks.reduce<Record<string, number>>((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {});
    const waitingApproval = activeTasks.filter((task) => task.status === 'waiting_approval').length;
    const running = activeTasks.filter((task) => task.status === 'running').length;
    const validating = activeTasks.filter(
      (task) => task.status === 'validating' || task.status === 'delivery_pending',
    ).length;
    const completed = recentCounts.completed || 0;
    const failed = (recentCounts.failed || 0) + (recentCounts.rejected || 0) + (recentCounts.cancelled || 0);

    return [
      `Now: ${activeTasks.length} active | ${waitingApproval} waiting for you | ${running} running | ${validating} finishing delivery`,
      `In scope: ${completed} completed | ${failed} failed or rejected | ${recentTasks.length} listed`,
    ].join('\n');
  }

  private getTaskListTitle(filter: TaskListFilter, count: number): string {
    switch (filter) {
      case 'active':
        return `Active tasks panel (${count})`;
      case 'approval':
        return `Pending approvals panel (${count})`;
      case 'failed':
        return `Recent failures panel (${count})`;
      case 'completed':
        return `Completed tasks panel (${count})`;
      case 'recent':
      default:
        return `Recent tasks panel (${count})`;
    }
  }

  private formatTaskEntry(task: Task): string {
    const detail =
      task.result_summary ||
      task.error_summary ||
      task.diff_summary ||
      task.stdout_summary ||
      task.intent ||
      'no summary';
    const actionHint = this.buildTaskActionHint(task);
    const lifecycle = task.metadata?.lifecycle;
    const activeFlag = lifecycle?.is_active || StateMachine.isActive(task.status) ? 'active' : 'finished';
    const statusLabel = this.describeTaskStatus(task.status);
    const commandLabel = this.describeTaskCommand(task.command_type);
    const executorLabel = task.executor_used ? this.describeExecutor(task.executor_used) : null;

    return [
      `- ${task.task_id.substring(0, 8)} | ${statusLabel} | ${commandLabel}`,
      `  ${this.truncateForTelegram(detail, 140) || 'no detail'}`,
      `  context: ${executorLabel ? `${executorLabel} | ` : ''}${task.workspace || 'workspace not provided'} | ${activeFlag}`,
      `  next step: ${actionHint}`,
    ].join('\n');
  }

  private buildTaskActionHint(task: Task): string {
    if (task.status === 'waiting_approval') {
      return '/approve (or /approve 1 if several)';
    }

    if (task.status === 'failed') {
      return `/diff ${task.task_id.substring(0, 8)} or repeat the request`;
    }

    if (task.status === 'completed' || task.status === 'reverted') {
      if (Array.isArray(task.artifacts) && task.artifacts.length > 0) {
        return `/files ${task.task_id.substring(0, 8)}`;
      }
      return `inspect with /files ${task.task_id.substring(0, 8)}`;
    }

    if (task.status === 'delivery_pending' || task.status === 'validating') {
      return 'wait for the final delivery';
    }

    if (task.status === 'running') {
      return 'watch the execution or check again shortly';
    }

    return 'track with /tasks or /files <id>';
  }

  private describeTaskStatus(status: string): string {
    switch (status) {
      case 'waiting_approval':
        return 'waiting for approval';
      case 'running':
        return 'running';
      case 'delivery_pending':
        return 'delivering';
      case 'validating':
        return 'validating';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'rejected':
        return 'rejected';
      case 'reverted':
        return 'reverted';
      default:
        return status;
    }
  }

  private describeTaskCommand(commandType: string): string {
    switch (String(commandType || '').trim()) {
      case '/codex':
        return 'code request';
      case '/external':
        return 'ExternalExecutor request';
      case '/gemini':
        return 'Gemini request';
      case '/aistudio':
        return 'AI Studio request';
      case '/stitch':
        return 'visual generation';
      case '/ag':
      case '/bridge':
        return 'ZavorthBridge automation';
      case '/workflow':
        return 'composed workflow';
      case '/task':
        return 'general task';
      case '/run':
        return 'local execution';
      default:
        return commandType || 'task';
    }
  }

  private describeExecutor(executor: string): string {
    switch (
      String(executor || '')
        .trim()
        .toLowerCase()
    ) {
      case 'codex':
        return 'Codex';
      case 'external_executor':
        return 'ExternalExecutor';
      case 'gemini_cli':
      case 'gemini':
        return 'Gemini';
      case 'aistudio':
        return 'AI Studio';
      case 'stitch':
        return 'Stitch';
      case 'zavorthBridge':
        return 'ZavorthBridge';
      case 'web_research':
        return 'web research';
      case 'local':
      case 'local_executor':
        return 'local shell';
      default:
        return executor;
    }
  }
}
