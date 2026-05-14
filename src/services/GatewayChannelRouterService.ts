import type { MessageChannel } from '../contracts/PlatformContract.js';
import type { SurfaceTaskDispatcherLike } from './SurfaceRuntime.js';
import {
  GatewayChannelRegistryService,
  type GatewayChannelRegistryEntry,
} from './GatewayChannelRegistryService.js';
import {
  GatewaySessionReadModelService,
} from '../runtime/sessions/GatewaySessionReadModelService.js';
import {
  GatewaySessionStoreService,
  type GatewaySessionSpawnSnapshot,
} from '../runtime/sessions/GatewaySessionStoreService.js';
import type {
  GatewaySessionListSnapshot,
  GatewaySessionSnapshot,
} from '../runtime/sessions/GatewaySessionService.js';

export type GatewaySessionSendResult = {
  ok: boolean;
  taskId: string | null;
  chatId: string;
  sessionId: string | null;
  platform: string;
  snapshot: GatewaySessionSnapshot | null;
};

type GatewayChannelRouterRuntime = {
  sessionStoreService?: GatewaySessionStoreService;
  sessionReadModelService: GatewaySessionReadModelService;
  channelRegistryService?: GatewayChannelRegistryService;
  surfaceTaskDispatcher?: SurfaceTaskDispatcherLike | null;
};

export class GatewayChannelRouterService {
  private readonly sessionStore: GatewaySessionStoreService;
  private readonly sessionReadModel: GatewaySessionReadModelService;
  private readonly channelRegistry: GatewayChannelRegistryService;
  private readonly dispatcher: SurfaceTaskDispatcherLike | null;

  constructor(runtime: GatewayChannelRouterRuntime) {
    this.sessionStore = runtime.sessionStoreService || new GatewaySessionStoreService();
    this.sessionReadModel = runtime.sessionReadModelService;
    this.channelRegistry = runtime.channelRegistryService || new GatewayChannelRegistryService();
    this.dispatcher = runtime.surfaceTaskDispatcher || null;
  }

  public canSendSessions(): boolean {
    return Boolean(this.dispatcher);
  }

  public canSpawn(platform?: MessageChannel | string | null): boolean {
    return this.sessionStore.canSpawn(platform);
  }

  public getChannel(id: string): GatewayChannelRegistryEntry | null {
    return this.channelRegistry.getChannel(id);
  }

  public async listSessions(input: {
    userId: string;
    limit?: number;
  }): Promise<GatewaySessionListSnapshot> {
    return this.sessionReadModel.listSessions(input);
  }

  public async readSession(input: {
    userId?: string | null;
    fallbackRuntimeUserId?: string | null;
    platform?: string | null;
    chatId?: string | null;
    sessionId?: string | null;
    sourceUserId?: string | null;
  }): Promise<GatewaySessionSnapshot | null> {
    return this.sessionReadModel.buildSnapshot(input);
  }

  public async sendToSession(input: {
    userId: string;
    platform: MessageChannel | string;
    chatId?: string | null;
    sessionId?: string | null;
    sourceUserId?: string | null;
    text: string;
    ctx?: any;
    mentions?: any[];
    composerPayload?: Record<string, any> | null;
  }): Promise<GatewaySessionSendResult> {
    if (!this.dispatcher) {
      throw new Error('Gateway session send requer um dispatcher compartilhado ativo.');
    }

    const target = this.sessionStore.resolveTarget({
      userId: input.userId,
      platform: input.platform,
      chatId: input.chatId,
      sessionId: input.sessionId,
      sourceUserId: input.sourceUserId,
    });
    if (!target) {
      throw new Error('Sessao alvo invalida para sessions_send.');
    }

    const channel = this.channelRegistry.getChannel(target.platform);
    if (!channel?.features.sessionSend) {
      throw new Error(`Canal ${target.platform} ainda nao aceita sessions_send.`);
    }

    const result = await this.dispatcher.dispatchTaskMessage({
      ctx: input.ctx || {
        platform: target.platform,
        userId: target.sourceUserId,
        chatId: target.chatId,
        isGroup: target.platform !== 'web',
        rawText: input.text,
        reply: async () => undefined,
        editMessage: async () => undefined,
      },
      platform: target.platform as MessageChannel,
      chatId: target.chatId,
      text: String(input.text || '').trim(),
      sourceUserId: target.sourceUserId,
      fallbackRuntimeUserId: target.runtimeUserId,
      source: target.platform as any,
      sessionId: target.sessionId,
      mentions: Array.isArray(input.mentions) ? input.mentions : [],
      composerPayload: input.composerPayload || null,
    });

    return {
      ok: true,
      taskId: String(result?.task?.task_id || '').trim() || null,
      chatId: target.chatId,
      sessionId: target.sessionId,
      platform: target.platform,
      snapshot: await this.sessionReadModel.buildSnapshot({
        userId: target.runtimeUserId,
        platform: target.platform,
        chatId: target.chatId,
        sessionId: target.sessionId,
        sourceUserId: target.sourceUserId,
      }),
    };
  }

  public spawnSession(input: {
    userId: string;
    platform?: MessageChannel | string | null;
  }): GatewaySessionSpawnSnapshot {
    const platform = String(input.platform || 'web').trim().toLowerCase() || 'web';
    const channel = this.channelRegistry.getChannel(platform);
    if (channel && !channel.features.sessionSpawn) {
      return this.sessionStore.createSession({ userId: input.userId, platform });
    }
    return this.sessionStore.createSession({ userId: input.userId, platform });
  }
}
