import type { MessageChannel } from '../contracts/PlatformContract.js';
import type { SurfaceTaskDispatcherLike } from './SurfaceRuntime.js';
import { GatewayChannelRouterService } from './GatewayChannelRouterService.js';
import { GatewaySessionReadModelService } from '../runtime/sessions/GatewaySessionReadModelService.js';
import {
  GatewaySessionService,
  type GatewaySessionListSnapshot,
  type GatewaySessionListSummarySnapshot,
  type GatewaySessionSnapshot,
} from '../runtime/sessions/GatewaySessionService.js';
import { GatewaySessionStoreService } from '../runtime/sessions/GatewaySessionStoreService.js';

import { ToolHookPipelineService } from './ToolHookPipelineService.js';

type GatewaySessionToolsRuntime = {
  defaultWorkspace?: string | null;
  surfaceTaskDispatcher?: SurfaceTaskDispatcherLike | null;
  createWebSession?: (() => string) | null;
  sessionStoreService?: GatewaySessionStoreService;
  sessionReadModelService?: GatewaySessionReadModelService;
  channelRouterService?: GatewayChannelRouterService;
  hookPipelineService?: Pick<ToolHookPipelineService, 'run'>;
};

export type GatewaySessionToolDescriptor = {
  id: 'sessions_list' | 'sessions_history' | 'sessions_send' | 'sessions_spawn';
  label: string;
  family: 'session';
  readiness: 'ready' | 'partial';
  description: string;
  operatorSummary: string;
};

export type GatewaySessionSendResult = {
  ok: boolean;
  taskId: string | null;
  chatId: string;
  sessionId: string | null;
  platform: string;
  snapshot: GatewaySessionSnapshot | null;
};

export type GatewaySessionSpawnResult = {
  ok: boolean;
  platform: string;
  sessionId: string | null;
  chatId: string | null;
  sourceUserId: string | null;
  runtimeUserId: string;
  handoffCommand: string;
};

export class GatewaySessionToolsService {
  private readonly defaultWorkspace: string | null;
  private readonly router: GatewayChannelRouterService;
  private readonly readModel: GatewaySessionReadModelService;
  private readonly hookPipeline: Pick<ToolHookPipelineService, 'run'>;

  constructor(
    private readonly sessions: GatewaySessionService,
    runtime: GatewaySessionToolsRuntime = {},
  ) {
    this.defaultWorkspace = this.normalizeWorkspace(runtime.defaultWorkspace);
    const sessionStore =
      runtime.sessionStoreService ||
      new GatewaySessionStoreService({
        createWebSession: runtime.createWebSession || null,
      });
    this.readModel =
      runtime.sessionReadModelService ||
      new GatewaySessionReadModelService(this.sessions, {
        sessionStoreService: sessionStore,
      });
    this.router =
      runtime.channelRouterService ||
      new GatewayChannelRouterService({
        sessionStoreService: sessionStore,
        sessionReadModelService: this.readModel,
        surfaceTaskDispatcher: runtime.surfaceTaskDispatcher || null,
      });
    this.hookPipeline = runtime.hookPipelineService || new ToolHookPipelineService();
  }

  public buildDescriptors(): GatewaySessionToolDescriptor[] {
    return [
      {
        id: 'sessions_list',
        label: 'sessions_list',
        family: 'session',
        readiness: 'ready',
        description: 'Lists recent cross-surface sessions for the current operator.',
        operatorSummary: 'Mostra os pontos de resumption mais recentes.',
      },
      {
        id: 'sessions_history',
        label: 'sessions_history',
        family: 'session',
        readiness: 'ready',
        description: 'Le o replay/handoff de uma session conhecida.',
        operatorSummary: 'Abre o contexto consolidado de uma session especifica.',
      },
      {
        id: 'sessions_send',
        label: 'sessions_send',
        family: 'session',
        readiness: this.router.canSendSessions() ? 'ready' : 'partial',
        description: 'Envia uma nova task para uma session ou chat especifico.',
        operatorSummary: this.router.canSendSessions() ? 'Can dispatch to an existing session through the shared runtime.'
          : 'The tool exists, but still depends on an active shared dispatcher.',
      },
      {
        id: 'sessions_spawn',
        label: 'sessions_spawn',
        family: 'session',
        readiness: this.router.canSpawn('web') ? 'ready' : 'partial',
        description: 'Cria uma nova session canonicamente rastreavel.',
        operatorSummary: this.router.canSpawn('web') ? 'Can explicitly open new web sessions.'
          : 'The tool exists, but the current runtime does not offer real spawn for all surfaces yet.',
      },
    ];
  }

  public async listSessions(input: {
    userId: string;
    limit?: number;
  }): Promise<GatewaySessionListSnapshot> {
    return this.router.listSessions(input);
  }

  public listSessionsSummary(input: {
    userId: string;
    limit?: number;
  }): GatewaySessionListSummarySnapshot {
    return this.sessions.listSessionsSummary(input);
  }

  public async readHistory(input: {
    userId: string;
    chatId?: string | null;
    sessionId?: string | null;
  }): Promise<GatewaySessionSnapshot | null> {
    return this.readModel.buildSnapshot(input);
  }

  public readHistoryFast(input: {
    userId: string;
    chatId?: string | null;
    sessionId?: string | null;
  }): GatewaySessionSnapshot | null {
    return this.readModel.buildSnapshotFast(input);
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
    workspace?: string | null;
  }): Promise<GatewaySessionSendResult> {
    const workspace = this.normalizeWorkspace(input.workspace);
    const before = await this.hookPipeline.run({
      event: 'session.before_send',
      workspace,
      context: {
        userId: String(input.userId || '').trim(),
        platform: String(input.platform || '').trim(),
        chatId: String(input.chatId || '').trim() || null,
        sessionId: String(input.sessionId || '').trim() || null,
        sourceUserId: String(input.sourceUserId || '').trim() || null,
        mentionCount: Array.isArray(input.mentions) ? input.mentions.length : 0,
        hasComposerPayload: Boolean(input.composerPayload),
        textLength: String(input.text || '').length,
      },
    });
    if (!before.ok) {
      throw new Error('Um hook bloqueou o envio para essa session.');
    }

    const result = await this.router.sendToSession(input);
    await this.hookPipeline.run({
      event: 'session.after_send',
      workspace,
      context: {
        userId: String(input.userId || '').trim(),
        platform: result.platform,
        chatId: result.chatId,
        sessionId: result.sessionId,
        taskId: result.taskId,
        ok: result.ok,
      },
    });
    return result;
  }

  public async spawnSession(input: {
    userId: string;
    platform?: MessageChannel | string | null;
    workspace?: string | null;
  }): Promise<GatewaySessionSpawnResult> {
    const workspace = this.normalizeWorkspace(input.workspace);
    const before = await this.hookPipeline.run({
      event: 'session.before_spawn',
      workspace,
      context: {
        userId: String(input.userId || '').trim(),
        platform: String(input.platform || '').trim() || 'web',
      },
    });
    if (!before.ok) {
      throw new Error('Um hook bloqueou a abertura da session derivada.');
    }

    const result = await this.router.spawnSession(input);
    await this.hookPipeline.run({
      event: 'session.after_spawn',
      workspace,
      context: {
        userId: String(input.userId || '').trim(),
        platform: result.platform,
        sessionId: result.sessionId,
        chatId: result.chatId,
        ok: result.ok,
      },
    });
    return result;
  }

  private normalizeWorkspace(value: string | null | undefined): string | null {
    const normalized = String(value || '').trim();
    if (normalized) {
      return normalized;
    }
    return this.defaultWorkspace || process.cwd();
  }
}
