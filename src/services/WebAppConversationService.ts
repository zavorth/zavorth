import {
  presentUniversalApprovalIntentDecision,
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
import type { ModeEscalationEvaluation, ModeEscalationSnapshot } from '../contracts/ModeEscalationContract.js';
import type { ModeEscalationService } from './ModeEscalationService.js';
import type {
  ZavorthAgentGateway,
  UniversalApprovalIntentDecisionResult,
  UniversalAgentExecutor,
  UniversalAgentRunResult,
} from '../runtime/agent/index.js';

import { SurfaceOperationalIntentService } from './SurfaceOperationalIntentService.js';
import { AttachmentIntelligenceService, type AttachmentTextProfile } from './AttachmentIntelligenceService.js';
import { ZavorthUserResponseRendererService } from './ZavorthUserResponseRendererService.js';
import { MediaUnderstandingService } from './MediaUnderstandingService.js';
import type { WebComposerAttachment } from '../contracts/WebComposer.js';
import type { MediaAnalysisType } from '../contracts/MediaUnderstandingContract.js';
import { AudioTranscriptionService } from './AudioTranscriptionService.js';
import type { ExecutionEngineDecision, ExecutionEngineId } from '../contracts/ExecutionEngineContract.js';
import type { ExecutionEngineRouteOperation, ExecutionEngineRouterService } from './ExecutionEngineRouterService.js';

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
import { WebAppConversationMediaSupport } from './WebAppConversationMediaSupport.js';
import {
  firstAttachmentText,
  normalizeExecutionEngineId,
  normalizeProviderName,
  recordOrNull,
  resolveComposerEffortLevel,
  resolveExecutionEngineTargetPath,
} from './web-app-conversation-helpers/WebAppConversationPureHelpers.js';

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
  private readonly attachmentIntelligence = new AttachmentIntelligenceService();
  private readonly mediaUnderstanding = new MediaUnderstandingService();
  private readonly audioTranscription = new AudioTranscriptionService({
    mediaUnderstanding: this.mediaUnderstanding,
  });
  private readonly mediaSupport: WebAppConversationMediaSupport;
  private readonly effortControl = new ZavorthEffortControlService();
  private readonly surfaceOperationalIntentService: Pick<SurfaceOperationalIntentService, 'decideResponse'>;
  private readonly responseRenderer = new ZavorthUserResponseRendererService();

  constructor(private readonly deps: WebAppConversationDeps) {
    this.mediaSupport = new WebAppConversationMediaSupport({
      audioTranscription: this.audioTranscription,
      mediaUnderstanding: this.mediaUnderstanding,
      attachmentIntelligence: this.attachmentIntelligence,
      realtime: deps.realtime,
    });
    this.surfaceOperationalIntentService =
      deps.surfaceOperationalIntentService || new SurfaceOperationalIntentService();
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
        permissionService: this.deps.runtime
          .permissionService as unknown as ComposerCatalogOptions['permissionService'],
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
    onboarding?: {
      status: 'collecting' | 'awaiting_confirmation' | 'applied' | 'confirmation_invalid';
      confirmationToken: string | null;
      preview: Record<string, unknown> | null;
    };
  }> {
    const normalizedComposerPayload = this.composerPayload.normalize(body);
    const message = normalizedComposerPayload.messageText;
    const providerRouteOverride = this.buildProviderRouteOverride(body);
    const composerRuntimeHints = this.buildComposerRuntimeHints(body, message);
    if (!message) {
      throw new Error('Empty message.');
    }
    if (
      this.composerContext.hasPendingFollowupActionWithoutMessage(
        String(body.message || ''),
        normalizedComposerPayload.mentions,
      )
    ) {
      throw new Error('This action must be sent with the next request in the same message.');
    }

    const sessionId = String(body.sessionId || '').trim() || this.deps.realtime.createSession();
    this.deps.realtime.ensureSession(sessionId);
    const resourceImpact = await this.planResourceImpact(message);
    this.deps.realtime.recordUserMessage(sessionId, message, null, normalizedComposerPayload.mentions);

    // Deterministic shared-surface commands must remain available during first run.
    // Onboarding is a conversational fallback, not an authorization boundary, and
    // must not shadow governed commands such as /status or /codexremote.
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

      const intake = await setupService.runFirstMessageIntake(sessionId, chatHistory, workspace, {
        locale: String(body.locale || body.deviceLocale || '').trim() || null,
        confirmPreviewToken: String(body.onboardingConfirmationToken || '').trim() || null,
      });
      const { reply, finished } = intake;

      this.deps.realtime.recordAssistantMessage(sessionId, reply, null, 'conversational-setup-reply');

      if (finished) {
        const tipsService = new ZavorthContextualTipsService();
        const tip = await tipsService.getTipIfUnseen(CONTEXTUAL_TIP_FLAGS.ONBOARDING_COMPLETED);
        if (tip) {
          this.deps.realtime.recordAssistantMessage(
            sessionId,
            await tipsService.formatTip(tip),
            null,
            'contextual-tip',
          );
        }
      }

      return {
        sessionId,
        taskId: null,
        snapshot: await this.deps.realtime.getResolvedSnapshot(sessionId),
        resourceImpact: null,
        modeEscalation: null,
        onboarding: {
          status: intake.status,
          confirmationToken: intake.confirmationToken || null,
          preview: intake.preview ? { ...intake.preview } : null,
        },
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
        snapshot: actionResult.snapshot || (await this.deps.realtime.getResolvedSnapshot(sessionId)),
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

    // agent-first: free text never steals to local-inspector via keyword NLU.
    // File inspection is model-owned (agent tools) or explicit slash/composer actions.

    const universalRuntimeHandled =
      this.composerContext.hasContextualMentions(normalizedComposerPayload.mentions) ||
      this.composerContext.hasCommandMention(normalizedComposerPayload.mentions) ||
      (responseDecision.responsePath !== 'agent-runtime' && responseDecision.responsePath !== 'approval-gate')
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

    const directConversationHandled =
      this.composerContext.hasContextualMentions(normalizedComposerPayload.mentions) ||
      responseDecision.responsePath !== 'fast-chat'
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

    const legacyUnifiedGatewayHandled =
      this.composerContext.hasContextualMentions(normalizedComposerPayload.mentions) ||
      responseDecision.responsePath !== 'fast-chat'
        ? false
        : await this.maybeHandleLegacyUnifiedGatewayIngress(sessionId, message, responseDecision, {
            mentions: normalizedComposerPayload.mentions,
            attachments: normalizedComposerPayload.attachments,
            selectedSkills: normalizedComposerPayload.selectedSkills,
            voice: normalizedComposerPayload.voice,
            ...providerRouteOverride,
            ...composerRuntimeHints,
          });
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

    const executionMessage = this.composerContext.buildExecutionText(message, normalizedComposerPayload.mentions);
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
    const targetPath = resolveExecutionEngineTargetPath(input.body, input.payload);
    const command = typeof input.body.command === 'string' ? input.body.command : null;
    const content =
      typeof input.body.content === 'string' ? input.body.content : firstAttachmentText(input.payload);
    return router.decide({
      prompt: input.message,
      operation: this.inferExecutionEngineOperation(input.message, input.body.operation),
      targetPath,
      command,
      content,
      requestedEngineId: normalizeExecutionEngineId(input.body.engineId),
      networkTargets: Array.isArray(input.body.networkTargets)
        ? input.body.networkTargets.filter((value): value is string => typeof value === 'string')
        : [],
    });
  }

  private inferExecutionEngineOperation(message: string, explicit: unknown): ExecutionEngineRouteOperation {
    if (
      explicit === 'chat' ||
      explicit === 'read' ||
      explicit === 'summarize' ||
      explicit === 'code-question' ||
      explicit === 'write' ||
      explicit === 'delete' ||
      explicit === 'shell' ||
      explicit === 'network' ||
      explicit === 'deploy' ||
      explicit === 'transaction'
    ) {
      return explicit;
    }
    void message;
    return 'chat';
  }

  private buildProviderRouteOverride(body: RuntimeRecord): RuntimeRecord {
    return resolveComposerModelRouteOverride(body);
  }

  private buildComposerRuntimeHints(body: RuntimeRecord, message: string): RuntimeRecord {
    const metadata = recordOrNull(body.metadata) || {};
    const composerSettings = recordOrNull(body.composerSettings);
    const rawExperienceProfile = body.experienceProfile ?? metadata.experienceProfile;
    const experienceProfile =
      typeof rawExperienceProfile === 'string' ? rawExperienceProfile.trim() : recordOrNull(rawExperienceProfile);
    const workflowIntent = recordOrNull(body.workflowIntent) || recordOrNull(metadata.workflowIntent);
    const engineDecision = recordOrNull(body.engineDecision);
    const profileForEffort =
      typeof experienceProfile === 'string'
        ? experienceProfile
        : experienceProfile?.id || experienceProfile?.label || null;
    const effortLevel = resolveComposerEffortLevel(
      composerSettings?.effort || workflowIntent?.effort || body.effort || metadata.effort,
    );
    const effortControl = this.effortControl.buildSnapshot({
      level: effortLevel,
      request: message,
      profile: profileForEffort,
    });
    const requestedFanout = Number(workflowIntent?.maxFanout);
    const maxFanout =
      Number.isFinite(requestedFanout) && requestedFanout > 0
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

  /**
   * Explicit slash / structured callback only — never free-text phrase approve/reject.
   */
  private async maybeResolveUniversalApprovalIntent(sessionId: string, message: string): Promise<boolean> {
    const agentGateway = this.deps.agentGateway || null;
    const text = String(message || '').trim();
    if (!agentGateway || !text) {
      return false;
    }
    // Free text stays agent-owned; only deterministic slash/callback tokens may resolve here.
    if (
      !text.startsWith('/approve ') &&
      !text.startsWith('/reject ') &&
      !text.startsWith('approval:approve:') &&
      !text.startsWith('approval:reject:')
    ) {
      return false;
    }

    const intentResult: UniversalApprovalIntentDecisionResult = await agentGateway.resolveApprovalIntent({
      text,
      source: text.startsWith('/') ? 'slash-command' : 'callback',
      channel: 'web',
      userId: this.deps.runtime.webUserId,
      sessionId,
    });
    if (intentResult.resolution.status === 'not_approval_intent') {
      return false;
    }

    // SurfaceProfile (web = rich-app) drives buttons vs numbered text — not free-text NLU.
    const presentation = presentUniversalApprovalIntentDecision(intentResult, 'web');
    let body = presentation.text || renderUniversalApprovalIntentDecisionResult(intentResult);
    // Web clients that understand action rows can use metadata; text always stays complete.
    if (presentation.actions.length > 0 && presentation.usedNativeButtons) {
      const actionHints = presentation.actions
        .slice(0, 12)
        .map((a) => `• ${a.label}${a.command ? `  (${a.command})` : ''}`)
        .join('\n');
      if (actionHints && !body.includes('/approve 1')) {
        body = `${body}\n\nActions:\n${actionHints}`;
      }
    }
    await this.deliverWebOutput(sessionId, body, 'universal-approval-intent', text);
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
    const results = await Promise.all(
      mediaAttachments
        .slice(0, 3)
        .map((attachment) => this.analyzeInlineMediaAttachment(sessionId, attachment, message)),
    );
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

  private async analyzeInlineMediaAttachment(sessionId: string, attachment: WebComposerAttachment, message: string) {
    return this.mediaSupport.analyzeInlineMediaAttachment(sessionId, attachment, message);
  }

  private renderMediaUnderstandingReply(
    message: string,
    attachments: WebComposerAttachment[],
    results: Array<{
      ok: boolean;
      name: string;
      type: string;
      summary: string;
      text: string | null;
      error: string | null;
    }>,
  ): string {
    return this.mediaSupport.renderMediaUnderstandingReply(message, attachments, results);
  }

  private buildMediaAttachmentPrompt(message: string, attachments: WebComposerAttachment[]): string {
    return this.mediaSupport.buildMediaAttachmentPrompt(message, attachments);
  }

  private getReadyMediaAttachments(attachments: WebComposerAttachment[]): WebComposerAttachment[] {
    return this.mediaSupport.getReadyMediaAttachments(attachments);
  }

  private isExplicitAttachmentDeliverableRequest(message: string): boolean {
    return this.mediaSupport.isExplicitAttachmentDeliverableRequest(message);
  }

  private buildAttachmentConversationPrompt(
    message: string,
    attachments: Array<{ name: string; type: string; size: number; text?: string | null; truncated?: boolean }>,
  ): string {
    return this.mediaSupport.buildAttachmentConversationPrompt(message, attachments);
  }

  private buildLocalAttachmentConversationReply(
    message: string,
    attachments: Array<{ name: string; type: string; size: number; text?: string | null; truncated?: boolean }>,
  ): string {
    return this.mediaSupport.buildLocalAttachmentConversationReply(message, attachments);
  }

  private profileTextAttachments(
    attachments: Array<{ name: string; type: string; size: number; text?: string | null; truncated?: boolean }>,
  ): AttachmentTextProfile[] {
    return this.mediaSupport.profileTextAttachments(attachments);
  }

  private maybeHandleUnsupportedAttachmentPayload(
    sessionId: string,
    payload: { attachments?: WebComposerAttachment[] },
  ): boolean {
    return this.mediaSupport.maybeHandleUnsupportedAttachmentPayload(sessionId, payload);
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
    } catch (error: unknown) {
      logger.warn('[Web App Conversation] cache operation failed', error);
      return null;
    } finally {
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
      explicitExecution: this.composerContext.hasCommandMention(input.mentions),
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
      const executionMessage = this.composerContext.buildExecutionText(text, input.mentions);
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
        summary: task.taskId ? 'Request forwarded by the universal engine for supervised execution.'
          : 'request processed by the universal engine.',
        replyText: task.taskId ? 'Received. I forwarded it for supervised execution and will show the result here.'
          : 'Received. The universal engine processed the request.',
        events: [
          {
            kind: 'tool',
            title: 'Despacho supervised',
            detail: task.taskId ? `Task ${task.taskId} criada a partir do run ${run.id}.`
              : 'Execution did not return a traceable task.',
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

    const result = await agentGateway.handle(
      {
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
      },
      {
        executor,
      },
    );

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
      runtimeField(this.deps.runtime, 'providerLabel') || runtimeField(this.deps.runtime, 'provider') || '',
    ).trim();
    if (runtimeProvider) {
      return runtimeProvider;
    }

    switch (normalizeProviderName(config.llmProvider || '')) {
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
        return 'Provider not provided';
    }
  }

  private resolveCurrentModelLabel(): string {
    const runtimeModel = String(
      runtimeField(this.deps.runtime, 'modelLabel') || runtimeField(this.deps.runtime, 'model') || '',
    ).trim();
    if (runtimeModel) {
      return runtimeModel;
    }

    switch (normalizeProviderName(config.llmProvider || '')) {
      case 'aigateway':
        return config.AIGatewayModel || 'current model not provided';
      case 'gemini':
        return config.geminiModel || 'current model not provided';
      case 'deepseek':
        return config.deepseekModel || 'current model not provided';
      case 'openai':
        return config.openaiModel || 'current model not provided';
      case 'minimax':
        return config.minimaxModel || 'current model not provided';
      case 'openrouter':
        return config.openRouterModel || 'current model not provided';
      case 'qwen':
      case 'puter':
        return config.qwenModel || 'current model not provided';
      case 'opencode':
        return config.openCodeModel || 'current model not provided';
      default:
        return 'current model not provided';
    }
  }

  private getComposerActions(): ComposerActionService {
    if (!this.composerActions) {
      this.composerActions = new ComposerActionService({
        taskManager: this.deps.runtime.taskManager as unknown as ComposerActionOptions['taskManager'],
        permissionController: this.deps.runtime
          .permissionController as unknown as ComposerActionOptions['permissionController'],
        workflowController: this.deps.runtime
          .workflowController as unknown as ComposerActionOptions['workflowController'],
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
          String(text || '').trim() || '(empty message)',
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
      this.deps.realtime.recordAssistantMessage(sessionId, result.summary, null, 'shared-surface-error');
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
    // Surface-agnostic card text (web has no native TG keyboard; still lists actions).
    let body: string;
    try {
      const { buildModeEscalationPendingCard } =
        require('./ModeEscalationPresentation.js') as typeof import('./ModeEscalationPresentation.js');
      const card = buildModeEscalationPendingCard({
        request: request as any,
        channel: 'web',
      });
      body = card.text;
      const actions = card.surfaceResponse?.actions || [];
      if (actions.length) {
        body = [body, '', 'Actions:', ...actions.map((a) => `• ${a.label}${a.command ? `  (${a.command})` : ''}`)].join(
          '\n',
        );
      }
    } catch {
      const reasons = request.reasons.slice(0, 3).map((entry) => `- ${entry}`);
      body = [
        `To continue, I need to elevate mode ${request.effectiveMode.id} → ${request.requiredMode.id}.`,
        '',
        request.summary,
        '',
        ...reasons,
        '',
        `Suggested scope: ${request.recommendedScope}.`,
        `Light fallback: ${request.fallback}`,
        'Quick approve: /mode approve  [once|session|host]  ·  or  /mode approve 1',
        'Reject: /mode reject  ·  or  /mode reject 1',
      ]
        .filter(Boolean)
        .join('\n');
    }
    this.deps.realtime.recordAssistantMessage(sessionId, body, null, 'mode-escalation');
  }

  private async deliverWebOutput(sessionId: string, text: string, kind: string, rawInput: string): Promise<void> {
    const outputStage = this.deps.runtime.echoOutputStage || null;
    if (!outputStage) {
      this.deps.realtime.recordAssistantMessage(sessionId, String(text || '').trim() || '(empty message)', null, kind);
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
            String(nextText || '').trim() || '(empty message)',
            null,
            kind,
          );
        },
      },
    });
  }
}

function asRuntimeRecord(value: unknown): RuntimeRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RuntimeRecord) : null;
}

function runtimeField(value: unknown, key: string): unknown {
  return asRuntimeRecord(value)?.[key];
}

function resourceWorkspace(resourceImpact: TaskResourceImpact | null): string | null {
  const workspace = String(asRuntimeRecord(resourceImpact)?.workspace || '').trim();
  return workspace || null;
}
