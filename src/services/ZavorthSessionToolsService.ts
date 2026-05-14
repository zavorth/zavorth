import { SurfaceIdentityService } from './SurfaceIdentityService.js';
import { GatewaySessionReadModelService } from '../runtime/sessions/GatewaySessionReadModelService.js';
import {
  SessionContinuityService,
  type SessionContinuitySnapshot,
  type SessionContinuityTask,
} from '../runtime/context/SessionContinuityService.js';
import {
  SessionReplayService,
  type SessionReplaySnapshot,
  type SessionReplayStepSnapshot,
} from '../runtime/context/SessionReplayService.js';
import {
  SessionHandoffService,
  type SessionHandoffSnapshot,
} from '../runtime/context/SessionHandoffService.js';
import { WorkflowRunService, type WorkflowRunSnapshot } from '../runtime/workflows/WorkflowRunService.js';
import {
  ExecutionLifecycleLinkService,
  type ExecutionLifecycleContextLink,
} from './ExecutionLifecycleLinkService.js';

type TaskManagerLike = ConstructorParameters<typeof SessionContinuityService>[0];

type ZavorthSessionToolsRuntime = {
  now?: () => Date;
  taskManager?: TaskManagerLike | null;
  surfaceIdentityService?: SurfaceIdentityService;
  continuityService?: SessionContinuityService;
  replayService?: SessionReplayService;
  handoffService?: SessionHandoffService;
  workflowRunService?: Pick<WorkflowRunService, 'listRuns'>;
  gatewaySessionReadModelService?: Pick<GatewaySessionReadModelService, 'buildSnapshotFast'>;
};

export type ZavorthSessionToolDefinition = {
  id: 'sessions_list' | 'sessions_history' | 'sessions_send' | 'sessions_spawn';
  label: string;
  description: string;
  actionHint: string;
};

export type ZavorthSessionTargetSnapshot = {
  id: string;
  label: string;
  surface: string;
  status: 'active' | 'linked' | 'recent';
  summary: string;
};

export type ZavorthSessionHistorySnapshot = {
  kind: 'task' | 'workflow' | 'timeline';
  id: string;
  label: string;
  summary: string;
  source: string | null;
  updatedAt: string | null;
  execution: ExecutionLifecycleContextLink | null;
};

export type ZavorthSessionToolsSnapshot = {
  generatedAt: string;
  summary: {
    tools: number;
    sessions: number;
    historyItems: number;
    linkedSurfaces: number;
  };
  tools: ZavorthSessionToolDefinition[];
  continuity: SessionContinuitySnapshot | null;
  replay: SessionReplaySnapshot | null;
  handoff: SessionHandoffSnapshot | null;
  workflowRuns: WorkflowRunSnapshot[];
  sessions: ZavorthSessionTargetSnapshot[];
  history: ZavorthSessionHistorySnapshot[];
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export class ZavorthSessionToolsService {
  private readonly now: () => Date;
  private readonly taskManager: TaskManagerLike | null;
  private readonly surfaceIdentity: SurfaceIdentityService;
  private readonly continuityService: SessionContinuityService | null;
  private readonly replayService: SessionReplayService;
  private readonly handoffService: SessionHandoffService;
  private readonly workflowRunService: Pick<WorkflowRunService, 'listRuns'>;
  private readonly gatewaySessionReadModel: Pick<GatewaySessionReadModelService, 'buildSnapshotFast'> | null;
  private readonly lifecycleLinks = new ExecutionLifecycleLinkService();

  constructor(runtime: ZavorthSessionToolsRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.taskManager = runtime.taskManager || null;
    this.surfaceIdentity = runtime.surfaceIdentityService || new SurfaceIdentityService();
    this.continuityService =
      runtime.continuityService ||
      (this.taskManager
        ? new SessionContinuityService(this.taskManager, {
            surfaceIdentityService: this.surfaceIdentity,
          })
        : null);
    this.replayService = runtime.replayService || new SessionReplayService();
    this.handoffService = runtime.handoffService || new SessionHandoffService();
    this.workflowRunService = runtime.workflowRunService || new WorkflowRunService();
    this.gatewaySessionReadModel = runtime.gatewaySessionReadModelService || null;
  }

  public buildSnapshot(input: {
    sessionId: string;
    chatId: string;
    userId: string;
  }): ZavorthSessionToolsSnapshot {
    const gatewaySnapshot = this.gatewaySessionReadModel?.buildSnapshotFast({
      sessionId: input.sessionId,
      chatId: input.chatId,
      userId: input.userId,
    }) || null;
    const continuity = gatewaySnapshot?.continuity || (
      this.continuityService
        ? this.continuityService.buildSnapshot(input.sessionId, input.chatId, input.userId)
        : null
    );
    const workflowRuns = gatewaySnapshot?.workflowRuns || this.listRelevantWorkflowRuns(continuity);
    const replay = gatewaySnapshot?.replay || (
      continuity
        ? this.replayService.buildSnapshot({
            continuity,
            tasks: continuity.recentTasks,
            permissions: [],
            workflowRuns,
          })
        : null
    );
    const handoff = gatewaySnapshot?.handoff || this.handoffService.buildSnapshot({
      continuity,
      replay,
      workflowRuns,
    });
    const sessions = this.buildSessions(continuity);
    const history = this.buildHistory(continuity, replay, workflowRuns);
    const tools: ZavorthSessionToolDefinition[] = [
      {
        id: 'sessions_list',
        label: 'Listar sessoes',
        description: 'Mostra sessoes e superficies ligadas ao mesmo operador.',
        actionHint: 'GET /api/web/session-tools',
      },
      {
        id: 'sessions_history',
        label: 'Historico de sessao',
        description: 'Mostra tasks, timeline e workflows recentes ligados a esse contexto.',
        actionHint: 'GET /api/web/session-tools',
      },
      {
        id: 'sessions_send',
        label: 'Enviar para sessao',
        description: 'Envia uma nova mensagem para a sessao atual reaproveitando o mesmo contexto.',
        actionHint: 'POST /api/web/session-tools/send',
      },
      {
        id: 'sessions_spawn',
        label: 'Abrir sessao derivada',
        description: 'Cria uma nova sessao carregando o melhor handoff encontrado.',
        actionHint: 'POST /api/web/session-tools/spawn',
      },
    ];

    return {
      generatedAt: this.now().toISOString(),
      summary: {
        tools: tools.length,
        sessions: sessions.length,
        historyItems: history.length,
        linkedSurfaces: continuity?.linkedSurfaces?.length || 0,
      },
      tools,
      continuity,
      replay,
      handoff,
      workflowRuns,
      sessions,
      history,
      narrative: {
        headline: handoff.headline,
        operatorSummary:
          continuity?.suggestedAction?.reason ||
          replay?.operatorSummary ||
          'Session tools prontos para listar, revisar, enviar e derivar sessoes.',
      },
    };
  }

  private listRelevantWorkflowRuns(continuity: SessionContinuitySnapshot | null): WorkflowRunSnapshot[] {
    const listRuns = this.workflowRunService.listRuns;
    if (typeof listRuns !== 'function') {
      return [];
    }

    const recentRuns = this.workflowRunService.listRuns({ limit: 8 }) || [];
    if (!continuity?.runtimeUserId) {
      return recentRuns;
    }

    return recentRuns.filter((run) => {
      const runtimeUserId = String(run.origin?.runtime_user_id || '').trim();
      const originUserId = String(run.origin?.origin_user_id || '').trim();
      return !runtimeUserId || runtimeUserId === continuity.runtimeUserId || originUserId === continuity.runtimeUserId;
    });
  }

  private buildSessions(continuity: SessionContinuitySnapshot | null): ZavorthSessionTargetSnapshot[] {
    if (!continuity) {
      return [];
    }

    const entries: ZavorthSessionTargetSnapshot[] = [];
    const seen = new Set<string>();
    const push = (entry: ZavorthSessionTargetSnapshot | null) => {
      if (!entry || seen.has(entry.id)) {
        return;
      }
      seen.add(entry.id);
      entries.push(entry);
    };

    push({
      id: continuity.sessionId,
      label: `Sessao atual (${continuity.chatId})`,
      surface: this.inferSurfaceFromChatId(continuity.chatId),
      status: continuity.currentSurfaceTask ? 'active' : 'linked',
      summary: continuity.currentSurfaceTask?.summary || continuity.suggestedAction.reason,
    });

    push(this.fromTask('telegram', continuity.latestTelegramTask));
    push(this.fromTask('web', continuity.latestWebTask));
    push(this.fromTask('discord', continuity.latestDiscordTask));
    push(this.fromTask('whatsapp', continuity.latestWhatsAppTask));

    for (const linkedSurface of continuity.linkedSurfaces || []) {
      push({
        id: `${linkedSurface.source}:${linkedSurface.sourceUserId}`,
        label: `${linkedSurface.source}:${linkedSurface.sourceUserId}`,
        surface: linkedSurface.source,
        status: 'linked',
        summary: `Superficie ligada em ${linkedSurface.linkedAt}.`,
      });
    }

    return entries;
  }

  private buildHistory(
    continuity: SessionContinuitySnapshot | null,
    replay: SessionReplaySnapshot | null,
    workflowRuns: WorkflowRunSnapshot[],
  ): ZavorthSessionHistorySnapshot[] {
    const entries: ZavorthSessionHistorySnapshot[] = [];

    for (const step of replay?.timeline || []) {
      entries.push(this.fromTimelineStep(step));
    }

    if (entries.length === 0) {
      for (const task of continuity?.recentTasks || []) {
        entries.push({
          kind: 'task',
          id: task.taskId,
          label: task.shortId,
          summary: task.summary || `${task.commandType} em ${task.source}`,
          source: task.source,
          updatedAt: task.updatedAt,
          execution: task.execution || null,
        });
      }
    }

    for (const run of workflowRuns.slice(0, 4)) {
      const checkpointCount = Number(run.externalized_state?.checkpoint_count || 0);
      const integritySummary = checkpointCount
        ? ` | ${checkpointCount} checkpoint(s)${run.externalized_state?.last_event ? ` | ultimo evento ${run.externalized_state.last_event}` : ''}`
        : '';
      entries.push({
        kind: 'workflow',
        id: run.workflow_run_id,
        label: `${run.workflow_name}:${run.workflow_run_id}`,
        summary: `${run.resume_prompt || run.objective || 'Workflow composto recente.'}${integritySummary}`,
        source: run.origin?.source_surface || null,
        updatedAt: run.updated_at || null,
        execution: this.lifecycleLinks.buildWorkflowContextLink(run as Record<string, unknown>),
      });
    }

    return entries
      .sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')))
      .slice(0, 8);
  }

  private fromTimelineStep(step: SessionReplayStepSnapshot): ZavorthSessionHistorySnapshot {
    return {
      kind: 'timeline',
      id: String(step.id || step.label || 'timeline').trim(),
      label: step.label,
      summary: step.detail,
      source: step.source || null,
      updatedAt: step.happenedAt || null,
      execution: null,
    };
  }

  private fromTask(surface: string, task: SessionContinuityTask | null): ZavorthSessionTargetSnapshot | null {
    if (!task) {
      return null;
    }
    return {
      id: `${surface}:${task.taskId}`,
      label: `${surface}:${task.shortId}`,
      surface,
      status: this.isActiveStatus(task.status) ? 'active' : 'recent',
      summary: task.summary || `${task.commandType} em ${surface}`,
    };
  }

  private isActiveStatus(status: string | null | undefined): boolean {
    const normalized = String(status || '').trim().toLowerCase();
    return ['running', 'waiting_approval', 'approval_pending', 'blocked'].includes(normalized);
  }

  private inferSurfaceFromChatId(chatId: string): string {
    const normalized = String(chatId || '').trim().toLowerCase();
    if (normalized.startsWith('web:')) {
      return 'web';
    }
    if (normalized.startsWith('telegram:')) {
      return 'telegram';
    }
    if (normalized.startsWith('discord:')) {
      return 'discord';
    }
    if (normalized.startsWith('whatsapp:')) {
      return 'whatsapp';
    }
    return 'runtime';
  }
}
