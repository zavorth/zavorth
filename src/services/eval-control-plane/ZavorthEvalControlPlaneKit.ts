import crypto from 'crypto';
import type { ProductObservabilitySnapshot } from '../ProductObservabilityService.js';
import type { ZavorthEvalHistorySnapshot } from '../ZavorthEvalHistoryFileService.js';
import type { ZavorthTelemetryLedgerSnapshot } from '../ZavorthTelemetryLedgerService.js';
import { logger } from '../../logger.js';
import { tService } from '../../i18n/services.js';
import type {
ZavorthEvalControlPlaneSnapshot,
  ZavorthEvalDataset,
  ZavorthEvalRegression,
  ZavorthEvalRegressionSeverity,
  ZavorthEvalScorecard,
  ZavorthEvalScorecardStatus,
  ZavorthEvalSelfmodBinding,
} from '../ZavorthEvalControlPlaneService.js';

type RouteStat = ProductObservabilitySnapshot['learning']['routes']['topSuccessful'][number];

type EvaluationSummary = ZavorthEvalControlPlaneSnapshot['summary'];

type EvalTelemetryInput = {
  status: ZavorthTelemetryLedgerSnapshot['status'];
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

export function buildEvalScorecards(
  observability: ProductObservabilitySnapshot,
  maxScorecards: number,
): ZavorthEvalScorecard[] {
  const candidates = [
    ...observability.learning.routes.highestFriction,
    ...observability.learning.routes.highestOperatorCost,
    ...observability.learning.routes.topSuccessful,
  ];
  const deduped: RouteStat[] = [];
  const seen = new Set<string>();
  for (const route of candidates) {
    const key = routeKey(route);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(route);
    if (deduped.length >= maxScorecards) {
      break;
    }
  }

  const scorecards = deduped.map((route) => {
    const status = resolveScorecardStatus(route);
    return {
      id: routeKey(route),
      label: buildRouteLabel(route),
      category: classifyRoute(route),
      status,
      executor: normalizeText(route.executor),
      sourceSurface: normalizeText(route.source_surface),
      workflow: normalizeText(route.workflow),
      total: Number(route.total || 0),
      completed: Number(route.completed || 0),
      failed: Number(route.failed || 0),
      waitingApproval: Number(route.waitingApproval || 0) + Number(route.waitingPermission || 0),
      successRate: roundRate(route.success_rate),
      frictionRate: roundRate(route.friction_rate),
      operatorCostScore: Math.max(0, Math.round(Number(route.operator_cost_score || 0))),
      lastSeenAt: normalizeText(route.last_seen_at) || observability.generatedAt,
      recommendation: buildRouteRecommendation(route, status),
      evidence: buildRouteEvidence(route),
    };
  });
  return downgradeSupersededLegacyScorecards(scorecards);
}

export function buildEvalDatasets(
  observability: ProductObservabilitySnapshot,
  scorecards: ZavorthEvalScorecard[],
  maxDatasets: number,
): ZavorthEvalDataset[] {
  const datasets: ZavorthEvalDataset[] = [];
  const groupedScorecards = new Map<string, ZavorthEvalScorecard[]>();
  for (const card of scorecards) {
    const bucket = groupedScorecards.get(card.category) || [];
    bucket.push(card);
    groupedScorecards.set(card.category, bucket);
  }

  for (const [category, cards] of groupedScorecards.entries()) {
    const id = `dataset:${category}`;
    const kind = 'route-cluster' as const;
    const sampleCount = cards.reduce((sum, card) => sum + card.total, 0);
    const examples = cards.slice(0, 4).map((card) => card.label);
    datasets.push({
      id,
      label: prettyCategory(category),
      kind,
      sampleCount,
      description: 'Conjunto operational observado nesta window para ' + prettyCategory(category).toLowerCase() + '.',
      examples,
      manifest: buildEvalDatasetManifest({
        id,
        kind,
        observability,
        sampleCount,
        examples,
        selectors: [
          'category:' + category,
          ...cards.slice(0, 4).map((card) => 'scorecard:' + card.id),
        ],
      }),
    });
  }

  if (observability.learning.workflowResumeStages.length > 0) {
    const id = 'dataset:resume-pressure';
    const kind = 'resume-pressure' as const;
    const sampleCount = observability.learning.workflowResumeStages.reduce(
      (sum, entry) => sum + Number(entry.count || 0),
      0,
    );
    const examples = observability.learning.workflowResumeStages.slice(0, 4).map((entry) => {
      return String(entry.workflow || 'workflow') + ' -> ' + String(entry.stage_label || 'stage');
    });
    datasets.push({
      id,
      label: 'Resume pressure',
      kind,
      sampleCount,
      description: 'stages that most often request resume, unblock, or repair in the current window.',
      examples,
      manifest: buildEvalDatasetManifest({
        id,
        kind,
        observability,
        sampleCount,
        examples,
        selectors: observability.learning.workflowResumeStages.slice(0, 4).map((entry) => {
          return 'workflow:' + String(entry.workflow || 'workflow') + ':stage:' + String(entry.stage_label || 'stage');
        }),
      }),
    });
  }

  if (observability.artifacts.recent.length > 0) {
    const id = 'dataset:artifacts';
    const kind = 'artifacts' as const;
    const sampleCount = observability.artifacts.recent.length;
    const examples = observability.artifacts.recent.slice(0, 4).map((artifact) => {
      return String(artifact.name || 'artifact') + ' | ' + String(artifact.kind || artifact.type || 'output');
    });
    datasets.push({
      id,
      label: 'Artifacts recentes',
      kind,
      sampleCount,
      description: 'Real deliveries generated by Zavorth that can become validation baselines or replays.',
      examples,
      manifest: buildEvalDatasetManifest({
        id,
        kind,
        observability,
        sampleCount,
        examples,
        selectors: observability.artifacts.recent.slice(0, 4).map((artifact) => {
          return 'artifact:' + String(artifact.kind || artifact.type || 'output');
        }),
      }),
    });
  }

  if (observability.surfaces.sources.length > 0) {
    const id = 'dataset:surfaces';
    const kind = 'surface-traffic' as const;
    const sampleCount = observability.surfaces.sources.reduce((sum, entry) => sum + Number(entry.count || 0), 0);
    const examples = observability.surfaces.sources.slice(0, 4).map((entry) => {
      return String(entry.label || 'surface') + ' | ' + String(entry.count || 0) + ' evento(s)';
    });
    datasets.push({
      id,
      label: 'Surface traffic',
      kind,
      sampleCount,
      description: 'surfaces que mais concentraram runs, approvals e entregas nesta window.',
      examples,
      manifest: buildEvalDatasetManifest({
        id,
        kind,
        observability,
        sampleCount,
        examples,
        selectors: observability.surfaces.sources.slice(0, 4).map((entry) => {
          return 'surface:' + String(entry.label || 'surface');
        }),
      }),
    });
  }

  return datasets.slice(0, maxDatasets);
}

function buildEvalDatasetManifest(input: {
  id: string;
  kind: ZavorthEvalDataset['kind'];
  observability: ProductObservabilitySnapshot;
  sampleCount: number;
  examples: string[];
  selectors: string[];
}): ZavorthEvalDataset['manifest'] {
  const scopeHash = stableHash(input.observability.scope);
  const manifestHash = stableHash({
    id: input.id,
    kind: input.kind,
    generatedAt: input.observability.generatedAt,
    windowHours: input.observability.windowHours,
    scopeHash,
    sampleCount: input.sampleCount,
    examples: input.examples,
    selectors: input.selectors,
  });
  return {
    version: 1,
    manifestHash,
    generatedAt: input.observability.generatedAt,
    windowHours: input.observability.windowHours,
    scopeHash,
    reproducible: true,
    baselineRef: `eval-baseline:${input.kind}:${manifestHash.slice(0, 12)}`,
    selectors: input.selectors.slice(0, 12),
    retention: {
      ttlMs: 30 * 24 * 60 * 60 * 1000,
      maxSamples: Math.max(4, Math.min(input.sampleCount || input.examples.length, 500)),
      compacted: input.sampleCount > input.examples.length,
    },
    redaction: {
      mode: 'references-only',
      payloadsIncluded: false,
      secretsIncluded: false,
      notes: [
        'manifest guarda only referencias, contagens e labels operacionais.',
        'Payloads, prompts, and secrets are not copied to eval datasets.',
      ],
    },
  };
}

export function buildEvalRegressions(
  observability: ProductObservabilitySnapshot,
  scorecards: ZavorthEvalScorecard[],
  operationsHealth: any,
  maxRegressions: number,
): ZavorthEvalRegression[] {
  const regressions: ZavorthEvalRegression[] = [];

  for (const card of scorecards) {
    if (!(card.status === 'critical' || card.status === 'attention')) {
      continue;
    }
    regressions.push({
      id: `regression:${card.id}`,
      label: card.label,
      severity: card.status === 'critical' ? 'critical' : 'high',
      evidence: card.evidence[0] || 'Flow with operational friction above baseline.',
      recommendedAction: card.recommendation,
    });
    if (regressions.length >= maxRegressions) {
      return regressions;
    }
  }

  if (observability.approvals.pending > 0) {
    regressions.push({
      id: 'regression:pending-approvals',
      label: tService('eval.pending_approvals_queue'),
      severity: observability.approvals.pending >= 5 ? 'critical' : 'high',
      evidence:
        String(observability.approvals.pending) + ` ${tService('eval.approvals_waiting_decision')}`,
      recommendedAction: tService('eval.review_approvals_reduce_handoffs'),
    });
  }

  const blockedResumeStage = observability.learning.workflowResumeStages.find((entry) => {
    return Number(entry.blocked || 0) > 0 || Number(entry.failed || 0) > 0;
  });
  if (blockedResumeStage) {
    regressions.push({
      id: 'regression:resume-stage:' + String(blockedResumeStage.workflow || 'workflow'),
      label: String(blockedResumeStage.workflow || 'workflow') + ' needs repair',
      severity: Number(blockedResumeStage.failed || 0) > 0 ? 'critical' : 'medium',
      evidence:
        String(blockedResumeStage.stage_label || 'stage')
        + ' teve '
        + String(blockedResumeStage.blocked || 0)
        + ' block(s) e '
        + String(blockedResumeStage.failed || 0)
        + ' failure(s).',
      recommendedAction: 'Capture replay, review prerequisites, and promote a recovery recipe.',
    });
  }

  const healthAttention = normalizeText(
    operationsHealth?.summary?.attentionMessage
    || operationsHealth?.attentionMessage
    || operationsHealth?.status,
  );
  if (healthAttention) {
    regressions.push({
      id: 'regression:ops-health',
      label: 'Operaction com attention extra',
      severity: 'medium',
      evidence: healthAttention,
      recommendedAction: 'Cruzar este alerta com o doctor operational before do next rollout.',
    });
  }

  return regressions.slice(0, maxRegressions);
}

export function buildEvalComparisons(
  observability: ProductObservabilitySnapshot,
): ZavorthEvalControlPlaneSnapshot['comparisons'] {
  const workflows = new Map<string, { total: number; completed: number; failed: number; resumable: number }>();
  for (const run of observability.workflows.recent) {
    const key = normalizeText(run.workflow) || 'workflow';
    const bucket = workflows.get(key) || { total: 0, completed: 0, failed: 0, resumable: 0 };
    bucket.total += 1;
    if (normalizeText(run.status) === 'completed') {
      bucket.completed += 1;
    }
    if (normalizeText(run.status) === 'failed') {
      bucket.failed += 1;
    }
    if (run.resume_stage_id || run.recovered_from_interruption) {
      bucket.resumable += 1;
    }
    workflows.set(key, bucket);
  }

  return {
    executors: observability.executors.top.slice(0, 6).map((entry) => ({
      label: String(entry.executor || 'executor'),
      total: Number(entry.total || 0),
      successRate: roundRate(entry.success_rate),
      frictionRate: roundRate(
        Number(entry.approval_friction || 0) > 0 && Number(entry.total || 0) > 0
          ? Number(entry.approval_friction || 0) / Number(entry.total || 0)
          : 0,
      ),
      note:
        String(entry.completed || 0) + '/' + String(entry.total || 0)
        + ' completed(s) | '
        + String(entry.waiting_approval || 0)
        + ' waiting for approval',
    })),
    surfaces: observability.surfaces.sources.slice(0, 6).map((entry) => ({
      label: String(entry.label || 'surface'),
      total: Number(entry.count || 0),
      successRate: null,
      frictionRate: null,
      note: 'Latest sinal em ' + String(entry.last_seen_at || observability.generatedAt),
    })),
    workflows: Array.from(workflows.entries()).slice(0, 6).map(([label, entry]) => ({
      label,
      total: entry.total,
      successRate: entry.total > 0 ? roundRate(entry.completed / entry.total) : null,
      frictionRate: entry.total > 0 ? roundRate(entry.resumable / entry.total) : null,
      note:
        String(entry.completed) + ' completed(s) | '
        + String(entry.failed) + ' falho(s) | '
        + String(entry.resumable) + ' retomavel(is)',
    })),
  };
}

export function buildEvalRegressionGate(
  regressions: ZavorthEvalRegression[],
  now: Date | (() => Date) = () => new Date(),
): ZavorthEvalControlPlaneSnapshot['regressionGate'] {
  const criticalRegressions = regressions.filter((entry) => entry.severity === 'critical').length;
  const highRegressions = regressions.filter((entry) => entry.severity === 'high').length;
  const blockers = criticalRegressions > 0
    ? regressions
      .filter((entry) => entry.severity === 'critical')
      .map((entry) => `${entry.label}: ${entry.evidence}`)
    : [];
  const warnings = criticalRegressions === 0 && highRegressions > 0
    ? regressions
      .filter((entry) => entry.severity === 'high')
      .map((entry) => `${entry.label}: ${entry.evidence}`)
    : [];
  const criticalEntries = regressions.filter((entry) => entry.severity === 'critical');
  const warningEntries = regressions.filter((entry) => entry.severity === 'high');
  const requiredActions = (criticalEntries.length > 0 ? criticalEntries : warningEntries)
    .slice(0, 4)
    .map((entry) => entry.recommendedAction);
  return {
    id: 'eval-regression-gate',
    status: blockers.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'passed',
    canProceed: blockers.length === 0,
    scope: 'production-rollout',
    reasons: [
      criticalRegressions > 0
        ? 'Critical regression blocks production rollout.'
        : 'No critical regression observed.',
    ],
    warnings,
    blockers,
    checkedAt: (typeof now === 'function' ? now() : now).toISOString(),
    budgets: {
      maxCriticalRegressions: 0,
      externalObservabilityRequired: false,
    },
    evidence: regressions.slice(0, 6).map((entry) => ({
      id: entry.id,
      label: entry.label,
      status: entry.severity,
      summary: entry.evidence,
      command: 'npm run ops:evals',
    })),
    nextActions: requiredActions.length > 0
      ? requiredActions
      : ['Manter baseline de evals atualizado before do next rollout.'],
    criticalRegressions,
    rolloutBlocked: criticalRegressions > 0,
    rolloutScopes: {
      local: true,
      beta: criticalRegressions === 0,
      production: criticalRegressions === 0,
    },
    requiredActions,
  };
}

export function buildEvalCoverage(
  observability: ProductObservabilitySnapshot,
): ZavorthEvalControlPlaneSnapshot['coverage'] {
  const notes = [
    observability.totals.tasks > 0
      ? 'Tasks, approvals, workflows e artifacts already alimentam evals operacionais reais.'
      : 'without recent tasks; use the current window to generate a more reliable baseline.',
    observability.learning.routes.topSuccessful.length > 0
      ? 'As scorecards saem das rotas mais bem sucedidas, mais caras e com maior friction.'
      : 'There are not enough routes for deep scorecards in this slice yet.',
    'is entrega usa a telemetria operational nactive do Zavorth; sinks externos podem ser adicionados after without quebrar o contrato.',
  ];

  return {
    taskSignal: String(observability.totals.tasks || 0) + ' task(s) observada(s)',
    workflowSignal: String(observability.totals.workflowRuns || 0) + ' workflow(s) observados',
    approvalSignal:
      String(observability.approvals.pending || 0) + ' pending(s) | '
      + String(observability.approvals.approved || 0) + ' approved(s)',
    artifactSignal: String(observability.totals.artifacts || 0) + ' artifact(s) recentes',
    notes,
  };
}

export function buildEvalSelfmodBinding(
  scorecards: ZavorthEvalScorecard[],
  datasets: ZavorthEvalDataset[],
  regressions: ZavorthEvalRegression[],
): ZavorthEvalSelfmodBinding {
  const changeSensitiveScorecards = scorecards.filter((entry) => {
    return ['engineering', 'extensions', 'watch-mode'].includes(entry.category);
  });
  const relatedDatasets = datasets
    .filter((entry) => {
      const label = `${entry.id} ${entry.label}`.toLowerCase();
      return /(engineering|plugin|hook|mcp|watch|extension|artifact)/.test(label);
    })
    .map((entry) => entry.id);
  const missingEvalEvidence =
    changeSensitiveScorecards.length > 0 && relatedDatasets.length === 0
      ? changeSensitiveScorecards.length
      : 0;
  const criticalRegressions = regressions.filter((entry) => entry.severity === 'critical').length;
  const status: ZavorthEvalSelfmodBinding['status'] =
    criticalRegressions > 0
      ? 'blocked'
      : missingEvalEvidence > 0
        ? 'attention'
        : 'ready';
  const requiredBeforeApply = [
    'Every applied Selfmod v2 change must point to a related scorecard or eval dataset.',
    'Critical regression blocks apply/rollout until replay or doctor demonstrates recovery.',
    'Snapshots must keep only manifests, hashes, and references; no raw payload.',
  ];
  return {
    status,
    policy: 'selfmod-v2-change-requires-related-eval',
    evaluatedChangeSignals: changeSensitiveScorecards.length,
    missingEvalEvidence,
    relatedDatasets,
    requiredBeforeApply,
    recommendation:
      status === 'blocked'
        ? 'Block Selfmod v2 promotion while the eval gate has a critical regression.'
        : status === 'attention'
          ? 'Generate the related dataset or scorecard before applying the next Selfmod v2 change.'
          : 'Selfmod v2 pode consumir este gate como evidence operational leve.',
  };
}

export function buildEvalNarrative(input: {
  scorecards: ZavorthEvalScorecard[];
  regressions: ZavorthEvalRegression[];
  operatorBrief: any;
  summary: EvaluationSummary;
}): ZavorthEvalControlPlaneSnapshot['narrative'] {
  const topHealthy = input.scorecards.find((entry) => entry.status === 'healthy') || null;
  const topRegression = input.regressions[0] || null;
  const briefHint = normalizeText(
    input.operatorBrief?.operatorSummary
    || input.operatorBrief?.summary
    || input.operatorBrief?.narrative?.operatorSummary,
  );
  const headline =
    input.summary.posture === 'critical'
      ? 'Channel mesh em modo de recovery'
      : input.summary.posture === 'attention'
        ? 'Channel mesh com pontos de attention'
        : 'Channel mesh stable';
  const operatorSummary = [
    briefHint,
    input.regressions.length > 0
      ? 'Maior pressure current: ' + topRegression?.label + '.'
      : 'No strong regression appeared in this slice.',
    topHealthy ? 'Better baseline: ' + topHealthy.label + '.'
      : null,
    'Datasets actives: ' + String(input.summary.datasets) + ' | scorecards: ' + String(input.summary.scorecards) + '.',
  ].filter(Boolean).join(' ');

  return {
    headline,
    operatorSummary: operatorSummary || 'Operational eval panel ready.',
  };
}

export function resolveEvalPosture(
  scorecards: ZavorthEvalScorecard[],
  regressions: ZavorthEvalRegression[],
): ZavorthEvalControlPlaneSnapshot['summary']['posture'] {
  if (
    regressions.some((entry) => entry.severity === 'critical')
    || scorecards.some((entry) => entry.status === 'critical')
  ) {
    return 'critical';
  }
  if (
    regressions.length > 0
    || scorecards.some((entry) => entry.status === 'attention')
  ) {
    return 'attention';
  }
  return 'healthy';
}

export function resolveEvalOperatorCostState(
  observability: ProductObservabilitySnapshot,
): ZavorthEvalControlPlaneSnapshot['summary']['operatorCostState'] {
  const cost = Math.max(
    Number(observability.operatorCost.averageApprovalWaitMs || 0),
    Number(observability.operatorCost.averageRecoveryMs || 0),
    Number(observability.operatorCost.averageArtifactDeliveryMs || 0),
  );
  if (cost >= 5 * 60 * 1000) {
    return 'high';
  }
  if (cost >= 60 * 1000) {
    return 'moderate';
  }
  return 'low';
}

export function countEvalTelemetrySignals(observability: ProductObservabilitySnapshot): number {
  let signals = 0;
  if (observability.totals.tasks > 0) {
    signals += 1;
  }
  if (observability.totals.workflowRuns > 0) {
    signals += 1;
  }
  if (observability.totals.approvals > 0 || observability.approvals.pending > 0) {
    signals += 1;
  }
  if (observability.totals.artifacts > 0) {
    signals += 1;
  }
  if (observability.learning.routes.topSuccessful.length > 0) {
    signals += 1;
  }
  return signals;
}

export function buildEvalMissingTelemetry(): EvalTelemetryInput {
  return {
    status: 'missing',
    totalEvents: 0,
    traceCount: 0,
    failureEvents: 0,
    blockedEvents: 0,
    lastEventAt: null,
    topSources: [],
    topEventTypes: [],
    traces: [],
    sinks: {
      localJsonl: false,
      langfuseConfigured: false,
      otelExporterConfigured: false,
      otelReady: false,
      externalRequired: false,
    },
    retention: {
      windowHours: 0,
      maxEvents: 0,
      maxTraces: 0,
      maxTopEntries: 0,
      scannedEvents: 0,
      retainedEvents: 0,
      truncated: false,
    },
    redaction: {
      mode: 'hashed-references',
      traceIdsHashed: true,
      payloadsIncluded: false,
      notes: ['without connected ledger; contract remains in redacted mode by default.'],
    },
    recommendation: 'without ledger de telemetria ligado in this runtime.',
  };
}

export function readEvalTelemetrySnapshot(
  telemetryLedgerService: { buildSnapshot: (input?: Date | Partial<{ referenceDate: Date; windowHours: number }>) => ZavorthTelemetryLedgerSnapshot } | null | undefined,
  referenceDate: Date,
  windowHours: number,
): EvalTelemetryInput {
  try {
    if (!telemetryLedgerService) {
      return buildEvalMissingTelemetry();
    }
    const snapshot = telemetryLedgerService.buildSnapshot({
      referenceDate,
      windowHours,
    });
    if (!snapshot) {
      return buildEvalMissingTelemetry();
    }
    return {
      status: snapshot.status,
      totalEvents: snapshot.totalEvents,
      traceCount: snapshot.traceCount,
      failureEvents: snapshot.failureEvents,
      blockedEvents: snapshot.blockedEvents,
      lastEventAt: snapshot.lastEventAt,
      topSources: snapshot.topSources,
      topEventTypes: snapshot.topEventTypes,
      traces: snapshot.traces,
      sinks: snapshot.sinks,
      retention: snapshot.retention || buildEvalMissingTelemetry().retention,
      redaction: snapshot.redaction || buildEvalMissingTelemetry().redaction,
      recommendation: snapshot.recommendation,
    };
  } catch (error: unknown) {logger.warn('[Zavorth Eval Control Plane Kit] creation failed', error);
    return {
      ...buildEvalMissingTelemetry(),
      recommendation: 'A read da telemetria failed on this host.',
    };
  }
}

export function buildEvalFallbackHistory(
  posture: ZavorthEvalControlPlaneSnapshot['summary']['posture'],
): ZavorthEvalHistorySnapshot {
  return {
    file: '',
    available: false,
    entries: 0,
    lastCapturedAt: null,
    latestPosture: posture,
    delta: {
      scorecards: 0,
      datasets: 0,
      regressions: 0,
      telemetrySignals: 0,
      traceCount: 0,
      failureEvents: 0,
    },
    trend: [],
    baseline: {
      available: false,
      generatedAt: null,
      posture,
      manifestHash: null,
      comparableWindows: 0,
      summary: 'without baseline history comparavel in this runtime.',
    },
    retention: {
      maxEntries: 0,
      trendWindow: 12,
      captureIntervalMs: 0,
      compacted: false,
    },
    recommendation: 'Historical baseline has not been persisted in this runtime yet.',
  };
}

export function captureEvalHistorySnapshot(
  evalHistoryService: { capture: (snapshot: any) => ZavorthEvalHistorySnapshot } | null | undefined,
  snapshot: ZavorthEvalControlPlaneSnapshot,
): ZavorthEvalHistorySnapshot {
  try {
    if (!evalHistoryService) {
      return buildEvalFallbackHistory(snapshot.summary.posture);
    }
    return evalHistoryService.capture(snapshot) || buildEvalFallbackHistory(snapshot.summary.posture);
  } catch (error: unknown) {logger.warn('[Zavorth Eval Control Plane Kit] creation failed', error);
    return buildEvalFallbackHistory(snapshot.summary.posture);
  }
}

function routeKey(route: RouteStat): string {
  return [
    normalizeRouteToken(route.executor) || 'executor',
    normalizeRouteToken(route.source_surface) || 'surface',
    normalizeRouteToken(route.workflow) || 'workflow',
    normalizeRouteToken(route.kind) || 'kind',
    normalizeRouteToken(route.subtype) || 'subtype',
  ].join('|');
}

function buildRouteLabel(route: RouteStat): string {
  const workflow = normalizeRouteToken(route.workflow);
  const sourceSurface = normalizeRouteToken(route.source_surface);
  const kind = normalizeRouteToken(route.kind);
  const subtype = normalizeRouteToken(route.subtype);
  const executor = normalizeRouteToken(route.executor);
  if (workflow && sourceSurface) {
    return workflow + ' via ' + sourceSurface;
  }
  if (workflow) {
    return workflow;
  }
  if (kind && subtype && sourceSurface) {
    return kind + '/' + subtype + ' via ' + sourceSurface;
  }
  if (kind && subtype) {
    return kind + '/' + subtype;
  }
  if (kind && sourceSurface) {
    return kind + ' via ' + sourceSurface;
  }
  if (sourceSurface) {
    return 'flow via ' + sourceSurface;
  }
  if (executor) {
    return 'flow via ' + executor;
  }
  return 'general flow';
}

function classifyRoute(route: RouteStat): string {
  const stack = [
    normalizeRouteToken(route.workflow),
    normalizeRouteToken(route.kind),
    normalizeRouteToken(route.subtype),
    normalizeRouteToken(route.source_surface),
    normalizeRouteToken(route.source),
    normalizeRouteToken(route.executor),
  ].filter(Boolean).join(' ').toLowerCase();

  if (/(watch|visual|browser|desktop|computer_use)/.test(stack)) {
    return 'watch-mode';
  }
  if (/(telegram|discord|slack|whatsapp|signal|imessage|teams|email|channel)/.test(stack)) {
    return 'channels';
  }
  if (/(node|mesh|pair|fleet|capability)/.test(stack)) {
    return 'nodes';
  }
  if (/(remote|transport|sidecar|tunnel|cloudflare)/.test(stack)) {
    return 'transports';
  }
  if (/(plugin|hook|skill|mcp|integration|extension)/.test(stack)) {
    return 'extensions';
  }
  if (/(build|test|patch|install|repair|workflow|session|engineering|repo)/.test(stack)) {
    return 'engineering';
  }
  return 'general';
}

function prettyCategory(value: string): string {
  switch (value) {
    case 'watch-mode':
      return 'Watch Mode';
    case 'channels':
      return 'Channel Mesh';
    case 'nodes':
      return 'Node Mesh';
    case 'transports':
      return 'Remote transports';
    case 'extensions':
      return 'Plugins, hooks e MCP';
    case 'engineering':
      return 'Engineering Core';
    default:
      return 'General flows';
  }
}

function resolveScorecardStatus(route: RouteStat): ZavorthEvalScorecardStatus {
  const total = Number(route.total || 0);
  const successRate = Number(route.success_rate || 0);
  const frictionRate = Number(route.friction_rate || 0);
  const failures = Number(route.failed || 0);
  const waitingApproval = Number(route.waitingApproval || 0) + Number(route.waitingPermission || 0);
  const evaluableTotal =
    Number(route.evaluable_total || 0)
    || (
      Number(route.completed || 0)
      + failures
      + waitingApproval
      + Number(route.rejected || 0)
    );
  const operatorCostScore = Number(route.operator_cost_score || 0);
  if (total < 2) {
    return 'insufficient_data';
  }
  if (evaluableTotal < 2) {
    return 'insufficient_data';
  }
  if (successRate < 0.5 || frictionRate >= 0.35 || failures > Number(route.completed || 0) || operatorCostScore >= 70) {
    return 'critical';
  }
  if (successRate < 0.8 || frictionRate >= 0.12 || waitingApproval > 0 || operatorCostScore >= 35) {
    return 'attention';
  }
  return 'healthy';
}

function downgradeSupersededLegacyScorecards(
  scorecards: ZavorthEvalScorecard[],
): ZavorthEvalScorecard[] {
  return scorecards.map((card) => {
    if (card.status !== 'critical' || !isSupersededLegacyRoute(card, scorecards)) {
      return card;
    }

    return {
      ...card,
      status: 'attention',
      recommendation: 'Confirm legacy route discontinuity and keep the healthy successor as rollout baseline.',
      evidence: [
        ...card.evidence,
        'legacy route superseded by healthy successor in the same channel',
      ],
    };
  });
}

function isSupersededLegacyRoute(
  card: ZavorthEvalScorecard,
  scorecards: ZavorthEvalScorecard[],
): boolean {
  if (!isLegacyExecutor(card.executor)) {
    return false;
  }

  const cardLastSeenAt = parseOperationalDate(card.lastSeenAt);
  return scorecards.some((candidate) => {
    if (candidate.id === card.id || candidate.status !== 'healthy') {
      return false;
    }
    if (isLegacyExecutor(candidate.executor)) {
      return false;
    }
    if (normalizeRouteToken(candidate.sourceSurface) !== normalizeRouteToken(card.sourceSurface)) {
      return false;
    }
    const sameWorkflow = normalizeRouteToken(candidate.workflow) === normalizeRouteToken(card.workflow);
    const legacyWorkflowIsEmpty = !normalizeRouteToken(card.workflow);
    if (!sameWorkflow && !legacyWorkflowIsEmpty) {
      return false;
    }
    const candidateLastSeenAt = parseOperationalDate(candidate.lastSeenAt);
    if (candidateLastSeenAt < cardLastSeenAt) {
      return false;
    }
    return candidate.completed >= 2 && candidate.successRate >= 0.9;
  });
}

function isLegacyExecutor(value: unknown): boolean {
  return normalizeRouteToken(value).toLowerCase() === 'echo';
}

function buildRouteRecommendation(route: RouteStat, status: ZavorthEvalScorecardStatus): string {
  const waitingApproval = Number(route.waitingApproval || 0) + Number(route.waitingPermission || 0);
  if (waitingApproval > 0) {
    return 'Reduzir handoffs e review approvals recorrentes desta rota.';
  }
  if (status === 'critical') {
    return 'run replay/doctor desta rota e capturar um dataset de failures before do next rollout.';
  }
  if (Number(route.operator_cost_score || 0) >= 35) {
    return 'Promote supervised automation or recipes to lower the operational cost of this route.';
  }
  return 'Usar is rota como baseline e comparar executores, surfaces e prompts nas next executions.';
}

function buildRouteEvidence(route: RouteStat): string[] {
  const evaluableTotal =
    Number(route.evaluable_total || 0)
    || (
      Number(route.completed || 0)
      + Number(route.failed || 0)
      + Number(route.waitingApproval || 0)
      + Number(route.waitingPermission || 0)
      + Number(route.rejected || 0)
    );
  return [
    String(route.completed || 0) + '/' + String(evaluableTotal || route.total || 0) + ' completed(s) avaliaveis',
    'failures=' + String(route.failed || 0) + ' | approvals='
      + String(Number(route.waitingApproval || 0) + Number(route.waitingPermission || 0)),
    'success=' + String(Math.round(Number(route.success_rate || 0) * 100)) + '%'
      + ' | friction=' + String(Math.round(Number(route.friction_rate || 0) * 100)) + '%',
    'operator-cost=' + String(Math.max(0, Math.round(Number(route.operator_cost_score || 0)))),
  ];
}

function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

function normalizeRouteToken(value: unknown): string {
  const text = normalizeText(value);
  const normalized = text.toLowerCase();
  if (
    !text
    || normalized === 'unknown'
    || normalized === 'n/a'
    || normalized === 'null'
    || normalized === 'undefined'
    || normalized === 'none'
  ) {
    return '';
  }
  return text;
}

function parseOperationalDate(value: unknown): number {
  const text = normalizeText(value);
  if (!text) {
    return 0;
  }
  const direct = Date.parse(text);
  if (Number.isFinite(direct)) {
    return direct;
  }
  const isoLike = text.includes('T') ? text : text.replace(' ', 'T') + 'Z';
  const parsed = Date.parse(isoLike);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stableHash(value: unknown): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(sortForHash(value)))
    .digest('hex');
}

function sortForHash(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortForHash(entry));
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = sortForHash((value as Record<string, unknown>)[key]);
        return accumulator;
      }, {});
  }
  return value;
}

function roundRate(value: unknown): number {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(1, Math.round(numeric * 1000) / 1000));
}

export type ZavorthEvalTelemetrySnapshot = EvalTelemetryInput;
