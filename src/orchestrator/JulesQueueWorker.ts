import { config } from '../config/index.js';
import { Task } from '../contracts/TaskContract.js';
import { JulesExecutor } from '../execution/JulesExecutor.js';
import { SmartOutputService } from '../services/SmartOutputService.js';
import { TaskManager } from './TaskManager.js';

type BotApiLike = {
  sendMessage: (...args: any[]) => Promise<any>;
};

type JulesClientLike = {
  inspectSession: (sessionId: string) => Promise<any>;
};

type WorkerDeps = {
  taskManager: TaskManager;
  botApi: BotApiLike;
  log: (level: 'info' | 'warn' | 'error', category: string, message: string, metadata?: Record<string, any>) => void;
  julesClient?: JulesClientLike;
};

export class JulesQueueWorker {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private readonly client: JulesClientLike;

  constructor(private deps: WorkerDeps) {
    this.client = deps.julesClient || new JulesExecutor();
  }

  public start(): void {
    if (!config.asyncQueueEnabled || this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, Math.max(2_000, config.asyncQueuePollIntervalMs));
    void this.tick();
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;

    try {
      const task = this.deps.taskManager.claimNextTaskByCommands(
        ['/jules'],
        ['waiting_approval', 'running', 'delivery_pending'],
        `${config.asyncQueueWorkerId}-jules`,
        config.asyncQueueLockTimeoutMs,
      );
      if (!task) {
        return;
      }

      if (task.status === 'delivery_pending' && task.result_summary) {
        await this.deliver(task, true);
        return;
      }

      await this.pollTask(task);
    } catch (error: any) {
      this.deps.log('error', 'JulesQueueWorker', error.message || 'Falha no worker do Jules.');
    } finally {
      this.running = false;
    }
  }

  private async pollTask(task: Task): Promise<void> {
    const sessionId = String(task.metadata?.jules_session_id || '').trim();
    if (!sessionId) {
      task.error_summary = 'Task Jules sem sessionId para acompanhamento.';
      task.metadata = this.withQueueUnlocked(task.metadata);
      this.deps.taskManager.saveTask(task);
      this.deps.taskManager.advanceState(task, 'failed');
      await this.deliverFailure(task);
      return;
    }

    const session = await this.client.inspectSession(sessionId);
    const state = String(session?.state || session?.status || '').trim().toUpperCase();

    task.metadata = {
      ...this.withQueueUnlocked(task.metadata),
      jules_session_id: sessionId,
      jules_last_state: state || 'UNKNOWN',
      jules_last_polled_at: new Date().toISOString(),
      jules_pending: false,
      jules_requires_approval: false,
    };

    if (state === 'COMPLETED' || state === 'SUCCEEDED') {
      task.result_summary = String(session?.result?.summary || session?.summary || 'Sessao Jules concluida.').trim();
      task.diff_summary = String(session?.result?.diffUrl || session?.diffUrl || '').trim() || null;

      if (task.status === 'waiting_approval') {
        this.deps.taskManager.advanceState(task, 'running');
      }
      this.deps.taskManager.saveTask(task);
      if (task.status !== 'delivery_pending') {
        this.deps.taskManager.advanceState(task, 'delivery_pending');
      }
      await this.deliver(task, false);
      return;
    }

    if (state === 'FAILED' || state === 'CANCELLED') {
      task.error_summary = String(session?.error?.message || `Sessao Jules ${state.toLowerCase()}.`).trim();
      this.deps.taskManager.saveTask(task);
      this.deps.taskManager.advanceState(task, 'failed');
      await this.deliverFailure(task);
      return;
    }

    if (state === 'AWAITING_USER_INPUT' || state === 'PLAN_REVIEW') {
      task.metadata = {
        ...task.metadata,
        jules_requires_approval: true,
      };
      this.deps.taskManager.saveTask(task);
      if (task.status !== 'waiting_approval') {
        this.deps.taskManager.advanceState(task, 'waiting_approval');
      }
      return;
    }

    task.metadata = {
      ...task.metadata,
      jules_pending: true,
    };
    this.deps.taskManager.saveTask(task);
    if (task.status === 'waiting_approval') {
      this.deps.taskManager.advanceState(task, 'running');
    }
  }

  private async deliver(task: Task, retryOnly: boolean): Promise<void> {
    const chatId = String(task.chat_id || '').trim();
    if (!chatId) {
      task.error_summary = task.error_summary || 'Task Jules sem chat_id para entrega.';
      task.metadata = this.withQueueUnlocked(task.metadata);
      this.deps.taskManager.saveTask(task);
      this.deps.taskManager.advanceState(task, 'failed');
      return;
    }

    const message = [
      'Jules concluiu a sessao.',
      `Referencia curta: ${task.task_id.substring(0, 8)}`,
      task.metadata?.jules_session_id ? `SessionId: ${task.metadata.jules_session_id}` : '',
      task.diff_summary ? `Diff: ${task.diff_summary}` : '',
      '',
      task.result_summary || 'Sem resultado.',
    ].filter(Boolean).join('\n');

    try {
      await SmartOutputService.send(this.deps.botApi as any, chatId, message, { parse_mode: 'Markdown' });
      task.metadata = {
        ...this.withQueueUnlocked(task.metadata),
        jules_delivered_at: new Date().toISOString(),
        jules_delivery_retries: Number(task.metadata?.jules_delivery_retries || 0) + (retryOnly ? 1 : 0),
      };
      this.deps.taskManager.saveTask(task);
      this.deps.taskManager.advanceState(task, 'completed');
    } catch (error: any) {
      task.metadata = {
        ...this.withQueueUnlocked(task.metadata),
        jules_delivery_retries: Number(task.metadata?.jules_delivery_retries || 0) + 1,
        jules_last_delivery_error: error.message || 'Falha ao entregar resposta do Jules.',
      };
      this.deps.taskManager.saveTask(task);
      if (task.status !== 'delivery_pending') {
        this.deps.taskManager.advanceState(task, 'delivery_pending');
      }
      this.deps.log('warn', 'JulesQueueWorker', 'Entrega do Jules pendente por falha no Telegram.', {
        taskId: task.task_id,
        error: error.message || 'unknown',
      });
    }
  }

  private async deliverFailure(task: Task): Promise<void> {
    const chatId = String(task.chat_id || '').trim();
    if (!chatId) {
      return;
    }

    try {
      await SmartOutputService.send(
        this.deps.botApi as any,
        chatId,
        [
          'Sessao Jules falhou.',
          `Referencia curta: ${task.task_id.substring(0, 8)}`,
          task.metadata?.jules_session_id ? `SessionId: ${task.metadata.jules_session_id}` : '',
          '',
          `Motivo: ${task.error_summary || 'Erro desconhecido.'}`,
        ].filter(Boolean).join('\n'),
      );
    } catch (error: any) {
      this.deps.log('warn', 'JulesQueueWorker', 'Falha ao entregar erro do Jules.', {
        taskId: task.task_id,
        error: error.message || 'unknown',
      });
    }
  }

  private withQueueUnlocked(metadata: Record<string, any> | undefined): Record<string, any> {
    return {
      ...(metadata || {}),
      queue_lock: null,
    };
  }
}
