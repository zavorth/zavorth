import type { Bot, Context, InlineKeyboard } from 'grammy';
import type { TaskManager } from '../../../orchestrator/TaskManager.js';
import type { LogRepository } from '../../../storage/LogRepository.js';
import type { ExecutionGateway } from '../../../execution/ExecutionGateway.js';
import type { PermissionService } from '../../../services/PermissionService.js';
import type { PermissionRequest } from '../../../contracts/PermissionRequest.js';
import type { LiveChannelBroadcastGatewayContract } from '../../../contracts/PlatformContract.js';
import type { ChannelIngressGateways } from '../../../services/DashboardService.js';
import type { RuntimeCompositionService } from '../../../services/RuntimeCompositionService.js';
import type { BroadcastCapableGateway } from '../../../services/ZavorthChannelActionService.js';
import type { TelegramPermissionController } from '../../../gateways/channels/telegram/controllers/TelegramPermissionController.js';
import type { TelegramExecutionController } from '../../../gateways/channels/telegram/controllers/TelegramExecutionController.js';
import type { TelegramPipelineController } from '../../../gateways/channels/telegram/controllers/TelegramPipelineController.js';
import type { SurfaceTaskDispatchService } from '../../../services/SurfaceTaskDispatchService.js';
import type { SurfaceCommandBoundary } from '../../../api/internal/InternalSurfaceApiCompat.js';
import type { BotGatewaySupport } from '../../../gateways/channels/telegram/bot-gateway/BotGatewaySupport.js';
import type { EchoOutputStageService } from '../../../services/EchoOutputStageService.js';
import { BotGatewayState } from '../../../gateways/channels/telegram/bot-gateway/BotGatewayState.js';
import { initializeBotGateway, type BotGatewayRuntimeOptions } from '../../../gateways/channels/telegram/bot-gateway/BotGatewayBootstrap.js';
import type { NaturalConversationIngressMetadata } from '../../../gateways/channels/telegram/bot-gateway/support/BotGatewayMessageProcessing.js';
import {
  getOrCreateBotGatewaySupport,
  type BotGatewaySupportHost,
} from '../../../gateways/channels/telegram/bot-gateway/BotGatewaySupportComposition.js';


export class BotGateway extends BotGatewayState implements LiveChannelBroadcastGatewayContract {
  constructor(
    token: string,
    private taskManager: TaskManager,
    private logRepo: LogRepository,
    runtimeComposition?: RuntimeCompositionService,
    runtimeOptions?: BotGatewayRuntimeOptions,
  ) {
    super();
    initializeBotGateway(this, token, taskManager, logRepo, runtimeComposition, runtimeOptions);
  }

  public getHelpText(): string {
    return this.menuController.getHelpText();
  }

  private getBotGatewaySupportInstance(): BotGatewaySupport {
    return getOrCreateBotGatewaySupport(this as unknown as BotGatewaySupportHost);
  }

  public registerOutgoingTracker(): void {
    this.getBotGatewaySupportInstance().registerOutgoingTracker();
  }

  public registerMiddlewares(): void {
    this.getBotGatewaySupportInstance().registerMiddlewares();
  }

  public registerHandlers(): void {
    this.getBotGatewaySupportInstance().registerHandlers();
  }

  private async processTextMessage(
    ctx: Context,
    text: string,
    inlineData?: Array<{ mimeType: string; data: string }>,
    ingressMetadata?: NaturalConversationIngressMetadata,
  ): Promise<void> {
    await this.getBotGatewaySupportInstance().processTextMessage(ctx, text, inlineData, ingressMetadata);
  }

  private async processGroupCommand(ctx: Context, text: string): Promise<void> {
    await this.getBotGatewaySupportInstance().processGroupCommand(ctx, text);
  }

  private async canUseInteractiveGroupAi(ctx: Context): Promise<boolean> {
    return this.getBotGatewaySupportInstance().canUseInteractiveGroupAi(ctx);
  }

  public async recordIncomingMessageTelemetry(
    chatId: string,
    userId: string,
    text: string,
    chatType: string,
  ): Promise<void> {
    await this.getBotGatewaySupportInstance().recordIncomingMessageTelemetry(chatId, userId, text, chatType);
  }

  public buildSharedSurfaceTelegramContext(
    ctx: Context,
    rawText: string,
    chatId: string,
    userId: string,
  ) {
    return this.getBotGatewaySupportInstance().buildSharedSurfaceTelegramContext(ctx, rawText, chatId, userId);
  }

  public async resolveWorkspaceCommandInput(
    rawText: string,
    parsed: Parameters<BotGatewaySupport['resolveWorkspaceCommandInput']>[1],
  ): Promise<ReturnType<BotGatewaySupport['resolveWorkspaceCommandInput']>> {
    return this.getBotGatewaySupportInstance().resolveWorkspaceCommandInput(rawText, parsed);
  }

  public resolveRuntimeAdapterRole(task: unknown): string {
    return this.getBotGatewaySupportInstance().resolveRuntimeAdapterRole(task);
  }

  public resolveApprovedExternalAccessPath(result: unknown): string {
    return this.getBotGatewaySupportInstance().resolveApprovedExternalAccessPath(result);
  }

  public toWslPath(targetPath: string): string {
    return this.getBotGatewaySupportInstance().toWslPath(targetPath);
  }

  public buildPermissionKeyboard(permission: PermissionRequest): InlineKeyboard {
    return this.permissionController.buildPermissionKeyboard(permission);
  }
  public resolveBroadcastRecipients(roles: string[] = ['admin']): string[] {
    return this.getBotGatewaySupportInstance().resolveBroadcastRecipients(roles);
  }
  public async broadcast(message: string, roles: string[] = ['admin']): Promise<void> {
    await this.getBotGatewaySupportInstance().broadcast(message, roles);
  }
  public async sendToChat(chatId: string, message: string): Promise<void> {
    await this.getBotGatewaySupportInstance().sendToChat(chatId, message);
  }

  public async start(): Promise<void> {
    await this.getBotGatewaySupportInstance().start();
  }

  public async startDashboardSurface(): Promise<void> {
    await this.getBotGatewaySupportInstance().startDashboardSurface();
  }

  public getExecutionGateway(): ExecutionGateway {
    return this.executionGateway;
  }

  public getExecutionController(): TelegramExecutionController {
    return this.executionController;
  }

  public getPermissionService(): PermissionService {
    return this.permissionService;
  }

  public getPermissionController(): TelegramPermissionController {
    return this.permissionController;
  }

  public getBotApi(): Bot['api'] {
    return this.bot.api;
  }

  public isStarted(): boolean {
    return this.getBotGatewaySupportInstance().isStarted();
  }

  public getIdentityHints(): { linkedBy: string; verificationMethod: string } {
    return {
      linkedBy: 'telegram-bot-gateway',
      verificationMethod: 'telegram-bot-token',
    };
  }

  public getSurfaceTaskDispatcher(): SurfaceTaskDispatchService {
    return this.surfaceTaskDispatcher;
  }

  public getEchoOutputStage(): EchoOutputStageService {
    return this.echoOutputStage;
  }

  public getWorkflowController(): TelegramPipelineController {
    return this.pipelineController;
  }

  public attachChannelBroadcastGateways(
    gateways: Partial<Record<string, BroadcastCapableGateway | null | undefined>>,
  ): void {
    this.dashboardService.attachChannelBroadcastGateways(gateways);
  }

  public attachSharedSurfaceCommandService(service: SurfaceCommandBoundary): void {
    this.sharedSurfaceCommandService = service;
  }

  public attachChannelIngressGateways(gateways: ChannelIngressGateways): void {
    this.dashboardService.attachChannelIngressGateways(gateways);
  }

  public formatPermissionCreatedMessage(permission: PermissionRequest): string {
    return this.permissionController.formatPermissionCreatedMessage(permission);
  }
}




