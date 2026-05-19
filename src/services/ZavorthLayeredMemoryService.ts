import { config } from '../config/index.js';
import { ZavorthLearningPlaneService, type LearningCandidateSnapshot } from './ZavorthLearningPlaneService.js';
import {
  ZavorthMemoryPlaneService,
  type ZavorthMemoryPlaneSnapshot,
  type ZavorthMemoryPlaneTimelineEntry,
} from './ZavorthMemoryPlaneService.js';
import { MemoryService, type MemoryEntry } from './MemoryService.js';
import { WorkflowRunService } from './WorkflowRunService.js';

export type LayeredMemoryLayer = 'episodic' | 'semantic' | 'procedural';

export type LayeredMemorySearchEntry = {
  id: string;
  label: string;
  summary: string;
  memoryLayer: LayeredMemoryLayer;
  source: string;
  confidence: number;
  lastValidatedAt: string | null;
  metadata?: Record<string, unknown>;
};

export type LayeredMemorySearchSnapshot = {
  generatedAt: string;
  query: string;
  total: number;
  data: LayeredMemorySearchEntry[];
};

export type LayeredMemoryProcedureSnapshot = {
  generatedAt: string;
  total: number;
  data: Array<LayeredMemorySearchEntry & { steps: string[] }>;
};

export type LayeredMemoryStatusSnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    episodic: number;
    semantic: number;
    procedural: number;
  };
  budgets: {
    perLayer: number;
    episodicUsage: number;
    semanticUsage: number;
    proceduralUsage: number;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export type LayeredMemoryMetricsSnapshot = {
  generatedAt: string;
  summary: {
    totalEntries: number;
    episodic: number;
    semantic: number;
    procedural: number;
    averageBudgetUsage: number;
    pressure: 'ok' | 'elevated' | 'critical';
  };
  budgets: LayeredMemoryStatusSnapshot['budgets'];
  procedures: {
    total: number;
    trustedLocal: number;
    learnedDraft: number;
    implicit: number;
  };
};

type LayeredMemoryRuntime = {
  now?: () => Date;
  memoryPlaneService?: Pick<ZavorthMemoryPlaneService, 'buildSnapshot'>;
  memoryService?: Pick<MemoryService, 'listAll' | 'listRelevant' | 'listHistoricalRelevant'>;
  learningPlaneService?: Pick<ZavorthLearningPlaneService, 'buildSnapshot'>;
  workflowRunService?: Pick<WorkflowRunService, 'listRuns'>;
};

type LayeredMemoryInput = {
  userId?: string | null;
  platform?: string | null;
  chatId?: string | null;
  sessionId?: string | null;
  workspaceHint?: string | null;
};

export class ZavorthLayeredMemoryService {
  private readonly now: () => Date;
  private readonly memoryPlane: Pick<ZavorthMemoryPlaneService, 'buildSnapshot'>;
  private readonly memoryService: Pick<MemoryService, 'listAll' | 'listRelevant' | 'listHistoricalRelevant'>;
  private readonly learningPlane: Pick<ZavorthLearningPlaneService, 'buildSnapshot'>;
  private readonly workflowRuns: Pick<WorkflowRunService, 'listRuns'>;

  constructor(runtime: LayeredMemoryRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.memoryPlane = runtime.memoryPlaneService || new ZavorthMemoryPlaneService();
    this.memoryService = runtime.memoryService || new MemoryService();
    this.learningPlane = runtime.learningPlaneService || new ZavorthLearningPlaneService();
    this.workflowRuns = runtime.workflowRunService || new WorkflowRunService();
  }

  public async buildStatus(input: LayeredMemoryInput = {}): Promise<LayeredMemoryStatusSnapshot> {
    const [memoryPlaneSnapshot, semanticEntries, procedures] = await Promise.all([
      this.memoryPlane.buildSnapshot({
        userId: input.userId || null,
        platform: input.platform || null,
        chatId: input.chatId || null,
        sessionId: input.sessionId || null,
        workspaceHint: input.workspaceHint || null,
      }),
      input.userId ? this.memoryService.listAll(input.userId) : Promise.resolve([]),
      this.readProcedures({
        workspaceHint: input.workspaceHint,
      }),
    ]);

    const episodicCount = (memoryPlaneSnapshot.timeline?.recent.length || 0)
      + (memoryPlaneSnapshot.replay?.timeline.length || 0);
    const semanticCount = semanticEntries.length;
    const proceduralCount = procedures.total;
    const perLayer = config.layeredMemoryBudgetPerLayer || 12;

    return {
      generatedAt: this.now().toISOString(),
      summary: {
        total: episodicCount + semanticCount + proceduralCount,
        episodic: episodicCount,
        semantic: semanticCount,
        procedural: proceduralCount,
      },
      budgets: {
        perLayer,
        episodicUsage: Math.min(1, episodicCount / Math.max(1, perLayer)),
        semanticUsage: Math.min(1, semanticCount / Math.max(1, perLayer)),
        proceduralUsage: Math.min(1, proceduralCount / Math.max(1, perLayer)),
      },
      narrative: {
        headline: 'Layered memory pronta para episodic, semantic e procedural recall.',
        operatorSummary: `${episodicCount} episodico(s), ${semanticCount} semantico(s) e `
          + `${proceduralCount} procedimento(s) no recall atual.`,
      },
    };
  }

  public async readMetrics(input: LayeredMemoryInput = {}): Promise<LayeredMemoryMetricsSnapshot> {
    const [status, procedures] = await Promise.all([
      this.buildStatus(input),
      this.readProcedures({
        workspaceHint: input.workspaceHint,
      }),
    ]);
    const averageBudgetUsage = Number((
      (status.budgets.episodicUsage + status.budgets.semanticUsage + status.budgets.proceduralUsage) / 3
    ).toFixed(3));
    const pressure = this.resolvePressure([
      status.budgets.episodicUsage,
      status.budgets.semanticUsage,
      status.budgets.proceduralUsage,
    ]);

    return {
      generatedAt: status.generatedAt,
      summary: {
        totalEntries: status.summary.total,
        episodic: status.summary.episodic,
        semantic: status.summary.semantic,
        procedural: status.summary.procedural,
        averageBudgetUsage,
        pressure,
      },
      budgets: status.budgets,
      procedures: {
        total: procedures.total,
        trustedLocal: procedures.data.filter((entry) => entry.metadata?.lifecycle === 'trusted_local').length,
        learnedDraft: procedures.data.filter((entry) => entry.metadata?.lifecycle === 'learned_draft').length,
        implicit: procedures.data.filter((entry) => entry.metadata?.lifecycle === 'implicit').length,
      },
    };
  }

  public async search(input: LayeredMemoryInput & { query: string; limit?: number }): Promise<LayeredMemorySearchSnapshot> {
    const query = String(input.query || '').trim();
    const limit = Math.max(1, Math.min(Number(input.limit || 12), 50));
    if (!query) {
      return {
        generatedAt: this.now().toISOString(),
        query: '',
        total: 0,
        data: [],
      };
    }

    const [memoryPlaneSnapshot, semanticEntries, historicalEntries, procedures] = await Promise.all([
      this.memoryPlane.buildSnapshot({
        userId: input.userId || null,
        platform: input.platform || null,
        chatId: input.chatId || null,
        sessionId: input.sessionId || null,
        workspaceHint: input.workspaceHint || null,
      }),
      input.userId ? this.memoryService.listRelevant(input.userId, query, limit) : Promise.resolve([]),
      input.userId ? this.memoryService.listHistoricalRelevant(input.userId, query, limit) : Promise.resolve([]),
      this.readProcedures({
        workspaceHint: input.workspaceHint,
      }),
    ]);

    const entries: LayeredMemorySearchEntry[] = [
      ...this.fromTimeline(memoryPlaneSnapshot.timeline.recent, query),
      ...this.fromSemantic(semanticEntries, 0.85),
      ...this.fromSemantic(historicalEntries, 0.6, 'memory-history'),
      ...procedures.data
        .filter((entry) => this.matchesQuery(`${entry.label} ${entry.summary} ${entry.steps.join(' ')}`, query))
        .map((entry) => ({
          id: entry.id,
          label: entry.label,
          summary: entry.summary,
          memoryLayer: 'procedural' as const,
          source: entry.source,
          confidence: entry.confidence,
          lastValidatedAt: entry.lastValidatedAt,
          metadata: entry.metadata,
        })),
    ]
      .sort((left, right) => {
        if (right.confidence !== left.confidence) {
          return right.confidence - left.confidence;
        }
        return String(right.lastValidatedAt || '').localeCompare(String(left.lastValidatedAt || ''));
      })
      .slice(0, limit);

    return {
      generatedAt: this.now().toISOString(),
      query,
      total: entries.length,
      data: entries,
    };
  }

  public async readProcedures(input: { workspaceHint?: string | null } = {}): Promise<LayeredMemoryProcedureSnapshot> {
    const workspace = String(input.workspaceHint || '').trim();
    const learningSnapshot = this.learningPlane.buildSnapshot({
      workspace: workspace || null,
    });
    const entries = new Map<string, LayeredMemoryProcedureSnapshot['data'][number]>();

    for (const candidate of learningSnapshot.candidates) {
      if (!['approved', 'pending'].includes(candidate.reviewState) && candidate.lifecycle !== 'trusted_local') {
        continue;
      }
      entries.set(candidate.id, this.fromLearningCandidate(candidate));
    }

    for (const run of this.workflowRuns.listRuns({
      workspace: workspace || null,
      limit: config.layeredMemoryBudgetPerLayer || 12,
      statuses: ['completed'],
    })) {
      const procedureId = `workflow:${run.workflow_run_id}`;
      if (entries.has(procedureId)) {
        continue;
      }
      const steps = run.phases
        .filter((phase) => Boolean(phase.label))
        .map((phase) => String(phase.label || '').trim())
        .filter(Boolean)
        .slice(0, 6);
      if (steps.length === 0) {
        continue;
      }
      entries.set(procedureId, {
        id: procedureId,
        label: `${this.capitalize(run.workflow_name)} procedure`,
        summary: run.objective,
        steps,
        memoryLayer: 'procedural',
        source: 'workflow-replay',
        confidence: 0.58,
        lastValidatedAt: run.updated_at || run.created_at || null,
        metadata: {
          workflowRunId: run.workflow_run_id,
          workspace: run.workspace,
          lifecycle: 'implicit',
        },
      });
    }

    const data = Array.from(entries.values())
      .sort((left, right) => {
        if (right.confidence !== left.confidence) {
          return right.confidence - left.confidence;
        }
        return String(right.lastValidatedAt || '').localeCompare(String(left.lastValidatedAt || ''));
      })
      .slice(0, config.layeredMemoryBudgetPerLayer || 12);

    return {
      generatedAt: this.now().toISOString(),
      total: data.length,
      data,
    };
  }

  private fromLearningCandidate(
    candidate: LearningCandidateSnapshot,
  ): LayeredMemoryProcedureSnapshot['data'][number] {
    return {
      id: candidate.id,
      label: candidate.title,
      summary: candidate.summary,
      steps: candidate.steps.slice(),
      memoryLayer: 'procedural',
      source: 'learning-plane',
      confidence: candidate.lifecycle === 'trusted_local' ? Math.max(candidate.score, 0.82) : candidate.score,
      lastValidatedAt: candidate.lastValidatedAt,
      metadata: {
        workflowRunId: candidate.source.workflowRunId,
        lifecycle: candidate.lifecycle,
        reviewState: candidate.reviewState,
        platformEntryId: candidate.platformEntryId,
      },
    };
  }

  private fromTimeline(entries: ZavorthMemoryPlaneTimelineEntry[], query: string): LayeredMemorySearchEntry[] {
    return entries
      .filter((entry) => this.matchesQuery(`${entry.label} ${entry.summary} ${entry.source}`, query))
      .map((entry) => ({
        id: entry.id,
        label: entry.label,
        summary: entry.summary,
        memoryLayer: 'episodic' as const,
        source: entry.source,
        confidence: entry.status === 'current' ? 0.72 : 0.55,
        lastValidatedAt: entry.happenedAt,
        metadata: {
          kind: entry.kind,
          category: entry.category,
          status: entry.status,
          targetId: entry.id,
        },
      }));
  }

  private fromSemantic(entries: MemoryEntry[], confidence: number, source: string = 'memory-store'): LayeredMemorySearchEntry[] {
    return entries.map((entry) => ({
      id: `memory:${entry.id}`,
      label: entry.key,
      summary: entry.value,
      memoryLayer: 'semantic',
      source,
      confidence,
      lastValidatedAt: entry.updated_at || entry.created_at,
      metadata: {
        category: entry.category,
      },
    }));
  }

  private matchesQuery(text: string, query: string): boolean {
    const haystack = String(text || '').trim().toLowerCase();
    const needle = String(query || '').trim().toLowerCase();
    if (!haystack || !needle) {
      return false;
    }
    return needle.split(/\s+/).every((token) => haystack.includes(token));
  }

  private capitalize(value: string): string {
    const normalized = String(value || '').trim();
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Procedural';
  }

  private resolvePressure(usages: number[]): 'ok' | 'elevated' | 'critical' {
    const maxUsage = usages.reduce((acc, value) => Math.max(acc, Number(value || 0)), 0);
    if (maxUsage >= 0.85) {
      return 'critical';
    }
    if (maxUsage >= 0.6) {
      return 'elevated';
    }
    return 'ok';
  }
}
