import { config } from '../config/index.js';
import {
  ZavorthLayeredMemoryService,
  type LayeredMemoryStatusSnapshot,
  type LayeredMemoryMetricsSnapshot,
  type LayeredMemoryProcedureSnapshot,
} from './ZavorthLayeredMemoryService.js';
import {
  ZavorthLearningPlaneService,
  type LearningPlaneSnapshot,
  type LearningPlaneMetricsSnapshot,
} from './ZavorthLearningPlaneService.js';
import {
  ZavorthMemoryPlaneService,
  type ZavorthMemoryPlaneSnapshot,
} from './ZavorthMemoryPlaneService.js';
import {
  WorkflowRunService,
  type WorkflowRunSnapshot,
} from './WorkflowRunService.js';
import {
  ExecutionLifecycleReadModelService,
  type ExecutionLifecycleReadModelSnapshot,
} from './ExecutionLifecycleReadModelService.js';
import { buildReplayLearningActions } from './replay-learning-control-plane/ReplayLearningControlPlaneActions.js';
import {
  resolveReplayLearningRestoreReady,
  resolveReplayLearningResumeReady,
} from './replay-learning-control-plane/ReplayLearningControlPlaneReadiness.js';
import {
  buildReplayLearningOperatorSummary,
  normalizeReplayLearningLimit,
  nullableText,
  resolveReplayLearningPosture,
  safeAsync,
  safeSync,
  text,
} from './replay-learning-control-plane/ReplayLearningControlPlaneSupport.js';





import { buildReplayLearningCards } from './replay-learning-control-plane/ReplayLearningControlPlaneCards.js';
import {
  collectReplayLearningArtifacts,
  collectReplayLearningCandidates,
  collectReplayLearningTimeline,
} from './replay-learning-control-plane/ReplayLearningControlPlaneCollections.js';


export type ZavorthReplayLearningPosture = 'healthy' | 'attention' | 'critical';
export type ZavorthReplayLearningActionSeverity = 'info' | 'warn' | 'critical';

type AsyncSnapshotLike = Pick<ZavorthMemoryPlaneService, 'buildSnapshot'>;

type LayeredMemoryLike = Partial<Pick<
  ZavorthLayeredMemoryService,
  'buildStatus' | 'readMetrics' | 'readProcedures'
>>;

type LearningPlaneLike = Pick<ZavorthLearningPlaneService, 'buildSnapshot' | 'readMetrics'>;

type WorkflowRunLike = Pick<WorkflowRunService, 'listRuns'>;
type HostActionLike = {
  listActions: (limit?: number) => any[];
};

type ReplayLearningRuntime = {
  now?: () => Date;
  workspaceRoot?: string | null;
  memoryPlaneService?: AsyncSnapshotLike | null;
  layeredMemoryService?: LayeredMemoryLike | null;
  learningPlaneService?: LearningPlaneLike | null;
  workflowRunService?: WorkflowRunLike | null;
  hostActionService?: HostActionLike | null;
};

export type ZavorthReplayLearningArtifactEntry = {
  id: string;
  label: string;
  kind: string;
  source: string;
  sourceRunId: string | null;
  path: string | null;
  url: string | null;
  createdAt: string | null;
  summary: string;
  reusable: boolean;
  resumePrompt: string;
};

export type ZavorthReplayLearningCard = {
  id: 'replay' | 'artifacts' | 'lifecycle' | 'learning' | 'memory' | 'workspace';
  label: string;
  posture: ZavorthReplayLearningPosture;
  summary: string;
  nextAction: string;
  command: string | null;
};

export type ZavorthReplayLearningControlPlaneSnapshot = {
  generatedAt: string;
  workspaceRoot: string;
  summary: {
    posture: ZavorthReplayLearningPosture;
    timelineEvents: number;
    compareReady: boolean;
    resumeReady: boolean;
    restoreReady: boolean;
    recentArtifacts: number;
    reusableArtifacts: number;
    workflowRuns: number;
    resumableWorkflowRuns: number;
    lifecycleEvents: number;
    lifecycleRuns: number;
    lifecycleApprovals: number;
    lifecycleArtifacts: number;
    lifecycleAttention: number;
    learningCandidates: number;
    pendingLearning: number;
    promotedLearning: number;
    highConfidenceLearning: number;
    memoryEntries: number;
    proceduralEntries: number;
    memoryPressure: string;
  };
  cards: ZavorthReplayLearningCard[];
  artifacts: ZavorthReplayLearningArtifactEntry[];
  timeline: Array<{
    id: string;
    label: string;
    kind: string;
    status: string | null;
    happenedAt: string | null;
    summary: string;
  }>;
  lifecycle: ExecutionLifecycleReadModelSnapshot;
  learningCandidates: Array<{
    id: string;
    title: string;
    kind: string;
    score: number;
    reviewState: string;
    lifecycle: string;
    sourceWorkflow: string;
    actionHint: string;
  }>;
  actions: Array<{
    id: string;
    label: string;
    severity: ZavorthReplayLearningActionSeverity;
    command: string | null;
    reason: string;
    prompt: string | null;
  }>;
  sourceSnapshots: {
    memoryPlane: any;
    layeredMemory: any;
    layeredMemoryMetrics: any;
    procedures: any;
    learningPlane: any;
    learningMetrics: any;
    workflowRuns: WorkflowRunSnapshot[];
    hostActions: any[];
    lifecycle: ExecutionLifecycleReadModelSnapshot;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};

export class ZavorthReplayLearningControlPlaneService {
  private readonly now: () => Date;
  private readonly workspaceRoot: string;
  private readonly memoryPlane: AsyncSnapshotLike;
  private readonly layeredMemory: LayeredMemoryLike;
  private readonly learningPlane: LearningPlaneLike;
  private readonly workflowRuns: WorkflowRunLike;
  private readonly hostActions: HostActionLike | null;
  private readonly lifecycleReadModel: ExecutionLifecycleReadModelService;

  constructor(runtime: ReplayLearningRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.workspaceRoot = text(runtime.workspaceRoot, config.projectRoot || process.cwd());
    this.memoryPlane = runtime.memoryPlaneService || new ZavorthMemoryPlaneService();
    this.learningPlane = runtime.learningPlaneService || new ZavorthLearningPlaneService();
    this.layeredMemory = runtime.layeredMemoryService || new ZavorthLayeredMemoryService({
      memoryPlaneService: this.memoryPlane,
      learningPlaneService: this.learningPlane,
    });
    this.workflowRuns = runtime.workflowRunService || new WorkflowRunService();
    this.hostActions = runtime.hostActionService || null;
    this.lifecycleReadModel = new ExecutionLifecycleReadModelService({ now: this.now });
  }

  public async buildSnapshot(input: {
    sessionId?: string | null;
    userId?: string | null;
    platform?: string | null;
    chatId?: string | null;
    workspace?: string | null;
    limit?: number | null;
  } = {}): Promise<ZavorthReplayLearningControlPlaneSnapshot> {
    const limit = normalizeReplayLearningLimit(input.limit);
    const workspace = text(input.workspace, this.workspaceRoot);
    const context = {
      userId: nullableText(input.userId),
      platform: nullableText(input.platform),
      chatId: nullableText(input.chatId),
      sessionId: nullableText(input.sessionId),
      workspaceHint: workspace,
    };
    const [
      memoryPlane,
      layeredMemory,
      layeredMemoryMetrics,
      procedures,
      learningPlane,
      learningMetrics,
    ] = await Promise.all([
      safeAsync(() => this.memoryPlane.buildSnapshot(context), null),
      safeAsync(() => this.layeredMemory.buildStatus?.(context), null),
      safeAsync(() => this.layeredMemory.readMetrics?.(context), null),
      safeAsync(() => this.layeredMemory.readProcedures?.({ workspaceHint: workspace }), null),
      safeAsync(() => this.learningPlane.buildSnapshot?.({ workspace }), null),
      safeAsync(() => this.learningPlane.readMetrics?.({ workspace }), null),
    ]);
    const workflowRuns = safeSync(() => this.workflowRuns.listRuns({ workspace, limit }), []);
    const hostActions = safeSync(() => this.hostActions?.listActions?.(Math.max(limit * 2, 50)) || [], []);
    const artifacts = collectReplayLearningArtifacts({ memoryPlane, workflowRuns, limit });
    const timeline = collectReplayLearningTimeline({ memoryPlane, workflowRuns, artifacts, limit });
    const lifecycle = this.lifecycleReadModel.buildSnapshot({
      memoryPlane,
      replay: memoryPlane?.replay || null,
      workflowRuns,
      hostActions,
      limit,
    });
    const learningCandidates = collectReplayLearningCandidates(learningPlane, limit);
    const compareReady = timeline.length >= 2 || workflowRuns.length >= 2;
    const resumeReady = resolveReplayLearningResumeReady(memoryPlane, workflowRuns, artifacts);
    const restoreReady = resolveReplayLearningRestoreReady(memoryPlane, workflowRuns);
    const summary = {
      posture: 'healthy' as ZavorthReplayLearningPosture,
      timelineEvents: timeline.length,
      compareReady,
      resumeReady,
      restoreReady,
      recentArtifacts: artifacts.length,
      reusableArtifacts: artifacts.filter((entry) => entry.reusable).length,
      workflowRuns: workflowRuns.length,
      resumableWorkflowRuns: workflowRuns.filter((run) => Boolean(run.resume_stage)).length,
      lifecycleEvents: lifecycle.summary.recent,
      lifecycleRuns: lifecycle.summary.runs,
      lifecycleApprovals: lifecycle.summary.approvals,
      lifecycleArtifacts: lifecycle.summary.artifacts,
      lifecycleAttention: lifecycle.summary.approvalRequired + lifecycle.summary.blocked + lifecycle.summary.failed,
      learningCandidates: Number(learningPlane?.summary?.total || learningCandidates.length || 0) || 0,
      pendingLearning: Number(learningPlane?.summary?.pending || 0) || 0,
      promotedLearning: Number(learningPlane?.summary?.promoted || 0) || 0,
      highConfidenceLearning: Number(learningPlane?.summary?.highConfidence || 0) || 0,
      memoryEntries: Number(layeredMemoryMetrics?.summary?.totalEntries || layeredMemory?.summary?.total || 0) || 0,
      proceduralEntries: Number(layeredMemoryMetrics?.summary?.procedural || procedures?.total || 0) || 0,
      memoryPressure: text(layeredMemoryMetrics?.summary?.pressure, 'ok'),
    };
    const cards = buildReplayLearningCards({
      memoryPlane,
      layeredMemory,
      layeredMemoryMetrics,
      learningPlane,
      procedures,
      lifecycle,
      summary,
    });
    const actions = buildReplayLearningActions({
      summary,
      artifacts,
      learningCandidates,
      memoryPlane,
      workflowRuns,
    });
    summary.posture = resolveReplayLearningPosture({ summary, actions, cards });

    return {
      generatedAt: this.now().toISOString(),
      workspaceRoot: workspace,
      summary,
      cards,
      artifacts,
      timeline,
      lifecycle,
      learningCandidates,
      actions,
      sourceSnapshots: {
        memoryPlane,
        layeredMemory,
        layeredMemoryMetrics,
        procedures,
        learningPlane,
        learningMetrics,
        workflowRuns,
        hostActions,
        lifecycle,
      },
      narrative: {
        headline: 'Replay learning: Replay, artifacts e learning loop',
        operatorSummary: buildReplayLearningOperatorSummary(summary),
        nextAction: actions[0]?.label || 'review replay, artifacts e learning periodicamente.',
      },
    };
  }

  public async renderReport(input: {
    sessionId?: string | null;
    userId?: string | null;
    platform?: string | null;
    chatId?: string | null;
    workspace?: string | null;
    limit?: number | null;
  } = {}): Promise<string> {
    const snapshot = await this.buildSnapshot(input);
    const lines = [
      'Replay learning: Replay, artifacts e learning loop',
      '',
      snapshot.narrative.operatorSummary,
      `Postura: ${snapshot.summary.posture}.`,
      `Replay: ${snapshot.summary.timelineEvents} evento(s), compare ${snapshot.summary.compareReady ? 'ready' : 'not ready'}, resume ${snapshot.summary.resumeReady ? 'ready' : 'no target'}.`,
      `Artifacts: ${snapshot.summary.recentArtifacts} recente(s), ${snapshot.summary.reusableArtifacts} reutilizavel(is).`,
      `Lifecycle: ${snapshot.summary.lifecycleEvents} evento(s), ${snapshot.summary.lifecycleRuns} run(s), ${snapshot.summary.lifecycleAttention} sinal(is) de attention.`,
      `Learning: ${snapshot.summary.learningCandidates} candidate(s), ${snapshot.summary.pendingLearning} pending(s), ${snapshot.summary.promotedLearning} promovido(s).`,
      `Memory: ${snapshot.summary.memoryEntries} entry(s), ${snapshot.summary.proceduralEntries} procedure(s), pressure ${snapshot.summary.memoryPressure}.`,
      '',
      'Cards operacionais:',
      ...snapshot.cards.map((entry) =>
        `- ${entry.label}: ${entry.posture} | ${entry.summary}${entry.command ? ` | ${entry.command}` : ''}`),
    ];
    if (snapshot.actions.length > 0) {
      lines.push(
        '',
        'Actions sugeridas:',
        ...snapshot.actions.slice(0, 8).map((entry) =>
          `- ${entry.label}: ${entry.reason}${entry.command ? ` | ${entry.command}` : ''}`),
      );
    }
    if (snapshot.artifacts.length > 0) {
      lines.push(
        '',
        'Artifacts reutilizaveis:',
        ...snapshot.artifacts.slice(0, 5).map((entry) =>
          `- ${entry.label} [${entry.kind}] - ${entry.summary}`),
      );
    }
    return lines.join('\n');
  }
}
