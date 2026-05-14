import { config } from '../config/index.js';
import { Task } from '../contracts/TaskContract.js';
import { DeepSearchService } from '../services/DeepSearchService.js';
import { SmartOutputService } from '../services/SmartOutputService.js';
import { TaskManager } from './TaskManager.js';

type BotApiLike = {
  sendMessage: (...args: any[]) => Promise<any>;
};

type WorkerDeps = {
  taskManager: TaskManager;
  deepSearchService: DeepSearchService;
  botApi: BotApiLike;
  log: (level: 'info' | 'warn' | 'error', category: string, message: string, metadata?: Record<string, any>) => void;
};

export class ResearchQueueWorker {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private deps: WorkerDeps) {}

  public start(): void {
    if (!config.asyncQueueEnabled || this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, Math.max(1_000, config.asyncQueuePollIntervalMs));
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
        ['/research', '/deepresearch'],
        ['pending', 'delivery_pending'],
        config.asyncQueueWorkerId,
        config.asyncQueueLockTimeoutMs,
      );
      if (!task) {
        return;
      }

      if (task.status === 'delivery_pending' && task.result_summary) {
        await this.deliver(task, true);
        return;
      }

      await this.execute(task);
    } catch (error: any) {
      this.deps.log('error', 'ResearchQueueWorker', error.message || 'Falha no worker de pesquisa.');
    } finally {
      this.running = false;
    }
  }

  private async execute(task: Task): Promise<void> {
    try {
      if (task.status === 'pending') {
        this.deps.taskManager.advanceState(task, 'parsed');
      }
      this.deps.taskManager.advanceState(task, 'running');

      const query = String(task.metadata?.research_query || task.normalized_message || '').trim();
      const deep = task.command_type === '/deepresearch';
      const result = deep
        ? await this.deps.deepSearchService.deepResearch(query)
        : await this.deps.deepSearchService.research(query);

      task.result_summary = result;
      task.error_summary = null;
      task.metadata = {
        ...(task.metadata || {}),
        queue_lock: null,
        async_queue: {
          ...(task.metadata?.async_queue || {}),
          executed_at: new Date().toISOString(),
          worker_id: config.asyncQueueWorkerId,
        },
      };
      this.deps.taskManager.saveTask(task);
      this.deps.taskManager.advanceState(task, 'delivery_pending');
      await this.deliver(task, false);
    } catch (error: any) {
      task.error_summary = error.message || 'Falha ao executar a pesquisa enfileirada.';
      task.metadata = {
        ...(task.metadata || {}),
        queue_lock: null,
        async_queue: {
          ...(task.metadata?.async_queue || {}),
          failed_at: new Date().toISOString(),
          worker_id: config.asyncQueueWorkerId,
        },
      };
      this.deps.taskManager.saveTask(task);
      this.deps.taskManager.advanceState(task, 'failed');
      await this.deliverFailure(task);
    }
  }

  private async deliver(task: Task, retryOnly: boolean): Promise<void> {
    const chatId = String(task.chat_id || '').trim();
    if (!chatId) {
      task.error_summary = task.error_summary || 'Task de pesquisa sem chat_id para entrega.';
      this.deps.taskManager.saveTask(task);
      this.deps.taskManager.advanceState(task, 'failed');
      return;
    }

    const message = [
      `${task.command_type === '/deepresearch' ? 'Deep Research' : 'Pesquisa'} concluida.`,
      `Referencia curta: ${task.task_id.substring(0, 8)}`,
      '',
      task.result_summary || 'Sem resultado.',
    ].join('\n');

    try {
      await SmartOutputService.send(this.deps.botApi as any, chatId, message, { parse_mode: 'Markdown' });
      task.metadata = {
        ...(task.metadata || {}),
        queue_lock: null,
        async_queue: {
          ...(task.metadata?.async_queue || {}),
          delivered_at: new Date().toISOString(),
          delivery_retries: Number(task.metadata?.async_queue?.delivery_retries || 0) + (retryOnly ? 1 : 0),
        },
      };
      this.deps.taskManager.saveTask(task);
      this.deps.taskManager.advanceState(task, 'completed');
    } catch (error: any) {
      task.metadata = {
        ...(task.metadata || {}),
        async_queue: {
          ...(task.metadata?.async_queue || {}),
          delivery_retries: Number(task.metadata?.async_queue?.delivery_retries || 0) + 1,
          last_delivery_error: error.message || 'Falha ao entregar resposta.',
        },
      };
      this.deps.taskManager.saveTask(task);
      if (task.status !== 'delivery_pending') {
        this.deps.taskManager.advanceState(task, 'delivery_pending');
      }
      this.deps.log('warn', 'ResearchQueueWorker', 'Entrega pendente por falha no Telegram.', {
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
        `Pesquisa falhou.\nReferencia curta: ${task.task_id.substring(0, 8)}\n\nMotivo: ${task.error_summary || 'Erro desconhecido.'}`,
      );
    } catch (error: any) {
      this.deps.log('warn', 'ResearchQueueWorker', 'Falha ao entregar erro da pesquisa.', {
        taskId: task.task_id,
        error: error.message || 'unknown',
      });
    }
  }
}
