import type { GatewaySessionSnapshot } from '../runtime/sessions/GatewaySessionService.js';
import { GatewaySessionReadModelService } from '../runtime/sessions/GatewaySessionReadModelService.js';
import { MemoryService, type MemoryEntry } from './MemoryService.js';
import { logger } from '../logger.js';
import type {
  SessionReplayArtifactSnapshot,
  SessionReplaySnapshot,
} from '../runtime/context/SessionReplayService.js';
import {
  WorkspaceOperationalMemoryService,
  type WorkspaceOperationalMemory,
} from '../runtime/context/WorkspaceOperationalMemoryService.js';

type GatewaySessionReadModelLike = Pick<GatewaySessionReadModelService, 'buildSnapshot' | 'buildSnapshotFast'>;
type MemoryServiceLike =
  Pick<MemoryService, 'listAll' | 'listRelevant'>
  & Partial<Pick<MemoryService, 'listHistoricalRelevant'>>;
type WorkspaceOperationalMemoryLike = Pick<WorkspaceOperationalMemoryService, 'getMemory'>;

type ZavorthMemoryPlaneRuntime = {
  now?: () => Date;
  gatewaySessionReadModelService?: GatewaySessionReadModelLike | null;
  memoryService?: MemoryServiceLike | null;
  workspaceOperationalMemoryService?: WorkspaceOperationalMemoryLike | null;
};

type ZavorthMemoryPlaneInput = {
  userId?: string | null;
  platform?: string | null;
  chatId?: string | null;
  sessionId?: string | null;
  sourceUserId?: string | null;
  workspaceHint?: string | null;
};

export type ZavorthMemoryPlaneEntry = {
  key: string;
  value: string;
  category: string;
  updatedAt: string | null;
};

export type ZavorthMemoryPlaneTimelineEntry = {
  id: string;
  label: string;
  kind: 'memory' | 'artifact' | 'workflow' | 'workspace';
  status: 'current' | 'historical';
  happenedAt: string | null;
  category: string | null;
  source: string;
  summary: string;
};

export type ZavorthMemoryPlaneConflict = {
  key: string;
  category: string | null;
  currentValue: string;
  previousValue: string;
  detectedAt: string | null;
  reason: string;
};

export type ZavorthMemoryPlaneSnapshot = {
  generatedAt: string;
  summary: {
    persistedMemories: number;
    relevantMemories: number;
    replayTasks: number;
    workflowRuns: number;
    artifacts: number;
    workspaceSignals: number;
    timelineEvents: number;
    historicalEvents: number;
    changedFacts: number;
  };
  memory: {
    recent: ZavorthMemoryPlaneEntry[];
    relevant: ZavorthMemoryPlaneEntry[];
    categories: string[];
    vectorRecall: boolean;
  };
  timeline: {
    recent: ZavorthMemoryPlaneTimelineEntry[];
    conflicts: ZavorthMemoryPlaneConflict[];
    latestHistoricalAt: string | null;
  };
  replay: SessionReplaySnapshot | null;
  artifacts: {
    recent: SessionReplayArtifactSnapshot[];
    kinds: string[];
    latestLabel: string | null;
    reusableCount: number;
  };
  workspace: {
    workspace: string;
    summary: string;
    recentArtifacts: Array<{
      name: string;
      kind: string;
      summary: string | null;
      createdAt: string;
    }>;
    recentWorkflowRuns: Array<{
      workflow: string;
      status: string;
      updatedAt: string;
      primaryArtifactName: string | null;
    }>;
    continuityRecommendations: Array<{
      label: string;
      reason: string;
      kind: string;
    }>;
    workflowRecommendations: Array<{
      workflow: string;
      rationale: string;
    }>;
  } | null;
  suggestedActions: Array<{
    id: string;
    label: string;
    command: string;
    reason: string;
    kind: 'resume' | 'artifact' | 'memory' | 'workspace';
  }>;
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export class ZavorthMemoryPlaneService {
  private readonly now: () => Date;
  private readonly sessionReadModel: GatewaySessionReadModelLike | null;
  private readonly memoryService: MemoryServiceLike | null;
  private readonly workspaceOperationalMemory: WorkspaceOperationalMemoryLike | null;

  constructor(runtime: ZavorthMemoryPlaneRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.sessionReadModel = runtime.gatewaySessionReadModelService || null;
    this.memoryService = runtime.memoryService || null;
    this.workspaceOperationalMemory = runtime.workspaceOperationalMemoryService || null;
  }

  public buildSnapshotFast(input: ZavorthMemoryPlaneInput = {}): ZavorthMemoryPlaneSnapshot {
    const session = this.sessionReadModel?.buildSnapshotFast({
      userId: input.userId || null,
      platform: input.platform || null,
      chatId: input.chatId || null,
      sessionId: input.sessionId || null,
      sourceUserId: input.sourceUserId || null,
    }) || null;

    return this.composeSnapshot({
      session,
      recentMemories: [],
      relevantMemories: [],
      historicalRelevantMemories: [],
      workspaceMemory: null,
      workspaceHint: String(input.workspaceHint || '').trim() || null,
    });
  }

  public async buildSnapshot(input: ZavorthMemoryPlaneInput = {}): Promise<ZavorthMemoryPlaneSnapshot> {
    const session = this.sessionReadModel
      ? await this.sessionReadModel.buildSnapshot({
          userId: input.userId || null,
          platform: input.platform || null,
          chatId: input.chatId || null,
          sessionId: input.sessionId || null,
          sourceUserId: input.sourceUserId || null,
        })
      : null;
    const workspace = this.resolveWorkspace(session, String(input.workspaceHint || '').trim() || null);
    const userId = String(input.userId || session?.runtimeUserId || '').trim() || null;
    const relevantQuery = this.buildRelevantMemoryQuery(session, workspace);

    const [recentMemories, relevantMemories, historicalRelevantMemories, workspaceMemory] = await Promise.all([
      this.readRecentMemories(userId),
      this.readRelevantMemories(userId, relevantQuery),
      this.readHistoricalRelevantMemories(userId, relevantQuery),
      this.readWorkspaceMemory(workspace, userId),
    ]);

    return this.composeSnapshot({
      session,
      recentMemories,
      relevantMemories,
      historicalRelevantMemories,
      workspaceMemory,
      workspaceHint: workspace,
    });
  }

  private composeSnapshot(input: {
    session: GatewaySessionSnapshot | null;
    recentMemories: MemoryEntry[];
    relevantMemories: MemoryEntry[];
    historicalRelevantMemories: MemoryEntry[];
    workspaceMemory: WorkspaceOperationalMemory | null;
    workspaceHint: string | null;
  }): ZavorthMemoryPlaneSnapshot {
    const relevantMemories = this.mergeRelevantMemories(
      input.relevantMemories,
      input.historicalRelevantMemories,
    );
    const replay = input.session?.replay || null;
    const artifacts = replay?.recentArtifacts || this.collectArtifactsFromSession(input.session);
    const workspace = input.workspaceMemory
      ? {
          workspace: input.workspaceMemory.workspace,
          summary: input.workspaceMemory.summary,
          recentArtifacts: (input.workspaceMemory.recent_artifacts || []).slice(0, 3).map((artifact) => ({
            name: artifact.name,
            kind: artifact.kind,
            summary: artifact.summary || null,
            createdAt: artifact.created_at,
          })),
          recentWorkflowRuns: (input.workspaceMemory.recent_workflow_runs || []).slice(0, 3).map((run) => ({
            workflow: run.workflow_name,
            status: run.status,
            updatedAt: run.updated_at,
            primaryArtifactName: run.primary_artifact_name || null,
          })),
          continuityRecommendations: (input.workspaceMemory.continuity_recommendations || []).slice(0, 3).map((entry) => ({
            label: entry.label,
            reason: entry.reason,
            kind: entry.kind,
          })),
          workflowRecommendations: (input.workspaceMemory.workflow_recommendations || []).slice(0, 3).map((entry) => ({
            workflow: entry.workflow,
            rationale: entry.rationale,
          })),
        }
      : null;
    const categories = Array.from(new Set(input.recentMemories.map((entry) => String(entry.category || '').trim()).filter(Boolean)));
    const timeline = this.buildTimeline({
      recentMemories: input.recentMemories,
      relevantMemories,
      artifacts,
      workspace,
    });
    const suggestedActions = this.buildSuggestedActions({
      session: input.session,
      replay,
      artifacts,
      workspace,
      recentMemories: input.recentMemories,
      workspaceHint: input.workspaceHint,
      timelineConflicts: timeline.conflicts,
    });

    return {
      generatedAt: this.now().toISOString(),
      summary: {
        persistedMemories: input.recentMemories.length,
        relevantMemories: relevantMemories.length,
        replayTasks: replay?.stats?.tasks || 0,
        workflowRuns: replay?.stats?.workflowRuns || 0,
        artifacts: artifacts.length,
        workspaceSignals:
          (workspace?.continuityRecommendations.length || 0)
          + (workspace?.workflowRecommendations.length || 0)
          + (workspace?.recentArtifacts.length || 0),
        timelineEvents: timeline.recent.length,
        historicalEvents: timeline.recent.filter((entry) => entry.status === 'historical').length,
        changedFacts: timeline.conflicts.length,
      },
      memory: {
        recent: input.recentMemories.slice(0, 5).map((entry) => this.serializeMemoryEntry(entry)),
        relevant: relevantMemories.slice(0, 5).map((entry) => this.serializeMemoryEntry(entry)),
        categories,
        vectorRecall: Boolean(this.memoryService),
      },
      timeline,
      replay,
      artifacts: {
        recent: artifacts.slice(0, 4),
        kinds: Array.from(new Set(artifacts.map((artifact) => String(artifact.kind || '').trim()).filter(Boolean))).slice(0, 6),
        latestLabel: artifacts[0]?.label || null,
        reusableCount: artifacts.length,
      },
      workspace,
      suggestedActions,
      narrative: {
        headline: 'Memory, Replay, Timeline & Artifacts',
        operatorSummary: this.buildOperatorSummary({
          replay,
          artifacts,
          workspace,
          recentMemories: input.recentMemories,
          relevantMemories,
          timeline,
        }),
      },
    };
  }

  private buildSuggestedActions(input: {
    session: GatewaySessionSnapshot | null;
    replay: SessionReplaySnapshot | null;
    artifacts: SessionReplayArtifactSnapshot[];
    workspace: ZavorthMemoryPlaneSnapshot['workspace'];
    recentMemories: MemoryEntry[];
    workspaceHint: string | null;
    timelineConflicts: ZavorthMemoryPlaneConflict[];
  }): ZavorthMemoryPlaneSnapshot['suggestedActions'] {
    const actions: ZavorthMemoryPlaneSnapshot['suggestedActions'] = [];
    const sessionTarget = String(input.session?.sessionId || input.session?.chatId || '').trim();

    if (input.replay?.recommendedEntry?.targetId && sessionTarget) {
      actions.push({
        id: 'replay-resume',
        label: input.replay.recommendedEntry.label,
        command: `/sessionhistory ${sessionTarget}`,
        reason: input.replay.recommendedEntry.reason,
        kind: 'resume',
      });
    }

    if (input.artifacts[0] && sessionTarget) {
      actions.push({
        id: 'artifact-resume',
        label: `Retomar a partir de ${input.artifacts[0].label}`,
        command: `/sessionhistory ${sessionTarget}`,
        reason: input.artifacts[0].summary || 'Existe uma entrega recente pronta para reaproveitar.',
        kind: 'artifact',
      });
    }

    if (!input.recentMemories.length) {
      actions.push({
        id: 'memory-seed',
        label: 'Semear memoria persistente',
        command: '/remember <chave> <valor>',
        reason: 'Ainda nao existem memorias persistentes registradas para este operador.',
        kind: 'memory',
      });
    }

    if (!input.workspace && input.workspaceHint) {
      actions.push({
        id: 'workspace-build',
        label: 'Materializar memoria operacional',
        command: '/task revisar workspace atual',
        reason: 'O workspace em foco ainda nao virou memoria operacional reutilizavel.',
        kind: 'workspace',
      });
    }

    if (input.timelineConflicts.length > 0) {
      actions.push({
        id: 'memory-conflict-review',
        label: 'Revisar fatos que mudaram',
        command: '/memoryplane',
        reason: `${input.timelineConflicts.length} fato(s) mudaram e agora aparecem como historico no contexto.`,
        kind: 'memory',
      });
    }

    return actions.slice(0, 4);
  }

  private buildOperatorSummary(input: {
    replay: SessionReplaySnapshot | null;
    artifacts: SessionReplayArtifactSnapshot[];
    workspace: ZavorthMemoryPlaneSnapshot['workspace'];
    recentMemories: MemoryEntry[];
    relevantMemories: MemoryEntry[];
    timeline: ZavorthMemoryPlaneSnapshot['timeline'];
  }): string {
    const parts = [
      input.replay
        ? `${input.replay.stats?.tasks || 0} tarefa(s) no replay`
        : 'sem replay relevante',
      input.artifacts.length
        ? `${input.artifacts.length} artefato(s) reutilizavel(is)`
        : 'sem artefatos recentes',
      input.recentMemories.length
        ? `${input.recentMemories.length} memoria(s) persistente(s)`
        : 'sem memoria persistente',
    ];

    if (input.relevantMemories.length) {
      parts.push(`${input.relevantMemories.length} memoria(s) relevante(s) para o contexto atual`);
    }
    if (input.workspace) {
      parts.push(`workspace ${input.workspace.workspace} com memoria operacional pronta`);
    }
    if (input.timeline.conflicts.length) {
      parts.push(`${input.timeline.conflicts.length} fato(s) mudaram e seguem visiveis na timeline`);
    }

    return parts.join(' | ');
  }

  private buildTimeline(input: {
    recentMemories: MemoryEntry[];
    relevantMemories: MemoryEntry[];
    artifacts: SessionReplayArtifactSnapshot[];
    workspace: ZavorthMemoryPlaneSnapshot['workspace'];
  }): ZavorthMemoryPlaneSnapshot['timeline'] {
    const entries: ZavorthMemoryPlaneTimelineEntry[] = [];
    const recentFactIds = new Set<string>();

    for (const entry of input.recentMemories.slice(0, 5)) {
      const factId = `${entry.key}::${entry.value}`;
      recentFactIds.add(factId);
      entries.push({
        id: `memory-current:${entry.key}:${entry.updated_at || entry.created_at || 'na'}`,
        label: entry.key,
        kind: 'memory',
        status: 'current',
        happenedAt: this.resolveMemoryEventTimestamp(entry),
        category: entry.category || null,
        source: 'memory.recent',
        summary: entry.value,
      });
    }

    for (const entry of input.relevantMemories.slice(0, 5)) {
      const factId = `${entry.key}::${entry.value}`;
      if (recentFactIds.has(factId)) {
        continue;
      }

      entries.push({
        id: `memory-historical:${entry.key}:${entry.archived_at || entry.updated_at || entry.created_at || 'na'}`,
        label: entry.key,
        kind: 'memory',
        status: 'historical',
        happenedAt: this.resolveMemoryEventTimestamp(entry),
        category: entry.category || null,
        source: entry.archived_at ? 'memory.history' : 'memory.relevant',
        summary: entry.value,
      });
    }

    for (const artifact of input.artifacts.slice(0, 3)) {
      entries.push({
        id: `artifact:${artifact.id}`,
        label: artifact.label,
        kind: 'artifact',
        status: 'current',
        happenedAt: artifact.createdAt || null,
        category: artifact.kind || null,
        source: 'replay.artifact',
        summary: artifact.summary || 'Artefato recente reutilizavel.',
      });
    }

    for (const workflow of input.workspace?.recentWorkflowRuns || []) {
      entries.push({
        id: `workflow:${workflow.workflow}:${workflow.updatedAt}`,
        label: workflow.workflow,
        kind: 'workflow',
        status: 'current',
        happenedAt: workflow.updatedAt || null,
        category: workflow.status || null,
        source: 'workspace.workflow',
        summary: workflow.primaryArtifactName
          ? `${workflow.status} | artefato ${workflow.primaryArtifactName}`
          : workflow.status,
      });
    }

    if (input.workspace) {
      entries.push({
        id: `workspace:${input.workspace.workspace}`,
        label: input.workspace.workspace,
        kind: 'workspace',
        status: 'current',
        happenedAt: input.workspace.recentArtifacts[0]?.createdAt || null,
        category: 'workspace',
        source: 'workspace.summary',
        summary: input.workspace.summary,
      });
    }

    const recent = entries
      .sort((left, right) => this.compareIsoDesc(left.happenedAt, right.happenedAt))
      .slice(0, 8);
    const conflicts = this.buildTimelineConflicts(input.recentMemories, input.relevantMemories);
    const latestHistoricalAt = recent
      .filter((entry) => entry.status === 'historical')
      .map((entry) => entry.happenedAt)
      .find((value) => Boolean(value))
      || null;

    return {
      recent,
      conflicts,
      latestHistoricalAt,
    };
  }

  private buildTimelineConflicts(
    recentMemories: MemoryEntry[],
    relevantMemories: MemoryEntry[],
  ): ZavorthMemoryPlaneConflict[] {
    const recentByKey = new Map<string, MemoryEntry>();
    for (const entry of recentMemories) {
      const key = String(entry.key || '').trim();
      if (!key) {
        continue;
      }

      const current = recentByKey.get(key);
      if (
        !current ||
        this.compareIsoDesc(
          this.resolveMemoryEventTimestamp(entry),
          this.resolveMemoryEventTimestamp(current),
        ) < 0
      ) {
        recentByKey.set(key, entry);
      }
    }

    const grouped = new Map<string, MemoryEntry[]>();
    for (const entry of [...recentMemories, ...relevantMemories]) {
      const key = String(entry.key || '').trim();
      if (!key) {
        continue;
      }
      const bucket = grouped.get(key) || [];
      bucket.push(entry);
      grouped.set(key, bucket);
    }

    const conflicts: ZavorthMemoryPlaneConflict[] = [];
    for (const [key, entries] of grouped.entries()) {
      const sorted = entries
        .slice()
        .sort((left, right) => this.compareIsoDesc(this.resolveMemoryEventTimestamp(left), this.resolveMemoryEventTimestamp(right)));
      const current = recentByKey.get(key) || sorted[0];
      const currentValue = String(current?.value || '').trim();
      const previous = sorted.find((entry) =>
        entry !== current
        && String(entry.value || '').trim()
        && String(entry.value || '').trim() !== currentValue);

      if (!current || !previous) {
        continue;
      }

      conflicts.push({
        key,
        category: String(current.category || previous.category || '').trim() || null,
        currentValue: String(current.value || '').trim(),
        previousValue: String(previous.value || '').trim(),
        detectedAt: current.updated_at || current.created_at || null,
        reason: 'O fato atual difere do historico recente recuperado para o mesmo identificador.',
      });
    }

    return conflicts.slice(0, 4);
  }

  private compareIsoDesc(left: string | null, right: string | null): number {
    const leftTime = left ? Date.parse(left) : 0;
    const rightTime = right ? Date.parse(right) : 0;
    return rightTime - leftTime;
  }

  private collectArtifactsFromSession(session: GatewaySessionSnapshot | null): SessionReplayArtifactSnapshot[] {
    const artifacts: SessionReplayArtifactSnapshot[] = [];
    const seen = new Set<string>();
    for (const task of session?.tasks || []) {
      for (const artifact of Array.isArray(task.artifacts) ? task.artifacts : []) {
        const id = String(artifact?.id || artifact?.key || artifact?.path || artifact?.name || '').trim();
        if (!id || seen.has(id)) {
          continue;
        }
        seen.add(id);
        artifacts.push({
          id,
          label: String(artifact?.name || artifact?.key || artifact?.path || 'Entrega').trim(),
          kind: String(artifact?.kind || artifact?.type || 'artifact').trim() || 'artifact',
          summary: String(artifact?.summary || artifact?.description || artifact?.path || '').trim() || null,
          path: String(artifact?.path || '').trim() || null,
          createdAt: String(artifact?.createdAt || (artifact as unknown as { created_at?: unknown })?.created_at || task.updated_at || '').trim() || null,
          sourceTaskId: task.task_id || null,
        });
      }
    }
    return artifacts;
  }

  private serializeMemoryEntry(entry: MemoryEntry): ZavorthMemoryPlaneEntry {
    return {
      key: entry.key,
      value: entry.value,
      category: entry.category,
      updatedAt: entry.updated_at || entry.created_at || null,
    };
  }

  private mergeRelevantMemories(currentRelevant: MemoryEntry[], historicalRelevant: MemoryEntry[]): MemoryEntry[] {
    const merged = [...currentRelevant, ...historicalRelevant];
    const seen = new Set<string>();

    return merged.filter((entry) => {
      const id = [
        entry.key,
        entry.value,
        entry.category,
        entry.updated_at,
        entry.archived_at || '',
      ].join('::');
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });
  }

  private resolveMemoryEventTimestamp(entry: MemoryEntry): string | null {
    return entry.archived_at || entry.updated_at || entry.created_at || null;
  }

  private resolveWorkspace(session: GatewaySessionSnapshot | null, workspaceHint: string | null): string | null {
    return String(
      workspaceHint
      || session?.continuity?.focusTask?.workspace
      || session?.continuity?.currentSurfaceTask?.workspace
      || session?.continuity?.latestTelegramTask?.workspace
      || session?.continuity?.latestWebTask?.workspace
      || session?.tasks?.find((task) => Boolean(task.workspace))?.workspace
      || '',
    ).trim() || null;
  }

  private buildRelevantMemoryQuery(session: GatewaySessionSnapshot | null, workspace: string | null): string {
    return [
      workspace,
      session?.replay?.headline,
      session?.replay?.operatorSummary,
      session?.continuity?.suggestedAction?.reason,
      session?.handoff?.handoffPrompt,
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .join(' ');
  }

  private async readRecentMemories(userId: string | null): Promise<MemoryEntry[]> {
    if (!userId || !this.memoryService) {
      return [];
    }

    try {
      return await this.memoryService.listAll(userId);
    } catch (error: any) {
      logger.warn('[MemoryPlane] Failed to list memories:', error);
      return [];
    }
  }

  private async readRelevantMemories(userId: string | null, query: string): Promise<MemoryEntry[]> {
    if (!userId || !this.memoryService || !String(query || '').trim()) {
      return [];
    }

    try {
      return await this.memoryService.listRelevant(userId, query, 5);
    } catch (error: any) {
      logger.warn('[MemoryPlane] Failed to list relevant memories:', error);
      return [];
    }
  }

  private async readHistoricalRelevantMemories(userId: string | null, query: string): Promise<MemoryEntry[]> {
    if (!userId || !this.memoryService || !String(query || '').trim() || !this.memoryService.listHistoricalRelevant) {
      return [];
    }

    try {
      return await this.memoryService.listHistoricalRelevant(userId, query, 5);
    } catch (error: any) {
      logger.warn('[MemoryPlane] Failed to list historical memories:', error);
      return [];
    }
  }

  private async readWorkspaceMemory(workspace: string | null, userId: string | null): Promise<WorkspaceOperationalMemory | null> {
    if (!workspace || !this.workspaceOperationalMemory) {
      return null;
    }

    try {
      return await this.workspaceOperationalMemory.getMemory(workspace, userId || undefined);
    } catch (error: any) {
      logger.warn('[MemoryPlane] Failed to read workspace memory:', error);
      return null;
    }
  }
}
