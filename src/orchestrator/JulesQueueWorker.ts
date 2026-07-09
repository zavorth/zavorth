import { config } from '../config/index.js';
import { Task } from '../contracts/TaskContract.js';
import { JulesExecutor } from '../execution/JulesExecutor.js';
import { SmartOutputService } from '../services/SmartOutputService.js';
import { TaskManager } from './TaskManager.js';
import { asErrorLike } from '../utils/errorLike.js';

type BotApiLike = {
  sendMessage(chatId: string | number, text: string, options?: { parse_mode?: 'Markdown' | 'HTML' }): Promise<unknown>;
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
    } catch (error: unknown) {
      const err = asErrorLike(error);
      this.deps.log('error', 'JulesQueueWorker', err.message || 'Jules worker failed.');
    } finally {
      this.running = false;
    }
  }

  private async pollTask(task: Task): Promise<void> {
    const sessionId = String(task.metadata?.jules_session_id || '').trim();
    if (!sessionId) {
      task.error_summary = 'Jules task has no sessionId to track.';
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
      task.result_summary = String(session?.result?.summary || session?.summary || 'Jules session completed.').trim();
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
      task.error_summary = String(session?.error?.message || `Jules session ${state.toLowerCase()}.`).trim();
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
      task.error_summary = task.error_summary || 'Jules task has no chat_id for delivery.';
      task.metadata = this.withQueueUnlocked(task.metadata);
      this.deps.taskManager.saveTask(task);
      this.deps.taskManager.advanceState(task, 'failed');
      return;
    }

    const message = [
      'Jules completed the session.',
      `Short reference: ${task.task_id.substring(0, 8)}`,
      task.metadata?.jules_session_id ? `SessionId: ${task.metadata.jules_session_id}` : '',
      task.diff_summary ? `Diff: ${task.diff_summary}` : '',
      '',
      task.result_summary || 'No result.',
    ].filter(Boolean).join('\n');

    try {
      await SmartOutputService.send(this.deps.botApi, chatId, message, { parse_mode: 'Markdown' });
      task.metadata = {
        ...this.withQueueUnlocked(task.metadata),
        jules_delivered_at: new Date().toISOString(),
        jules_delivery_retries: Number(task.metadata?.jules_delivery_retries || 0) + (retryOnly ? 1 : 0),
      };
      this.deps.taskManager.saveTask(task);
      this.deps.taskManager.advanceState(task, 'completed');
    } catch (error: unknown) {
      const err = asErrorLike(error);
      task.metadata = {
        ...this.withQueueUnlocked(task.metadata),
        jules_delivery_retries: Number(task.metadata?.jules_delivery_retries || 0) + 1,
        jules_last_delivery_error: err.message || 'Failed to deliver Jules response.',
      };
      this.deps.taskManager.saveTask(task);
      if (task.status !== 'delivery_pending') {
        this.deps.taskManager.advanceState(task, 'delivery_pending');
      }
      this.deps.log('warn', 'JulesQueueWorker', 'Jules delivery pending due to Telegram failure.', {
        taskId: task.task_id,
        error: err.message || 'unknown',
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
        this.deps.botApi,
        chatId,
        [
          'Jules session failed.',
          `Short reference: ${task.task_id.substring(0, 8)}`,
          task.metadata?.jules_session_id ? `SessionId: ${task.metadata.jules_session_id}` : '',
          '',
          `Reason: ${task.error_summary || 'Unknown error.'}`,
        ].filter(Boolean).join('\n'),
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);
      this.deps.log('warn', 'JulesQueueWorker', 'Failed to deliver Jules error.', {
        taskId: task.task_id,
        error: err.message || 'unknown',
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
