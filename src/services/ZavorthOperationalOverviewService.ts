import { config } from '../config/index.js';
import { ZavorthDistributedRuntimeControlPlaneService } from './ZavorthDistributedRuntimeControlPlaneService.js';
import { ZavorthRuntimeStabilityControlPlaneService } from './ZavorthRuntimeStabilityControlPlaneService.js';
import { ZavorthReplayLearningControlPlaneService } from './ZavorthReplayLearningControlPlaneService.js';
import {
  buildOverviewCard,
  buildOverviewNarrative,
  collectOverviewActions,
  countOverviewPostures,
  resolveOverviewPosture,
  text,
  type ControlPlaneOverviewAction,
  type ControlPlaneOverviewCard,
  type ControlPlaneOverviewNarrative,
  type ControlPlaneOverviewPosture,
} from '../domain/observability/application/control-plane/ControlPlaneOverviewKit.js';

type DistributedRuntimeLike = Pick<ZavorthDistributedRuntimeControlPlaneService, 'buildSnapshot'>;
type RuntimeStabilityLike = Pick<ZavorthRuntimeStabilityControlPlaneService, 'buildSnapshot'>;
type ReplayLearningLike = Pick<ZavorthReplayLearningControlPlaneService, 'buildSnapshot'>;

type OperationalOverviewRuntime = {
  now?: () => Date;
  workspaceRoot?: string | null;
  distributedRuntimeControlPlaneService?: DistributedRuntimeLike | null;
  runtimeStabilityControlPlaneService?: RuntimeStabilityLike | null;
  replayLearningControlPlaneService?: ReplayLearningLike | null;
};

export type ZavorthOperationalOverviewSnapshot = {
  generatedAt: string;
  workspaceRoot: string;
  scope: {
    selectedId: string | null;
    query: string | null;
    sessionId: string | null;
    userId: string | null;
    platform: string | null;
    chatId: string | null;
    workspace: string;
    limit: number;
  };
  summary: {
    posture: ControlPlaneOverviewPosture;
    healthyPlanes: number;
    attentionPlanes: number;
    criticalPlanes: number;
    readyChannels: number;
    onlineNodes: number;
    readyTransports: number;
    keepaliveActive: boolean;
    recoverableIssues: number;
    lifecycleEvents: number;
    lifecycleAttention: number;
    reusableArtifacts: number;
    pendingLearning: number;
    recommendedActions: number;
  };
  cards: ControlPlaneOverviewCard[];
  actions: ControlPlaneOverviewAction[];
  sourceSnapshots: {
    distributedRuntime: any;
    runtimeStability: any;
    replayLearning: any;
  };
  narrative: ControlPlaneOverviewNarrative;
};

export class ZavorthOperationalOverviewService {
  private readonly now: () => Date;
  private readonly workspaceRoot: string;
  private readonly distributedRuntime: DistributedRuntimeLike;
  private readonly runtimeStability: RuntimeStabilityLike;
  private readonly replayLearning: ReplayLearningLike;

  constructor(runtime: OperationalOverviewRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.workspaceRoot = text(runtime.workspaceRoot, config.projectRoot || process.cwd());
    this.distributedRuntime =
      runtime.distributedRuntimeControlPlaneService
      || new ZavorthDistributedRuntimeControlPlaneService();
    this.runtimeStability =
      runtime.runtimeStabilityControlPlaneService
      || new ZavorthRuntimeStabilityControlPlaneService();
    this.replayLearning =
      runtime.replayLearningControlPlaneService
      || new ZavorthReplayLearningControlPlaneService();
  }

  public async buildSnapshot(input: {
    selectedId?: string | null;
    query?: string | null;
    sessionId?: string | null;
    userId?: string | null;
    platform?: string | null;
    chatId?: string | null;
    workspace?: string | null;
    limit?: number | null;
    deepDoctor?: boolean;
  } = {}): Promise<ZavorthOperationalOverviewSnapshot> {
    const limit = this.normalizeLimit(input.limit);
    const workspace = text(input.workspace, this.workspaceRoot);
    const [distributedRuntime, runtimeStability, replayLearning] = await Promise.all([
      Promise.resolve(this.distributedRuntime.buildSnapshot({
        selectedId: input.selectedId || null,
        query: input.query || null,
      })),
      Promise.resolve(this.runtimeStability.buildSnapshot({
        deepDoctor: input.deepDoctor === true,
      })),
      Promise.resolve(this.replayLearning.buildSnapshot({
        sessionId: input.sessionId || null,
        userId: input.userId || null,
        platform: input.platform || null,
        chatId: input.chatId || null,
        workspace,
        limit,
      })),
    ]);
    const cards = this.buildCards({ distributedRuntime, runtimeStability, replayLearning });
    const actions = collectOverviewActions([
      { source: 'distributed-runtime', actions: distributedRuntime?.actions },
      { source: 'runtime-stability', actions: runtimeStability?.actions },
      { source: 'replay-learning', actions: replayLearning?.actions },
    ], limit);
    const counts = countOverviewPostures(cards);
    const posture = resolveOverviewPosture(cards.map((entry) => entry.posture));
    const summary = {
      posture,
      healthyPlanes: counts.healthy,
      attentionPlanes: counts.attention,
      criticalPlanes: counts.critical,
      readyChannels: Number(distributedRuntime?.summary?.readyChannels || 0) || 0,
      onlineNodes: Number(distributedRuntime?.summary?.onlineNodes || runtimeStability?.summary?.onlineNodes || 0) || 0,
      readyTransports:
        Number(distributedRuntime?.summary?.readyTransports || runtimeStability?.summary?.readyTransports || 0) || 0,
      keepaliveActive: runtimeStability?.summary?.keepaliveActive === true,
      recoverableIssues: Number(runtimeStability?.summary?.recoverableIssues || 0) || 0,
      lifecycleEvents: Number(replayLearning?.summary?.lifecycleEvents || 0) || 0,
      lifecycleAttention: Number(replayLearning?.summary?.lifecycleAttention || 0) || 0,
      reusableArtifacts: Number(replayLearning?.summary?.reusableArtifacts || 0) || 0,
      pendingLearning: Number(replayLearning?.summary?.pendingLearning || 0) || 0,
      recommendedActions: actions.length,
    };
    const narrative = buildOverviewNarrative({
      headline: 'Operational Overview',
      operatorSummary:
        `${summary.readyChannels} canal(is) pronto(s), ${summary.onlineNodes} node(s) online, `
        + `${summary.readyTransports} transport(s) prontos, ${summary.lifecycleEvents} evento(s) de lifecycle `
        + `e ${summary.lifecycleAttention} sinal(is) pedindo atencao no replay/learning.`,
      actions,
      fallbackNextAction: 'Revisar runtime distribuido, estabilidade e replay operacional.',
    });

    return {
      generatedAt: this.now().toISOString(),
      workspaceRoot: workspace,
      scope: {
        selectedId: this.nullableText(input.selectedId),
        query: this.nullableText(input.query),
        sessionId: this.nullableText(input.sessionId),
        userId: this.nullableText(input.userId),
        platform: this.nullableText(input.platform),
        chatId: this.nullableText(input.chatId),
        workspace,
        limit,
      },
      summary,
      cards,
      actions,
      sourceSnapshots: {
        distributedRuntime,
        runtimeStability,
        replayLearning,
      },
      narrative,
    };
  }

  public async evaluatePosture(input: Parameters<ZavorthOperationalOverviewService['buildSnapshot']>[0] = {}): Promise<{
    posture: ControlPlaneOverviewPosture;
    healthyPlanes: number;
    attentionPlanes: number;
    criticalPlanes: number;
  }> {
    const snapshot = await this.buildSnapshot(input);
    return {
      posture: snapshot.summary.posture,
      healthyPlanes: snapshot.summary.healthyPlanes,
      attentionPlanes: snapshot.summary.attentionPlanes,
      criticalPlanes: snapshot.summary.criticalPlanes,
    };
  }

  public async listActions(
    input: Parameters<ZavorthOperationalOverviewService['buildSnapshot']>[0] = {},
  ): Promise<ControlPlaneOverviewAction[]> {
    const snapshot = await this.buildSnapshot(input);
    return snapshot.actions;
  }

  public async renderReport(
    input: Parameters<ZavorthOperationalOverviewService['buildSnapshot']>[0] = {},
  ): Promise<string> {
    const snapshot = await this.buildSnapshot(input);
    const lines = [
      snapshot.narrative.headline,
      '',
      snapshot.narrative.operatorSummary,
      `Postura: ${snapshot.summary.posture}.`,
      `Planes: healthy ${snapshot.summary.healthyPlanes} | attention ${snapshot.summary.attentionPlanes} | critical ${snapshot.summary.criticalPlanes}.`,
      `Runtime: canais prontos ${snapshot.summary.readyChannels} | nodes online ${snapshot.summary.onlineNodes} | transports prontos ${snapshot.summary.readyTransports}.`,
      `Stability: keepalive ${snapshot.summary.keepaliveActive ? 'ativo' : 'ausente'} | recoverable issues ${snapshot.summary.recoverableIssues}.`,
      `Replay/Learning: lifecycle ${snapshot.summary.lifecycleEvents} | attention ${snapshot.summary.lifecycleAttention} | artifacts reutilizaveis ${snapshot.summary.reusableArtifacts} | pending learning ${snapshot.summary.pendingLearning}.`,
    ];
    if (snapshot.actions.length > 0) {
      lines.push(
        '',
        'Acoes sugeridas:',
        ...snapshot.actions.map((entry) =>
          `- [${entry.source}] ${entry.label}: ${entry.reason}${entry.command ? ` | ${entry.command}` : ''}`),
      );
    }
    return lines.join('\n');
  }

  private buildCards(input: {
    distributedRuntime: any;
    runtimeStability: any;
    replayLearning: any;
  }): ControlPlaneOverviewCard[] {
    return [
      buildOverviewCard({
        id: 'distributed-runtime',
        label: 'Distributed Runtime',
        posture: input.distributedRuntime?.summary?.posture,
        summary:
          `${Number(input.distributedRuntime?.summary?.readyChannels || 0) || 0} canal(is) prontos | `
          + `${Number(input.distributedRuntime?.summary?.onlineNodes || 0) || 0} node(s) online | `
          + `${Number(input.distributedRuntime?.summary?.readyTransports || 0) || 0} transport(s) prontos.`,
        nextAction: input.distributedRuntime?.narrative?.nextAction,
        command: input.distributedRuntime?.actions?.[0]?.command,
        source: 'distributed-runtime',
      }),
      buildOverviewCard({
        id: 'runtime-stability',
        label: 'Runtime Stability',
        posture: input.runtimeStability?.summary?.posture,
        summary:
          `Gate ${text(input.runtimeStability?.gate?.status, 'attention')} | `
          + `keepalive ${input.runtimeStability?.summary?.keepaliveActive ? 'ativo' : 'ausente'} | `
          + `${Number(input.runtimeStability?.summary?.recoverableIssues || 0) || 0} issue(s) recuperavel(is).`,
        nextAction: input.runtimeStability?.narrative?.nextAction,
        command: input.runtimeStability?.actions?.[0]?.command,
        source: 'runtime-stability',
      }),
      buildOverviewCard({
        id: 'replay-learning',
        label: 'Replay And Learning',
        posture: input.replayLearning?.summary?.posture,
        summary:
          `${Number(input.replayLearning?.summary?.lifecycleEvents || 0) || 0} evento(s) de lifecycle | `
          + `${Number(input.replayLearning?.summary?.reusableArtifacts || 0) || 0} artifact(s) reutilizavel(is) | `
          + `${Number(input.replayLearning?.summary?.pendingLearning || 0) || 0} learning candidate(s) pendente(s).`,
        nextAction: input.replayLearning?.narrative?.nextAction,
        command: input.replayLearning?.actions?.[0]?.command,
        source: 'replay-learning',
      }),
    ];
  }

  private normalizeLimit(value: number | null | undefined): number {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 8;
    }
    return Math.max(3, Math.min(16, Math.floor(numeric)));
  }

  private nullableText(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }
}
