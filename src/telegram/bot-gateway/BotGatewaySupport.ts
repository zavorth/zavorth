import type { Context } from 'grammy';
import type { IMessageContext } from '../../contracts/IMessageBroker.js';
import type { ParsedCommand } from '../CommandParser.js';
import {
  buildSharedSurfaceTelegramContext,
  canUseInteractiveGroupAi,
  processGroupCommand,
  processTextMessage,
  recordIncomingMessageTelemetry,
  resolveWorkspaceCommandInput,
  type NaturalConversationIngressMetadata,
} from './support/BotGatewayMessageProcessing.js';
import {
  broadcast,
  flushPendingSupervisedNotifications,
  getTelegramGatewayHandlerRegistrar,
  normalizeExternalRequestedPath,
  resolveApprovedExternalAccessPath,
  resolveBroadcastRecipients,
  resolveExternalAgentRole,
  sendToChat,
  start,
  startDashboardSurface,
  toWslPath,
} from './support/BotGatewayRuntimeLifecycle.js';
import type {
  BotGatewaySupportHandlerCallbacks,
  BotGatewaySupportRuntime,
  BotGatewaySupportState,
} from './BotGatewaySupportTypes.js';

export type {
  BotGatewaySupportHandlerCallbacks,
  BotGatewaySupportRuntime,
  BotGatewaySupportState,
} from './BotGatewaySupportTypes.js';

export class BotGatewaySupport {
  constructor(private readonly runtime: BotGatewaySupportRuntime) {}

  public registerOutgoingTracker(): void {
    getTelegramGatewayHandlerRegistrar(
      this.runtime,
      this.getHandlerCallbacks(),
    ).registerOutgoingTracker();
  }

  public registerMiddlewares(): void {
    getTelegramGatewayHandlerRegistrar(
      this.runtime,
      this.getHandlerCallbacks(),
    ).registerMiddlewares();
  }

  public registerHandlers(): void {
    getTelegramGatewayHandlerRegistrar(
      this.runtime,
      this.getHandlerCallbacks(),
    ).registerHandlers();
  }

  public attachSharedSurfaceCommandService(
    service: BotGatewaySupportState['sharedSurfaceCommandService'],
  ): void {
    this.runtime.state.sharedSurfaceCommandService = service;
  }

  public isStarted(): boolean {
    return this.runtime.state.dashboardSurfaceStarted;
  }

  public async processTextMessage(
    ctx: Context,
    text: string,
    inlineData?: Array<{ mimeType: string; data: string }>,
    ingressMetadata?: NaturalConversationIngressMetadata,
  ): Promise<void> {
    return processTextMessage(this.runtime, ctx, text, inlineData, ingressMetadata);
  }

  public async processGroupCommand(ctx: Context, text: string): Promise<void> {
    return processGroupCommand(this.runtime, ctx, text);
  }

  public async canUseInteractiveGroupAi(ctx: Context): Promise<boolean> {
    return canUseInteractiveGroupAi(this.runtime, ctx);
  }

  public resolveBroadcastRecipients(roles: string[] = ['admin']): string[] {
    return resolveBroadcastRecipients(roles);
  }

  public async broadcast(message: string, roles: string[] = ['admin']): Promise<void> {
    return broadcast(this.runtime, message, roles);
  }

  public async sendToChat(chatId: string, message: string): Promise<void> {
    return sendToChat(this.runtime, chatId, message);
  }

  public async start(): Promise<void> {
    return start(this.runtime);
  }

  public async startDashboardSurface(): Promise<void> {
    return startDashboardSurface(this.runtime);
  }

  public async flushPendingSupervisedNotifications(): Promise<void> {
    return flushPendingSupervisedNotifications(this.runtime);
  }

  public resolveExternalAgentRole(task: unknown): string {
    return resolveExternalAgentRole(task);
  }

  public resolveApprovedExternalAccessPath(result: unknown): string {
    return resolveApprovedExternalAccessPath(result);
  }

  public normalizeExternalRequestedPath(candidate: unknown): string | null {
    return normalizeExternalRequestedPath(candidate);
  }

  public toWslPath(targetPath: string): string {
    return toWslPath(targetPath);
  }

  public async recordIncomingMessageTelemetry(
    chatId: string,
    userId: string,
    text: string,
    chatType: string,
  ): Promise<void> {
    return recordIncomingMessageTelemetry(
      this.runtime,
      chatId,
      userId,
      text,
      chatType,
    );
  }

  public buildSharedSurfaceTelegramContext(
    ctx: Context,
    rawText: string,
    chatId: string,
    userId: string,
  ): IMessageContext {
    return buildSharedSurfaceTelegramContext(
      this.runtime,
      ctx,
      rawText,
      chatId,
      userId,
    );
  }

  public async resolveWorkspaceCommandInput(
    rawText: string,
    parsed: ParsedCommand,
  ): Promise<{ rawText: string; parsed: ParsedCommand } | null> {
    return resolveWorkspaceCommandInput(this.runtime, rawText, parsed);
  }

  private getHandlerCallbacks(): BotGatewaySupportHandlerCallbacks {
    return {
      processTextMessage: (ctx, text) =>
        this.runtime.processTextMessage
          ? this.runtime.processTextMessage(ctx, text)
          : this.processTextMessage(ctx, text),
      processGroupCommand: (ctx, text) =>
        this.runtime.processGroupCommand
          ? this.runtime.processGroupCommand(ctx, text)
          : this.processGroupCommand(ctx, text),
      canUseInteractiveGroupAi: (ctx) =>
        this.runtime.canUseInteractiveGroupAi
          ? this.runtime.canUseInteractiveGroupAi(ctx)
          : this.canUseInteractiveGroupAi(ctx),
    };
  }
}
