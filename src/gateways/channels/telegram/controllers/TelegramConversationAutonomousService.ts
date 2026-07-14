import { Context } from 'grammy';
import { config } from '../../../../config/index.js';
import { Task } from '../../../../contracts/TaskContract.js';
import { SmartOutputService } from '../../../../services/SmartOutputService.js';
import { buildWorkspaceContinuityContext } from '../../../../runtime/context/WorkspaceContinuityContext.js';
import { classifyWorkspaceTaskProfile } from '../../../../services/WorkspaceTaskKind.js';
import {
  ExecutionEscalationPolicy,
  inferUniversalAgentRequestedTools,
  type UniversalAgentRunResult,
  type ZavorthAgentGateway,
} from '../../../../runtime/agent/index.js';
import { TelegramConversationContextService } from '../../../../gateways/channels/telegram/controllers/TelegramConversationContextService.js';

import { TelegramConversationDecisionService } from '../../../../gateways/channels/telegram/controllers/TelegramConversationDecisionService.js';
import { TelegramConversationDirectReplyService } from '../../../../gateways/channels/telegram/controllers/TelegramConversationDirectReplyService.js';
import { TelegramConversationStateService } from '../../../../gateways/channels/telegram/controllers/TelegramConversationStateService.js';
import { asErrorLike } from '../../../../utils/errorLike';
import { canTelegramActorWriteLearning } from '../../../../services/ZavorthTelegramOperatorAuth.js';
import { canActorWriteLearning } from '../../../../services/ZavorthLearningWriteAuth.js';

type InlineData = Array<{ mimeType: string; data: string }>;
type ContinuityContext = ReturnType<typeof buildWorkspaceContinuityContext>;

type SummaryRecorder = {
  recordExchange(userId: string, chatId: string, input: string, output: string): Promise<unknown>;
};

type MemoryRecorder = {
  autoExtract(userId: string, input: string, output: string): Promise<unknown>;
};

type AgentGateway = Pick<ZavorthAgentGateway, 'handle'>;

type ConversationalAgent = {
  chat(message: string, inlineData?: InlineData, options?: Record<string, unknown>): Promise<any>;
};

export type TelegramConversationAutonomousServiceDeps = {
  agentGateway: AgentGateway;
  contextService: TelegramConversationContextService;
  decisionService: TelegramConversationDecisionService;
  directReplyService: TelegramConversationDirectReplyService;
  executionEscalationPolicy?: ExecutionEscalationPolicy | null;
  stateService: TelegramConversationStateService;
  recordAssistantMessage?: ((task: Task, content: string, kind?: string | null) => Promise<void> | void) | null;
};

export type TelegramConversationAutonomousParams = {
  ctx: Context;
  task: Task;
  messageText: string;
  contextualMessage: string;
  actionPayload: string;
  inlineData?: InlineData;
  continuityContext?: ContinuityContext | null;
  isContinuationRequest?: boolean;
  userId?: string | null;
  chatId?: string | null;
  convAgent: ConversationalAgent;
  summaryService?: SummaryRecorder | null;
  memoryService?: MemoryRecorder | null;
};

export class TelegramConversationAutonomousService {
  private readonly executionEscalationPolicy: ExecutionEscalationPolicy;

  constructor(private readonly deps: TelegramConversationAutonomousServiceDeps) {
    this.executionEscalationPolicy = deps.executionEscalationPolicy || new ExecutionEscalationPolicy();
  }

  public async handleAutonomousSuggestion(params: TelegramConversationAutonomousParams): Promise<void> {
    const {
      ctx,
      task,
      messageText,
      contextualMessage,
      actionPayload,
      inlineData,
      continuityContext,
      isContinuationRequest = false,
      userId,
      chatId,
      convAgent,
      summaryService,
      memoryService,
    } = params;

    const userRoles = config.telegramUserRoles[String(userId || '')] || ['admin'];
    if (!userRoles.includes('admin')) {
      await ctx.reply(
        `**Restricted Access:**\n\nThe assistant suggested running an autonomous action:\n\`${actionPayload}\`\n\nYour current role does not have permission for that.`,
        { parse_mode: 'Markdown' },
      );
      await Promise.resolve(
        this.deps.recordAssistantMessage?.(
          task,
          `**Restricted Access:**\n\nThe assistant suggested running an autonomous action:\n\`${actionPayload}\`\n\nYour current role does not have permission for that.`,
          'autonomous-denied',
        ),
      );
      return;
    }

    const autonomyDecision = this.deps.decisionService.decideAutonomousExecution(
      task,
      messageText,
      actionPayload,
    );

    if (autonomyDecision.mode === 'direct') {
      const directStyleHints = this.deps.decisionService.buildDirectResponseStyleHints(
        task,
        autonomyDecision.taskKind,
        autonomyDecision.taskSubtype,
      );
      const fallbackResponse = await convAgent.chat(contextualMessage, inlineData, {
        mode: 'direct',
        styleHints: directStyleHints,
        taskKind: autonomyDecision.taskKind,
        taskSubtype: autonomyDecision.taskSubtype,
        workspaceOperationalMemory: task.metadata?.workspace_operational_memory || null,
        userId,
        chatId,
        surface: 'telegram',
        allowLearningWrite: canTelegramActorWriteLearning(userId),
      });

      await this.deps.directReplyService.sendDirectReply({
        ctx,
        task,
        messageText,
        responseText:
          String(
            fallbackResponse.text
              || 'I can answer this directly without using autonomous mode, but I did not receive a usable final response.',
          ).trim(),
        taskKind: autonomyDecision.taskKind,
        taskSubtype: autonomyDecision.taskSubtype,
        styleHints: directStyleHints,
        continuityContext,
        isContinuationRequest,
        llm: fallbackResponse.llm,
        summaryService,
        memoryService,
        userId,
        chatId,
      });
      return;
    }

    const activationMessage = [
      'Autonomous work activated in the governed runtime.',
      '',
      `Objective: ${actionPayload}`,
      '',
      'Opening a run through the Zavorth Agent Gateway...',
    ].join('\n');
    await SmartOutputService.reply(ctx, activationMessage);
    await Promise.resolve(
      this.deps.recordAssistantMessage?.(
        task,
        activationMessage,
        'autonomous-activation',
      ),
    );

    try {
      const taskProfile = classifyWorkspaceTaskProfile({ text: actionPayload });
      const responseDecision = task.metadata?.responseDecision && typeof task.metadata.responseDecision === 'object'
        ? task.metadata.responseDecision as Record<string, unknown>
        : null;
      const structuredTools = [
        ...(Array.isArray(task.metadata?.requestedTools) ? task.metadata.requestedTools : []),
        ...(Array.isArray(responseDecision?.requestedTools) ? responseDecision.requestedTools : []),
      ].map((tool) => String(tool || '').trim()).filter(Boolean);
      const requestedTools = inferUniversalAgentRequestedTools({
        text: actionPayload,
        capabilityIds: structuredTools,
        fallbackTool: structuredTools.length > 0 ? null : 'memory.read',
      });
      const escalationDecision = this.executionEscalationPolicy.resolve({
        complexObjective: requestedTools.includes('swarm.run'),
        taskGoal: actionPayload,
        suggestedSubagents: requestedTools.includes('swarm.run')
          ? ['planner', 'implementer', 'verifier']
          : [],
        metadata: {
          source: 'TelegramConversationAutonomousService',
          requestedTools,
        },
      });
      this.deps.stateService.markAgentGatewayRunRunning(task, actionPayload);
      const contextMessages = this.deps.contextService.buildGraphContextMessages(task);
      const resolvedUserId = String(userId || task.user_id || 'local-user').trim() || 'local-user';
      const resolvedChatId = String(chatId || task.chat_id || task.task_id || '').trim() || null;
      const result = await this.deps.agentGateway.handle({
        requestId: task.task_id || undefined,
        userId: resolvedUserId,
        sessionId: resolvedChatId || String(task.task_id || 'telegram').trim() || 'telegram',
        channel: 'telegram',
        text: actionPayload,
        workspace: task.workspace || null,
        requestedTools,
        metadata: {
          source: 'telegram',
          surface: 'telegram',
          taskId: task.task_id || null,
          chatId: resolvedChatId,
          userId: resolvedUserId,
          allowLearningWrite: canActorWriteLearning({
            surface: 'telegram',
            userId: resolvedUserId,
            chatId: resolvedChatId,
          }),
          taskKind: taskProfile.kind,
          taskSubtype: taskProfile.subtype,
          contextualMessage,
          contextMessages,
          workspaceProfile: task.metadata?.workspace_profile || null,
          workspaceOperationalMemory: task.metadata?.workspace_operational_memory || null,
          workspaceProfileSummary: task.metadata?.workspace_profile_summary || null,
          workspaceOperationalMemorySummary: task.metadata?.workspace_operational_memory_summary || null,
          workspaceStrategy: this.deps.contextService.buildWorkspaceStrategySnapshot(task, actionPayload),
          responseDecision: {
            schemaVersion: 1,
            mode: 'operation',
            confidence: 'high',
            reason: 'Telegram autonomous request routed through the universal agent runtime.',
            sourceReason: 'telegram-autonomous-policy',
            target: { type: 'workflow', value: null },
            requestedTools,
            responsePath: 'agent-runtime',
            shouldCreateArtifact: requestedTools.some((tool) => (
              tool === 'write_file' || tool === 'filesystem.write' || tool === 'file.edit'
            )),
            shouldShowArtifactInChat: false,
            diagnostics: {
              surface: 'telegram',
              shouldExecute: true,
              semantic: false,
            },
          },
          executionEscalation: escalationDecision,
          graphRuntimeServiceCalled: false,
        },
      });

      this.deps.stateService.recordAgentGatewayRunOutcome(task, actionPayload, result);

      const finalText = this.deps.stateService.decorateReplyWithContinuation(
        this.buildGatewayReplyText(result),
        continuityContext,
        isContinuationRequest,
      );
      const resultMessage = this.decorateGatewayResultMessage(result, finalText);
      await SmartOutputService.reply(ctx, resultMessage);
      await Promise.resolve(
        this.deps.recordAssistantMessage?.(
          task,
          resultMessage,
          this.resolveGatewayAssistantMessageKind(result),
        ),
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.deps.stateService.recordAgentGatewayRunException(task, actionPayload, err);
      await SmartOutputService.reply(ctx, `Governed execution failed: ${errorMessage}`);
      await Promise.resolve(
        this.deps.recordAssistantMessage?.(
          task,
          `Governed execution failed: ${errorMessage}`,
          'autonomous-exception',
        ),
      );
    }
  }

  private buildGatewayReplyText(result: UniversalAgentRunResult): string {
    return String(result.replies?.[0]?.text || '').trim()
      || String(result.run?.summary || '').trim()
      || (result.ok ? 'Execution recorded by the universal runtime.' : 'Governed execution failed.');
  }

  private decorateGatewayResultMessage(result: UniversalAgentRunResult, finalText: string): string {
    const status = result.run?.status || (result.ok ? 'completed' : 'failed');
    if (status === 'completed') {
      return `Autonomous task completed.\n\n${finalText}`;
    }
    if (status === 'waiting_approval') {
      return finalText;
    }
    if (status === 'queued' || status === 'running' || status === 'thinking') {
      return `Governed execution recorded.\n\n${finalText}`;
    }
    return `Governed execution failed.\n\n${finalText}`;
  }

  private resolveGatewayAssistantMessageKind(result: UniversalAgentRunResult): string {
    const status = result.run?.status || (result.ok ? 'completed' : 'failed');
    if (status === 'waiting_approval') {
      return 'autonomous-waiting-approval';
    }
    if (status === 'completed') {
      return 'autonomous-result';
    }
    if (status === 'queued' || status === 'running' || status === 'thinking') {
      return 'autonomous-running';
    }
    return 'autonomous-failure';
  }
}
