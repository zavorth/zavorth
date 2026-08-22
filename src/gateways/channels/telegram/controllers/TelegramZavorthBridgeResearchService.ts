import { Context } from 'grammy';
import { Task } from '../../../../contracts/TaskContract.js';
import { TaskManager } from '../../../../orchestrator/TaskManager.js';
import { SmartOutputService } from '../../../../services/SmartOutputService.js';
import { asErrorLike } from '../../../../utils/errorLike.js';

type BotApiLike = {
  sendMessage(chatId: string | number, text: string, other?: Record<string, unknown>): Promise<unknown>;
};

type TelegramZavorthBridgeResearchServiceDeps = {
  taskManager: Pick<TaskManager, 'advanceState'>;
  botApi: BotApiLike;
  persistTask: (task: Task) => void;
  truncateForTelegram: (content: string, maxLength: number) => string;
  runResearchFallback?: (query: string) => Promise<string>;
};

export class TelegramZavorthBridgeResearchService {
  constructor(private readonly deps: TelegramZavorthBridgeResearchServiceDeps) {}

  public async tryResearchFallback(
    ctx: Context,
    task: Task,
    prompt: string,
    error: unknown,
  ): Promise<boolean> {
    if (!this.isDirectChatUnavailableError(error)) {
      return false;
    }

    if (!this.deps.runResearchFallback || !this.shouldUseResearchCapability(task)) {
      return false;
    }

    return this.runResearchFallbackFlow(
      ctx,
      task,
      prompt,
      'The real ZavorthBridge did not open a reliable conversation to answer in chat. I will use Zavorth web research so you still get a response.',
      error instanceof Error ? error : new Error(String(error)),
    );
  }

  public async tryDirectResearchRoute(ctx: Context, task: Task, prompt: string): Promise<boolean> {
    if (!this.deps.runResearchFallback || !this.shouldUseResearchCapability(task)) {
      return false;
    }

    return this.runResearchFallbackFlow(
      ctx,
      task,
      prompt,
      'This request looks like web research. I will answer through Zavorth structured web route instead of opening ZavorthBridge.',
    );
  }

  private async runResearchFallbackFlow(
    ctx: Context,
    task: Task,
    prompt: string,
    introMessage: string,
    zavorthBridgeError?: Error | null,
  ): Promise<boolean> {
    await ctx.reply(introMessage);

    try {
      const resultText = await this.deps.runResearchFallback!(prompt.trim());
      task.executor_used = 'research';
      task.fallback_used = Boolean(zavorthBridgeError);
      task.result_summary = this.deps.truncateForTelegram(resultText, 800);
      task.error_summary = null;
      task.metadata = {
        ...(task.metadata || {}),
        zavorthBridgeBypassed: !zavorthBridgeError,
        zavorthBridgeFallbackReason: zavorthBridgeError?.message || null,
        researchRoutedByIntent: !zavorthBridgeError,
      };
      this.deps.persistTask(task);
      await SmartOutputService.send(
        this.deps.botApi as never,
        task.chat_id as never,
        resultText,
        { parse_mode: 'Markdown' },
      );
      this.deps.taskManager.advanceState(task, 'completed');
      return true;
    } catch (fallbackError: unknown) {
  const fallbackErrorLike = asErrorLike(fallbackError);const fallbackMsg = fallbackError instanceof Error ? fallbackErrorLike.message : String(fallbackError);
      task.error_summary = zavorthBridgeError ? `ZavorthBridge: ${zavorthBridgeError.message}\nFallback web: ${fallbackMsg}`
        : `Web research: ${fallbackMsg}`;
      task.metadata = {
        ...(task.metadata || {}),
        zavorthBridgeBypassed: !zavorthBridgeError,
        zavorthBridgeFallbackReason: zavorthBridgeError?.message || null,
        researchRoutedByIntent: !zavorthBridgeError,
      };
      this.deps.persistTask(task);
      if (!this.isTaskTerminal(task.status)) {
        this.deps.taskManager.advanceState(task, 'failed');
      }
      await ctx.reply(
        zavorthBridgeError
          ? [
              'ZavorthBridge did not open a reliable conversation, and the web research route also failed.',
              '',
              `ZavorthBridge: ${zavorthBridgeError.message}`,
              `Web research: ${fallbackMsg}`,
            ].join('\n')
          : [
              'The Zavorth web route failed while handling this research request.',
              '',
              `Web research: ${fallbackMsg}`,
            ].join('\n'),
      );
      return true;
    }
  }

  private isTaskTerminal(status: string): boolean {
    return ['failed', 'completed', 'rejected', 'cancelled'].includes(status);
  }

  private isDirectChatUnavailableError(error: unknown): boolean {
    const code = error !== null && typeof error === 'object' && 'code' in error
      ? String((error as Record<string, unknown>).code ?? '')
      : '';
    return code.trim().toLowerCase() === 'direct_chat_unavailable';
  }

  private shouldUseResearchCapability(task: Task): boolean {
    const metadata = task.metadata || {};
    const responseDecision = metadata.responseDecision && typeof metadata.responseDecision === 'object'
      ? metadata.responseDecision as Record<string, unknown>
      : null;
    const candidates = [
      ...(Array.isArray(metadata.requestedTools) ? metadata.requestedTools : []),
      ...(Array.isArray(responseDecision?.requestedTools) ? responseDecision.requestedTools : []),
    ];
    return candidates.some((tool) => ['web_search', 'web.search', 'network_fetch'].includes(String(tool || '').trim().toLowerCase()));
  }
}
