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
import {
  renderUniversalApprovalIntentDecisionResult,
} from '../runtime/agent/index.js';
import { config } from '../config/index.js';
import { SurfaceOperationalIntentService } from './SurfaceOperationalIntentService.js';
import { FileInspectionService } from './FileInspectionService.js';
import { AttachmentIntelligenceService, type AttachmentTextProfile } from './AttachmentIntelligenceService.js';
import { ZavorthUserResponseRendererService } from './ZavorthUserResponseRendererService.js';

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
};

export class WebAppConversationService {
  private composerCatalog: ComposerCatalogService | null = null;
  private composerActions: ComposerActionService | null = null;
  private readonly composerContext = new ComposerContextService();
  private readonly composerPayload = new ComposerPayloadService();
  private readonly fileInspectionService = new FileInspectionService();
  private readonly attachmentIntelligence = new AttachmentIntelligenceService();
  private readonly surfaceOperationalIntentService: Pick<SurfaceOperationalIntentService, 'decideResponse'>;
  private readonly responseRenderer = new ZavorthUserResponseRendererService();

  constructor(private readonly deps: WebAppConversationDeps) {
    this.surfaceOperationalIntentService = deps.surfaceOperationalIntentService || new SurfaceOperationalIntentService();
  }

  public createWebContext(sessionId: string): unknown {
    const numericUserId = Number.parseInt(this.deps.runtime.webUserId || '1', 10) || 1;
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
  }> {
    const normalizedComposerPayload = this.composerPayload.normalize(body);
    const message = normalizedComposerPayload.messageText;
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
          },
          resourceImpact,
          requestedTools: responseDecision.requestedTools,
          responseDecision,
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
          },
          resourceImpact,
          kind: 'universal-agent-runtime',
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
    };
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
      'O usuario enviou anexos textuais pelo Command Center.',
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
      attachments?: Array<{ name: string; type: string; size: number; text?: string | null; truncated?: boolean }>;
    },
  ): boolean {
    const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
    if (attachments.length === 0) {
      return false;
    }

    const unsupported = attachments.filter((attachment) => !String(attachment.text || '').trim());
    if (unsupported.length === 0) {
      return false;
    }

    const lines = [
      unsupported.length === attachments.length
        ? 'Recebi o anexo, mas nesta versao do Command Center ele chegou apenas como metadados.'
        : 'Recebi os anexos. Alguns chegaram apenas como metadados e nao serao analisados agora.',
      '',
      ...unsupported.slice(0, 5).map((attachment) => `- ${attachment.name} (${attachment.type || 'tipo desconhecido'}, ${attachment.size || 0} bytes)`),
      '',
      'Para eu analisar de verdade agora, envie um arquivo textual pequeno, cole o conteudo no chat ou use uma pasta/arquivo local que o Zavorth consiga acessar.',
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
    } catch {
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
            },
          },
        ],
        metadata: {
          taskId: task.taskId || null,
          responseDecision: input.responseDecision,
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

    switch (this.normalizeProviderName(config.llmProvider || 'gemini')) {
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

    switch (this.normalizeProviderName(config.llmProvider || 'gemini')) {
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

    await legacyUnifiedGateway.handleEvent({
      surface: 'web',
      chatId: this.deps.realtime.getChatId(sessionId),
      userId: this.deps.runtime.webUserId,
      text,
      isGroup: false,
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
