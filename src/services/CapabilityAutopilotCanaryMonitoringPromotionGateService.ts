import { createHash } from 'crypto';
import type { CapabilityAutopilotPreflightCheck } from './CapabilityAutopilotPreflightEntrypointService.js';
import type { CapabilityAutopilotReleaseExecutionSnapshot } from './CapabilityAutopilotReleaseExecutionGateService.js';

export type CapabilityAutopilotCanaryPromotionStatus =
  | 'canary_promotion_ready'
  | 'blocked';

export type CapabilityAutopilotCanaryPromotionRecommendation =
  | 'promote_canary_to_next_cohort'
  | 'hold_canary_or_rollback';

export type CapabilityAutopilotCanaryPromotionOptions = {
  canaryObservationComplete?: boolean;
  observationWindowMinutes?: number;
  minObservationWindowMinutes?: number;
  telemetryFresh?: boolean;
  metricsWindowComplete?: boolean;
  errorRatePercent?: number;
  maxErrorRatePercent?: number;
  p95LatencyMs?: number;
  maxP95LatencyMs?: number;
  successRatePercent?: number;
  minSuccessRatePercent?: number;
  crashFreePercent?: number;
  minCrashFreePercent?: number;
  p0IncidentCount?: number;
  p1IncidentCount?: number;
  maxP1Incidents?: number;
  rollbackTriggered?: boolean;
  rollbackRecommended?: boolean;
  supportLoadOk?: boolean;
  negativeFeedbackPercent?: number;
  maxNegativeFeedbackPercent?: number;
  canaryCohortStable?: boolean;
  promotionApproved?: boolean;
  nextCohortPercent?: number;
  maxNextCohortPercent?: number;
  rollbackRunbookReady?: boolean;
  observabilityReviewReady?: boolean;
  auditPersisted?: boolean;
  autoPromoteEnabled?: boolean;
  globalRolloutEnabled?: boolean;
  skipApprovalEnabled?: boolean;
  actorId?: string | null;
  canaryPromotionReceiptId?: string | null;
  observationWindowId?: string | null;
  telemetrySnapshotId?: string | null;
  incidentReviewId?: string | null;
  feedbackSummaryId?: string | null;
  nextCohortId?: string | null;
  promotionApprovalId?: string | null;
  rollbackRunbookId?: string | null;
  observabilityReviewId?: string | null;
  auditReceiptId?: string | null;
  reason?: string | null;
};

export type CapabilityAutopilotCanaryPromotionSnapshot = {
  phase: '83';
  canaryPromotionId: string;
  generatedAt: string;
  surface: 'capability-autopilot-canary-monitoring-promotion-gate';
  capabilityId: string;
  status: CapabilityAutopilotCanaryPromotionStatus;
  recommendation: CapabilityAutopilotCanaryPromotionRecommendation;
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  sourceSnapshotPhase: CapabilityAutopilotReleaseExecutionSnapshot['phase'];
  sourceStatus: CapabilityAutopilotReleaseExecutionSnapshot['status'];
  sourceRecommendation: CapabilityAutopilotReleaseExecutionSnapshot['recommendation'];
  observation: {
    canaryObservationComplete: boolean;
    observationWindowMinutes: number;
    minObservationWindowMinutes: number;
    telemetryFresh: boolean;
    metricsWindowComplete: boolean;
    observationWindowId: string | null;
    telemetrySnapshotId: string | null;
  };
  health: {
    errorRatePercent: number;
    maxErrorRatePercent: number;
    p95LatencyMs: number;
    maxP95LatencyMs: number;
    successRatePercent: number;
    minSuccessRatePercent: number;
    crashFreePercent: number;
    minCrashFreePercent: number;
  };
  incidents: {
    p0IncidentCount: number;
    p1IncidentCount: number;
    maxP1Incidents: number;
    rollbackTriggered: boolean;
    rollbackRecommended: boolean;
    incidentReviewId: string | null;
  };
  feedback: {
    supportLoadOk: boolean;
    negativeFeedbackPercent: number;
    maxNegativeFeedbackPercent: number;
    feedbackSummaryId: string | null;
  };
  promotion: {
    canaryCohortStable: boolean;
    promotionApproved: boolean;
    promotionApprovalId: string | null;
    nextCohortPercent: number;
    maxNextCohortPercent: number;
    nextCohortId: string | null;
  };
  safeguards: {
    rollbackRunbookReady: boolean;
    rollbackRunbookId: string | null;
    observabilityReviewReady: boolean;
    observabilityReviewId: string | null;
    auditPersisted: boolean;
    auditReceiptId: string | null;
    autoPromoteEnabled: boolean;
    globalRolloutEnabled: boolean;
    skipApprovalEnabled: boolean;
  };
  blockers: string[];
  checks: CapabilityAutopilotPreflightCheck[];
  audit: {
    sourceGeneratedAt: string;
    sourceReleaseExecutionGateId: string;
    actorId: string | null;
    reason: string | null;
    canaryPromotionReceiptId: string | null;
  };
  nextRecommendedPhase: {
    phase: 'consolidation';
    title: string;
    reason: string;
  };
  metadata: Record<string, unknown>;
};

export type CapabilityAutopilotCanaryMonitoringPromotionGateRuntime = {
  now?: () => Date;
};

type ResolvedOptions = {
  canaryObservationComplete: boolean;
  observationWindowMinutes: number;
  minObservationWindowMinutes: number;
  telemetryFresh: boolean;
  metricsWindowComplete: boolean;
  errorRatePercent: number;
  maxErrorRatePercent: number;
  p95LatencyMs: number;
  maxP95LatencyMs: number;
  successRatePercent: number;
  minSuccessRatePercent: number;
  crashFreePercent: number;
  minCrashFreePercent: number;
  p0IncidentCount: number;
  p1IncidentCount: number;
  maxP1Incidents: number;
  rollbackTriggered: boolean;
  rollbackRecommended: boolean;
  supportLoadOk: boolean;
  negativeFeedbackPercent: number;
  maxNegativeFeedbackPercent: number;
  canaryCohortStable: boolean;
  promotionApproved: boolean;
  nextCohortPercent: number;
  maxNextCohortPercent: number;
  rollbackRunbookReady: boolean;
  observabilityReviewReady: boolean;
  auditPersisted: boolean;
  autoPromoteEnabled: boolean;
  globalRolloutEnabled: boolean;
  skipApprovalEnabled: boolean;
};

export class CapabilityAutopilotCanaryMonitoringPromotionGateService {
  private readonly now: () => Date;

  constructor(runtime: CapabilityAutopilotCanaryMonitoringPromotionGateRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildCanaryPromotionSnapshot(
    source: CapabilityAutopilotReleaseExecutionSnapshot,
    options: CapabilityAutopilotCanaryPromotionOptions = {},
  ): CapabilityAutopilotCanaryPromotionSnapshot {
    const generatedAt = this.now().toISOString();
    const resolved = this.resolveOptions(source, options);
    const blockers = this.resolveBlockers(source, resolved);
    const checks = this.buildChecks(source, resolved, blockers);
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;
    const status: CapabilityAutopilotCanaryPromotionStatus = failed > 0 || blockers.length > 0
      ? 'blocked'
      : 'canary_promotion_ready';
    const recommendation: CapabilityAutopilotCanaryPromotionRecommendation = status === 'canary_promotion_ready'
      ? 'promote_canary_to_next_cohort'
      : 'hold_canary_or_rollback';

    return {
      phase: '83',
      canaryPromotionId: this.buildCanaryPromotionId(source, generatedAt, options.canaryPromotionReceiptId || null),
      generatedAt,
      surface: 'capability-autopilot-canary-monitoring-promotion-gate',
      capabilityId: source.capabilityId,
      status,
      recommendation,
      summary: {
        ok: status === 'canary_promotion_ready',
        passed,
        warnings,
        failed,
      },
      sourceSnapshotPhase: source.phase,
      sourceStatus: source.status,
      sourceRecommendation: source.recommendation,
      observation: {
        canaryObservationComplete: resolved.canaryObservationComplete,
        observationWindowMinutes: resolved.observationWindowMinutes,
        minObservationWindowMinutes: resolved.minObservationWindowMinutes,
        telemetryFresh: resolved.telemetryFresh,
        metricsWindowComplete: resolved.metricsWindowComplete,
        observationWindowId: options.observationWindowId || null,
        telemetrySnapshotId: options.telemetrySnapshotId || null,
      },
      health: {
        errorRatePercent: resolved.errorRatePercent,
        maxErrorRatePercent: resolved.maxErrorRatePercent,
        p95LatencyMs: resolved.p95LatencyMs,
        maxP95LatencyMs: resolved.maxP95LatencyMs,
        successRatePercent: resolved.successRatePercent,
        minSuccessRatePercent: resolved.minSuccessRatePercent,
        crashFreePercent: resolved.crashFreePercent,
        minCrashFreePercent: resolved.minCrashFreePercent,
      },
      incidents: {
        p0IncidentCount: resolved.p0IncidentCount,
        p1IncidentCount: resolved.p1IncidentCount,
        maxP1Incidents: resolved.maxP1Incidents,
        rollbackTriggered: resolved.rollbackTriggered,
        rollbackRecommended: resolved.rollbackRecommended,
        incidentReviewId: options.incidentReviewId || null,
      },
      feedback: {
        supportLoadOk: resolved.supportLoadOk,
        negativeFeedbackPercent: resolved.negativeFeedbackPercent,
        maxNegativeFeedbackPercent: resolved.maxNegativeFeedbackPercent,
        feedbackSummaryId: options.feedbackSummaryId || null,
      },
      promotion: {
        canaryCohortStable: resolved.canaryCohortStable,
        promotionApproved: resolved.promotionApproved,
        promotionApprovalId: options.promotionApprovalId || null,
        nextCohortPercent: resolved.nextCohortPercent,
        maxNextCohortPercent: resolved.maxNextCohortPercent,
        nextCohortId: options.nextCohortId || null,
      },
      safeguards: {
        rollbackRunbookReady: resolved.rollbackRunbookReady,
        rollbackRunbookId: options.rollbackRunbookId || null,
        observabilityReviewReady: resolved.observabilityReviewReady,
        observabilityReviewId: options.observabilityReviewId || null,
        auditPersisted: resolved.auditPersisted,
        auditReceiptId: options.auditReceiptId || null,
        autoPromoteEnabled: resolved.autoPromoteEnabled,
        globalRolloutEnabled: resolved.globalRolloutEnabled,
        skipApprovalEnabled: resolved.skipApprovalEnabled,
      },
      blockers,
      checks,
      audit: {
        sourceGeneratedAt: source.generatedAt,
        sourceReleaseExecutionGateId: source.releaseExecutionGateId,
        actorId: options.actorId || null,
        reason: options.reason || null,
        canaryPromotionReceiptId: options.canaryPromotionReceiptId || null,
      },
      nextRecommendedPhase: {
        phase: 'consolidation',
        title: 'Capability Autopilot Release Readiness Consolidation',
        reason:
          'Nao ha nova fase automatica recomendada; o proximo passo e integrar o release readiness consolidado ao produto real e medir uso antes de criar novos gates.',
      },
      metadata: {
        phase: 'capability-autopilot-phase-83',
        sourceSnapshotStatus: source.status,
        sourceRecommendation: source.recommendation,
        autoExecute: false,
        recommendation,
        canaryPromotionReady: status === 'canary_promotion_ready',
        observationWindowMinutes: resolved.observationWindowMinutes,
        errorRatePercent: resolved.errorRatePercent,
        successRatePercent: resolved.successRatePercent,
        nextCohortPercent: resolved.nextCohortPercent,
        autoPromoteEnabled: resolved.autoPromoteEnabled,
        globalRolloutEnabled: resolved.globalRolloutEnabled,
      },
    };
  }

  public renderReport(snapshot: CapabilityAutopilotCanaryPromotionSnapshot): string {
    const lines: string[] = [];
    lines.push('[capability-autopilot-canary-promotion] Fase 83 - Capability Autopilot v1.1 Canary Monitoring And Promotion Gate');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`recommendation: ${snapshot.recommendation}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`capability: ${snapshot.capabilityId}`);
    lines.push(`observation: ${snapshot.observation.observationWindowMinutes}m/${snapshot.observation.minObservationWindowMinutes}m`);
    lines.push(`health: error=${snapshot.health.errorRatePercent}%/${snapshot.health.maxErrorRatePercent}% success=${snapshot.health.successRatePercent}%/${snapshot.health.minSuccessRatePercent}%`);
    lines.push(`next cohort: ${snapshot.promotion.nextCohortPercent}%/${snapshot.promotion.maxNextCohortPercent}%`);
    lines.push('');
    for (const item of snapshot.checks) {
      lines.push(`[${item.status}] ${item.title}`);
      lines.push(`  ${item.reason}`);
      for (const evidence of item.evidence) {
        lines.push(`  - ${evidence}`);
      }
    }
    lines.push('');
    lines.push(`proxima etapa recomendada: ${snapshot.nextRecommendedPhase.phase} - ${snapshot.nextRecommendedPhase.title}`);
    lines.push(snapshot.nextRecommendedPhase.reason);
    return lines.join('\n');
  }

  private resolveOptions(
    source: CapabilityAutopilotReleaseExecutionSnapshot,
    options: CapabilityAutopilotCanaryPromotionOptions,
  ): ResolvedOptions {
    return {
      canaryObservationComplete: options.canaryObservationComplete === true,
      observationWindowMinutes: this.resolveNumber(options.observationWindowMinutes, 0),
      minObservationWindowMinutes: this.resolveNumber(options.minObservationWindowMinutes, 0),
      telemetryFresh: options.telemetryFresh === true,
      metricsWindowComplete: options.metricsWindowComplete === true,
      errorRatePercent: this.resolveNumber(options.errorRatePercent, 0),
      maxErrorRatePercent: this.resolveNumber(options.maxErrorRatePercent, 0),
      p95LatencyMs: this.resolveNumber(options.p95LatencyMs, 0),
      maxP95LatencyMs: this.resolveNumber(options.maxP95LatencyMs, 0),
      successRatePercent: this.resolveNumber(options.successRatePercent, 0),
      minSuccessRatePercent: this.resolveNumber(options.minSuccessRatePercent, 0),
      crashFreePercent: this.resolveNumber(options.crashFreePercent, 0),
      minCrashFreePercent: this.resolveNumber(options.minCrashFreePercent, 0),
      p0IncidentCount: this.resolveNumber(options.p0IncidentCount, 0),
      p1IncidentCount: this.resolveNumber(options.p1IncidentCount, 0),
      maxP1Incidents: this.resolveNumber(options.maxP1Incidents, 0),
      rollbackTriggered: options.rollbackTriggered === true,
      rollbackRecommended: options.rollbackRecommended === true,
      supportLoadOk: options.supportLoadOk === true,
      negativeFeedbackPercent: this.resolveNumber(options.negativeFeedbackPercent, 0),
      maxNegativeFeedbackPercent: this.resolveNumber(options.maxNegativeFeedbackPercent, 0),
      canaryCohortStable: options.canaryCohortStable === true,
      promotionApproved: options.promotionApproved === true,
      nextCohortPercent: this.resolveNumber(options.nextCohortPercent, source.canary.initialCanaryPercent),
      maxNextCohortPercent: this.resolveNumber(options.maxNextCohortPercent, source.canary.maxInitialCanaryPercent),
      rollbackRunbookReady: options.rollbackRunbookReady === true,
      observabilityReviewReady: options.observabilityReviewReady === true,
      auditPersisted: options.auditPersisted === true,
      autoPromoteEnabled: options.autoPromoteEnabled === true,
      globalRolloutEnabled: options.globalRolloutEnabled === true,
      skipApprovalEnabled: options.skipApprovalEnabled === true,
    };
  }

  private resolveNumber(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private resolveBlockers(
    source: CapabilityAutopilotReleaseExecutionSnapshot,
    options: ResolvedOptions,
  ): string[] {
    const blockers: string[] = [];
    if (
      source.status !== 'release_execution_ready' ||
      source.recommendation !== 'execute_manual_v1_1_release' ||
      !source.summary.ok
    ) {
      blockers.push(`source_release_execution_not_ready:${source.status}`);
    }
    if (!options.canaryObservationComplete) {
      blockers.push('canary_observation_required');
    }
    if (options.observationWindowMinutes < options.minObservationWindowMinutes || options.minObservationWindowMinutes <= 0) {
      blockers.push('observation_window_too_short');
    }
    if (!options.telemetryFresh) {
      blockers.push('telemetry_freshness_required');
    }
    if (!options.metricsWindowComplete) {
      blockers.push('metrics_window_required');
    }
    if (options.errorRatePercent > options.maxErrorRatePercent) {
      blockers.push('error_rate_budget_exceeded');
    }
    if (options.p95LatencyMs > options.maxP95LatencyMs) {
      blockers.push('latency_budget_exceeded');
    }
    if (options.successRatePercent < options.minSuccessRatePercent) {
      blockers.push('success_rate_threshold_not_met');
    }
    if (options.crashFreePercent < options.minCrashFreePercent) {
      blockers.push('crash_free_threshold_not_met');
    }
    if (options.p0IncidentCount > 0) {
      blockers.push('p0_incidents_present');
    }
    if (options.p1IncidentCount > options.maxP1Incidents) {
      blockers.push('p1_incident_budget_exceeded');
    }
    if (options.rollbackTriggered) {
      blockers.push('rollback_already_triggered');
    }
    if (options.rollbackRecommended) {
      blockers.push('rollback_recommended');
    }
    if (!options.supportLoadOk) {
      blockers.push('support_load_not_ok');
    }
    if (options.negativeFeedbackPercent > options.maxNegativeFeedbackPercent) {
      blockers.push('negative_feedback_budget_exceeded');
    }
    if (!options.canaryCohortStable) {
      blockers.push('canary_cohort_not_stable');
    }
    if (!options.promotionApproved) {
      blockers.push('promotion_approval_required');
    }
    if (options.nextCohortPercent <= 0 || options.nextCohortPercent > options.maxNextCohortPercent) {
      blockers.push('next_cohort_percent_out_of_bounds');
    }
    if (!options.rollbackRunbookReady) {
      blockers.push('rollback_runbook_required');
    }
    if (!options.observabilityReviewReady) {
      blockers.push('observability_review_required');
    }
    if (!options.auditPersisted) {
      blockers.push('audit_persistence_required');
    }
    if (options.autoPromoteEnabled) {
      blockers.push('auto_promote_not_allowed');
    }
    if (options.globalRolloutEnabled) {
      blockers.push('global_rollout_not_allowed');
    }
    if (options.skipApprovalEnabled) {
      blockers.push('skip_approval_not_allowed');
    }
    return Array.from(new Set(blockers));
  }

  private buildChecks(
    source: CapabilityAutopilotReleaseExecutionSnapshot,
    options: ResolvedOptions,
    blockers: string[],
  ): CapabilityAutopilotPreflightCheck[] {
    const serialized = JSON.stringify({ source });

    return [
      this.check(
        'capability-autopilot-canary-promotion:source-ready',
        'release execution source ready',
        source.status === 'release_execution_ready' && source.recommendation === 'execute_manual_v1_1_release' && source.summary.ok ? 'pass' : 'fail',
        'Canary promotion so pode partir de release execution pronta.',
        [
          `sourceStatus=${source.status}`,
          `sourceRecommendation=${source.recommendation}`,
          `sourceOk=${source.summary.ok}`,
        ],
      ),
      this.check(
        'capability-autopilot-canary-promotion:observation',
        'janela de observacao completa',
        options.canaryObservationComplete &&
          options.observationWindowMinutes >= options.minObservationWindowMinutes &&
          options.telemetryFresh &&
          options.metricsWindowComplete
          ? 'pass'
          : 'fail',
        'Promocao exige janela completa, telemetria fresca e metrics window fechada.',
        [
          `canaryObservationComplete=${options.canaryObservationComplete}`,
          `observationWindowMinutes=${options.observationWindowMinutes}`,
          `minObservationWindowMinutes=${options.minObservationWindowMinutes}`,
          `telemetryFresh=${options.telemetryFresh}`,
          `metricsWindowComplete=${options.metricsWindowComplete}`,
        ],
      ),
      this.check(
        'capability-autopilot-canary-promotion:health',
        'sinais de saude dentro do budget',
        options.errorRatePercent <= options.maxErrorRatePercent &&
          options.p95LatencyMs <= options.maxP95LatencyMs &&
          options.successRatePercent >= options.minSuccessRatePercent &&
          options.crashFreePercent >= options.minCrashFreePercent
          ? 'pass'
          : 'fail',
        'Canary so avanca com erro, latencia, success rate e crash-free dentro do budget.',
        [
          `errorRatePercent=${options.errorRatePercent}`,
          `maxErrorRatePercent=${options.maxErrorRatePercent}`,
          `p95LatencyMs=${options.p95LatencyMs}`,
          `maxP95LatencyMs=${options.maxP95LatencyMs}`,
          `successRatePercent=${options.successRatePercent}`,
          `minSuccessRatePercent=${options.minSuccessRatePercent}`,
          `crashFreePercent=${options.crashFreePercent}`,
          `minCrashFreePercent=${options.minCrashFreePercent}`,
        ],
      ),
      this.check(
        'capability-autopilot-canary-promotion:incidents-feedback',
        'incidentes e feedback saudaveis',
        options.p0IncidentCount === 0 &&
          options.p1IncidentCount <= options.maxP1Incidents &&
          !options.rollbackTriggered &&
          !options.rollbackRecommended &&
          options.supportLoadOk &&
          options.negativeFeedbackPercent <= options.maxNegativeFeedbackPercent
          ? 'pass'
          : 'fail',
        'Canary nao avanca com incidentes graves, rollback recomendado, suporte sobrecarregado ou feedback negativo acima do budget.',
        [
          `p0IncidentCount=${options.p0IncidentCount}`,
          `p1IncidentCount=${options.p1IncidentCount}`,
          `maxP1Incidents=${options.maxP1Incidents}`,
          `rollbackTriggered=${options.rollbackTriggered}`,
          `rollbackRecommended=${options.rollbackRecommended}`,
          `supportLoadOk=${options.supportLoadOk}`,
          `negativeFeedbackPercent=${options.negativeFeedbackPercent}`,
          `maxNegativeFeedbackPercent=${options.maxNegativeFeedbackPercent}`,
        ],
      ),
      this.check(
        'capability-autopilot-canary-promotion:promotion-controls',
        'promocao para proxima coorte controlada',
        options.canaryCohortStable &&
          options.promotionApproved &&
          options.nextCohortPercent > 0 &&
          options.nextCohortPercent <= options.maxNextCohortPercent
          ? 'pass'
          : 'fail',
        'Promocao exige coorte estavel, aprovacao explicita e proxima coorte dentro do teto.',
        [
          `canaryCohortStable=${options.canaryCohortStable}`,
          `promotionApproved=${options.promotionApproved}`,
          `nextCohortPercent=${options.nextCohortPercent}`,
          `maxNextCohortPercent=${options.maxNextCohortPercent}`,
        ],
      ),
      this.check(
        'capability-autopilot-canary-promotion:safeguards',
        'salvaguardas de canary ativas',
        options.rollbackRunbookReady &&
          options.observabilityReviewReady &&
          options.auditPersisted &&
          !options.autoPromoteEnabled &&
          !options.globalRolloutEnabled &&
          !options.skipApprovalEnabled
          ? 'pass'
          : 'fail',
        'Fase 83 permite promocao controlada, mas bloqueia auto-promote, rollout global e skip-approval.',
        [
          `rollbackRunbookReady=${options.rollbackRunbookReady}`,
          `observabilityReviewReady=${options.observabilityReviewReady}`,
          `auditPersisted=${options.auditPersisted}`,
          `autoPromoteEnabled=${options.autoPromoteEnabled}`,
          `globalRolloutEnabled=${options.globalRolloutEnabled}`,
          `skipApprovalEnabled=${options.skipApprovalEnabled}`,
        ],
      ),
      this.check(
        'capability-autopilot-canary-promotion:no-blockers',
        'sem blockers de canary',
        blockers.length === 0 ? 'pass' : 'fail',
        'Nao pode haver blocker agregado para promover canary.',
        blockers.length > 0 ? blockers : ['blockers=0'],
      ),
      this.check(
        'capability-autopilot-canary-promotion:no-raw-payload',
        'sem payload cru serializado',
        !serialized.includes('rawText') && !serialized.includes('normalizedText') ? 'pass' : 'fail',
        'Snapshot publico de canary promotion nao pode reintroduzir intent cru.',
        [
          `containsRawKeys=${String(serialized.includes('rawText') || serialized.includes('normalizedText'))}`,
        ],
      ),
    ];
  }

  private buildCanaryPromotionId(
    source: CapabilityAutopilotReleaseExecutionSnapshot,
    generatedAt: string,
    canaryPromotionReceiptId: string | null,
  ): string {
    const digest = createHash('sha256')
      .update([
        source.capabilityId,
        source.phase,
        source.releaseExecutionGateId,
        source.generatedAt,
        generatedAt,
        canaryPromotionReceiptId || '<none>',
      ].join('|'), 'utf8')
      .digest('hex')
      .slice(0, 16);
    return `${source.capabilityId}-canary-promotion-${digest}`;
  }

  private check(
    id: string,
    title: string,
    status: CapabilityAutopilotPreflightCheck['status'],
    reason: string,
    evidence: string[] = [],
  ): CapabilityAutopilotPreflightCheck {
    return {
      id,
      title,
      status,
      reason,
      evidence,
    };
  }
}
