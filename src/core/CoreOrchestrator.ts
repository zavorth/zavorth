import { IMessageBroker, IMessageContext } from '../contracts/IMessageBroker.js';
import { PlatformGatewayContract, PlatformKey, TaskSource } from '../contracts/PlatformContract.js';
import { LogRepository } from '../storage/LogRepository.js';
import type { SurfaceTaskDispatcherLike, SurfaceControllerContext } from '../services/SurfaceRuntime.js';
import type { EchoOutputStageService } from '../services/EchoOutputStageService.js';
import { CommandParser } from '../gateways/channels/telegram/CommandParser.js';
import {
  createInternalSurfaceCommandApi,
  type SurfaceCommandBoundary,
} from '../api/internal/InternalSurfaceApiCompat.js';
import { DiscordSurfacePolicyService } from '../services/DiscordSurfacePolicyService.js';
import {
  SurfaceOperationalIntentService,
} from '../services/SurfaceOperationalIntentService.js';
import { randomUUID } from 'crypto';

import {
  formatSharedSurfaceUnavailableReply,
  isSharedSurfaceCommandType,
} from '../services/SharedSurfaceCommandContract.js';

import type { ZavorthResponseDecision } from '../contracts/ZavorthResponseDecisionContract.js';
import { ContextEngine } from '../context-engine/ContextEngine.js';
import type { LegacyUnifiedGatewayAdapter } from '../context-engine/LegacyUnifiedGatewayAdapter.js';
import { NaturalLanguageRouter } from '../cognitive-firewall/NaturalLanguageRouter.js';
import type {
  UniversalAgentChannel,
  UniversalAgentExecutor,
  UniversalAgentRunResult,
  UniversalReplyPort,
  ZavorthAgentGateway,
} from '../runtime/agent/index.js';
import { asErrorLike, errorMessage } from '../utils/errorLike.js';
type ParsedCoreCommand = ReturnType<CommandParser['parse']>;

type CoreOrchestratorPipelineState = {
  ctx: IMessageContext;
  rawText: string;
  parsed: ParsedCoreCommand | null;
  shouldUseLegacyUnifiedGatewayIngress: boolean;
};

type CoreOrchestratorPipelineHandler = {
  id: string;
  priority: number;
  handle: (state: CoreOrchestratorPipelineState) => Promise<boolean>;
};

/**
 * CoreOrchestrator
 * Central message broker that processes clean text from every channel surface.
 * Gateways only forward the message and provide the reply callback.
 */
export class CoreOrchestrator implements IMessageBroker {
  private gateways: Map<PlatformKey, PlatformGatewayContract> = new Map();
  private surfaceTaskDispatcher: SurfaceTaskDispatcherLike | null = null;
  private readonly commandParser = new CommandParser();
  private sharedSurfaceCommandService: SurfaceCommandBoundary | null = null;
  private readonly discordSurfacePolicyService: DiscordSurfacePolicyService;
  private contextEngine: ContextEngine | null = null;
  private legacyUnifiedGateway: Pick<LegacyUnifiedGatewayAdapter, 'recordEvent' | 'handleEvent'> | null = null;
  private agentGateway: Pick<ZavorthAgentGateway, 'handle'> | null = null;
  private echoOutputStage: Pick<EchoOutputStageService, 'deliver'> | null = null;
  private readonly naturalRouter = new NaturalLanguageRouter();
  private readonly surfaceOperationalIntentService: Pick<SurfaceOperationalIntentService, 'decideResponse'>;

  constructor(
    private logRepo: LogRepository,
    discordSurfacePolicyService: DiscordSurfacePolicyService = new DiscordSurfacePolicyService(),
    surfaceOperationalIntentService: Pick<SurfaceOperationalIntentService, 'decideResponse'> = new SurfaceOperationalIntentService(),
  ) {
    this.discordSurfacePolicyService = discordSurfacePolicyService;
    this.surfaceOperationalIntentService = surfaceOperationalIntentService;
  }

  public registerGateway(platform: PlatformKey, gateway: PlatformGatewayContract): void {
    this.gateways.set(platform, gateway);
    this.logRepo.log('info', 'CoreOrchestrator', `Gateway registered: ${platform}`);
  }

  public attachSurfaceTaskDispatcher(dispatcher: SurfaceTaskDispatcherLike): void {
    this.surfaceTaskDispatcher = dispatcher;
  }

  public attachSharedSurfaceCommandService(service: SurfaceCommandBoundary): void {
    this.sharedSurfaceCommandService = service;
  }

  /**
   * Connects ContextEngine to the orchestrator during bootstrap.
   */
  public attachContextEngine(engine: ContextEngine): void {
    this.contextEngine = engine;
    this.logRepo.log('info', 'CoreOrchestrator', 'ContextEngine connected to CoreOrchestrator.');
  }

  public attachLegacyUnifiedGatewayAdapter(
    gateway: Pick<LegacyUnifiedGatewayAdapter, 'recordEvent' | 'handleEvent'>,
  ): void {
    this.legacyUnifiedGateway = gateway;
    this.logRepo.log('info', 'CoreOrchestrator', 'LegacyUnifiedGatewayAdapter connected as ingress fallback.');
  }

  public attachAgentGateway(gateway: Pick<ZavorthAgentGateway, 'handle'> | null): void {
    this.agentGateway = gateway;
    this.logRepo.log('info', 'CoreOrchestrator', 'ZavorthAgentGateway connected as canonical natural ingress.');
  }

  public attachEchoOutputStage(stage: Pick<EchoOutputStageService, 'deliver'> | null): void {
    this.echoOutputStage = stage;
    this.logRepo.log('info', 'CoreOrchestrator', 'EchoOutputStage connected to the output bus.');
  }

  public async processMessage(ctx: IMessageContext): Promise<void> {
    const rawText = String(ctx.rawText || '').trim();
    const parsed = rawText ? this.commandParser.parse(rawText) : null;
    const preflightState: CoreOrchestratorPipelineState = {
      ctx,
      rawText,
      parsed,
      shouldUseLegacyUnifiedGatewayIngress: this.shouldUseLegacyUnifiedGatewayIngress(ctx, rawText),
    };
    for (const handler of this.buildPreflightPipeline()) {
      if (await handler.handle(preflightState)) {
        return;
      }
    }

    this.logRepo.log('info', 'CoreOrchestrator', `Processing message from ${ctx.platform} (User: ${ctx.userId}): ${ctx.rawText.substring(0, 50)}`);
    if (await this.tryHandleNaturalMessageThroughAgentGateway(ctx, rawText)) {
      return;
    }

    const shouldUseLegacyUnifiedGatewayIngress = this.shouldUseLegacyUnifiedGatewayIngress(ctx, rawText);

    if ((this.legacyUnifiedGateway || this.contextEngine) && rawText && !shouldUseLegacyUnifiedGatewayIngress) {
      const event = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        surface: ctx.platform,
        chatId: ctx.chatId,
        userId: ctx.userId,
        role: 'user',
        content: rawText,
        inlineData: ctx.inlineData,
      } as const;
      if (this.legacyUnifiedGateway) {
        this.legacyUnifiedGateway.recordEvent(event);
      } else {
        this.contextEngine?.pushEvent(event);
      }
    }

    if (rawText && !rawText.startsWith('/')) {
      const route = this.naturalRouter.route(rawText);
      this.logRepo.log(
        'info',
        'NaturalRouter',
        `[${ctx.platform}] Intent: ${route.intentCategory} | Trivial: ${route.isTrivialChat} | FastModel: ${route.useFastModel} | ${route.firewallStats}`,
      );

      // Enrich context with classification for downstream use
      ctx.__naturalRoute = route;
    }
    
    if (ctx.rawText === '/ping') {
      await ctx.reply(`Sovereign responding through ${ctx.platform}! Pong!`);
      return;
    }

    if (!String(ctx.rawText || '').trim()) {
      return;
    }

    if (shouldUseLegacyUnifiedGatewayIngress) {
      await this.legacyUnifiedGateway!.handleEvent({
        surface: ctx.platform,
        chatId: ctx.chatId,
        userId: ctx.userId,
        text: rawText,
        isGroup: ctx.isGroup,
        inlineData: ctx.inlineData,
        reply: async (text: string) => {
          await this.deliverOutput(ctx, text, rawText);
        },
        metadata: {
          stage: 'legacy-unified-conversation-fallback-v1',
          transport: ctx.transport || 'text',
          messageId: ctx.messageId || null,
          channelId: ctx.channelId || null,
          threadId: ctx.threadId || null,
          attachments: ctx.attachments || [],
          nativeCommand: ctx.nativeCommand || null,
          composerPayload: ctx.composerPayload || null,
        },
      });
      return;
    }

    if (!this.surfaceTaskDispatcher) {
      await ctx.reply('O runtime multicanal ainda nao recebeu um dispatcher compartilhado.');
      return;
    }

    await this.surfaceTaskDispatcher.dispatchTaskMessage({
      ctx: ctx as unknown as SurfaceControllerContext,
      platform: ctx.platform,
      chatId: ctx.chatId,
      text: rawText || ctx.rawText,
      sourceUserId: ctx.userId,
      fallbackRuntimeUserId: ctx.userId,
      source: ctx.platform as TaskSource,
      composerPayload: ctx.composerPayload || null,
      inlineData: ctx.inlineData,
      identity: this.resolveSurfaceIdentityHints(ctx.platform),
      surfacePolicy:
        ctx.platform === 'discord'
          ? {
              publicServerMode: this.discordSurfacePolicyService.isPublicServerMode(),
              forceApprovalForExecution: this.discordSurfacePolicyService.isPublicServerMode() && ctx.isGroup,
              transport: ctx.transport || null,
            }
          : null,
    });
  }

  public async broadcast(message: string, roles: string[] = ['admin']): Promise<void> {
    const normalizedRoles = Array.from(
      new Set(
        (roles || [])
          .map((role) => String(role || '').trim().toLowerCase())
          .filter(Boolean),
      ),
    );

    for (const [platform, gateway] of this.gateways.entries()) {
      if (typeof gateway.broadcast === 'function') {
        const roleAware =
          gateway.supportsRoleAwareBroadcast === true ||
          typeof gateway.resolveBroadcastRecipients === 'function';

        if (normalizedRoles.length > 0 && !roleAware) {
          this.logRepo.log(
            'warn',
            'CoreOrchestrator',
            `Gateway ${platform} ignorada no broadcast com roles porque ainda nao declara suporte a roteamento por role.`,
          );
          continue;
        }

        await gateway.broadcast(message, normalizedRoles);
      }
    }
  }

  public getRegisteredPlatforms(): PlatformKey[] {
    return Array.from(this.gateways.keys());
  }

  private buildPreflightPipeline(): CoreOrchestratorPipelineHandler[] {
    return [
      {
        id: 'shared-surface-command-api',
        priority: 10,
        handle: (state: CoreOrchestratorPipelineState) => this.handleSharedSurfaceCommandApi(state),
      },
      {
        id: 'discord-public-server-gate',
        priority: 20,
        handle: (state: CoreOrchestratorPipelineState) => this.handleDiscordPublicServerGate(state),
      },
      {
        id: 'unsupported-slash-command-gate',
        priority: 30,
        handle: (state: CoreOrchestratorPipelineState) => this.handleUnsupportedSlashCommandGate(state),
      },
    ].sort((left, right) => left.priority - right.priority);
  }

  private async handleSharedSurfaceCommandApi(
    state: CoreOrchestratorPipelineState,
  ): Promise<boolean> {
    const { ctx, rawText, parsed } = state;
    if (!rawText || !parsed) {
      return false;
    }

    const sharedSurfaceApi = createInternalSurfaceCommandApi(this.sharedSurfaceCommandService);
    if (!sharedSurfaceApi) {
      return false;
    }

    const result = await sharedSurfaceApi.handleCommand({
      context: ctx,
      parsedCommand: parsed,
      request: {
        surface: String(ctx.platform || 'unknown'),
        requestedBy: ctx.userId,
        chatId: ctx.chatId,
        threadId: ctx.threadId || null,
        correlation: {
          sessionId: ctx.threadId || ctx.chatId || null,
        },
        metadata: {
          transport: ctx.transport || null,
        },
      },
    });
    if (result.status === 'not_handled') {
      return false;
    }

    if (!result.ok && result.messages.length === 0 && result.summary) {
      await ctx.reply(result.summary);
    }
    return true;
  }

  private async handleDiscordPublicServerGate(
    state: CoreOrchestratorPipelineState,
  ): Promise<boolean> {
    const { ctx, rawText } = state;
    if (
      !rawText ||
      ctx.platform !== 'discord' ||
      !ctx.isGroup ||
      ctx.transport !== 'text' ||
      !this.discordSurfacePolicyService.isPublicServerMode()
    ) {
      return false;
    }

    if (rawText.startsWith('/')) {
      await ctx.reply('No Discord publico, use os slash commands do Zavorth nos canais liberados.');
    }
    return true;
  }

  private async handleUnsupportedSlashCommandGate(
    state: CoreOrchestratorPipelineState,
  ): Promise<boolean> {
    const { ctx, rawText, parsed } = state;
    if (!rawText.startsWith('/') || !parsed || this.isSharedSurfaceCommand(parsed.command_type)) {
      return false;
    }

    await ctx.reply(formatSharedSurfaceUnavailableReply(ctx.platform));
    return true;
  }

  private isSharedSurfaceCommand(commandType: string): boolean {
    return isSharedSurfaceCommandType(commandType, Boolean(this.sharedSurfaceCommandService));
  }

  private shouldUseLegacyUnifiedGatewayIngress(ctx: IMessageContext, rawText: string): boolean {
    if (!this.legacyUnifiedGateway || !rawText || rawText.startsWith('/')) {
      return false;
    }

    const platform = String(ctx.platform || '').trim().toLowerCase();
    return platform === 'discord';
  }

  private async tryHandleNaturalMessageThroughAgentGateway(
    ctx: IMessageContext,
    rawText: string,
  ): Promise<boolean> {
    const text = String(rawText || '').trim();
    if (!this.agentGateway || !text || text.startsWith('/')) {
      return false;
    }

    if (!ctx.__naturalRoute) {
      const route = this.naturalRouter.route(text);
      this.logRepo.log(
        'info',
        'NaturalRouter',
        `[${ctx.platform}] Intent: ${route.intentCategory} | Trivial: ${route.isTrivialChat} | FastModel: ${route.useFastModel} | ${route.firewallStats}`,
      );
      ctx.__naturalRoute = route;
    }

    const channel = this.resolveUniversalAgentChannel(ctx.platform);
    const sessionId = this.resolveAgentSessionId(ctx);
    const responseDecision = await this.surfaceOperationalIntentService.decideResponse({
      surface: String(ctx.platform || 'unknown'),
      text,
      hasAttachments: this.hasAttachmentPayload(ctx),
      explicitExecution: false,
      capabilityIds: this.resolveComposerCapabilityIds(ctx.composerPayload),
    });
    const shouldBridgeToSurfaceDispatcher = this.shouldBridgeAgentRunToSurfaceDispatcher(responseDecision.responsePath);
    const executor = shouldBridgeToSurfaceDispatcher && this.surfaceTaskDispatcher
      ? this.createSurfaceTaskDispatcherExecutor(ctx, text, responseDecision)
      : undefined;

    let result: UniversalAgentRunResult;
    try {
      result = await this.agentGateway.handle({
        requestId: ctx.messageId || undefined,
        traceId: null,
        userId: ctx.userId,
        channel,
        sessionId,
        text,
        workspace: null,
        replyPort: this.buildAgentReplyPort(ctx, channel),
        requestedTools: responseDecision.requestedTools,
        modelProfile: {
          routingPolicy: 'gateway',
          supportsTools: true,
        },
        metadata: {
          source: 'core-orchestrator',
          platform: ctx.platform,
          transport: ctx.transport || 'text',
          chatId: ctx.chatId,
          channelId: ctx.channelId || null,
          threadId: ctx.threadId || null,
          messageId: ctx.messageId || null,
          isGroup: ctx.isGroup,
          attachments: ctx.attachments || [],
          inlineDataCount: ctx.inlineData?.length || 0,
          nativeCommand: ctx.nativeCommand || null,
          composerPayload: ctx.composerPayload || null,
          naturalRoute: ctx.__naturalRoute || null,
          responseDecision,
          artifactPolicy: responseDecision.artifactPolicy,
          legacyUnifiedGatewayAvailable: Boolean(this.legacyUnifiedGateway),
          legacyUnifiedGatewayBypassed: Boolean(this.legacyUnifiedGateway),
          surfaceTaskDispatcherAvailable: Boolean(this.surfaceTaskDispatcher),
          surfaceTaskDispatcherDeferred: shouldBridgeToSurfaceDispatcher,
        },
      }, executor ? { executor } : {});
    } catch (error: unknown) {
      const err = asErrorLike(error);
      this.logRepo.log(
        'warn',
        'CoreOrchestrator',
        `ZavorthAgentGateway falhou no ingresso natural; mantendo fallback legado: ${errorMessage(error)}`,
      );
      return false;
    }

    await this.deliverAgentGatewayResult(ctx, result, text);
    return true;
  }

  private shouldBridgeAgentRunToSurfaceDispatcher(responsePath: string): boolean {
    return responsePath === 'agent-runtime'
      || responsePath === 'approval-gate'
      || responsePath === 'local-inspector';
  }

  private createSurfaceTaskDispatcherExecutor(
    ctx: IMessageContext,
    text: string,
    responseDecision: ZavorthResponseDecision,
  ): UniversalAgentExecutor {
    return async ({ run }) => {
      const dispatchResult = await this.surfaceTaskDispatcher!.dispatchTaskMessage({
        ctx: ctx as unknown as SurfaceControllerContext,
        platform: ctx.platform,
        chatId: ctx.chatId,
        text,
        sourceUserId: ctx.userId,
        fallbackRuntimeUserId: ctx.userId,
        source: ctx.platform as TaskSource,
        sessionId: this.resolveAgentSessionId(ctx),
        threadId: ctx.threadId || null,
        composerPayload: ctx.composerPayload || null,
        inlineData: ctx.inlineData,
        identity: this.resolveSurfaceIdentityHints(ctx.platform),
        surfacePolicy:
          ctx.platform === 'discord'
            ? {
                publicServerMode: this.discordSurfacePolicyService.isPublicServerMode(),
                forceApprovalForExecution: this.discordSurfacePolicyService.isPublicServerMode() && ctx.isGroup,
                transport: ctx.transport || null,
              }
            : {
                transport: ctx.transport || null,
              },
      });
      const taskId = this.resolveDispatchedTaskId(dispatchResult.task);

      return {
        status: taskId ? 'running' : 'completed',
        summary: taskId
          ? 'Pedido natural encapsulado pelo AgentGateway e encaminhado para execucao supervisionada.'
          : 'Pedido natural encapsulado pelo AgentGateway e processado pelo dispatcher compartilhado.',
        replyText: taskId
          ? 'Recebi. Encaminhei para execucao supervisionada e vou manter o acompanhamento por aqui.'
          : 'Recebi. O runtime universal processou o pedido nessa superficie.',
        events: [
          {
            kind: 'tool',
            title: 'SurfaceTaskDispatchService',
            detail: taskId
              ? `Task ${taskId} criada a partir do run ${run.id}.`
              : `Dispatcher retornou sem task rastreavel para o run ${run.id}.`,
            status: 'done',
            metadata: {
              taskId,
              surface: ctx.platform,
              source: 'core-orchestrator-agent-gateway-executor',
            },
          },
        ],
        metadata: {
          taskId,
          responseDecision,
          surfaceTaskDispatch: {
            source: 'SurfaceTaskDispatchService',
            calledAfterAgentGateway: true,
            runtimeUserId: dispatchResult.runtimeUserId,
            sourceUserId: dispatchResult.sourceUserId,
            tenantId: dispatchResult.tenantId,
          },
        },
      };
    };
  }

  private async deliverAgentGatewayResult(
    ctx: IMessageContext,
    result: UniversalAgentRunResult,
    rawInput: string,
  ): Promise<void> {
    const primaryReply = String(result.replies[0]?.text || '').trim()
      || String(result.run.summary || '').trim()
      || 'Pedido processado pelo runtime universal.';
    await this.deliverOutput(ctx, primaryReply, rawInput);
  }

  private resolveUniversalAgentChannel(platform: PlatformKey | string): UniversalAgentChannel {
    const normalized = String(platform || '').trim().toLowerCase();
    if (normalized === 'telegram' || normalized === 'web' || normalized === 'cli' || normalized === 'discord') {
      return normalized;
    }
    if (normalized) {
      return 'api';
    }
    return 'unknown';
  }

  private resolveAgentSessionId(ctx: IMessageContext): string {
    return String(ctx.threadId || ctx.chatId || `${ctx.platform}:${ctx.userId}` || 'unknown').trim();
  }

  private buildAgentReplyPort(ctx: IMessageContext, channel: UniversalAgentChannel): UniversalReplyPort {
    const platform = String(ctx.platform || channel || 'unknown').trim() || 'unknown';
    return {
      id: `${platform}:primary`,
      label: this.humanizeSurfaceLabel(platform),
      kind: channel,
      status: 'available',
      primary: true,
      description: 'Porta de resposta criada pelo CoreOrchestrator para o AgentGateway.',
    };
  }

  private humanizeSurfaceLabel(platform: string): string {
    const normalized = String(platform || '').trim().toLowerCase();
    switch (normalized) {
      case 'discord':
        return 'Discord';
      case 'telegram':
        return 'Telegram';
      case 'whatsapp':
        return 'WhatsApp';
      case 'slack':
        return 'Slack';
      case 'signal':
        return 'Signal';
      case 'imessage':
        return 'iMessage';
      case 'teams':
        return 'Teams';
      case 'email':
        return 'Email';
      case 'web':
        return 'ZavorthControl';
      case 'cli':
        return 'Terminal';
      default:
        return 'Canal de origem';
    }
  }

  private hasAttachmentPayload(ctx: IMessageContext): boolean {
    return Boolean(
      (ctx.attachments?.length || 0) > 0
      || (ctx.inlineData?.length || 0) > 0
      || (Array.isArray(ctx.composerPayload?.attachments) && ctx.composerPayload.attachments.length > 0),
    );
  }

  private resolveComposerCapabilityIds(composerPayload?: Record<string, any> | null): string[] {
    const selectedSkills = Array.isArray(composerPayload?.selectedSkills)
      ? composerPayload!.selectedSkills
      : [];
    return selectedSkills
      .map((skill: any) => String(skill?.id || skill?.capabilityId || '').trim())
      .filter(Boolean);
  }

  private resolveDispatchedTaskId(task: any): string | null {
    return String(task?.task_id || task?.taskId || task?.id || '').trim() || null;
  }

  private resolveSurfaceIdentityHints(platform: PlatformKey | string): {
    linkedBy: string;
    verificationMethod: string;
  } {
    const normalizedPlatform = String(platform || '').trim().toLowerCase();
    const gateway = this.gateways.get(normalizedPlatform as PlatformKey);
    const gatewayHints = gateway?.getIdentityHints?.();
    if (gatewayHints?.linkedBy && gatewayHints?.verificationMethod) {
      return gatewayHints;
    }

    switch (normalizedPlatform) {
      case 'discord':
        return {
          linkedBy: 'discord-gateway',
          verificationMethod: 'discord-runtime',
        };
      case 'telegram':
        return {
          linkedBy: 'telegram-gateway',
          verificationMethod: 'telegram-auth-guard',
        };
      case 'web':
        return {
          linkedBy: 'web-session',
          verificationMethod: 'zavorthControl-auth',
        };
      case 'whatsapp':
        return {
          linkedBy: 'whatsapp-gateway',
          verificationMethod: 'whatsapp-session',
        };
      default:
        return {
          linkedBy: `${platform}-gateway`,
          verificationMethod: 'gateway-runtime',
        };
    }
  }

  private async deliverOutput(ctx: IMessageContext, text: string, rawInput: string): Promise<void> {
    if (!this.echoOutputStage) {
      await ctx.reply(text);
      return;
    }

    await this.echoOutputStage.deliver({
      surface: String(ctx.platform || 'unknown'),
      text,
      rawInput,
      requestedBy: ctx.userId,
      sessionId: ctx.threadId || ctx.chatId || '',
      sink: {
        sendText: async (nextText) => ctx.reply(nextText),
      },
    });
  }
}
