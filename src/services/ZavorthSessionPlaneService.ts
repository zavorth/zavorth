import {
  ZavorthSessionToolsService,
  type ZavorthSessionToolsSnapshot,
} from '../runtime/sessions/ZavorthSessionToolsService.js';
import {
  GatewayChannelRegistryService,
  type GatewayChannelRegistryEntry,
} from './GatewayChannelRegistryService.js';
import {
  GatewaySessionStoreService,
  type GatewayCanonicalSessionTarget,
  type GatewaySessionSpawnSnapshot,
} from '../runtime/sessions/GatewaySessionStoreService.js';
import {
  GatewaySessionToolsService,
  type GatewaySessionSendResult,
  type GatewaySessionToolDescriptor,
} from '../runtime/sessions/GatewaySessionToolsService.js';
import { tService } from '../i18n/services.js';



import type {
  GatewaySessionListEntry,
  GatewaySessionListSnapshot,
  GatewaySessionSnapshot,
} from '../runtime/sessions/GatewaySessionService.js';

type ZavorthSessionPlaneRuntime = {
  now?: () => Date;
  sessionToolsService?: Pick<ZavorthSessionToolsService, 'buildSnapshot'>;
  gatewaySessionToolsService?: Pick<
    GatewaySessionToolsService,
    'buildDescriptors' | 'listSessions' | 'listSessionsSummary' | 'readHistory' | 'readHistoryFast' | 'sendToSession' | 'spawnSession'
  >;
  sessionStoreService?: Pick<GatewaySessionStoreService, 'resolveTarget' | 'canSpawn'>;
  channelRegistryService?: Pick<GatewayChannelRegistryService, 'getChannel'>;
};

export type ZavorthSessionPlaneCommand = {
  id: 'sessions' | 'sessionhistory' | 'sessionsend' | 'sessionspawn';
  command: string;
  usage: string;
  description: string;
  readiness: 'ready' | 'partial';
  operatorSummary: string;
};

export type ZavorthSessionPlaneSnapshot = {
  generatedAt: string;
  summary: {
    commands: number;
    tools: number;
    sessions: number;
    historyItems: number;
    pendingPermissions: number;
    linkedSurfaces: number;
    sendReady: boolean;
    spawnReady: boolean;
  };
  store: {
    target: GatewayCanonicalSessionTarget | null;
    channel: GatewayChannelRegistryEntry | null;
    sendReady: boolean;
    spawnReady: boolean;
  };
  commands: ZavorthSessionPlaneCommand[];
  tools: GatewaySessionToolDescriptor[];
  current: {
    sessionTools: ZavorthSessionToolsSnapshot | null;
    history: GatewaySessionSnapshot | null;
  };
  sessions: GatewaySessionListSnapshot;
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export type ZavorthSessionPlaneStatusSummarySnapshot = {
  generatedAt: string;
  summary: Pick<
    ZavorthSessionPlaneSnapshot['summary'],
    'sessions' | 'historyItems' | 'sendReady' | 'spawnReady'
  >;
  narrative: ZavorthSessionPlaneSnapshot['narrative'];
};

const EMPTY_SESSION_LIST: GatewaySessionListSnapshot = {
  generatedAt: new Date(0).toISOString(),
  runtimeUserId: '',
  total: 0,
  entries: [],
};

export class ZavorthSessionPlaneService {
  private readonly now: () => Date;
  private readonly sessionTools: Pick<ZavorthSessionToolsService, 'buildSnapshot'>;
  private readonly gatewaySessionTools: Pick<
    GatewaySessionToolsService,
    'buildDescriptors' | 'listSessions' | 'listSessionsSummary' | 'readHistory' | 'readHistoryFast' | 'sendToSession' | 'spawnSession'
  > | null;
  private readonly sessionStore: Pick<GatewaySessionStoreService, 'resolveTarget' | 'canSpawn'>;
  private readonly channelRegistry: Pick<GatewayChannelRegistryService, 'getChannel'> | null;

  constructor(runtime: ZavorthSessionPlaneRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.sessionTools = runtime.sessionToolsService || new ZavorthSessionToolsService();
    this.gatewaySessionTools = runtime.gatewaySessionToolsService || null;
    this.sessionStore = runtime.sessionStoreService || new GatewaySessionStoreService();
    this.channelRegistry = runtime.channelRegistryService || null;
  }

  public async buildSnapshot(input: {
    userId: string;
    platform?: string | null;
    chatId?: string | null;
    sessionId?: string | null;
    sourceUserId?: string | null;
    limit?: number;
  }): Promise<ZavorthSessionPlaneSnapshot> {
    const target = this.sessionStore.resolveTarget({
      userId: input.userId,
      platform: input.platform,
      chatId: input.chatId,
      sessionId: input.sessionId,
      sourceUserId: input.sourceUserId,
    });
    const tools = this.gatewaySessionTools?.buildDescriptors() || [];
    const currentHistory = this.gatewaySessionTools
      ? await this.gatewaySessionTools.readHistory({
          userId: input.userId,
          chatId: target?.chatId || input.chatId || null,
          sessionId: target?.sessionId || input.sessionId || null,
        })
      : null;
    const currentSessionTools =
      target
        ? this.sessionTools.buildSnapshot({
            sessionId: target.sessionId || target.chatId,
            chatId: target.chatId,
            userId: target.runtimeUserId,
          })
        : null;
    const sessions: GatewaySessionListSnapshot = this.gatewaySessionTools
      ? await this.gatewaySessionTools.listSessions({
          userId: input.userId,
          limit: input.limit,
        })
      : {
          ...EMPTY_SESSION_LIST,
          generatedAt: this.now().toISOString(),
          runtimeUserId: String(input.userId || '').trim(),
        };
    const channel = target ? this.channelRegistry?.getChannel(target.platform) || null : null;
    const sendReady = tools.some((tool) => tool.id === 'sessions_send' && tool.readiness === 'ready');
    const spawnReady = Boolean(this.sessionStore.canSpawn('web'));
    const commands = this.buildCommands({
      sendReady,
      spawnReady,
    });
    const historyItems = Math.max(
      currentSessionTools?.history.length || 0,
      currentHistory?.replay?.timeline.length || 0,
      currentHistory?.transcript?.length || 0,
    );
    const pendingPermissions = currentHistory?.permissions.filter((entry) => entry.status === 'pending').length || 0;
    const linkedSurfaces = currentSessionTools?.summary.linkedSurfaces || currentHistory?.continuity?.linkedSurfaces?.length || 0;

    return {
      generatedAt: this.now().toISOString(),
      summary: {
        commands: commands.length,
        tools: tools.length,
        sessions: sessions.entries.length,
        historyItems,
        pendingPermissions,
        linkedSurfaces,
        sendReady,
        spawnReady,
      },
      store: {
        target,
        channel,
        sendReady,
        spawnReady,
      },
      commands,
      tools,
      current: {
        sessionTools: currentSessionTools,
        history: currentHistory,
      },
      sessions,
      narrative: {
        headline: currentHistory?.replay?.headline
          || currentSessionTools?.narrative.headline
          || 'Session plane is ready to list, review, send, and derive sessions.',
        operatorSummary: currentHistory?.handoff?.operatorSummary
          || currentSessionTools?.narrative.operatorSummary
          || this.buildDefaultOperatorSummary(sessions.entries, sendReady, spawnReady),
      },
    };
  }

  public async buildStatusSummary(input: {
    userId: string;
    platform?: string | null;
    chatId?: string | null;
    sessionId?: string | null;
    sourceUserId?: string | null;
    limit?: number;
  }): Promise<ZavorthSessionPlaneStatusSummarySnapshot> {
    const tools = this.gatewaySessionTools?.buildDescriptors() || [];
    const sessionSummary = this.gatewaySessionTools
      ? typeof this.gatewaySessionTools.listSessionsSummary === 'function'
        ? this.gatewaySessionTools.listSessionsSummary({
            userId: input.userId,
            limit: input.limit,
          })
        : await this.gatewaySessionTools.listSessions({
            userId: input.userId,
            limit: input.limit,
          })
      : {
          ...EMPTY_SESSION_LIST,
          generatedAt: this.now().toISOString(),
          runtimeUserId: String(input.userId || '').trim(),
          visible: 0,
        };
    const sendReady = tools.some((tool) => tool.id === 'sessions_send' && tool.readiness === 'ready');
    const spawnReady = Boolean(this.sessionStore.canSpawn('web'));
    const visibleSessions =
      typeof (sessionSummary as { visible?: unknown }).visible === 'number'
        ? (sessionSummary as { visible: number }).visible
        : Array.isArray((sessionSummary as unknown as { entries?: unknown }).entries)
          ? (sessionSummary as unknown as { entries: unknown[] }).entries.length
          : 0;
    const hasExplicitTarget = Boolean(
      String(input.chatId || '').trim()
      || String(input.sessionId || '').trim()
      || String(input.sourceUserId || '').trim(),
    );
    let historyItems = 0;
    let headline = 'Session plane is ready to list, review, send, and derive sessions.';
    let operatorSummary = this.buildDefaultOperatorSummary(visibleSessions, sendReady, spawnReady);

    if (hasExplicitTarget) {
      const target = this.sessionStore.resolveTarget({
        userId: input.userId,
        platform: input.platform,
        chatId: input.chatId,
        sessionId: input.sessionId,
        sourceUserId: input.sourceUserId,
      });
      if (target) {
        const currentHistory = this.gatewaySessionTools
          ? await this.gatewaySessionTools.readHistory({
              userId: input.userId,
              chatId: target.chatId || input.chatId || null,
              sessionId: target.sessionId || input.sessionId || null,
            })
          : null;
        const currentSessionTools = this.sessionTools.buildSnapshot({
          sessionId: target.sessionId || target.chatId,
          chatId: target.chatId,
          userId: target.runtimeUserId,
        });
        historyItems = Math.max(
          currentSessionTools?.history.length || 0,
          currentHistory?.replay?.timeline.length || 0,
          currentHistory?.transcript?.length || 0,
        );
        headline = currentHistory?.replay?.headline
          || currentSessionTools?.narrative.headline
          || headline;
        operatorSummary = currentHistory?.handoff?.operatorSummary
          || currentSessionTools?.narrative.operatorSummary
          || operatorSummary;
      }
    }

    return {
      generatedAt: this.now().toISOString(),
      summary: {
        sessions: visibleSessions,
        historyItems,
        sendReady,
        spawnReady,
      },
      narrative: {
        headline,
        operatorSummary,
      },
    };
  }

  public buildStatusSummaryFast(input: {
    userId: string;
    platform?: string | null;
    chatId?: string | null;
    sessionId?: string | null;
    sourceUserId?: string | null;
    limit?: number;
  }): ZavorthSessionPlaneStatusSummarySnapshot {
    const tools = this.gatewaySessionTools?.buildDescriptors() || [];
    const sessionSummary = this.gatewaySessionTools
      ? typeof this.gatewaySessionTools.listSessionsSummary === 'function'
        ? this.gatewaySessionTools.listSessionsSummary({
            userId: input.userId,
            limit: input.limit,
          })
        : {
            ...EMPTY_SESSION_LIST,
            generatedAt: this.now().toISOString(),
            runtimeUserId: String(input.userId || '').trim(),
            visible: 0,
          }
      : {
          ...EMPTY_SESSION_LIST,
          generatedAt: this.now().toISOString(),
          runtimeUserId: String(input.userId || '').trim(),
          visible: 0,
        };
    const sendReady = tools.some((tool) => tool.id === 'sessions_send' && tool.readiness === 'ready');
    const spawnReady = Boolean(this.sessionStore.canSpawn('web'));
    const visibleSessions =
      typeof (sessionSummary as { visible?: unknown }).visible === 'number'
        ? (sessionSummary as { visible: number }).visible
        : Array.isArray((sessionSummary as unknown as { entries?: unknown }).entries)
          ? (sessionSummary as unknown as { entries: unknown[] }).entries.length
          : 0;
    const hasExplicitTarget = Boolean(
      String(input.chatId || '').trim()
      || String(input.sessionId || '').trim()
      || String(input.sourceUserId || '').trim(),
    );
    let historyItems = 0;
    let headline = 'Session plane is ready to list, review, send, and derive sessions.';
    let operatorSummary = this.buildDefaultOperatorSummary(visibleSessions, sendReady, spawnReady);

    if (hasExplicitTarget) {
      const target = this.sessionStore.resolveTarget({
        userId: input.userId,
        platform: input.platform,
        chatId: input.chatId,
        sessionId: input.sessionId,
        sourceUserId: input.sourceUserId,
      });
      if (target) {
        const currentHistory = this.gatewaySessionTools?.readHistoryFast({
          userId: input.userId,
          chatId: target.chatId || input.chatId || null,
          sessionId: target.sessionId || input.sessionId || null,
        }) || null;
        const currentSessionTools = this.sessionTools.buildSnapshot({
          sessionId: target.sessionId || target.chatId,
          chatId: target.chatId,
          userId: target.runtimeUserId,
        });
        historyItems = Math.max(
          currentSessionTools?.history.length || 0,
          currentHistory?.replay?.timeline.length || 0,
          currentHistory?.transcript?.length || 0,
        );
        headline = currentHistory?.replay?.headline
          || currentSessionTools?.narrative.headline
          || headline;
        operatorSummary = currentHistory?.handoff?.operatorSummary
          || currentSessionTools?.narrative.operatorSummary
          || operatorSummary;
      }
    }

    return {
      generatedAt: this.now().toISOString(),
      summary: {
        sessions: visibleSessions,
        historyItems,
        sendReady,
        spawnReady,
      },
      narrative: {
        headline,
        operatorSummary,
      },
    };
  }

  public async sendToSession(input: {
    userId: string;
    platform: string;
    chatId?: string | null;
    sessionId?: string | null;
    sourceUserId?: string | null;
    text: string;
    ctx?: unknown;
    mentions?: unknown[];
    composerPayload?: Record<string, unknown> | null;
  }): Promise<GatewaySessionSendResult> {
    if (!this.gatewaySessionTools) {
      throw new Error('Session plane has not received session tools from the gateway yet.');
    }
    return this.gatewaySessionTools.sendToSession(input);
  }

  public async spawnSession(input: {
    userId: string;
    platform?: string | null;
  }): Promise<GatewaySessionSpawnSnapshot> {
    if (!this.gatewaySessionTools) {
      throw new Error('Session plane has not received session tools from the gateway yet.');
    }
    return this.gatewaySessionTools.spawnSession(input);
  }

  public async renderOverviewReport(input: {
    userId: string;
    platform?: string | null;
    chatId?: string | null;
    sessionId?: string | null;
    sourceUserId?: string | null;
  }): Promise<string> {
    const snapshot = await this.buildSnapshot(input);
    const lines = [
      tService('session.plane_title'),
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      '',
      tService('session.visible_sessions', { visible: String(snapshot.sessions.entries.length), total: String(snapshot.sessions.total) }),
      `${tService('session.history_current')}: ${snapshot.summary.historyItems} item(s) | ${tService('approval.pending')}: ${snapshot.summary.pendingPermissions}.`,
      `${tService('session.cross_send')}: ${snapshot.summary.sendReady ? tService('session.ready') : tService('session.partial')} | spawn web: ${snapshot.summary.spawnReady ? tService('session.ready') : tService('session.partial')}.`,
    ];

    if (snapshot.store.target) {
      lines.push(
        '',
        `${tService('session.current_target')}: ${snapshot.store.target.label}.`,
        `${tService('session.channel')}: ${snapshot.store.channel?.label || snapshot.store.target.platform}.`,
      );
    }

    if (snapshot.sessions.entries.length > 0) {
      lines.push('', tService('session.resume_points') + ':');
      for (const entry of snapshot.sessions.entries.slice(0, 4)) {
        lines.push(
          `- ${entry.label}: ${entry.latestTaskLabel}`
          + (entry.updatedAt ? ` | atualizado at ${entry.updatedAt}` : ''),
        );
      }
    }

    lines.push('', 'Commands:');
    for (const command of snapshot.commands) {
      lines.push(`- ${command.command} ${command.usage}`.trim() + `: ${command.description}`);
    }

    return lines.join('\n');
  }

  public async renderHistoryReport(input: {
    userId: string;
    platform?: string | null;
    chatId?: string | null;
    sessionId?: string | null;
    sourceUserId?: string | null;
  }): Promise<string> {
    const snapshot = await this.buildSnapshot(input);
    const history = snapshot.current.history;
    if (!history) {
      return 'Could not find consolidated history for this session yet.';
    }

    const lines = [
      'Official session history',
      '',
      snapshot.narrative.headline,
      history.handoff?.operatorSummary || history.replay?.operatorSummary || 'without operator summary adicional.',
    ];

    if (history.replay?.recommendedEntry) {
      lines.push(
        '',
        `Better entrada: ${history.replay.recommendedEntry.label}.`,
        history.replay.recommendedEntry.reason,
      );
    }

    const timeline = history.replay?.timeline || [];
    if (timeline.length > 0) {
      lines.push('', 'Latests passos:');
      for (const step of timeline.slice(0, 4)) {
        lines.push(`- ${step.label}: ${step.detail}`);
      }
    }

    const tasks = history.tasks || [];
    if (tasks.length > 0) {
      lines.push('', 'Tasks recentes:');
      for (const task of tasks.slice(0, 4)) {
        lines.push(
          `- ${task.command_type || '/task'} ${task.task_id.substring(0, 8)}: `
          + `${task.result_summary || task.raw_message || task.status || 'without summary'}`,
        );
      }
    }

    const transcript = Array.isArray(history.transcript) ? history.transcript : [];
    if (transcript.length > 0) {
      lines.push('', 'Transcript recente:');
      for (const message of transcript.slice(-4)) {
        const role = String(message.role || 'system').trim();
        const content = String(message.content || '').trim();
        if (!content) {
          continue;
        }
        lines.push(`- ${role}: ${content}`);
      }
    }

    return lines.join('\n');
  }

  private buildCommands(input: {
    sendReady: boolean;
    spawnReady: boolean;
  }): ZavorthSessionPlaneCommand[] {
    return [
      {
        id: 'sessions',
        command: '/sessions',
        usage: '[sessionId|chatId]',
        description: 'Lists known sessions and summarizes the current target.',
        readiness: 'ready',
        operatorSummary: 'Opens the official session plane for the current operator.',
      },
      {
        id: 'sessionhistory',
        command: '/sessionhistory',
        usage: '[sessionId|chatId]',
        description: 'Shows replay, handoff, and the consolidated timeline for the target session.',
        readiness: 'ready',
        operatorSummary: 'Reads the history canonicaly resolved by the gateway.',
      },
      {
        id: 'sessionsend',
        command: '/sessionsend',
        usage: '<sessionId|chatId> -- <message>',
        description: 'Dispatches a message to another session through the shared runtime.',
        readiness: input.sendReady ? 'ready' : 'partial',
        operatorSummary: input.sendReady ? 'Can send to existing sessions now.'
          : 'Visible as an official command, but depends on an active shared dispatcher.',
      },
      {
        id: 'sessionspawn',
        command: '/sessionspawn',
        usage: '[web]',
        description: 'Opens a canonicaly traceable derived session.',
        readiness: input.spawnReady ? 'ready' : 'partial',
        operatorSummary: input.spawnReady ? 'Can open derived web sessions with handoff ready.'
          : 'The command exists, but the current runtime still cannot spawn the target session.',
      },
    ];
  }

  private buildDefaultOperatorSummary(
    entriesOrCount: GatewaySessionListEntry[] | number,
    sendReady: boolean,
    spawnReady: boolean,
  ): string {
      const count = Array.isArray(entriesOrCount) ? entriesOrCount.length : entriesOrCount;
      return `${count} recent session(s) no gateway | `
      + `cross-send ${sendReady ? 'ready' : 'parcial'} | `
      + `spawn ${spawnReady ? 'ready' : 'parcial'}.`;
  }
}
