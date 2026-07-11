import {
  renderUniversalApprovalIntentDecisionResult,
} from '../runtime/agent/index.js';
import { config } from '../config/index.js';
import { ZavorthEffortControlService } from './ZavorthEffortControlService.js';
import { FirstRunPersonalizationService } from './FirstRunPersonalizationService.js';

import { ComposerActionService } from './ComposerActionService.js';
import { ComposerCatalogService } from './ComposerCatalogService.js';
import { ComposerContextService } from './ComposerContextService.js';
import { ComposerPayloadService, type NormalizedComposerPayload } from './ComposerPayloadService.js';
import { GatewaySessionToolsService } from '../runtime/sessions/GatewaySessionToolsService.js';
import type { SharedSurfaceRuntime } from './SurfaceRuntime.js';
import { WebRealtimeService } from './WebRealtimeService.js';
import type { IMessageContext } from '../contracts/IMessageBroker.js';
import {
  createInternalSurfaceCommandApi,
  type SurfaceCommandBoundary,
} from '../api/internal/InternalSurfaceApiCompat.js';
import type { TaskResourceImpact } from '../contracts/TaskResourcePlannerContract.js';
import type { ZavorthResponseDecision } from '../contracts/ZavorthResponseDecisionContract.js';
import type { TaskResourcePlannerService } from './TaskResourcePlannerService.js';
import type {
  ModeEscalationEvaluation,
  ModeEscalationSnapshot,
} from '../contracts/ModeEscalationContract.js';
import type { ModeEscalationService } from './ModeEscalationService.js';
import type {
  ZavorthAgentGateway,
  UniversalApprovalIntentDecisionResult,
  UniversalAgentExecutor,
  UniversalAgentRunResult,
} from '../runtime/agent/index.js';

import { SurfaceOperationalIntentService } from './SurfaceOperationalIntentService.js';
import { FileInspectionService } from './FileInspectionService.js';
import { AttachmentIntelligenceService, type AttachmentTextProfile } from './AttachmentIntelligenceService.js';
import { ZavorthUserResponseRendererService } from './ZavorthUserResponseRendererService.js';
import { MediaUnderstandingService } from './MediaUnderstandingService.js';
import type { WebComposerAttachment } from '../contracts/WebComposer.js';
import type { MediaAnalysisType } from '../contracts/MediaUnderstandingContract.js';
import { AudioTranscriptionService } from './AudioTranscriptionService.js';
import type { ExecutionEngineDecision, ExecutionEngineId } from '../contracts/ExecutionEngineContract.js';
import type {
  ExecutionEngineRouteOperation,
  ExecutionEngineRouterService,
} from './ExecutionEngineRouterService.js';

import { resolveComposerModelRouteOverride } from './WebAppComposerModelRoute.js';
import {
  buildInlineDataFromAttachments,
  extractInlineDataFromComposerPayload,
  getReadyMediaAttachments,
  resolveReadyMediaAttachment,
} from './WebAppConversationInlineData.js';

import { ZavorthFirstBootDetectionService } from './ZavorthFirstBootDetectionService.js';
import { ZavorthConversationalSetupService } from './ZavorthConversationalSetupService.js';
import { ZavorthContextualTipsService, CONTEXTUAL_TIP_FLAGS } from './ZavorthContextualTipsService.js';
import type { ChatMessage } from '../providers/ILlmProvider.js';
import { safeParseInt } from '../ai-gateway/shared/utils/safeParseInt.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

type RuntimeRecord = Record<string, unknown>;
type ComposerCatalogOptions = NonNullable<ConstructorParameters<typeof ComposerCatalogService>[0]>;
type ComposerActionOptions = ConstructorParameters<typeof ComposerActionService>[0];

type WebAppConversationDeps = {
  runtime: SharedSurfaceRuntime;
  realtime: WebRealtimeService;
  getGatewaySessionTools: () => GatewaySessionToolsService;
  getSharedSurfaceCommandService?: () => SurfaceCommandBoundary | null;
  taskResourcePlanner?: Pick<TaskResourcePlannerService, 'planChatTask' | 'renderImpactSummary'> | null;
  modeEscalation?: Pick<ModeEscalationService, 'evaluateChatRequest' | 'buildSnapshot'> | null;
  agentGateway?: ZavorthAgentGateway | null;
  surfaceOperationalIntentService?: Pick<SurfaceOperationalIntentService, 'decideResponse'> | null;
  executionEngineRouter?: Pick<ExecutionEngineRouterService, 'decide'> | null;
};

export class WebAppConversationService {
  private composerCatalog: ComposerCatalogService | null = null;
  private composerActions: ComposerActionService | null = null;
  private readonly composerContext = new ComposerContextService();
  private readonly composerPayload = new ComposerPayloadService();
  private readonly fileInspectionService = new FileInspectionService();
  private readonly attachmentIntelligence = new AttachmentIntelligenceService();
  private readonly mediaUnderstanding = new MediaUnderstandingService();
  private readonly audioTranscription = new AudioTranscriptionService({
    mediaUnderstanding: this.mediaUnderstanding,
  });
  private readonly effortControl = new ZavorthEffortControlService();
  private readonly surfaceOperationalIntentService: Pick<SurfaceOperationalIntentService, 'decideResponse'>;
  private readonly responseRenderer = new ZavorthUserResponseRendererService();

  constructor(private readonly deps: WebAppConversationDeps) {
    this.surfaceOperationalIntentService = deps.surfaceOperationalIntentService || new SurfaceOperationalIntentService();
  }

  public createWebContext(sessionId: string): Record<string, unknown> {
    const numericUserId = safeParseInt(this.deps.runtime.webUserId, 1);
    return {
      from: { id: numericUserId, username: 'web' },
      chat: { id: 0, type: 'private' },
      api: {
        sendChatAction: async () => undefined,
      },
      reply: async (text: string) => {
        await this.deliverWebOutput(sessionId, text, 'web-context-reply', String(text || ''));
        return {};
      },
      answerCallbackQuery: async () => undefined,
      editMessageReplyMarkup: async () => undefined,
    };
  }

  public getComposerCatalog(): ComposerCatalogService {
    if (!this.composerCatalog) {
      this.composerCatalog = new ComposerCatalogService({
        taskManager: this.deps.runtime.taskManager as unknown as ComposerCatalogOptions['taskManager'],
        permissionService: this.deps.runtime.permissionService as unknown as ComposerCatalogOptions['permissionService'],
      });
    }

    return this.composerCatalog;
  }

  public async processChatSend(body: RuntimeRecord): Promise<{
    sessionId: string;
    taskId: string | null;
    snapshot: Awaited<ReturnType<WebRealtimeService['getResolvedSnapshot']>>;
    resourceImpact: TaskResourceImpact | null;
    modeEscalation: ModeEscalationSnapshot | null;
    responseDecision?: ZavorthResponseDecision | null;
    executionEngineDecision?: ExecutionEngineDecision | null;
  }> {
    const normalizedComposerPayload = this.composerPayload.normalize(body);
    const message = normalizedComposerPayload.messageText;
    const providerRouteOverride = this.buildProviderRouteOverride(body);
    const composerRuntimeHints = this.buildComposerRuntimeHints(body, message);
    if (!message) {
      throw new Error('Mensagem vazia.');
    }
    if (
      this.composerContext.hasPendingFollowupActionWithoutMessage(
        String(body.message || ''),
        normalizedComposerPayload.mentions,
      )
    ) {
      throw new Error('Essa action precisa ir junto com o proximo pedido na mesma mensagem.');
    }

    const sessionId = String(body.sessionId || '').trim() || this.deps.realtime.createSession();
    this.deps.realtime.ensureSession(sessionId);
    const resourceImpact = await this.planResourceImpact(message);
    this.deps.realtime.recordUserMessage(
      sessionId,
      message,
      null,
      normalizedComposerPayload.mentions,
    );

    const personalizationService = new FirstRunPersonalizationService({ projectRoot: this.deps.runtime.projectRoot });
    const personalizationStatus = personalizationService.getStatus();
    if (personalizationStatus.pending) {
      const firstBootService = new ZavorthFirstBootDetectionService({ cwd: this.deps.runtime.projectRoot });
      const workspace = firstBootService.detectWorkspace();
      
      const sessionSnapshot = await this.deps.realtime.getResolvedSnapshot(sessionId);
      const chatHistory: ChatMessage[] = sessionSnapshot.messages.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));

      const setupService = new ZavorthConversationalSetupService({
        personalization: personalizationService,
      });

      const { reply, finished } = await setupService.runFirstMessageIntake(sessionId, chatHistory, workspace);
      
      this.deps.realtime.recordAssistantMessage(
        sessionId,
        reply,
        null,
        'conversational-setup-reply'
      );

      if (finished) {
        const tipsService = new ZavorthContextualTipsService();
        const tip = await tipsService.getTipIfUnseen(CONTEXTUAL_TIP_FLAGS.ONBOARDING_COMPLETED);
        if (tip) {
          this.deps.realtime.recordAssistantMessage(
            sessionId,
            await tipsService.formatTip(tip),
            null,
            'contextual-tip'
          );
        }
      }

      return {
        sessionId,
        taskId: null,
        snapshot: await this.deps.realtime.getResolvedSnapshot(sessionId),
        resourceImpact: null,
        modeEscalation: null,
      };
    }
    const executionEngineDecision = this.decideExecutionEngine({
      message,
      body,
      payload: normalizedComposerPayload,
    });
    if (await this.maybeResolveUniversalApprovalIntent(sessionId, message)) {
      return {
        sessionId,
        taskId: null,
        snapshot: await this.deps.realtime.getResolvedSnapshot(sessionId),
        resourceImpact,
        modeEscalation: this.deps.modeEscalation?.buildSnapshot(sessionId) || null,
        responseDecision: null,
      };
    }
    if (resourceImpact?.heavy) {
      this.deps.realtime.recordAssistantMessage(
        sessionId,
        this.deps.taskResourcePlanner?.renderImpactSummary(resourceImpact) || resourceImpact.userFacingSummary,
        null,
        'resource-impact',
      );
    }
    const actionResult = await this.getComposerActions().maybeHandle({
      sessionId,
      mentions: normalizedComposerPayload.mentions,
      webContext: this.createWebContext(sessionId),
    });
    if (actionResult.handled) {
      return {
        sessionId,
        taskId: actionResult.taskId || null,
        snapshot: actionResult.snapshot || await this.deps.realtime.getResolvedSnapshot(sessionId),
        resourceImpact,
        modeEscalation: this.deps.modeEscalation?.buildSnapshot(sessionId) || null,
      };
    }

    if (this.maybeHandleUnsupportedAttachmentPayload(sessionId, normalizedComposerPayload)) {
      return {
        sessionId,
        taskId: null,
        snapshot: await this.deps.realtime.getResolvedSnapshot(sessionId),
        resourceImpact,
        modeEscalation: this.deps.modeEscalation?.buildSnapshot(sessionId) || null,
        responseDecision: null,
      };
    }

    if (await this.maybeHandleMediaAttachmentConversation(sessionId, message, normalizedComposerPayload)) {
      return {
        sessionId,
        taskId: null,
        snapshot: await this.deps.realtime.getResolvedSnapshot(sessionId),
        resourceImpact,
        modeEscalation: this.deps.modeEscalation?.buildSnapshot(sessionId) || null,
        responseDecision: null,
      };
    }

    if (await this.maybeHandleTextAttachmentConversation(sessionId, message, normalizedComposerPayload)) {
      return {
        sessionId,
        taskId: null,
        snapshot: await this.deps.realtime.getResolvedSnapshot(sessionId),
        resourceImpact,
        modeEscalation: this.deps.modeEscalation?.buildSnapshot(sessionId) || null,
        responseDecision: null,
      };
    }

    const sharedSurfaceHandled = this.composerContext.hasContextualMentions(normalizedComposerPayload.mentions)
      ? false
      : await this.maybeHandleSharedSurface(sessionId, message);
    if (sharedSurfaceHandled) {
      return {
        sessionId,
        taskId: null,
        snapshot: await this.deps.realtime.getResolvedSnapshot(sessionId),
        resourceImpact,
        modeEscalation: this.deps.modeEscalation?.buildSnapshot(sessionId) || null,
      };
    }

    const modeEscalation = this.deps.modeEscalation
      ? this.deps.modeEscalation.evaluateChatRequest({
          sessionId,
          message,
          resourceImpact,
          requestedBy: this.deps.runtime.webUserId,
        })
      : null;
    if (modeEscalation && !modeEscalation.allowed) {
      this.recordModeEscalationMessage(sessionId, modeEscalation);
      return {
        sessionId,
        taskId: null,
        snapshot: await this.deps.realtime.getResolvedSnapshot(sessionId),
        resourceImpact,
        modeEscalation: modeEscalation.snapshot,
      };
    }

    const responseDecision = await this.decideResponse({
      message,
      mentions: normalizedComposerPayload.mentions,
      attachments: normalizedComposerPayload.attachments,
      selectedSkills: normalizedComposerPayload.selectedSkills,
      resourceImpact,
    });

    if (responseDecision.responsePath === 'local-inspector') {
      const fileInspectionHandled = await this.maybeHandleFileInspection(sessionId, message);
      if (fileInspectionHandled) {
        return {
          sessionId,
          taskId: null,
          snapshot: await this.deps.realtime.getResolvedSnapshot(sessionId),
          resourceImpact,
          modeEscalation: modeEscalation?.snapshot || this.deps.modeEscalation?.buildSnapshot(sessionId) || null,
          responseDecision,
        };
      }
    }

    const universalRuntimeHandled = this.composerContext.hasContextualMentions(normalizedComposerPayload.mentions)
      || (responseDecision.responsePath !== 'agent-runtime' && responseDecision.responsePath !== 'approval-gate')
      ? null
      : await this.maybeHandleUniversalAgentRuntime({
          sessionId,
          message,
          mentions: normalizedComposerPayload.mentions,
          composerPayload: {
            mentions: normalizedComposerPayload.mentions,
            attachments: normalizedComposerPayload.attachments,
            selectedSkills: normalizedComposerPayload.selectedSkills,
            voice: normalizedComposerPayload.voice,
            ...providerRouteOverride,
            ...composerRuntimeHints,
          },
          resourceImpact,
          requestedTools: responseDecision.requestedTools,
          responseDecision,
          executionEngineDecision,
        });
    if (universalRuntimeHandled) {
      await this.deps.realtime.captureBaseline(sessionId);
      return {
        sessionId,
        taskId: this.extractTaskIdFromUniversalRun(universalRuntimeHandled),
        snapshot: await this.deps.realtime.getResolvedSnapshot(sessionId),
        resourceImpact,
        modeEscalation: modeEscalation?.snapshot || this.deps.modeEscalation?.buildSnapshot(sessionId) || null,
        responseDecision,
      };
    }

    const directConversationHandled = this.composerContext.hasContextualMentions(normalizedComposerPayload.mentions)
      || responseDecision.responsePath !== 'fast-chat'
      ? null
      : await this.maybeHandleDirectAgentConversation({
          sessionId,
          message,
          requestedTools: responseDecision.requestedTools,
          responseDecision,
          composerPayload: {
            mentions: normalizedComposerPayload.mentions,
            attachments: normalizedComposerPayload.attachments,
            selectedSkills: normalizedComposerPayload.selectedSkills,
            voice: normalizedComposerPayload.voice,
            ...providerRouteOverride,
            ...composerRuntimeHints,
          },
          resourceImpact,
          kind: 'universal-agent-runtime',
          executionEngineDecision,
        });
    if (directConversationHandled) {
      await this.deps.realtime.captureBaseline(sessionId);
      return {
        sessionId,
        taskId: null,
        snapshot: await this.deps.realtime.getResolvedSnapshot(sessionId),
        resourceImpact,
        modeEscalation: modeEscalation?.snapshot || this.deps.modeEscalation?.buildSnapshot(sessionId) || null,
        responseDecision,
      };
    }

    const legacyUnifiedGatewayHandled = this.composerContext.hasContextualMentions(normalizedComposerPayload.mentions)
      || responseDecision.responsePath !== 'fast-chat'
      ? false
      : await this.maybeHandleLegacyUnifiedGatewayIngress(
          sessionId,
          message,
          responseDecision,
          {
            mentions: normalizedComposerPayload.mentions,
            attachments: normalizedComposerPayload.attachments,
            selectedSkills: normalizedComposerPayload.selectedSkills,
            voice: normalizedComposerPayload.voice,
            ...providerRouteOverride,
            ...composerRuntimeHints,
          },
        );
    if (legacyUnifiedGatewayHandled) {
      await this.deps.realtime.captureBaseline(sessionId);
      return {
        sessionId,
        taskId: null,
        snapshot: await this.deps.realtime.getResolvedSnapshot(sessionId),
        resourceImpact,
        modeEscalation: this.deps.modeEscalation?.buildSnapshot(sessionId) || null,
        responseDecision,
      };
    }

    const executionMessage = this.composerContext.buildExecutionText(
      message,
      normalizedComposerPayload.mentions,
    );
    const task = await this.deps.getGatewaySessionTools().sendToSession({
      userId: this.deps.runtime.webUserId,
      platform: 'web',
      chatId: this.deps.realtime.getChatId(sessionId),
      sessionId,
      sourceUserId: sessionId,
      text: executionMessage,
      ctx: this.createWebContext(sessionId),
      mentions: normalizedComposerPayload.mentions,
      composerPayload: {
        mentions: normalizedComposerPayload.mentions,
        attachments: normalizedComposerPayload.attachments,
        selectedSkills: normalizedComposerPayload.selectedSkills,
        voice: normalizedComposerPayload.voice,
        ...providerRouteOverride,
        ...composerRuntimeHints,
      },
    });
    await this.deps.realtime.captureBaseline(sessionId);
    return {
      sessionId,
      taskId: task.taskId || null,
      snapshot: await this.deps.realtime.getResolvedSnapshot(sessionId),
      resourceImpact,
      modeEscalation: modeEscalation?.snapshot || this.deps.modeEscalation?.buildSnapshot(sessionId) || null,
      responseDecision,
      executionEngineDecision,
    };
  }

  private decideExecutionEngine(input: {
    message: string;
    body: RuntimeRecord;
    payload: NormalizedComposerPayload;
  }): ExecutionEngineDecision | null {
    const router = this.deps.executionEngineRouter || null;
    if (!router) return null;
    const targetPath = this.resolveExecutionEngineTargetPath(input.body, input.payload);
    const command = typeof input.body.command === 'string' ? input.body.command : null;
    const content = typeof input.body.content === 'string'
      ? input.body.content
      : this.firstAttachmentText(input.payload);
    return router.decide({
      prompt: input.message,
      operation: this.inferExecutionEngineOperation(input.message, input.body.operation),
      targetPath,
      command,
      content,
      requestedEngineId: this.normalizeExecutionEngineId(input.body.engineId),
      networkTargets: Array.isArray(input.body.networkTargets)
        ? input.body.networkTargets.filter((value): value is string => typeof value === 'string')
        : [],
    });
  }

  private inferExecutionEngineOperation(
    message: string,
    explicit: unknown,
  ): ExecutionEngineRouteOperation {
    if (
      explicit === 'chat' || explicit === 'read' || explicit === 'summarize' || explicit === 'code-question'
      || explicit === 'write' || explicit === 'delete' || explicit === 'shell' || explicit === 'network'
      || explicit === 'deploy' || explicit === 'transaction'
    ) {
      return explicit;
    }
    if (/\b(rm\s+-rf|remove-item|del\s+\/s|git\s+reset|git\s+clean)\b/i.test(message)) return 'shell';
    if (/\b(deploy|release|publish)\b/i.test(message)) return 'deploy';
    if (/\b(create|edit|write|modify|patch|apply|delete|remove|rename|move|criar|editar|apagar|remover)\b/i.test(message)) return 'write';
    if (/\b(read|summari[sz]e|resuma|summary)\b/i.test(message)) return 'summarize';
    if (/\b(code|function|class|bug|error|stack|typescript|react|vite)\b/i.test(message)) return 'code-question';
    return 'chat';
  }

  private buildProviderRouteOverride(body: RuntimeRecord): RuntimeRecord {
    return resolveComposerModelRouteOverride(body);
  }

  private buildComposerRuntimeHints(body: RuntimeRecord, message: string): RuntimeRecord {
    const metadata = this.recordOrNull(body.metadata) || {};
    const composerSettings = this.recordOrNull(body.composerSettings);
    const rawExperienceProfile = body.experienceProfile ?? metadata.experienceProfile;
    const experienceProfile = typeof rawExperienceProfile === 'string'
      ? rawExperienceProfile.trim()
      : this.recordOrNull(rawExperienceProfile);
    const workflowIntent = this.recordOrNull(body.workflowIntent) || this.recordOrNull(metadata.workflowIntent);
    const engineDecision = this.recordOrNull(body.engineDecision);
    const profileForEffort = typeof experienceProfile === 'string'
      ? experienceProfile
      : experienceProfile?.id || experienceProfile?.label || null;
    const effortLevel = this.resolveComposerEffortLevel(
      composerSettings?.effort
      || workflowIntent?.effort
      || body.effort
      || metadata.effort,
    );
    const effortControl = this.effortControl.buildSnapshot({
      level: effortLevel,
      request: message,
      profile: profileForEffort,
    });
    const requestedFanout = Number(workflowIntent?.maxFanout);
    const maxFanout = Number.isFinite(requestedFanout) && requestedFanout > 0
      ? Math.min(Math.max(1, Math.floor(requestedFanout)), effortControl.budget.maxSubagents)
      : effortControl.budget.maxSubagents;
    const dynamicWorkflow = workflowIntent
      ? {
          source: workflowIntent.source || 'zavorthControl',
          kind: workflowIntent.kind || null,
          command: workflowIntent.command || null,
          recommended: Boolean(workflowIntent.dynamicWorkflow || effortControl.routing.dynamicWorkflowsRecommended),
          budgetGuardRequired: true,
          finalSynthesisRequired: true,
          effortLevel: effortControl.effectiveLevel,
          maxFanout,
          rawSecretsSerialized: false,
        }
      : null;

    return {
      ...(composerSettings ? { composerSettings } : {}),
      ...(experienceProfile ? { experienceProfile } : {}),
      ...(workflowIntent ? { workflowIntent } : {}),
      ...(dynamicWorkflow ? { dynamicWorkflow } : {}),
      ...(engineDecision ? { engineDecision } : {}),
      ...(typeof body.engineId === 'string' && body.engineId.trim() ? { engineId: body.engineId.trim() } : {}),
      effortControl,
    };
  }

  private resolveComposerEffortLevel(value: unknown): 'low' | 'standard' | 'high' | 'ultra-code' {
    const normalized = String(value || '').trim().toLowerCase().replace(/_/g, '-');
    if (normalized === 'low' || normalized === 'fast' || normalized === 'light') return 'low';
    if (normalized === 'deep' || normalized === 'high' || normalized === 'heavy') return 'high';
    if (normalized === 'ultra' || normalized === 'ultra-code' || normalized === 'max') return 'ultra-code';
    return 'standard';
  }

  private recordOrNull(value: unknown): RuntimeRecord | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as RuntimeRecord
      : null;
  }

  private resolveExecutionEngineTargetPath(
    body: RuntimeRecord,
    payload: NormalizedComposerPayload,
  ): string | null {
    if (typeof body.targetPath === 'string' && body.targetPath.trim()) return body.targetPath;
    for (const attachment of payload.attachments) {
      const record = attachment as unknown as RuntimeRecord;
      const candidate = String(
        record.localPath
        || record.path
        || attachment.name
        || '',
      ).trim();
      if (candidate) return candidate;
    }
    return null;
  }

  private firstAttachmentText(payload: NormalizedComposerPayload): string | null {
    const attachment = payload.attachments.find((item) => String(item.text || '').trim());
    return attachment ? String(attachment.text || '') : null;
  }

  private normalizeExecutionEngineId(value: unknown): ExecutionEngineId | null {
    return value === 'lite' || value === 'velocity' || value === 'shield' ? value : null;
  }

  private async maybeResolveUniversalApprovalIntent(sessionId: string, message: string): Promise<boolean> {
    const agentGateway = this.deps.agentGateway || null;
    const text = String(message || '').trim();
    if (!agentGateway || !text || text.startsWith('/')) {
      return false;
    }

    const intentResult: UniversalApprovalIntentDecisionResult = await agentGateway.resolveApprovalIntent({
      text,
      source: 'text',
      channel: 'web',
      userId: this.deps.runtime.webUserId,
      sessionId,
    });
    if (intentResult.resolution.status === 'not_approval_intent') {
      return false;
    }

    await this.deliverWebOutput(
      sessionId,
      renderUniversalApprovalIntentDecisionResult(intentResult),
      'universal-approval-intent',
      text,
    );
    return true;
  }

  private async maybeHandleFileInspection(sessionId: string, message: string): Promise<boolean> {
    if (!this.fileInspectionService.shouldHandleNaturalQuery(message)) {
      return false;
    }
    const plan = await this.fileInspectionService.prepare(message);
    if (plan.kind === 'permission') {
      this.deps.realtime.recordAssistantMessage(
        sessionId,
        [
          'Para analisar essa pasta, preciso de autorizacao de acesso local.',
          '',
          `Pasta solicitada: ${plan.previewPath}`,
          plan.reason,
        ].filter(Boolean).join('\n'),
        null,
        'file-inspection-permission',
      );
      return true;
    }
    this.deps.realtime.recordAssistantMessage(
      sessionId,
      plan.text,
      null,
      'file-inspection',
    );
    return true;
  }

  private async maybeHandleTextAttachmentConversation(
    sessionId: string,
    message: string,
    payload: NormalizedComposerPayload,
  ): Promise<boolean> {
    const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
    const readableAttachments = attachments.filter((attachment) => String(attachment.text || '').trim());
    if (readableAttachments.length === 0) {
      return false;
    }
    if (payload.selectedSkills.length > 0 || this.composerContext.hasContextualMentions(payload.mentions)) {
      return false;
    }
    if (this.isExplicitAttachmentDeliverableRequest(message)) {
      return false;
    }

    const modelPrompt = this.buildAttachmentConversationPrompt(message, readableAttachments);
    const handledByAgentGateway = await this.maybeHandleDirectAgentConversation({
      sessionId,
      message: modelPrompt,
      requestedTools: [],
      responseDecision: null,
      composerPayload: {
        mentions: payload.mentions,
        attachments: payload.attachments,
        selectedSkills: payload.selectedSkills,
        voice: payload.voice,
        originalMessage: message,
        attachmentConversation: true,
      },
      resourceImpact: null,
      userVisibleText: message,
      kind: 'attachment-conversation',
    });
    if (handledByAgentGateway) {
      return true;
    }

    const handledByGateway = await this.maybeHandleLegacyUnifiedGatewayIngress(
      sessionId,
      modelPrompt,
      null,
      {
        mentions: payload.mentions,
        attachments: payload.attachments,
        selectedSkills: payload.selectedSkills,
        voice: payload.voice,
        originalMessage: message,
        attachmentConversation: true,
      },
      {
        userVisibleText: message,
        kind: 'attachment-conversation',
      },
    );
    if (handledByGateway) {
      return true;
    }

    this.deps.realtime.recordAssistantMessage(
      sessionId,
      this.buildLocalAttachmentConversationReply(message, readableAttachments),
      null,
      'attachment-conversation',
    );
    return true;
  }

  private async maybeHandleMediaAttachmentConversation(
    sessionId: string,
    message: string,
    payload: NormalizedComposerPayload,
  ): Promise<boolean> {
    const mediaAttachments = this.getReadyMediaAttachments(payload.attachments);
    if (mediaAttachments.length === 0) {
      return false;
    }
    if (payload.selectedSkills.length > 0 || this.composerContext.hasContextualMentions(payload.mentions)) {
      return false;
    }

    const prompt = this.buildMediaAttachmentPrompt(message, mediaAttachments);
    const results = await Promise.all(mediaAttachments.slice(0, 3).map((attachment) =>
      this.analyzeInlineMediaAttachment(sessionId, attachment, message)));
    const successful = results.filter((result) => result.ok);

    if (successful.length > 0) {
      this.deps.realtime.recordAssistantMessage(
        sessionId,
        this.renderMediaUnderstandingReply(message, mediaAttachments, results),
        null,
        'media-understanding',
      );
      return true;
    }

    const handledByAgentGateway = await this.maybeHandleDirectAgentConversation({
      sessionId,
      message: prompt,
      requestedTools: ['media.understand'],
      responseDecision: null,
      composerPayload: {
        mentions: payload.mentions,
        attachments: payload.attachments,
        selectedSkills: payload.selectedSkills,
        voice: payload.voice,
        originalMessage: message,
        mediaConversation: true,
        inlineData: buildInlineDataFromAttachments(mediaAttachments),
      },
      resourceImpact: null,
      userVisibleText: message,
      kind: 'media-understanding',
    });
    if (handledByAgentGateway) {
      return true;
    }

    const handledByGateway = await this.maybeHandleLegacyUnifiedGatewayIngress(
      sessionId,
      prompt,
      null,
      {
        mentions: payload.mentions,
        attachments: payload.attachments,
        selectedSkills: payload.selectedSkills,
        voice: payload.voice,
        originalMessage: message,
        mediaConversation: true,
        inlineData: buildInlineDataFromAttachments(mediaAttachments),
      },
      {
        userVisibleText: message,
        kind: 'media-understanding',
      },
    );
    if (handledByGateway) {
      return true;
    }

    this.deps.realtime.recordAssistantMessage(
      sessionId,
      this.renderMediaUnderstandingReply(message, mediaAttachments, results),
      null,
      'media-understanding',
    );
    return true;
  }

  private async analyzeInlineMediaAttachment(
    sessionId: string,
    attachment: WebComposerAttachment,
    message: string,
  ): Promise<{
    ok: boolean;
    name: string;
    type: string;
    summary: string;
    text: string | null;
    error: string | null;
    attempts?: Array<{ provider: string; model: string | null; status: string; reason: string | null; latencyMs: number }>;
  }> {
    const media = resolveReadyMediaAttachment(attachment);
    if (!media) {
      return {
        ok: false,
        name: attachment.name,
        type: attachment.type,
        summary: 'Media payload was not available.',
        text: null,
        error: 'missing-media-payload',
      };
    }

    if (media.kind === 'audio') {
      const audioResult = await this.audioTranscription.transcribe({
        audio: Buffer.from(media.content, 'base64'),
        mimeType: media.mimeType,
        fileName: attachment.name,
        prompt: message,
        sessionId,
        language: null,
      });
      return {
        ok: audioResult.ok,
        name: attachment.name,
        type: media.mimeType,
        summary: audioResult.ok
          ? `Audio transcribed with ${audioResult.provider || 'configured'} speech provider.`
          : 'Audio transcription failed.',
        text: audioResult.text,
        error: audioResult.error,
        attempts: audioResult.attempts,
      };
    }

    try {
      const result = await this.mediaUnderstanding.analyze({
        source: {
          kind: 'buffer',
          data: Buffer.from(media.content, 'base64'),
          contentType: media.mimeType,
          fileName: attachment.name,
        },
        modality: media.kind,
        analysisType: this.resolveMediaAnalysisType(message),
        prompt: message,
        sessionId,
        providerHints: {
          surface: 'zavorth-control',
          fileName: attachment.name,
          responseLanguage: 'English',
        },
      });
      const analysisText = result.analysis?.answer
        || result.analysis?.extractedText
        || result.analysis?.description
        || result.summary;
      return {
        ok: result.ok,
        name: attachment.name,
        type: media.mimeType,
        summary: result.summary,
        text: String(analysisText || '').trim() || null,
        error: result.error?.message || null,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Web App Conversation] string operation failed', error);
    return {
        ok: false,
        name: attachment.name,
        type: media.mimeType,
        summary: 'Media analysis could not run.',
        text: null,
        error: error instanceof Error ? err.message : String(error),
      };
  }
  }

  private renderMediaUnderstandingReply(
    message: string,
    attachments: WebComposerAttachment[],
    results: Array<{ ok: boolean; name: string; type: string; summary: string; text: string | null; error: string | null }>,
  ): string {
    const successful = results.filter((result) => result.ok && result.text);
    if (successful.length > 0) {
      return [
        successful.length === 1
          ? `I analyzed ${successful[0].name}.`
          : `I analyzed ${successful.length} media files.`,
        '',
        ...successful.map((result) => [
          `**${result.name}**`,
          result.text,
        ].join('\n')),
      ].join('\n\n');
    }

    const reasons = results
      .map((result) => result.error || result.summary)
      .filter(Boolean)
      .slice(0, 3);
    return [
      attachments.length === 1
        ? `I received ${attachments[0].name} as a real media payload.`
        : `I received ${attachments.length} media files as real payloads.`,
      '',
      'Media understanding is wired in the backend, but no configured multimodal provider completed this analysis yet.',
      reasons.length ? `Reason: ${reasons.join(' | ')}` : null,
      '',
      `Your request: ${message}`,
    ].filter(Boolean).join('\n');
  }

  private buildMediaAttachmentPrompt(message: string, attachments: WebComposerAttachment[]): string {
    return [
      'The user attached media through Zavorth Control.',
      'Analyze the inline image/audio payloads directly. For images, describe visible content and extract readable text when useful. For audio, transcribe or summarize the spoken content.',
      'Answer naturally and do not mention internal payload IDs, gateway internals, or implementation details.',
      '',
      `User request: ${message}`,
      '',
      'Attached media:',
      ...attachments.map((attachment) =>
        `- ${attachment.name} (${attachment.type || 'application/octet-stream'}, ${attachment.size || 0} bytes)`),
    ].join('\n');
  }

  private resolveMediaAnalysisType(message: string): MediaAnalysisType {
    const normalized = String(message || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/\b(ocr|extract|extraction|transcribe|transcription|transcrev|extrai|extraia|leia|read text)\b/.test(normalized)) {
      return 'extract';
    }
    if (/\b(what|who|where|when|why|how|qual|quem|onde|quando|por que|como|\?)\b/.test(normalized)) {
      return 'qa';
    }
    return 'describe';
  }

  private getReadyMediaAttachments(attachments: WebComposerAttachment[]): WebComposerAttachment[] {
    return getReadyMediaAttachments(attachments);
  }

  private isExplicitAttachmentDeliverableRequest(message: string): boolean {
    return /\b(pdf|relat[oó]rio|documento|arquivo\s+final|artefato|salve|exporte|ger[eê]|crie)\b/i.test(
      String(message || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
    );
  }

  private buildAttachmentConversationPrompt(
    message: string,
    attachments: Array<{ name: string; type: string; size: number; text?: string | null; truncated?: boolean }>,
  ): string {
    const profiles = this.profileTextAttachments(attachments);
    const context = profiles.map((profile, index) => (
      this.attachmentIntelligence.renderPromptSection(profile, index)
    )).join('\n\n---\n\n');

    return [
      'O usuario enviou anexos textuais pelo ZavorthControl.',
      'Voce e o analista de arquivos do Zavorth. Responda com qualidade de produto: identifique formato, sinais estruturais, riscos e limites honestos.',
      'Responda ao pedido usando o conteudo e o perfil automatico dos anexos, em linguagem natural.',
      'Se o arquivo parecer token, chave, hash, Base64, Base64URL ou URL-encoded, diga isso claramente e cite os sinais observaveis.',
      'Nao mencione IDs internos, runs, pipeline, payload, gateway ou que voce preparou execucao.',
      'Nao crie artefato, relatorio ou run para perguntas simples sobre anexos.',
      'Nao repita nem decodifique o conteudo bruto inteiro quando ele parecer sensivel; explique a estrutura.',
      'Evite resposta generica de uma frase. Entregue uma analise curta, util e especifica.',
      '',
      `Pedido do usuario: ${message}`,
      '',
      context,
    ].join('\n');
  }

  private buildLocalAttachmentConversationReply(
    message: string,
    attachments: Array<{ name: string; type: string; size: number; text?: string | null; truncated?: boolean }>,
  ): string {
    return this.attachmentIntelligence.renderLocalReply({
      message,
      profiles: this.profileTextAttachments(attachments),
    });
  }

  private describeAttachmentText(text: string): string {
    const profile = this.attachmentIntelligence.profileTextAttachment({ text });
    return this.attachmentIntelligence.renderLocalReply({
      profiles: [profile],
    });
  }

  private profileTextAttachments(
    attachments: Array<{ name: string; type: string; size: number; text?: string | null; truncated?: boolean }>,
  ): AttachmentTextProfile[] {
    return attachments.slice(0, 5).map((attachment) => this.attachmentIntelligence.profileTextAttachment({
      name: attachment.name,
      type: attachment.type,
      size: attachment.size,
      text: attachment.text,
      truncated: attachment.truncated,
    }));
  }

  private maybeHandleUnsupportedAttachmentPayload(
    sessionId: string,
    payload: {
      attachments?: WebComposerAttachment[];
    },
  ): boolean {
    const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
    if (attachments.length === 0) {
      return false;
    }

    const unsupported = attachments.filter((attachment) =>
      !String(attachment.text || '').trim() && !resolveReadyMediaAttachment(attachment));
    if (unsupported.length === 0) {
      return false;
    }

    const lines = [
      unsupported.length === attachments.length
        ? 'I received the attachment, but it arrived as metadata only; chegou apenas como metadados.'
        : 'I received the attachments. Some arrived as metadata only and will not be analyzed now.',
      '',
      ...unsupported.slice(0, 5).map((attachment) => `- ${attachment.name} (${attachment.type || 'unknown type'}, ${attachment.size || 0} bytes)`),
      '',
      'To analyze it directly, send a readable text/document file, image/audio under the media limit, or point Zavorth to a local file it can access.',
    ];
    this.deps.realtime.recordAssistantMessage(
      sessionId,
      lines.join('\n'),
      null,
      unsupported.length === attachments.length ? 'attachment-unsupported' : 'attachment-warning',
    );

    return unsupported.length === attachments.length;
  }

  private async planResourceImpact(message: string): Promise<TaskResourceImpact | null> {
    if (!this.deps.taskResourcePlanner) {
      return null;
    }

    let timeoutHandle: NodeJS.Timeout | null = null;
    try {
      const result = await Promise.race<TaskResourceImpact | null>([
        this.deps.taskResourcePlanner.planChatTask(message, {
          preferCachedWithinMs: 15_000,
          requestedBy: this.deps.runtime.webUserId,
        }),
        new Promise<null>((resolve) => {
          timeoutHandle = setTimeout(() => resolve(null), 750);
          timeoutHandle.unref?.();
        }),
      ]);
      return result;
    } catch (error: unknown) {logger.warn('[Web App Conversation] cache operation failed', error); return null; } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private async decideResponse(input: {
    message: string;
    mentions: NormalizedComposerPayload['mentions'];
    attachments?: NormalizedComposerPayload['attachments'];
    selectedSkills?: NormalizedComposerPayload['selectedSkills'];
    resourceImpact: TaskResourceImpact | null;
  }): Promise<ZavorthResponseDecision> {
    return this.surfaceOperationalIntentService.decideResponse({
      surface: 'web',
      text: input.message,
      hasContextualMentions: this.composerContext.hasContextualMentions(input.mentions),
      hasAttachments: Array.isArray(input.attachments) && input.attachments.length > 0,
      capabilityIds: Array.isArray(input.selectedSkills)
        ? input.selectedSkills.map((skill) => String(skill.id || '').trim()).filter(Boolean)
        : [],
      resourceImpact: input.resourceImpact,
    });
  }

  private async maybeHandleUniversalAgentRuntime(input: {
    sessionId: string;
    message: string;
    mentions: NormalizedComposerPayload['mentions'];
    composerPayload: RuntimeRecord;
    resourceImpact: TaskResourceImpact | null;
    requestedTools: string[];
    responseDecision: ZavorthResponseDecision;
    executionEngineDecision?: ExecutionEngineDecision | null;
  }): Promise<UniversalAgentRunResult | null> {
    const agentGateway = this.deps.agentGateway || null;
    const text = String(input.message || '').trim();
    if (!agentGateway || !text || text.startsWith('/')) {
      return null;
    }

    const requestedTools = input.requestedTools;
    const executor: UniversalAgentExecutor = async ({ run }) => {
      const executionMessage = this.composerContext.buildExecutionText(
        text,
        input.mentions,
      );
      const task = await this.deps.getGatewaySessionTools().sendToSession({
        userId: this.deps.runtime.webUserId,
        platform: 'web',
        chatId: this.deps.realtime.getChatId(input.sessionId),
        sessionId: input.sessionId,
        sourceUserId: input.sessionId,
        text: executionMessage,
        ctx: this.createWebContext(input.sessionId),
        mentions: input.mentions,
        composerPayload: input.composerPayload,
      });

      return {
        status: task.taskId ? 'running' : 'completed',
        summary: task.taskId
          ? 'Pedido encaminhado pelo motor universal para execucao supervisionada.'
          : 'Pedido processado pelo motor universal.',
        replyText: task.taskId
          ? 'Recebi. Encaminhei para execucao supervisionada e vou mostrar o resultado aqui.'
          : 'Recebi. O motor universal processou a solicitacao.',
        events: [
          {
            kind: 'tool',
            title: 'Despacho supervisionado',
            detail: task.taskId
              ? `Task ${task.taskId} criada a partir do run ${run.id}.`
              : 'A execucao nao retornou task rastreavel.',
            status: 'done',
            metadata: {
              taskId: task.taskId || null,
              effortControl: input.composerPayload?.effortControl || null,
              workflowIntent: input.composerPayload?.workflowIntent || null,
              dynamicWorkflow: input.composerPayload?.dynamicWorkflow || null,
            },
          },
        ],
        metadata: {
          taskId: task.taskId || null,
          responseDecision: input.responseDecision,
          executionEngineDecision: input.executionEngineDecision || null,
          effortControl: input.composerPayload?.effortControl || null,
          workflowIntent: input.composerPayload?.workflowIntent || null,
          dynamicWorkflow: input.composerPayload?.dynamicWorkflow || null,
        },
      };
    };

    const result = await agentGateway.handle({
      userId: this.deps.runtime.webUserId,
      channel: 'web',
      sessionId: input.sessionId,
      text,
      workspace: resourceWorkspace(input.resourceImpact),
      requestedTools,
      modelProfile: {
        providerLabel: this.resolveCurrentProviderLabel(),
        modelLabel: this.resolveCurrentModelLabel(),
        routingPolicy: 'gateway',
        supportsTools: true,
      },
      metadata: {
        transport: 'web',
        sessionId: input.sessionId,
        resourceImpact: input.resourceImpact,
        responseDecision: input.responseDecision,
        artifactPolicy: input.responseDecision.artifactPolicy,
        composerPayload: input.composerPayload,
        effortControl: input.composerPayload?.effortControl || null,
        workflowIntent: input.composerPayload?.workflowIntent || null,
        dynamicWorkflow: input.composerPayload?.dynamicWorkflow || null,
        providerName: input.composerPayload?.providerName || null,
        modelName: input.composerPayload?.modelName || null,
        allowProviderFallback: input.composerPayload?.allowProviderFallback !== false,
      },
    }, {
      executor,
    });

    const primaryReply = result.replies[0]?.text;
    if (primaryReply) {
      const approval = result.run.approvals.find((entry) => entry.status === 'pending') || null;
      const rendered = this.responseRenderer.render({
        text: primaryReply,
        channel: 'web',
        audience: 'normal-user',
        run: result.run,
        approvalId: approval?.id || null,
        approvalStatus: approval?.status || null,
      }).text;
      await this.deliverWebOutput(input.sessionId, rendered, 'universal-agent-runtime', text);
    }
    return result;
  }

  private async maybeHandleDirectAgentConversation(input: {
    sessionId: string;
    message: string;
    requestedTools: string[];
    responseDecision: ZavorthResponseDecision | null;
    composerPayload?: RuntimeRecord | null;
    resourceImpact: TaskResourceImpact | null;
    userVisibleText?: string;
    kind?: string;
    executionEngineDecision?: ExecutionEngineDecision | null;
  }): Promise<UniversalAgentRunResult | null> {
    const agentGateway = this.deps.agentGateway || null;
    const text = String(input.message || '').trim();
    if (!agentGateway || !text || text.startsWith('/')) {
      return null;
    }

    const result = await agentGateway.handle({
      userId: this.deps.runtime.webUserId,
      channel: 'web',
      sessionId: input.sessionId,
      text,
      workspace: resourceWorkspace(input.resourceImpact),
      requestedTools: input.requestedTools,
      modelProfile: {
        providerLabel: this.resolveCurrentProviderLabel(),
        modelLabel: this.resolveCurrentModelLabel(),
        routingPolicy: 'gateway',
        supportsTools: true,
      },
      metadata: {
        transport: 'web',
        sessionId: input.sessionId,
        resourceImpact: input.resourceImpact,
        responseDecision: input.responseDecision,
        artifactPolicy: input.responseDecision?.artifactPolicy || null,
        composerPayload: input.composerPayload || null,
        effortControl: input.composerPayload?.effortControl || null,
        workflowIntent: input.composerPayload?.workflowIntent || null,
        dynamicWorkflow: input.composerPayload?.dynamicWorkflow || null,
        providerName: input.composerPayload?.providerName || null,
        modelName: input.composerPayload?.modelName || null,
        allowProviderFallback: input.composerPayload?.allowProviderFallback !== false,
        executionEngineDecision: input.executionEngineDecision || null,
        legacyUnifiedGatewayAvailable: Boolean(this.resolveLegacyUnifiedGateway()),
        legacyUnifiedGatewayBypassed: Boolean(this.resolveLegacyUnifiedGateway()),
      },
    });

    const primaryReply = result.replies[0]?.text;
    if (primaryReply) {
      const rendered = this.responseRenderer.render({
        text: primaryReply,
        channel: 'web',
        audience: 'normal-user',
        run: result.run,
        includeTechnicalFooter: false,
      }).text;
      await this.deliverWebOutput(
        input.sessionId,
        rendered,
        input.kind || 'universal-agent-runtime',
        input.userVisibleText || text,
      );
    }
    return result;
  }

  private extractTaskIdFromUniversalRun(result: UniversalAgentRunResult): string | null {
    const metadataTaskId = String(result.run.metadata?.taskId || '').trim();
    if (metadataTaskId) {
      return metadataTaskId;
    }
    for (const event of result.run.events) {
      const taskId = String(event.metadata?.taskId || '').trim();
      if (taskId) {
        return taskId;
      }
    }
    return null;
  }

  private resolveCurrentProviderLabel(): string {
    const runtimeProvider = String(
      runtimeField(this.deps.runtime, 'providerLabel')
      || runtimeField(this.deps.runtime, 'provider')
      || '',
    ).trim();
    if (runtimeProvider) {
      return runtimeProvider;
    }

    switch (this.normalizeProviderName((config.llmProvider || ''))) {
      case 'aigateway':
        return 'Zavorth Gateway';
      case 'gemini':
        return 'Gemini';
      case 'deepseek':
        return 'DeepSeek';
      case 'openai':
        return 'OpenAI';
      case 'minimax':
        return 'MiniMax';
      case 'openrouter':
        return 'OpenRouter';
      case 'qwen':
      case 'puter':
        return 'Qwen';
      case 'opencode':
        return 'OpenCode';
      case 'ollama':
        return 'Ollama';
      default:
        return 'Provider nao informado';
    }
  }

  private resolveCurrentModelLabel(): string {
    const runtimeModel = String(
      runtimeField(this.deps.runtime, 'modelLabel')
      || runtimeField(this.deps.runtime, 'model')
      || '',
    ).trim();
    if (runtimeModel) {
      return runtimeModel;
    }

    switch (this.normalizeProviderName((config.llmProvider || ''))) {
      case 'aigateway':
        return config.AIGatewayModel || 'modelo atual nao informado';
      case 'gemini':
        return config.geminiModel || 'modelo atual nao informado';
      case 'deepseek':
        return config.deepseekModel || 'modelo atual nao informado';
      case 'openai':
        return config.openaiModel || 'modelo atual nao informado';
      case 'minimax':
        return config.minimaxModel || 'modelo atual nao informado';
      case 'openrouter':
        return config.openRouterModel || 'modelo atual nao informado';
      case 'qwen':
      case 'puter':
        return config.qwenModel || 'modelo atual nao informado';
      case 'opencode':
        return config.openCodeModel || 'modelo atual nao informado';
      default:
        return 'modelo atual nao informado';
    }
  }

  private normalizeProviderName(provider: string): string {
    return String(provider || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  }

  private getComposerActions(): ComposerActionService {
    if (!this.composerActions) {
      this.composerActions = new ComposerActionService({
        taskManager: this.deps.runtime.taskManager as unknown as ComposerActionOptions['taskManager'],
        permissionController: this.deps.runtime.permissionController as unknown as ComposerActionOptions['permissionController'],
        workflowController: this.deps.runtime.workflowController as unknown as ComposerActionOptions['workflowController'],
        realtime: this.deps.realtime,
      });
    }

    return this.composerActions;
  }

  private async maybeHandleSharedSurface(sessionId: string, message: string): Promise<boolean> {
    const surfaceApi = createInternalSurfaceCommandApi(this.deps.getSharedSurfaceCommandService?.() || null);
    if (!surfaceApi) {
      return false;
    }

    const ctx: IMessageContext = {
      platform: 'web',
      userId: this.deps.runtime.webUserId,
      chatId: this.deps.realtime.getChatId(sessionId),
      isGroup: false,
      rawText: message,
      channelId: sessionId,
      threadId: sessionId,
      transport: message.trim().startsWith('/') ? 'slash_command' : 'text',
      composerPayload: null,
      reply: async (text: string) => {
        await this.deliverWebOutput(sessionId, text, 'shared-surface', message);
      },
      editMessage: async (_messageId: string, text: string) => {
        this.deps.realtime.recordAssistantMessage(
          sessionId,
          String(text || '').trim() || '(mensagem vazia)',
          null,
          'shared-surface-edit',
        );
      },
    };

    const result = await surfaceApi.handleCommand({
      context: ctx,
      request: {
        surface: 'web',
        requestedBy: this.deps.runtime.webUserId,
        chatId: this.deps.realtime.getChatId(sessionId),
        threadId: sessionId,
        correlation: {
          sessionId,
        },
        metadata: {
          sessionId,
          transport: ctx.transport,
        },
      },
    });
    if (result.status === 'not_handled') {
      return false;
    }
    if (!result.ok && result.messages.length === 0 && result.summary) {
      this.deps.realtime.recordAssistantMessage(
        sessionId,
        result.summary,
        null,
        'shared-surface-error',
      );
    }
    return true;
  }

  private async maybeHandleLegacyUnifiedGatewayIngress(
    sessionId: string,
    message: string,
    responseDecision?: ZavorthResponseDecision | null,
    composerPayload?: RuntimeRecord | null,
    options: { userVisibleText?: string; kind?: string } = {},
  ): Promise<boolean> {
    const legacyUnifiedGateway = this.deps.agentGateway ? null : this.resolveLegacyUnifiedGateway();
    const text = String(message || '').trim();
    if (!legacyUnifiedGateway || !text || text.startsWith('/')) {
      return false;
    }
    const inlineData = extractInlineDataFromComposerPayload(composerPayload);

    await legacyUnifiedGateway.handleEvent({
      surface: 'web',
      chatId: this.deps.realtime.getChatId(sessionId),
      userId: this.deps.runtime.webUserId,
      text,
      isGroup: false,
      inlineData,
      reply: async (replyText: string) => {
        await this.deliverWebOutput(
          sessionId,
          replyText,
          options.kind || 'unified-gateway',
          options.userVisibleText || text,
        );
      },
      metadata: {
        phase: 'legacy-unified-conversation-fallback-v1',
        transport: 'text',
        sessionId,
        channelId: sessionId,
        threadId: sessionId,
        isVoiceInput: inlineData.some((entry) => /^audio\//i.test(entry.mimeType)),
        responseDecision: responseDecision || null,
        composerPayload: composerPayload || null,
      },
    });
    return true;
  }

  private resolveLegacyUnifiedGateway(): SharedSurfaceRuntime['legacyUnifiedGateway'] {
    return this.deps.runtime.legacyUnifiedGateway || null;
  }

  private recordModeEscalationMessage(sessionId: string, evaluation: ModeEscalationEvaluation): void {
    if (!evaluation.request) {
      return;
    }
    const request = evaluation.request;
    const reasons = request.reasons.slice(0, 3).map((entry) => `- ${entry}`);
    this.deps.realtime.recordAssistantMessage(
      sessionId,
      [
        `Para seguir com isso, eu preciso elevar do modo ${request.effectiveMode.id} para ${request.requiredMode.id}.`,
        '',
        request.summary,
        '',
        ...reasons,
        '',
        `Escopo sugerido: ${request.recommendedScope}.`,
        `Fallback leve: ${request.fallback}`,
        `Aprovacao rapida: /mode approve ${request.id} [once|session|host]`,
      ].filter(Boolean).join('\n'),
      null,
      'mode-escalation',
    );
  }

  private async deliverWebOutput(
    sessionId: string,
    text: string,
    kind: string,
    rawInput: string,
  ): Promise<void> {
    const outputStage = this.deps.runtime.echoOutputStage || null;
    if (!outputStage) {
      this.deps.realtime.recordAssistantMessage(
        sessionId,
        String(text || '').trim() || '(mensagem vazia)',
        null,
        kind,
      );
      return;
    }

    await outputStage.deliver({
      surface: 'web',
      text,
      rawInput,
      requestedBy: this.deps.runtime.webUserId,
      sessionId,
      sink: {
        sendText: async (nextText) => {
          this.deps.realtime.recordAssistantMessage(
            sessionId,
            String(nextText || '').trim() || '(mensagem vazia)',
            null,
            kind,
          );
        },
      },
    });
  }
}

function asRuntimeRecord(value: unknown): RuntimeRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RuntimeRecord : null;
}

function runtimeField(value: unknown, key: string): unknown {
  return asRuntimeRecord(value)?.[key];
}

function resourceWorkspace(resourceImpact: TaskResourceImpact | null): string | null {
  const workspace = String(asRuntimeRecord(resourceImpact)?.workspace || '').trim();
  return workspace || null;
}
