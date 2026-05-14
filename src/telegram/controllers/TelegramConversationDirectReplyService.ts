import { Context, InputFile } from 'grammy';
import { Task } from '../../contracts/TaskContract.js';
import { SmartOutputService } from '../../services/SmartOutputService.js';
import { EchoOutputStageService } from '../../services/EchoOutputStageService.js';
import { buildWorkspaceContinuityContext } from '../../runtime/context/WorkspaceContinuityContext.js';
import type { WorkspaceTaskKind, WorkspaceTaskSubtype } from '../../services/WorkspaceTaskKind.js';
import type { AudioSynthesisOptions } from '../AudioHandler.js';
import { logEchoTrace, resolveEchoTraceId } from '../EchoTrace.js';
import { TelegramConversationStateService } from './TelegramConversationStateService.js';

type ContinuityContext = ReturnType<typeof buildWorkspaceContinuityContext>;

type DirectReplyLlm = {
  providerName: string;
  modelName?: string;
};

type SummaryRecorder = {
  recordExchange(userId: string, chatId: string, input: string, output: string): Promise<unknown>;
};

type MemoryRecorder = {
  autoExtract(userId: string, input: string, output: string): Promise<unknown>;
};

export type TelegramConversationDirectReplyServiceDeps = {
  stateService: TelegramConversationStateService;
  recordAssistantMessage?: ((task: Task, content: string, kind?: string | null) => Promise<void> | void) | null;
  echoAudioHandler?: {
    synthesize: (text: string, voiceIdOrOptions?: string | AudioSynthesisOptions) => Promise<string | null>;
    cleanup: (filePath: string) => void;
  } | null;
  echoPreferenceStore?: {
    isEchoModeActive: () => Promise<boolean>;
  } | null;
  echoOutputStage?: EchoOutputStageService | null;
};

export type TelegramConversationDirectReplyParams = {
  ctx: Context;
  task: Task;
  messageText: string;
  responseText: string;
  taskKind: WorkspaceTaskKind;
  taskSubtype: WorkspaceTaskSubtype;
  styleHints: string[];
  continuityContext?: ContinuityContext | null;
  isContinuationRequest?: boolean;
  llm?: DirectReplyLlm;
  summaryService?: SummaryRecorder | null;
  memoryService?: MemoryRecorder | null;
  userId?: string | null;
  chatId?: string | null;
};

export class TelegramConversationDirectReplyService {
  constructor(private readonly deps: TelegramConversationDirectReplyServiceDeps) {}

  public async sendDirectReply(params: TelegramConversationDirectReplyParams): Promise<string> {
    const {
      ctx,
      task,
      messageText,
      responseText,
      taskKind,
      taskSubtype,
      styleHints,
      continuityContext,
      isContinuationRequest = false,
      llm,
      summaryService,
      memoryService,
      userId,
      chatId,
    } = params;

    const finalText = this.deps.stateService.decorateReplyWithContinuation(
      String(responseText || '').trim(),
      continuityContext,
      isContinuationRequest,
    );

    task.result_summary = finalText || task.result_summary || null;
    this.deps.stateService.recordDirectResponseOutcome(
      task,
      taskKind,
      taskSubtype,
      styleHints,
      llm,
      continuityContext,
      finalText,
      isContinuationRequest,
    );

    await this.reply(ctx, finalText, messageText, task);
    await Promise.resolve(this.deps.recordAssistantMessage?.(task, finalText, 'reply'));

    if (summaryService && userId && chatId) {
      await summaryService.recordExchange(userId, chatId, messageText, finalText).catch(() => {});
    }
    if (memoryService && userId) {
      await memoryService.autoExtract(userId, messageText, finalText).catch(() => {});
    }

    return finalText;
  }

  private async reply(ctx: Context, text: string, messageText: string, task: Task): Promise<void> {
    if (await this.tryEchoReply(ctx, text, messageText, task)) {
      return;
    }

    const traceId = resolveEchoTraceId(task, 'telegram-direct-reply');
    if (task.metadata?.voiceFlow) {
      logEchoTrace(traceId, 'reply.text.completed', {
        taskId: task.task_id,
        chars: String(text || '').length,
      });
    }
    await SmartOutputService.reply(ctx, text);
  }

  private async tryEchoReply(ctx: Context, text: string, messageText: string, task: Task): Promise<boolean> {
    const audioHandler = this.deps.echoAudioHandler;
    const preferenceStore = this.deps.echoPreferenceStore;
    const normalizedText = String(text || '').trim();
    const outputStage = this.deps.echoOutputStage || (
      audioHandler && preferenceStore
        ? new EchoOutputStageService({
            audioHandler,
            preferenceStore,
          })
        : null
    );
    if (!outputStage || normalizedText.length === 0) {
      return false;
    }

    const traceId = resolveEchoTraceId(task, 'telegram-direct-reply');
    const result = await outputStage.deliver({
      surface: 'telegram',
      text: normalizedText,
      rawInput: messageText,
      traceId,
      taskId: task.task_id,
      requestedBy: 'telegram-bot',
      sessionId: ctx.chat?.id ? String(ctx.chat.id) : '',
      voiceFlow: (task.metadata?.voiceFlow || {}) as Record<string, unknown>,
      sink: {
        sendText: async (fallbackText) => {
          if (task.metadata?.voiceFlow) {
            logEchoTrace(traceId, 'reply.text.completed', {
              taskId: task.task_id,
              chars: String(fallbackText || '').length,
            });
          }
          await SmartOutputService.reply(ctx, String(fallbackText || ''));
        },
        sendChatAction: async (action) => {
          if (!ctx.chat?.id) {
            return;
          }
          await ctx.api.sendChatAction(ctx.chat.id, action);
        },
        sendVoice: async (audioPath) => {
          await ctx.replyWithVoice(new InputFile(audioPath));
        },
      },
    });

    return result.delivered === 'voice';
  }
}
