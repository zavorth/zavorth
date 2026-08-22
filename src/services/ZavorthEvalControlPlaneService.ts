import type {
  ProductObservabilitySnapshot,
  ProductObservabilityService,
} from './ProductObservabilityService.js';
import type { ZavorthEvalHistorySnapshot } from './ZavorthEvalHistoryFileService.js';
import type { ZavorthTelemetryLedgerSnapshot } from './ZavorthTelemetryLedgerService.js';
import type { ZavorthReadinessGate } from '../contracts/ZavorthMutationPlaneContract.js';
import { logger } from '../logger.js';
import {
buildEvalComparisons,
  buildEvalCoverage,
  buildEvalDatasets,
  buildEvalFallbackHistory,
  buildEvalNarrative,
  buildEvalRegressions,
  buildEvalRegressionGate,
  buildEvalScorecards,
  buildEvalSelfmodBinding,
  captureEvalHistorySnapshot,
  countEvalTelemetrySignals,
  readEvalTelemetrySnapshot,
  resolveEvalOperatorCostState,
  resolveEvalPosture,
} from './eval-control-plane/ZavorthEvalControlPlaneKit.js';

type ProductObservabilityLike = Pick<ProductObservabilityService, 'buildSnapshot'>;
type TelemetryLedgerLike = {
  buildSnapshot: (input?: Date | Partial<{ referenceDate: Date; windowHours: number }>) => ZavorthTelemetryLedgerSnapshot;
};
type EvalHistoryLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  capture: (snapshot: any) => ZavorthEvalHistorySnapshot;
  readHistory?: (limit?: number) => ZavorthEvalHistorySnapshot;
};

type OperatorBriefLike = {
  readSnapshot?: () => unknown;
};

type OperationsHealthLike = {
  readLastReport?: () => unknown;
  readSnapshot?: () => unknown;
};

type ZavorthEvalScope = ProductObservabilitySnapshot['scope'];

export type ZavorthEvalControlPlaneInput =
  | Date
  | Partial<{
      referenceDate: Date;
      workspace: string | null;
      sourceSurface: string | null;
      executor: string | null;
      workflow: string | null;
    }>;

export type ZavorthEvalScorecardStatus =
  | 'healthy'
  | 'attention'
  | 'critical'
  | 'insufficient_data';

export type ZavorthEvalRegressionSeverity = 'medium' | 'high' | 'critical';

export type ZavorthEvalScorecard = {
  id: string;
  label: string;
  category: string;
  status: ZavorthEvalScorecardStatus;
  executor: string | null;
  sourceSurface: string | null;
  workflow: string | null;
  total: number;
  completed: number;
  failed: number;
  waitingApproval: number;
  successRate: number;
  frictionRate: number;
  operatorCostScore: number;
  lastSeenAt: string;
  recommendation: string;
  evidence: string[];
};

export type ZavorthEvalDataset = {
  id: string;
  label: string;
  kind: 'route-cluster' | 'resume-pressure' | 'artifacts' | 'surface-traffic';
  sampleCount: number;
  description: string;
  examples: string[];
  manifest: ZavorthEvalDatasetManifest;
};

export type ZavorthEvalDatasetManifest = {
  version: 1;
  manifestHash: string;
  generatedAt: string;
  windowHours: number;
  scopeHash: string;
  reproducible: boolean;
  baselineRef: string;
  selectors: string[];
  retention: {
    ttlMs: number;
    maxSamples: number;
    compacted: boolean;
  };
  redaction: {
    mode: 'references-only';
    payloadsIncluded: false;
    secretsIncluded: false;
    notes: string[];
  };
};

export type ZavorthEvalComparisonEntry = {
  label: string;
  total: number;
  successRate: number | null;
  frictionRate: number | null;
  note: string | null;
};

export type ZavorthEvalRegression = {
  id: string;
  label: string;
  severity: ZavorthEvalRegressionSeverity;
  evidence: string;
  recommendedAction: string;
};

export type ZavorthEvalSelfmodBinding = {
  status: 'ready' | 'attention' | 'blocked';
  policy: string;
  evaluatedChangeSignals: number;
  missingEvalEvidence: number;
  relatedDatasets: string[];
  requiredBeforeApply: string[];
  recommendation: string;
};

export type ZavorthEvalControlPlaneSnapshot = {
  generatedAt: string;
  windowHours: number;
  scope: ZavorthEvalScope;
  summary: {
    posture: 'healthy' | 'attention' | 'critical';
    scorecards: number;
    healthyScorecards: number;
    attentionScorecards: number;
    criticalScorecards: number;
    datasets: number;
    regressions: number;
    telemetrySignals: number;
    operatorCostState: 'low' | 'moderate' | 'high';
  };
  narrative: {
    headline: string;
    operatorSummary: string;
  };
  scorecards: ZavorthEvalScorecard[];
  datasets: ZavorthEvalDataset[];
  regressions: ZavorthEvalRegression[];
  regressionGate: ZavorthReadinessGate & {
    criticalRegressions: number;
    rolloutBlocked: boolean;
    rolloutScopes: {
      local: boolean;
      beta: boolean;
      production: boolean;
    };
    requiredActions: string[];
  };
  comparisons: {
    executors: ZavorthEvalComparisonEntry[];
    surfaces: ZavorthEvalComparisonEntry[];
    workflows: ZavorthEvalComparisonEntry[];
  };
  coverage: {
    taskSignal: string;
    workflowSignal: string;
    approvalSignal: string;
    artifactSignal: string;
    notes: string[];
  };
  telemetry: {
    status: 'active' | 'idle' | 'missing';
    totalEvents: number;
    traceCount: number;
    failureEvents: number;
    blockedEvents: number;
    lastEventAt: string | null;
    topSources: ZavorthTelemetryLedgerSnapshot['topSources'];
    topEventTypes: ZavorthTelemetryLedgerSnapshot['topEventTypes'];
    traces: ZavorthTelemetryLedgerSnapshot['traces'];
    sinks: ZavorthTelemetryLedgerSnapshot['sinks'];
    retention: ZavorthTelemetryLedgerSnapshot['retention'];
    redaction: ZavorthTelemetryLedgerSnapshot['redaction'];
    recommendation: string | null;
  };
  selfmod: ZavorthEvalSelfmodBinding;
  history: ZavorthEvalHistorySnapshot;
  insights: string[];
};

type ZavorthEvalRuntime = {
  now?: () => Date;
  maxScorecards?: number;
  maxDatasets?: number;
  maxRegressions?: number;
};

export class ZavorthEvalControlPlaneService {
  private readonly now: () => Date;
  private readonly maxScorecards: number;
  private readonly maxDatasets: number;
  private readonly maxRegressions: number;

  constructor(
    private readonly deps: {
      productObservabilityService: ProductObservabilityLike;
      operatorBriefService?: OperatorBriefLike | null;
      operationsHealthService?: OperationsHealthLike | null;
      telemetryLedgerService?: TelemetryLedgerLike | null;
      evalHistoryService?: EvalHistoryLike | null;
    },
    runtime: ZavorthEvalRuntime = {},
  ) {
    this.now = runtime.now || (() => new Date());
    this.maxScorecards = Math.max(4, Math.min(runtime.maxScorecards || 8, 12));
    this.maxDatasets = Math.max(3, Math.min(runtime.maxDatasets || 6, 10));
    this.maxRegressions = Math.max(3, Math.min(runtime.maxRegressions || 6, 10));
  }

  public async buildSnapshot(
    input: ZavorthEvalControlPlaneInput = {},
  ): Promise<ZavorthEvalControlPlaneSnapshot> {
    const normalizedInput = input instanceof Date ? { referenceDate: input } : (input || {});
    const generatedAt = this.now();
    const observability = await this.deps.productObservabilityService.buildSnapshot(normalizedInput);
    const operatorBrief = this.readOperatorBrief();
    const operationsHealth = this.readOperationsHealth();
    const scorecards = buildEvalScorecards(observability, this.maxScorecards);
    const datasets = buildEvalDatasets(observability, scorecards, this.maxDatasets);
    const regressions = buildEvalRegressions(observability, scorecards, operationsHealth, this.maxRegressions);
    const regressionGate = buildEvalRegressionGate(regressions, generatedAt);
    const selfmod = buildEvalSelfmodBinding(scorecards, datasets, regressions);
    const comparisons = buildEvalComparisons(observability);
    const telemetry = readEvalTelemetrySnapshot(
      this.deps.telemetryLedgerService,
      normalizedInput.referenceDate || generatedAt,
      observability.windowHours,
    );
    const summary = {
      posture: resolveEvalPosture(scorecards, regressions),
      scorecards: scorecards.length,
      healthyScorecards: scorecards.filter((entry) => entry.status === 'healthy').length,
      attentionScorecards: scorecards.filter((entry) => entry.status === 'attention').length,
      criticalScorecards: scorecards.filter((entry) => entry.status === 'critical').length,
      datasets: datasets.length,
      regressions: regressions.length,
      telemetrySignals: countEvalTelemetrySignals(observability),
      operatorCostState: resolveEvalOperatorCostState(observability),
    } as const;
    const narrative = buildEvalNarrative({
      scorecards,
      regressions,
      operatorBrief,
      summary,
    });
    const baseSnapshot = {
      generatedAt: generatedAt.toISOString(),
      windowHours: observability.windowHours,
      scope: observability.scope,
      summary,
      narrative,
      scorecards,
      datasets,
      regressions,
      regressionGate,
      comparisons,
      coverage: buildEvalCoverage(observability),
      telemetry,
      selfmod,
      history: buildEvalFallbackHistory(summary.posture),
      insights: observability.insights.slice(0, 8),
    } satisfies ZavorthEvalControlPlaneSnapshot;
    const history = captureEvalHistorySnapshot(this.deps.evalHistoryService, baseSnapshot);

    return {
      ...baseSnapshot,
      history,
    };
  }

  private readOperatorBrief(): unknown {
    try {
      return typeof this.deps.operatorBriefService?.readSnapshot === 'function'
        ? this.deps.operatorBriefService.readSnapshot()
        : null;
    } catch (error: unknown) {logger.warn('[Zavorth Eval Control Plane] code compilation failed', error); return null; }
  }

  private readOperationsHealth(): unknown {
    try {
      if (typeof this.deps.operationsHealthService?.readLastReport === 'function') {
        return this.deps.operationsHealthService.readLastReport();
      }
      if (typeof this.deps.operationsHealthService?.readSnapshot === 'function') {
        return this.deps.operationsHealthService.readSnapshot();
      }
      return null;
    } catch (error: unknown) {logger.warn('[Zavorth Eval Control Plane] health check failed', error); return null; }
  }
}
