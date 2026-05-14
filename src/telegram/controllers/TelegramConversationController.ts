import { randomUUID } from 'crypto';
import { Context } from 'grammy';
import { Task } from '../../contracts/TaskContract.js';
import { BridgeManager } from '../../orchestrator/BridgeManager.js';
import { TaskManager } from '../../orchestrator/TaskManager.js';
import { ConversationSummaryService } from '../../services/ConversationSummaryService.js';
import { MemoryService } from '../../services/MemoryService.js';
import { RecentTaskResolver } from '../../services/RecentTaskResolver.js';
import { SmartOutputService } from '../../services/SmartOutputService.js';
import { GatewaySessionLedgerService } from '../../services/GatewaySessionLedgerService.js';
import { GatewaySessionReadModelService } from '../../services/GatewaySessionReadModelService.js';
import { GatewaySessionService, type GatewaySessionSnapshot } from '../../services/GatewaySessionService.js';
import { buildWorkspaceContinuityContext } from '../../runtime/context/WorkspaceContinuityContext.js';
import { isStructuredAgentRunAction } from '../../contracts/StructuredAgentRunContract.js';
import { classifyWorkspaceTaskProfile } from '../../services/WorkspaceTaskKind.js';
import {
  ExecutionEscalationPolicy,
  ZavorthAgentGateway,
  type UniversalAgentExecutor,
  type UniversalAgentExecutorResult,
} from '../../runtime/agent/index.js';
import type { GraphRuntimeService } from '../../services/graph/GraphRuntimeService.js';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import type { AudioSynthesisOptions } from '../AudioHandler.js';
import { TelegramConversationAutonomousService } from './TelegramConversationAutonomousService.js';
import { TelegramConversationDecisionService } from './TelegramConversationDecisionService.js';
import { TelegramConversationContextService } from './TelegramConversationContextService.js';
import { TelegramConversationDirectReplyService } from './TelegramConversationDirectReplyService.js';
import { TelegramConversationStateService } from './TelegramConversationStateService.js';

type InlineData = Array<{ mimeType: string; data: string }>;
type TelegramAgentGateway = Pick<ZavorthAgentGateway, 'handle'>;
type TelegramConversationControllerRuntime = {
  agentGateway?: TelegramAgentGateway | null;
  executionEscalationPolicy?: ExecutionEscalationPolicy | null;
  sessionReadModelService?: GatewaySessionReadModelService | null;
  sessionLedgerService?: GatewaySessionLedgerService | null;
  toolRuntime?: {
    getToolDefinitions(): ToolDefinition[];
    executeTool(toolName: string, args: unknown): Promise<string>;
  } | null;
  echoAudioHandler?: {
    synthesize: (text: string, voiceIdOrOptions?: string | AudioSynthesisOptions) => Promise<string | null>;
    cleanup: (filePath: string) => void;
  } | null;
  echoPreferenceStore?: {
    isEchoModeActive: () => Promise<boolean>;
  } | null;
  permissionService?: {
    listRequests(
      status?: 'pending' | 'approved' | 'rejected' | 'expired' | 'all',
      limit?: number,
    ): Promise<unknown[]>;
  } | null;
};

export class TelegramConversationController {
  private recentTaskResolver: RecentTaskResolver | null;
  private readonly agentGateway: TelegramAgentGateway;
  private readonly autonomousService: TelegramConversationAutonomousService;
  private readonly contextService: TelegramConversationContextService;
  private readonly decisionService: TelegramConversationDecisionService;
  private readonly directReplyService: TelegramConversationDirectReplyService;
  private readonly executionEscalationPolicy: ExecutionEscalationPolicy;
  private readonly sessionLedger: GatewaySessionLedgerService;
  private readonly sessionReadModel: GatewaySessionReadModelService;
  private readonly stateService: TelegramConversationStateService;
  private readonly toolRuntime: TelegramConversationControllerRuntime['toolRuntime'];

  constructor(
    private bridgeManager: BridgeManager,
    private taskManager?: TaskManager,
    graphRuntime?: GraphRuntimeService,
    runtime: TelegramConversationControllerRuntime = {},
  ) {
    this.recentTaskResolver = this.taskManager ? new RecentTaskResolver(this.taskManager) : null;
    this.agentGateway = runtime.agentGateway || this.createAgentGateway(graphRuntime || null);
    this.executionEscalationPolicy = runtime.executionEscalationPolicy || new ExecutionEscalationPolicy();
    this.toolRuntime = runtime.toolRuntime || null;
    this.sessionLedger = runtime.sessionLedgerService || new GatewaySessionLedgerService();
    this.sessionReadModel =
      runtime.sessionReadModelService ||
      new GatewaySessionReadModelService(
        new GatewaySessionService({
          taskManager: this.taskManager as any,
          permissionService: (runtime.permissionService as any) || null,
          sessionLedgerService: this.sessionLedger,
        }),
      );
    this.decisionService = new TelegramConversationDecisionService();
    this.contextService = new TelegramConversationContextService({
      isContinuationIntent: (messageText) => this.decisionService.isContinuationIntent(messageText),
    });
    this.stateService = new TelegramConversationStateService({
      taskManager: this.taskManager,
      buildWorkspaceStrategySnapshot: (task, taskGoal) => this.contextService.buildWorkspaceStrategySnapshot(task, taskGoal),
    });
    this.directReplyService = new TelegramConversationDirectReplyService({
      stateService: this.stateService,
      recordAssistantMessage: (task, content, kind) => this.recordAssistantMessage(task, content, kind),
      echoAudioHandler: runtime.echoAudioHandler || null,
      echoPreferenceStore: runtime.echoPreferenceStore || null,
    });
    this.autonomousService = new TelegramConversationAutonomousService({
      agentGateway: this.agentGateway,
      contextService: this.contextService,
      decisionService: this.decisionService,
      directReplyService: this.directReplyService,
      executionEscalationPolicy: this.executionEscalationPolicy,
      recordAssistantMessage: (task, content, kind) => this.recordAssistantMessage(task, content, kind),
      stateService: this.stateService,
    });
  }

  public async handleConversational(
    ctx: Context,
    task: Task,
    messageText: string,
    inlineData?: InlineData,
  ): Promise<void> {
    if (ctx.chat?.id) {
      await ctx.api.sendChatAction(ctx.chat.id, 'typing');
    }

    const ConversationalModule = require('../../agents/ConversationalAgent.js').ConversationalAgent;
    const convAgent = new ConversationalModule({
      toolRuntime: this.toolRuntime,
    });
    const memoryService = new MemoryService();
    const summaryService = new ConversationSummaryService();
    const userId = ctx.from?.id.toString() || task.user_id || '';
    const chatId = ctx.chat?.id?.toString() || task.chat_id || '';
    const canonicalTarget = this.resolveCanonicalTarget(task, userId, chatId);

    try {
      this.recordLedgerMessage(canonicalTarget, {
        id: randomUUID(),
        role: 'user',
        content: messageText,
        createdAt: new Date().toISOString(),
        taskId: task.task_id || null,
        kind: 'input',
        surface: 'telegram',
      });
      const recentTaskReply = userId
        ? this.recentTaskResolver?.resolve(userId, task.task_id || null, messageText, task.chat_id || null) || null
        : null;
      if (recentTaskReply) {
        task.result_summary = recentTaskReply;
        await SmartOutputService.reply(ctx, recentTaskReply);
        this.recordLedgerMessage(canonicalTarget, {
          id: randomUUID(),
          role: 'assistant',
          content: recentTaskReply,
          createdAt: new Date().toISOString(),
          taskId: task.task_id || null,
          kind: 'recent-task-reply',
          surface: 'telegram',
        });
        return;
      }

      const memoryContext = userId ? await memoryService.getMemoryContext(userId, messageText) : '';
      const summaryContext =
        userId && chatId ? await summaryService.getConversationContext(userId, chatId) : '';
      const canonicalSnapshot = await this.buildCanonicalSnapshot(task, canonicalTarget);
      const continuityContext = buildWorkspaceContinuityContext(task, String(task.source || 'telegram').trim());
      const workspaceContext = this.contextService.buildWorkspaceContext(task, continuityContext);
      const canonicalSessionContext = this.contextService.buildCanonicalSessionContext(canonicalSnapshot);
      const messageProfile = classifyWorkspaceTaskProfile({
        commandType: task.command_type,
        intent: task.intent,
        executor: task.executor_used || task.command_type,
        text: messageText,
      });
      const isContinuationRequest = this.decisionService.isContinuationIntent(messageText);
      const continuityResponseHint = this.contextService.buildContinuityResponseHint(messageText, continuityContext);
      const effectiveMessageText = this.contextService.buildContinuationAwareMessage(messageText, continuityContext);
      const contextSections = [
        workspaceContext,
        canonicalSessionContext,
        memoryContext,
        summaryContext,
        continuityResponseHint,
      ]
        .map((value) => String(value || '').trim())
        .filter(Boolean);
      const contextualMessage = contextSections.length
        ? `${contextSections.join('\n\n')}\n\nMENSAGEM ATUAL DO USUARIO:\n${effectiveMessageText}`
        : effectiveMessageText;
      const preLlmAutonomyDecision = this.decisionService.decideAutonomousExecution(
        task,
        messageText,
        effectiveMessageText,
      );
      if (preLlmAutonomyDecision.mode === 'autonomous') {
        await this.autonomousService.handleAutonomousSuggestion({
          ctx,
          task,
          messageText,
          contextualMessage,
          actionPayload: effectiveMessageText,
          inlineData,
          continuityContext,
          isContinuationRequest,
          userId,
          chatId,
          convAgent,
          summaryService,
          memoryService,
        });
        return;
      }

      const response = await convAgent.chat(contextualMessage, inlineData, {
        taskKind: messageProfile.kind,
        taskSubtype: messageProfile.subtype,
        workspaceOperationalMemory: task.metadata?.workspace_operational_memory || null,
      });

      if (isStructuredAgentRunAction(response.action)) {
        await this.autonomousService.handleAutonomousSuggestion({
          ctx,
          task,
          messageText,
          contextualMessage,
          actionPayload: response.action.payload,
          inlineData,
          continuityContext,
          isContinuationRequest,
          userId,
          chatId,
          convAgent,
          summaryService,
          memoryService,
        });
        return;
      }

      if (response.text) {
        await this.directReplyService.sendDirectReply({
          ctx,
          task,
          messageText,
          responseText: String(response.text || '').trim(),
          taskKind: messageProfile.kind,
          taskSubtype: messageProfile.subtype,
          styleHints: [],
          continuityContext,
          isContinuationRequest,
          llm: response.llm,
          summaryService,
          memoryService,
          userId,
          chatId,
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error || 'erro desconhecido');
      const failureMessage = `Nao consegui responder isso agora.\n\nMotivo: ${message}`;
      await ctx.reply(failureMessage);
      this.recordLedgerMessage(canonicalTarget, {
        id: randomUUID(),
        role: 'assistant',
        content: failureMessage,
        createdAt: new Date().toISOString(),
        taskId: task.task_id || null,
        kind: 'error',
        surface: 'telegram',
      });
    }
  }

  public async dispatchAutonomousTaskToBridge(task: Task, payload: string): Promise<void> {
    const forwardedTask: Task = {
      ...task,
      normalized_message: payload,
    };

    await this.bridgeManager.dispatchToIDE(forwardedTask, 'ZAVORTH_BRIDGE');
  }

  private createAgentGateway(graphRuntime: GraphRuntimeService | null): TelegramAgentGateway {
    if (!graphRuntime) {
      return new ZavorthAgentGateway();
    }

    return new ZavorthAgentGateway({
      executor: this.createGraphRuntimeBackendExecutor(graphRuntime),
    });
  }

  private createGraphRuntimeBackendExecutor(graphRuntime: GraphRuntimeService): UniversalAgentExecutor {
    return async ({ request, run }): Promise<UniversalAgentExecutorResult> => {
      const metadata = request.metadata || {};
      const contextMessages = Array.isArray(metadata.contextMessages)
        ? metadata.contextMessages as any[]
        : [];
      const result = await graphRuntime.runAutonomousTask(request.text, {
        initialMessages: contextMessages.length > 0 ? contextMessages as any : undefined,
        metadata: {
          ...metadata,
          agentRunId: run.id,
          agentGatewayTraceId: run.traceId,
          governedBackend: true,
          graphRuntimeDirectBrain: false,
        },
      });
      const ok = Boolean(result?.ok);
      const replyText = String(result?.finalReply || result?.criticFeedback || result?.error || '').trim()
        || (ok ? 'Graph backend concluiu a execucao governada.' : 'Graph backend falhou na execucao governada.');

      return {
        status: ok ? 'completed' : 'failed',
        summary: replyText,
        replyText,
        metadata: {
          graphRuntimeBackend: {
            called: true,
            governedBy: 'AgentRunService',
            status: result?.status || (ok ? 'completed' : 'failed'),
            traceId: result?.traceId || null,
            iterations: Number(result?.iterations || 0),
            approved: result?.approved === true,
            providerName: String(result?.providerName || '').trim() || null,
            modelName: String(result?.modelName || '').trim() || null,
          },
        },
      };
    };
  }

  private resolveCanonicalTarget(task: Task, userId: string, chatId: string) {
    return this.sessionReadModel.resolveTarget({
      userId,
      fallbackRuntimeUserId: task.user_id || userId || null,
      platform: 'telegram',
      chatId,
      sourceUserId: userId || task.user_id || null,
    });
  }

  private async buildCanonicalSnapshot(
    task: Task,
    target: ReturnType<TelegramConversationController['resolveCanonicalTarget']>,
  ): Promise<GatewaySessionSnapshot | null> {
    if (!target) {
      return null;
    }

    return this.sessionReadModel.buildSnapshot({
      userId: target.runtimeUserId,
      fallbackRuntimeUserId: task.user_id || target.runtimeUserId,
      platform: target.platform,
      chatId: target.chatId,
      sessionId: target.sessionId,
      sourceUserId: target.sourceUserId,
    });
  }

  private async recordAssistantMessage(
    task: Task,
    content: string,
    kind?: string | null,
  ): Promise<void> {
    const target = this.resolveCanonicalTarget(
      task,
      String(task.user_id || '').trim(),
      String(task.chat_id || '').trim(),
    );
    this.recordLedgerMessage(target, {
      id: randomUUID(),
      role: 'assistant',
      content,
      createdAt: new Date().toISOString(),
      taskId: task.task_id || null,
      kind: String(kind || '').trim() || 'reply',
      surface: 'telegram',
    });
  }

  private recordLedgerMessage(
    target: ReturnType<TelegramConversationController['resolveCanonicalTarget']>,
    entry: {
      id: string;
      role: 'user' | 'assistant' | 'system';
      content: string;
      createdAt: string;
      taskId?: string | null;
      kind?: string | null;
      surface: string;
    },
  ): void {
    if (!target) {
      return;
    }

    const content = String(entry.content || '').trim();
    if (!content) {
      return;
    }

    this.sessionLedger.appendMessage(
      {
        platform: target.platform,
        chatId: target.chatId,
        sessionId: target.sessionId,
        runtimeUserId: target.runtimeUserId,
        sourceUserId: target.sourceUserId,
      },
      {
        id: entry.id,
        role: entry.role,
        content,
        createdAt: entry.createdAt,
        taskId: entry.taskId || null,
        kind: entry.kind || null,
        surface: entry.surface,
      },
    );
  }

  /*

  private buildDirectResponseStyleHints(
    task: Task,
    taskKind: WorkspaceTaskKind,
    taskSubtype: WorkspaceTaskSubtype,
  ): string[] {
    const recommendation = this.resolveDirectStyleRecommendation(task, taskKind, taskSubtype);
    const preferredStyle = recommendation?.preferred_style || resolveWorkspaceResponseStyle(taskKind, taskSubtype);
    const taskLabel = taskSubtype !== 'general' && taskSubtype !== 'unknown' ? taskSubtype : taskKind;
    const hints: string[] = [];

    if (recommendation) {
      hints.push(
        `Siga o formato que este workspace tende a preferir para ${taskLabel}: ${preferredStyle} (${recommendation.rationale}).`,
      );
    }

    switch (preferredStyle) {
      case 'summary_first':
        hints.push(
          'Abra com um resumo executivo curto antes dos detalhes.',
          'Depois do resumo, organize os pontos por prioridade e proximos passos.',
        );
        break;
      case 'findings_first':
        hints.push(
          'Comece pelos achados, riscos ou falhas mais importantes.',
          'Deixe contexto secundario e explicacoes complementares depois dos achados principais.',
        );
        break;
      case 'decision_brief':
        hints.push(
          'Estruture a resposta como comparacao objetiva com criterios explicitos.',
          'Termine com recomendacao final clara, tradeoffs e risco principal.',
        );
        break;
      case 'checkpointed':
        hints.push(
          'Estruture a resposta em passos ou checkpoints claros.',
          'Deixe explicito o estado atual, o que ja foi feito e o proximo passo.',
        );
        break;
      case 'diagnostic':
        hints.push(
          'Responda como diagnostico: sintomas, causa provavel, evidencias e proximo teste recomendado.',
        );
        break;
      case 'implementation_ready':
        hints.push(
          'Responda de forma operacional e pronta para execucao.',
          'Inclua proposta concreta, impacto esperado e proximos passos práticos.',
        );
        break;
      default:
        hints.push('Responda de forma direta, economica e facil de aplicar.');
        break;
    }

    return Array.from(new Set(hints.map((hint) => hint.trim()).filter(Boolean)));
  }

  private hasStrongAutonomyIntent(originalMessage: string, autonomousPayload: string): boolean {
    const combined = `${String(originalMessage || '')}\n${String(autonomousPayload || '')}`.toLowerCase();

    return /(arrume|corrija|conserte|modifique|altere|implante|implemente|crie|gere arquivo|rode|execute|automatize|fa[cç]a sozinho|pode seguir|pode fazer|aplique|mude o sistema|edite)/i.test(
      combined,
    );
  }

  */
}
