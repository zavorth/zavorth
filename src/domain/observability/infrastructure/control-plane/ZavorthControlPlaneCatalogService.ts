import { config } from '../../../../config/index.js';
import {
  buildControlPlaneSnapshot,
  buildOverviewCard,
  buildOverviewNarrative,
  collectOverviewActions,
  countOverviewPostures,
  renderControlPlaneReport,
  resolveOverviewPosture,
  text,
  type ControlPlaneOverviewAction,
  type ControlPlaneOverviewCard,
  type ControlPlaneOverviewNarrative,
  type ControlPlaneOverviewPosture,
  type ControlPlaneSnapshotMinimum,
} from './ControlPlaneOverviewKit.js';
import {
  ZavorthOperationalOverviewService,
  type ZavorthOperationalOverviewSnapshot,
} from '../../../../services/ZavorthOperationalOverviewService.js';
import {
  ZavorthProductOverviewService,
  type ZavorthProductOverviewSnapshot,
} from '../../../../services/ZavorthProductOverviewService.js';
import {
  ZavorthTrustOverviewService,
  type ZavorthTrustOverviewSnapshot,
} from '../../../../services/ZavorthTrustOverviewService.js';

type OverviewServiceLike<TSnapshot> = {
  buildSnapshot: (input?: any) => TSnapshot | Promise<TSnapshot>;
};

type ZavorthControlPlaneCatalogRuntime = {
  now?: () => Date;
  workspaceRoot?: string | null;
  operationalOverviewService?: OverviewServiceLike<ZavorthOperationalOverviewSnapshot> | null;
  trustOverviewService?: OverviewServiceLike<ZavorthTrustOverviewSnapshot> | null;
  productOverviewService?: OverviewServiceLike<ZavorthProductOverviewSnapshot> | null;
};

export type ZavorthControlPlaneCatalogInput = {
  selectedId?: string | null;
  query?: string | null;
  sessionId?: string | null;
  userId?: string | null;
  platform?: string | null;
  chatId?: string | null;
  workspace?: string | null;
  limit?: number | null;
  deepDoctor?: boolean;
  recommendFor?: string | null;
  profile?: string | null;
  rolloutScope?: string | null;
};

export type ZavorthControlPlaneFamilyId = 'operational' | 'trust' | 'product';

export type ZavorthControlPlaneFamily = ControlPlaneOverviewCard & {
  overviewId: ZavorthControlPlaneFamilyId;
  generatedAt: string;
  planeCount: number;
  sourceSnapshotKeys: string[];
};

export type ZavorthControlPlaneCatalogSummary = {
  posture: ControlPlaneOverviewPosture;
  families: number;
  healthyFamilies: number;
  attentionFamilies: number;
  criticalFamilies: number;
  operationalPosture: ControlPlaneOverviewPosture;
  trustPosture: ControlPlaneOverviewPosture;
  productPosture: ControlPlaneOverviewPosture;
  recommendedActions: number;
};

export type ZavorthControlPlaneCatalogSnapshot = ControlPlaneSnapshotMinimum<
  ZavorthControlPlaneCatalogSummary,
  {
    operational: ZavorthOperationalOverviewSnapshot;
    trust: ZavorthTrustOverviewSnapshot;
    product: ZavorthProductOverviewSnapshot;
  }
> & {
  workspaceRoot: string;
  scope: Required<Pick<ZavorthControlPlaneCatalogInput, 'workspace'>> & {
    selectedId: string | null;
    query: string | null;
    sessionId: string | null;
    userId: string | null;
    platform: string | null;
    chatId: string | null;
    limit: number;
    profile: string | null;
    rolloutScope: string | null;
  };
  families: ZavorthControlPlaneFamily[];
  cards: ZavorthControlPlaneFamily[];
  narrative: ControlPlaneOverviewNarrative;
  actions: ControlPlaneOverviewAction[];
};

export class ZavorthControlPlaneCatalogService {
  private readonly now: () => Date;
  private readonly workspaceRoot: string;
  private readonly operationalOverview: OverviewServiceLike<ZavorthOperationalOverviewSnapshot>;
  private readonly trustOverview: OverviewServiceLike<ZavorthTrustOverviewSnapshot>;
  private readonly productOverview: OverviewServiceLike<ZavorthProductOverviewSnapshot>;

  constructor(runtime: ZavorthControlPlaneCatalogRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.workspaceRoot = text(runtime.workspaceRoot, config.projectRoot || process.cwd());
    this.operationalOverview = runtime.operationalOverviewService || new ZavorthOperationalOverviewService({
      now: this.now,
      workspaceRoot: this.workspaceRoot,
    });
    this.trustOverview = runtime.trustOverviewService || new ZavorthTrustOverviewService({
      now: this.now,
      workspaceRoot: this.workspaceRoot,
    });
    this.productOverview = runtime.productOverviewService || new ZavorthProductOverviewService({
      now: this.now,
      workspaceRoot: this.workspaceRoot,
    });
  }

  public async buildSnapshot(
    input: ZavorthControlPlaneCatalogInput = {},
  ): Promise<ZavorthControlPlaneCatalogSnapshot> {
    const workspace = text(input.workspace, this.workspaceRoot);
    const limit = this.normalizeLimit(input.limit);
    const [operational, trust, product] = await Promise.all([
      Promise.resolve(this.operationalOverview.buildSnapshot({
        selectedId: input.selectedId || null,
        query: input.query || null,
        sessionId: input.sessionId || null,
        userId: input.userId || null,
        platform: input.platform || null,
        chatId: input.chatId || null,
        workspace,
        limit,
        deepDoctor: input.deepDoctor === true,
      })),
      Promise.resolve(this.trustOverview.buildSnapshot({ limit })),
      Promise.resolve(this.productOverview.buildSnapshot({
        workspace,
        selectedId: input.selectedId || null,
        query: input.query || null,
        recommendFor: input.recommendFor || null,
        profile: input.profile || null,
        rolloutScope: input.rolloutScope || null,
      })),
    ]);
    const families = [
      this.buildFamily('operational', 'Operational Overview', operational),
      this.buildFamily('trust', 'Trust Overview', trust),
      this.buildFamily('product', 'Product Overview', product),
    ];
    const actions = collectOverviewActions([
      { source: 'operational-overview', actions: operational.actions },
      { source: 'trust-overview', actions: trust.actions },
      { source: 'product-overview', actions: product.actions },
    ], limit);
    const counts = countOverviewPostures(families);
    const summary: ZavorthControlPlaneCatalogSummary = {
      posture: resolveOverviewPosture(families.map((entry) => entry.posture)),
      families: families.length,
      healthyFamilies: counts.healthy,
      attentionFamilies: counts.attention,
      criticalFamilies: counts.critical,
      operationalPosture: operational.summary.posture,
      trustPosture: trust.summary.posture,
      productPosture: product.summary.posture,
      recommendedActions: actions.length,
    };
    const narrative = buildOverviewNarrative({
      headline: 'Control Plane Catalog',
      operatorSummary:
        `${summary.healthyFamilies}/${summary.families} familia(s) healthy, `
        + `${summary.attentionFamilies} attention, ${summary.criticalFamilies} critical; `
        + `operational=${summary.operationalPosture}, trust=${summary.trustPosture}, product=${summary.productPosture}.`,
      actions,
      fallbackNextAction: 'Usar os overviews Operational, Trust e Product como fronteira canonica dos control planes.',
    });
    const snapshot = buildControlPlaneSnapshot({
      generatedAt: this.now().toISOString(),
      summary,
      narrative,
      actions,
      sourceSnapshots: {
        operational,
        trust,
        product,
      },
    });
    return {
      ...snapshot,
      workspaceRoot: workspace,
      scope: {
        workspace,
        selectedId: this.nullableText(input.selectedId),
        query: this.nullableText(input.query),
        sessionId: this.nullableText(input.sessionId),
        userId: this.nullableText(input.userId),
        platform: this.nullableText(input.platform),
        chatId: this.nullableText(input.chatId),
        limit,
        profile: this.nullableText(input.profile),
        rolloutScope: this.nullableText(input.rolloutScope),
      },
      families,
      cards: families,
    };
  }

  public async evaluatePosture(input: ZavorthControlPlaneCatalogInput = {}): Promise<{
    posture: ControlPlaneOverviewPosture;
    healthyFamilies: number;
    attentionFamilies: number;
    criticalFamilies: number;
  }> {
    const snapshot = await this.buildSnapshot(input);
    return {
      posture: snapshot.summary.posture,
      healthyFamilies: snapshot.summary.healthyFamilies,
      attentionFamilies: snapshot.summary.attentionFamilies,
      criticalFamilies: snapshot.summary.criticalFamilies,
    };
  }

  public async listActions(
    input: ZavorthControlPlaneCatalogInput = {},
  ): Promise<ControlPlaneOverviewAction[]> {
    const snapshot = await this.buildSnapshot(input);
    return snapshot.actions;
  }

  public async renderReport(input: ZavorthControlPlaneCatalogInput = {}): Promise<string> {
    const snapshot = await this.buildSnapshot(input);
    return renderControlPlaneReport({
      title: 'Control Plane Catalog',
      narrative: snapshot.narrative,
      posture: snapshot.summary.posture,
      summaryLines: [
        `Families: healthy ${snapshot.summary.healthyFamilies} | attention ${snapshot.summary.attentionFamilies} | critical ${snapshot.summary.criticalFamilies}.`,
        `Overviews: operational ${snapshot.summary.operationalPosture} | trust ${snapshot.summary.trustPosture} | product ${snapshot.summary.productPosture}.`,
        `Acoes recomendadas: ${snapshot.summary.recommendedActions}.`,
      ],
      actions: snapshot.actions,
    });
  }

  private buildFamily(
    overviewId: ZavorthControlPlaneFamilyId,
    label: string,
    snapshot: ZavorthOperationalOverviewSnapshot | ZavorthTrustOverviewSnapshot | ZavorthProductOverviewSnapshot,
  ): ZavorthControlPlaneFamily {
    const sourceSnapshotKeys = Object.keys(snapshot.sourceSnapshots || {});
    return {
      ...buildOverviewCard({
        id: `${overviewId}-overview`,
        label,
        posture: snapshot.summary.posture,
        summary: snapshot.narrative.operatorSummary,
        nextAction: snapshot.narrative.nextAction,
        command: snapshot.actions[0]?.command,
        source: `${overviewId}-overview`,
      }),
      overviewId,
      generatedAt: text(snapshot.generatedAt, 'unknown'),
      planeCount: Array.isArray(snapshot.cards) ? snapshot.cards.length : sourceSnapshotKeys.length,
      sourceSnapshotKeys,
    };
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
