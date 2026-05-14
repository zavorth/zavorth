import { config } from '../config/index.js';
import { ZavorthHubControlPlaneService } from './ZavorthHubControlPlaneService.js';
import { ZavorthEcosystemControlPlaneService } from './ZavorthEcosystemControlPlaneService.js';
import { ZavorthEvalControlPlaneService } from './ZavorthEvalControlPlaneService.js';
import { ZavorthRolloutReadinessControlPlaneService } from './ZavorthRolloutReadinessControlPlaneService.js';
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

type HubLike = Pick<ZavorthHubControlPlaneService, 'buildSnapshot'>;
type EcosystemLike = Pick<ZavorthEcosystemControlPlaneService, 'buildSnapshot'>;
type EvalLike = Pick<ZavorthEvalControlPlaneService, 'buildSnapshot'>;
type RolloutLike = Pick<ZavorthRolloutReadinessControlPlaneService, 'buildSnapshot'>;

type ProductOverviewRuntime = {
  now?: () => Date;
  workspaceRoot?: string | null;
  hubControlPlaneService?: HubLike | null;
  ecosystemControlPlaneService?: EcosystemLike | null;
  evalControlPlaneService?: EvalLike | null;
  rolloutReadinessControlPlaneService?: RolloutLike | null;
};

export type ZavorthProductOverviewSnapshot = {
  generatedAt: string;
  workspaceRoot: string;
  scope: {
    workspace: string;
    selectedId: string | null;
    query: string | null;
    recommendFor: string | null;
    profile: string | null;
    rolloutScope: string | null;
  };
  summary: {
    posture: ControlPlaneOverviewPosture;
    healthyPlanes: number;
    attentionPlanes: number;
    criticalPlanes: number;
    integrations: number;
    platformEntries: number;
    sdkFilesReady: number;
    sdkFilesExpected: number;
    scorecards: number;
    regressions: number;
    releaseReady: boolean;
    rolloutGateStatus: string;
    recommendedActions: number;
  };
  cards: ControlPlaneOverviewCard[];
  actions: ControlPlaneOverviewAction[];
  sourceSnapshots: {
    hub: any;
    ecosystem: any;
    evals: any;
    rollout: any;
  };
  narrative: ControlPlaneOverviewNarrative;
};

export class ZavorthProductOverviewService {
  private readonly now: () => Date;
  private readonly workspaceRoot: string;
  private readonly hub: HubLike;
  private readonly ecosystem: EcosystemLike;
  private readonly evals: EvalLike;
  private readonly rollout: RolloutLike;

  constructor(runtime: ProductOverviewRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.workspaceRoot = text(runtime.workspaceRoot, config.projectRoot || process.cwd());
    this.hub = runtime.hubControlPlaneService || new ZavorthHubControlPlaneService();
    this.ecosystem = runtime.ecosystemControlPlaneService || new ZavorthEcosystemControlPlaneService();
    this.evals = runtime.evalControlPlaneService || this.buildFallbackEvalControlPlane();
    this.rollout = runtime.rolloutReadinessControlPlaneService || new ZavorthRolloutReadinessControlPlaneService();
  }

  public async buildSnapshot(input: {
    workspace?: string | null;
    selectedId?: string | null;
    query?: string | null;
    recommendFor?: string | null;
    profile?: string | null;
    rolloutScope?: string | null;
  } = {}): Promise<ZavorthProductOverviewSnapshot> {
    const workspace = text(input.workspace, this.workspaceRoot);
    const [hub, ecosystem, evals, rollout] = await Promise.all([
      Promise.resolve(this.hub.buildSnapshot({
        selectedId: input.selectedId || null,
        query: input.query || null,
        recommendFor: input.recommendFor || null,
      })),
      Promise.resolve(this.ecosystem.buildSnapshot({
        selectedId: input.selectedId || null,
        query: input.query || null,
      })),
      Promise.resolve(this.evals.buildSnapshot({
        workspace,
        sourceSurface: 'product-overview',
      })),
      Promise.resolve(this.rollout.buildSnapshot({
        profile: input.profile || null,
        scope: input.rolloutScope || null,
      })),
    ]);
    const cards = this.buildCards({ hub, ecosystem, evals, rollout });
    const evalActions = Array.isArray(evals?.regressions)
      ? evals.regressions.slice(0, 3).map((entry: any) => ({
        id: `eval:${entry.id}`,
        label: `Corrigir ${entry.label}`,
        severity: entry?.severity,
        reason: entry?.recommendedAction || entry?.evidence || 'Regressao precisa de atencao.',
        command: null,
      }))
      : [];
    const actions = collectOverviewActions([
      { source: 'hub', actions: hub?.actions },
      { source: 'ecosystem', actions: ecosystem?.actions },
      { source: 'rollout', actions: rollout?.actions },
      { source: 'evals', actions: evalActions },
    ], 10);
    const counts = countOverviewPostures(cards);
    const posture = resolveOverviewPosture(cards.map((entry) => entry.posture));
    const summary = {
      posture,
      healthyPlanes: counts.healthy,
      attentionPlanes: counts.attention,
      criticalPlanes: counts.critical,
      integrations: Number(hub?.summary?.integrations || 0) || 0,
      platformEntries: Number(hub?.summary?.platformEntries || ecosystem?.summary?.registryEntries || 0) || 0,
      sdkFilesReady: Number(ecosystem?.summary?.sdkFilesReady || 0) || 0,
      sdkFilesExpected: Number(ecosystem?.summary?.sdkFilesExpected || 0) || 0,
      scorecards: Number(evals?.summary?.scorecards || 0) || 0,
      regressions: Number(evals?.summary?.regressions || 0) || 0,
      releaseReady: rollout?.summary?.releaseReady === true,
      rolloutGateStatus: text(rollout?.summary?.gateStatus, 'unknown'),
      recommendedActions: actions.length,
    };
    const narrative = buildOverviewNarrative({
      headline: 'Product Overview',
      operatorSummary:
        `${summary.integrations} integration(s), ${summary.platformEntries} entrada(s) de platform, `
        + `${summary.sdkFilesReady}/${summary.sdkFilesExpected} arquivo(s)-chave de SDK prontos, `
        + `${summary.scorecards} scorecard(s), ${summary.regressions} regressao(oes) e `
        + `gate de rollout ${summary.rolloutGateStatus}.`,
      actions,
      fallbackNextAction: 'Revisar hub, ecosystem, evals e rollout readiness.',
    });

    return {
      generatedAt: this.now().toISOString(),
      workspaceRoot: workspace,
      scope: {
        workspace,
        selectedId: this.nullableText(input.selectedId),
        query: this.nullableText(input.query),
        recommendFor: this.nullableText(input.recommendFor),
        profile: this.nullableText(input.profile),
        rolloutScope: this.nullableText(input.rolloutScope),
      },
      summary,
      cards,
      actions,
      sourceSnapshots: {
        hub,
        ecosystem,
        evals,
        rollout,
      },
      narrative,
    };
  }

  public async evaluatePosture(input: Parameters<ZavorthProductOverviewService['buildSnapshot']>[0] = {}): Promise<{
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
    input: Parameters<ZavorthProductOverviewService['buildSnapshot']>[0] = {},
  ): Promise<ControlPlaneOverviewAction[]> {
    const snapshot = await this.buildSnapshot(input);
    return snapshot.actions;
  }

  public async renderReport(
    input: Parameters<ZavorthProductOverviewService['buildSnapshot']>[0] = {},
  ): Promise<string> {
    const snapshot = await this.buildSnapshot(input);
    const lines = [
      snapshot.narrative.headline,
      '',
      snapshot.narrative.operatorSummary,
      `Postura: ${snapshot.summary.posture}.`,
      `Planes: healthy ${snapshot.summary.healthyPlanes} | attention ${snapshot.summary.attentionPlanes} | critical ${snapshot.summary.criticalPlanes}.`,
      `Hub: integrations ${snapshot.summary.integrations} | platform entries ${snapshot.summary.platformEntries}.`,
      `Ecosystem: SDK ${snapshot.summary.sdkFilesReady}/${snapshot.summary.sdkFilesExpected}.`,
      `Evals: scorecards ${snapshot.summary.scorecards} | regressions ${snapshot.summary.regressions}.`,
      `Rollout: releaseReady=${snapshot.summary.releaseReady ? 'yes' : 'no'} | gate ${snapshot.summary.rolloutGateStatus}.`,
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
    hub: any;
    ecosystem: any;
    evals: any;
    rollout: any;
  }): ControlPlaneOverviewCard[] {
    return [
      buildOverviewCard({
        id: 'hub',
        label: 'Hub Plane',
        posture: input.hub?.summary?.posture,
        summary:
          `${Number(input.hub?.summary?.integrations || 0) || 0} integration(s) | `
          + `${Number(input.hub?.summary?.platformEntries || 0) || 0} entrada(s) | `
          + `${Number(input.hub?.summary?.recommendedActions || 0) || 0} acao(oes) recomendada(s).`,
        nextAction: input.hub?.narrative?.nextAction,
        command: input.hub?.actions?.[0]?.command,
        source: 'hub',
      }),
      buildOverviewCard({
        id: 'ecosystem',
        label: 'Ecosystem Plane',
        posture: input.ecosystem?.summary?.posture,
        summary:
          `${Number(input.ecosystem?.summary?.registryEntries || 0) || 0} registro(s) | `
          + `${Number(input.ecosystem?.summary?.sdkFilesReady || 0) || 0}/${Number(input.ecosystem?.summary?.sdkFilesExpected || 0) || 0} arquivo(s)-chave de SDK | `
          + `${Number(input.ecosystem?.summary?.publishArtifacts || 0) || 0} artifact(s) de publish.`,
        nextAction: input.ecosystem?.narrative?.nextAction,
        command: input.ecosystem?.actions?.[0]?.command,
        source: 'ecosystem',
      }),
      buildOverviewCard({
        id: 'evals',
        label: 'Eval Plane',
        posture: input.evals?.summary?.posture,
        summary:
          `${Number(input.evals?.summary?.scorecards || 0) || 0} scorecard(s) | `
          + `${Number(input.evals?.summary?.regressions || 0) || 0} regressao(oes) | `
          + `operator cost ${text(input.evals?.summary?.operatorCostState, 'low')}.`,
        nextAction: input.evals?.regressions?.[0]?.recommendedAction || 'Revisar scorecards e datasets do produto.',
        command: null,
        source: 'evals',
      }),
      buildOverviewCard({
        id: 'rollout',
        label: 'Rollout Readiness',
        posture: input.rollout?.summary?.posture,
        summary:
          `release ${input.rollout?.summary?.releaseReady ? 'ready' : 'pending'} | `
          + `gate ${text(input.rollout?.summary?.gateStatus, 'unknown')} | `
          + `${Number(input.rollout?.summary?.publishEntries || 0) || 0} publish entrie(s).`,
        nextAction: input.rollout?.narrative?.nextAction,
        command: input.rollout?.actions?.[0]?.command,
        source: 'rollout',
      }),
    ];
  }

  private buildFallbackEvalControlPlane(): EvalLike {
    return {
      buildSnapshot: async () => ({
        generatedAt: this.now().toISOString(),
        windowHours: 24,
        scope: {
          workspace: this.workspaceRoot,
          sourceSurface: 'product-overview-fallback',
          executor: null,
          workflow: null,
        },
        summary: {
          posture: 'attention',
          scorecards: 0,
          healthyScorecards: 0,
          attentionScorecards: 0,
          criticalScorecards: 0,
          datasets: 0,
          regressions: 0,
          telemetrySignals: 0,
          operatorCostState: 'moderate',
        },
        narrative: {
          headline: 'Eval Plane fallback',
          operatorSummary: 'Eval plane sem deps dedicadas neste contexto; mantendo product overview em modo fail-soft.',
        },
        scorecards: [],
        datasets: [],
        regressions: [],
        regressionGate: {
          status: 'warning',
          canProceed: true,
          blockingReasons: [],
          warnings: ['Eval plane em fallback dentro do product overview.'],
          criticalRegressions: 0,
        },
        comparisons: {
          executors: [],
          surfaces: [],
          workflows: [],
        },
        coverage: {
          taskSignal: 'missing',
          workflowSignal: 'missing',
          approvalSignal: 'missing',
          artifactSignal: 'missing',
          notes: ['Fallback local do ProductOverviewService.'],
        },
        telemetry: {
          status: 'missing',
          totalEvents: 0,
          traceCount: 0,
          failureEvents: 0,
          blockedEvents: 0,
          lastEventAt: null,
          topSources: [],
          topEventTypes: [],
          traces: [],
          sinks: [],
          recommendation: 'Injetar ZavorthEvalControlPlaneService completo no composition root de produto.',
        },
        history: {
          capturedAt: this.now().toISOString(),
          entries: [],
        },
        insights: [],
      } as any),
    };
  }

  private nullableText(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }
}
