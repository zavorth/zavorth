import { Context } from 'grammy';
import { Task } from '@zavorth/contracts/TaskContract.js';
import { TaskManager } from '../../../../orchestrator/TaskManager.js';
import { StateMachine } from '../../../../orchestrator/StateMachine.js';
import { ArtifactPipelineService } from '@zavorth/runtime/artifacts/ArtifactPipelineService.js';
import { SmartOutputService } from '@zavorth/services/SmartOutputService.js';

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
      await ctx.reply('Could not locate that task. Use /tasks to find the correct short ID or describe the inspection better.');
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
      await ctx.reply(`A tarefa ${task.task_id.substring(0, 8)} ainda nao registrou arquivos ou artefatos.`);
      return;
    }

    const lines = [
      `Arquivos e artefatos da tarefa ${task.task_id.substring(0, 8)}`,
      '',
    ];

    if (targetFiles.length > 0) {
      lines.push('*Arquivos-alvo*');
      lines.push(...targetFiles.map((file) => `- ${file}`));
      lines.push('');
    }

    if (artifactLines.length > 0) {
      lines.push('*Artefatos*');
      lines.push(
        `Total: ${artifactManifest.total} | imagens: ${artifactManifest.photos} | arquivos: ${artifactManifest.documents} | links: ${artifactManifest.links}`,
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
      task.diff_summary ||
      task.result_summary ||
      task.stdout_summary ||
      task.stderr_summary ||
      task.error_summary;

    if (!diffText) {
      await ctx.reply(`Task ${task.task_id.substring(0, 8)} has not recorded a diff or final summary yet.`);
      return;
    }

    await SmartOutputService.reply(
      ctx,
      `Diff/Summary for task ${task.task_id.substring(0, 8)}\n\n${diffText}`,
    );
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

    const candidates = [
      ...this.taskManager.getRecentTasks(25, userId),
      ...this.taskManager.getRecentTasks(25),
    ];

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
      pending: 'active', pendente: 'active', pendentes: 'active', active: 'active', ativo: 'active', ativos: 'active',
      approval: 'approval', approvals: 'approval', aprovacao: 'approval', aprovacoes: 'approval', waiting_approval: 'approval',
      failed: 'failed', falha: 'failed', falhas: 'failed', erro: 'failed', erros: 'failed',
      completed: 'completed', done: 'completed', concluidas: 'completed', concluida: 'completed', finalizadas: 'completed', finalizada: 'completed',
    };

    for (const token of tokens) {
      const mapped = FILTER_ALIASES[token];
      if (mapped) {
        filter = mapped;
        continue;
      }
      const numeric = Number.parseInt(token, 10);
      if (Number.isFinite(numeric)) {
        limit = Math.max(1, Math.min(numeric, 20));
      }
    }

    return { filter, limit };
  }

  private selectTasksForView(
    filter: TaskListFilter,
    recentTasks: Task[],
    activeTasks: Task[],
    limit: number,
  ): Task[] {
    switch (filter) {
      case 'active':
        return activeTasks.slice(0, limit);
      case 'approval':
        return activeTasks.filter((task) => task.status === 'waiting_approval' || task.approval_status === 'pending').slice(0, limit);
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
    const validating = activeTasks.filter((task) => task.status === 'validating' || task.status === 'delivery_pending').length;
    const completed = recentCounts.completed || 0;
    const failed = (recentCounts.failed || 0) + (recentCounts.rejected || 0) + (recentCounts.cancelled || 0);

    return [
      `Agora: ${activeTasks.length} ativas | ${waitingApproval} esperando voce | ${running} em execucao | ${validating} finalizando entrega`,
      `No recorte: ${completed} concluidas | ${failed} com falha ou rejeicao | ${recentTasks.length} listadas`,
    ].join('\n');
  }

  private getTaskListTitle(filter: TaskListFilter, count: number): string {
    switch (filter) {
      case 'active':
        return `Painel de tarefas ativas (${count})`;
      case 'approval':
        return `Painel de aprovacoes pendentes (${count})`;
      case 'failed':
        return `Painel de falhas recentes (${count})`;
      case 'completed':
        return `Painel de tarefas concluidas (${count})`;
      case 'recent':
      default:
        return `Painel de tarefas recentes (${count})`;
    }
  }

  private formatTaskEntry(task: Task): string {
    const detail =
      task.result_summary ||
      task.error_summary ||
      task.diff_summary ||
      task.stdout_summary ||
      task.intent ||
      'sem resumo';
    const actionHint = this.buildTaskActionHint(task);
    const lifecycle = task.metadata?.lifecycle;
    const activeFlag = lifecycle?.is_active || StateMachine.isActive(task.status) ? 'ativa' : 'finalizada';
    const statusLabel = this.describeTaskStatus(task.status);
    const commandLabel = this.describeTaskCommand(task.command_type);
    const executorLabel = task.executor_used ? this.describeExecutor(task.executor_used) : null;

    return [
      `- ${task.task_id.substring(0, 8)} | ${statusLabel} | ${commandLabel}`,
      `  ${this.truncateForTelegram(detail, 140) || 'sem detalhe'}`,
      `  contexto: ${executorLabel ? `${executorLabel} | ` : ''}${task.workspace || 'workspace nao informada'} | ${activeFlag}`,
      `  proximo passo: ${actionHint}`,
    ].join('\n');
  }

  private buildTaskActionHint(task: Task): string {
    if (task.status === 'waiting_approval') {
      return `/approve ${task.task_id}`;
    }

    if (task.status === 'failed') {
      return `/diff ${task.task_id.substring(0, 8)} ou repetir o pedido`;
    }

    if (task.status === 'completed' || task.status === 'reverted') {
      if (Array.isArray(task.artifacts) && task.artifacts.length > 0) {
        return `/files ${task.task_id.substring(0, 8)}`;
      }
      return `inspecionar com /files ${task.task_id.substring(0, 8)}`;
    }

    if (task.status === 'delivery_pending' || task.status === 'validating') {
      return 'aguarde a entrega final';
    }

    if (task.status === 'running') {
      return 'acompanhe a execucao ou volte em instantes';
    }

    return 'acompanhe com /tasks ou /files <id>';
  }

  private describeTaskStatus(status: string): string {
    switch (status) {
      case 'waiting_approval':
        return 'aguardando aprovacao';
      case 'running':
        return 'em execucao';
      case 'delivery_pending':
        return 'entregando';
      case 'validating':
        return 'validando';
      case 'completed':
        return 'concluida';
      case 'failed':
        return 'falhou';
      case 'rejected':
        return 'rejeitada';
      case 'reverted':
        return 'revertida';
      default:
        return status;
    }
  }

  private describeTaskCommand(commandType: string): string {
    switch (String(commandType || '').trim()) {
      case '/codex':
        return 'pedido de codigo';
      case '/external':
        return 'pedido ExternalExecutor';
      case '/gemini':
        return 'pedido Gemini';
      case '/aistudio':
        return 'pedido AI Studio';
      case '/stitch':
        return 'geracao visual';
      case '/ag':
      case '/bridge':
        return 'automacao ZavorthBridge';
      case '/workflow':
        return 'workflow composto';
      case '/task':
        return 'tarefa geral';
      case '/run':
        return 'execucao local';
      default:
        return commandType || 'tarefa';
    }
  }

  private describeExecutor(executor: string): string {
    switch (String(executor || '').trim().toLowerCase()) {
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
        return 'pesquisa web';
      case 'local':
      case 'local_executor':
        return 'shell local';
      default:
        return executor;
    }
  }
}
