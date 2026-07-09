import { Context } from 'grammy';
import { Task } from '../../../../contracts/TaskContract.js';
import { TaskManager } from '../../../../orchestrator/TaskManager.js';
import { SmartOutputService } from '../../../../services/SmartOutputService.js';

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

    if (!this.deps.runResearchFallback || !this.shouldAutoFallbackToResearch(prompt)) {
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
    if (!this.deps.runResearchFallback || !this.shouldBypassZavorthBridgeForResearch(prompt)) {
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
        this.deps.botApi as any,
        task.chat_id as any,
        resultText,
        { parse_mode: 'Markdown' },
      );
      this.deps.taskManager.advanceState(task, 'completed');
      return true;
    } catch (fallbackError: any) { const error = fallbackError; const err = fallbackError; const e = fallbackError;
      const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      task.error_summary = zavorthBridgeError
        ? `ZavorthBridge: ${zavorthBridgeError.message}\nFallback web: ${fallbackMsg}`
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

  private shouldAutoFallbackToResearch(prompt: string): boolean {
    const normalized = String(prompt || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const looksLikeResearch = [
      /(^|\s)pesquise(\s|$)/,
      /(^|\s)pesquisa(\s|$)/,
      /(^|\s)research(\s|$)/,
      /noticias?/,
      /\bnews\b/,
      /ultimas? atualizacoes/,
      /ultimas? noticias/,
      /me conte as noticias/,
      /resuma as principais noticias/,
      /verifique .*noticias/,
    ].some((pattern) => pattern.test(normalized));

    return looksLikeResearch && !this.isNotebookBoundPrompt(normalized);
  }

  private shouldBypassZavorthBridgeForResearch(prompt: string): boolean {
    if (!this.shouldAutoFallbackToResearch(prompt)) {
      return false;
    }

    const normalized = String(prompt || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    return !this.isNotebookBoundPrompt(normalized);
  }

  private isNotebookBoundPrompt(normalizedPrompt: string): boolean {
    const notebookBoundSignals = [
      /\bworkspace\b/,
      /\brepo\b/,
      /\brepositorio\b/,
      /\bprojeto\b/,
      /\bcodigo\b/,
      /\bcode\b/,
      /\barquivo\b/,
      /\bfile\b/,
      /\bpasta\b/,
      /\bfolder\b/,
      /\bdiretorio\b/,
      /\bdirectory\b/,
      /\bconteudo da pasta\b/,
      /\bdentro da pasta\b/,
      /\blocal\b/,
      /\blog\b/,
      /\bterminal\b/,
      /\bapp\b/,
      /\bjanela\b/,
      /\bnotebook\b/,
      /\bide\b/,
      /\bbranch\b/,
      /\bgit\b/,
      /[a-z]:[\\/]/,
      /\/mnt\//,
    ];

    return notebookBoundSignals.some((pattern) => pattern.test(normalizedPrompt));
  }
}
