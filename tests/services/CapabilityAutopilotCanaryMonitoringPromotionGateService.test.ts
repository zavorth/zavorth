import {
  CapabilityAutopilotCanaryMonitoringPromotionGateService,
  type CapabilityAutopilotCanaryPromotionOptions,
} from '../../src/services/CapabilityAutopilotCanaryMonitoringPromotionGateService';
import type { CapabilityAutopilotReleaseExecutionSnapshot } from '../../src/services/CapabilityAutopilotReleaseExecutionGateService';

const FIXED_NOW = new Date('2026-04-26T13:00:00.000Z');

const readyOptions: CapabilityAutopilotCanaryPromotionOptions = {
  canaryObservationComplete: true,
  observationWindowMinutes: 120,
  minObservationWindowMinutes: 60,
  telemetryFresh: true,
  metricsWindowComplete: true,
  errorRatePercent: 0.2,
  maxErrorRatePercent: 1,
  p95LatencyMs: 850,
  maxP95LatencyMs: 1200,
  successRatePercent: 99.5,
  minSuccessRatePercent: 99,
  crashFreePercent: 99.95,
  minCrashFreePercent: 99.9,
  p0IncidentCount: 0,
  p1IncidentCount: 0,
  maxP1Incidents: 0,
  rollbackTriggered: false,
  rollbackRecommended: false,
  supportLoadOk: true,
  negativeFeedbackPercent: 5,
  maxNegativeFeedbackPercent: 15,
  canaryCohortStable: true,
  promotionApproved: true,
  nextCohortPercent: 10,
  maxNextCohortPercent: 25,
  rollbackRunbookReady: true,
  observabilityReviewReady: true,
  auditPersisted: true,
  autoPromoteEnabled: false,
  globalRolloutEnabled: false,
  skipApprovalEnabled: false,
  actorId: 'canary-operator',
  canaryPromotionReceiptId: 'canary-promotion-1',
  observationWindowId: 'observation-window-1',
  telemetrySnapshotId: 'telemetry-snapshot-1',
  incidentReviewId: 'incident-review-1',
  feedbackSummaryId: 'feedback-summary-1',
  nextCohortId: 'next-cohort-1',
  promotionApprovalId: 'promotion-approval-1',
  rollbackRunbookId: 'rollback-runbook-1',
  observabilityReviewId: 'observability-review-1',
  auditReceiptId: 'audit-1',
  reason: 'checkpoint-83-test',
};

function createSource(
  overrides: Partial<CapabilityAutopilotReleaseExecutionSnapshot> = {},
): CapabilityAutopilotReleaseExecutionSnapshot {
  return {
    stage: '82',
    releaseExecutionGateId: 'executor-gemini-cli-release-execution-1',
    generatedAt: FIXED_NOW.toISOString(),
    surface: 'capability-autopilot-release-execution-gate',
    capabilityId: 'executor-gemini-cli',
    status: 'release_execution_ready',
    recommendation: 'execute_manual_v1_1_release',
    summary: {
      ok: true,
      passed: 8,
      warnings: 0,
      failed: 0,
    },
    sourceSnapshotStage: '81',
    sourceStatus: 'rollout_plan_ready',
    sourceRecommendation: 'prepare_manual_v1_1_rollout',
    executionIntent: {
      releaseExecutionApproved: true,
      manualOperatorPresent: true,
      releaseVersion: '1.1.0-rc.0',
      releaseTag: 'v1.1.0-rc.0',
      versionManifestReady: true,
      versionManifestId: 'version-manifest-1',
      releaseBranchClean: true,
    },
    publishGate: {
      tagCreationApproved: true,
      tagApprovalReceiptId: 'tag-approval-1',
      publishApproved: true,
      publishApprovalReceiptId: 'publish-approval-1',
    },
    artifacts: {
      releaseBundleVerified: true,
      artifactVerificationReceiptId: 'artifact-verify-1',
      signedArtifactsReady: true,
      provenanceReady: true,
      provenanceReceiptId: 'provenance-1',
      changelogFrozen: true,
      docsFrozen: true,
    },
    canary: {
      canaryLaunchApproved: true,
      canaryLaunchReceiptId: 'canary-launch-1',
      initialCanaryPercent: 5,
      maxInitialCanaryPercent: 5,
      canaryCohortReady: true,
      smokeBeforeCanaryPassed: true,
      smokeReceiptId: 'smoke-1',
    },
    rollbackAndObservability: {
      rollbackCheckpointReady: true,
      rollbackCheckpointId: 'rollback-checkpoint-1',
      rollbackDryRunPassed: true,
      rollbackDryRunReceiptId: 'rollback-dry-run-1',
      observabilityLive: true,
      observabilityDashboardId: 'observability-dashboard-1',
      incidentCommanderAssigned: true,
      incidentCommanderId: 'incident-commander-1',
      supportBridgeReady: true,
      supportBridgeId: 'support-bridge-1',
      auditSinkReady: true,
      auditReceiptId: 'audit-1',
    },
    safeguards: {
      autoExecuteEnabled: false,
      globalRolloutEnabled: false,
      skipCanaryEnabled: false,
    },
    blockers: [],
    checks: [],
    audit: {
      sourceGeneratedAt: FIXED_NOW.toISOString(),
      sourceRolloutPlanId: 'rollout-plan-1',
      actorId: 'release-operator',
      reason: 'checkpoint-82-test',
      executionGateReceiptId: 'execution-gate-1',
    },
    nextRecommendedGate: {
      stage: '83',
      title: 'Capability Autopilot v1.1 Canary Monitoring And Promotion Gate',
      reason: 'Monitor canary.',
    },
    metadata: {
      autoExecute: false,
      releaseExecutionReady: true,
    },
    ...overrides,
  };
}

function createService() {
  return new CapabilityAutopilotCanaryMonitoringPromotionGateService({
    now: () => FIXED_NOW,
  });
}

describe('CapabilityAutopilotCanaryMonitoringPromotionGateService', () => {
  it('recommends promoting canary when observation and health signals are ready', () => {
    const service = createService();
    const snapshot = service.buildCanaryPromotionSnapshot(createSource(), readyOptions);

    expect(snapshot).toMatchObject({
      stage: '83',
      status: 'canary_promotion_ready',
      recommendation: 'promote_canary_to_next_cohort',
      summary: {
        ok: true,
        failed: 0,
      },
      observation: {
        canaryObservationComplete: true,
        observationWindowMinutes: 120,
        minObservationWindowMinutes: 60,
        telemetryFresh: true,
        metricsWindowComplete: true,
      },
      health: {
        errorRatePercent: 0.2,
        maxErrorRatePercent: 1,
        successRatePercent: 99.5,
        minSuccessRatePercent: 99,
      },
      incidents: {
        p0IncidentCount: 0,
        p1IncidentCount: 0,
        rollbackTriggered: false,
        rollbackRecommended: false,
      },
      promotion: {
        canaryCohortStable: true,
        promotionApproved: true,
        nextCohortPercent: 10,
        maxNextCohortPercent: 25,
      },
      safeguards: {
        rollbackRunbookReady: true,
        observabilityReviewReady: true,
        auditPersisted: true,
        autoPromoteEnabled: false,
        globalRolloutEnabled: false,
      },
      metadata: {
        autoExecute: false,
        canaryPromotionReady: true,
      },
    });
    expect(snapshot.blockers).toEqual([]);
    expect(JSON.stringify(snapshot)).not.toContain('rawText');
    expect(JSON.stringify(snapshot)).not.toContain('normalizedText');
  });

  it('holds canary when release execution source is not ready', () => {
    const service = createService();
    const source = createSource({
      status: 'blocked',
      recommendation: 'hold_rollout_plan',
      summary: {
        ok: false,
        passed: 6,
        warnings: 0,
        failed: 1,
      },
    });

    const snapshot = service.buildCanaryPromotionSnapshot(source, readyOptions);

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.recommendation).toBe('hold_canary_or_rollback');
    expect(snapshot.blockers).toContain('source_release_execution_not_ready:blocked');
    expect(snapshot.checks.find((check) => check.id === 'capability-autopilot-canary-promotion:source-ready'))
      .toMatchObject({
        status: 'fail',
      });
  });

  it('blocks promotion when observation or health budgets fail', () => {
    const service = createService();
    const snapshot = service.buildCanaryPromotionSnapshot(createSource(), {
      ...readyOptions,
      canaryObservationComplete: false,
      observationWindowMinutes: 30,
      minObservationWindowMinutes: 60,
      telemetryFresh: false,
      metricsWindowComplete: false,
      errorRatePercent: 2,
      maxErrorRatePercent: 1,
      p95LatencyMs: 1500,
      maxP95LatencyMs: 1200,
      successRatePercent: 97,
      minSuccessRatePercent: 99,
      crashFreePercent: 99,
      minCrashFreePercent: 99.9,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.blockers).toEqual(expect.arrayContaining([
      'canary_observation_required',
      'observation_window_too_short',
      'telemetry_freshness_required',
      'metrics_window_required',
      'error_rate_budget_exceeded',
      'latency_budget_exceeded',
      'success_rate_threshold_not_met',
      'crash_free_threshold_not_met',
    ]));
  });

  it('blocks promotion when incidents, feedback or rollback signals fail', () => {
    const service = createService();
    const snapshot = service.buildCanaryPromotionSnapshot(createSource(), {
      ...readyOptions,
      p0IncidentCount: 1,
      p1IncidentCount: 2,
      maxP1Incidents: 0,
      rollbackTriggered: true,
      rollbackRecommended: true,
      supportLoadOk: false,
      negativeFeedbackPercent: 30,
      maxNegativeFeedbackPercent: 15,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.blockers).toEqual(expect.arrayContaining([
      'p0_incidents_present',
      'p1_incident_budget_exceeded',
      'rollback_already_triggered',
      'rollback_recommended',
      'support_load_not_ok',
      'negative_feedback_budget_exceeded',
    ]));
  });

  it('blocks promotion when approval, next cohort or safeguards fail', () => {
    const service = createService();
    const snapshot = service.buildCanaryPromotionSnapshot(createSource(), {
      ...readyOptions,
      canaryCohortStable: false,
      promotionApproved: false,
      nextCohortPercent: 50,
      maxNextCohortPercent: 25,
      rollbackRunbookReady: false,
      observabilityReviewReady: false,
      auditPersisted: false,
      autoPromoteEnabled: true,
      globalRolloutEnabled: true,
      skipApprovalEnabled: true,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.blockers).toEqual(expect.arrayContaining([
      'canary_cohort_not_stable',
      'promotion_approval_required',
      'next_cohort_percent_out_of_bounds',
      'rollback_runbook_required',
      'observability_review_required',
      'audit_persistence_required',
      'auto_promote_not_allowed',
      'global_rollout_not_allowed',
      'skip_approval_not_allowed',
    ]));
  });

  it('renders the consolidation step instead of opening another phase', () => {
    const service = createService();
    const snapshot = service.buildCanaryPromotionSnapshot(createSource(), readyOptions);

    expect(service.renderReport(snapshot)).toContain('Gate capability-autopilot-canary-monitoring-promotion - Capability Autopilot v1.1 Canary Monitoring And Promotion Gate');
    expect(service.renderReport(snapshot)).toContain('recommended next stage: consolidation - Capability Autopilot Release Readiness Consolidation');
  });
});
