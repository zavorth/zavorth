import {
  CapabilityAutopilotReleaseRolloutPlanService,
  type CapabilityAutopilotReleaseRolloutPlanOptions,
} from '../../src/services/CapabilityAutopilotReleaseRolloutPlanService';
import type { CapabilityAutopilotReleaseCandidateSnapshot } from '../../src/services/CapabilityAutopilotReleaseCandidateGateService';

const FIXED_NOW = new Date('2026-04-26T11:00:00.000Z');

const readyOptions: CapabilityAutopilotReleaseRolloutPlanOptions = {
  rolloutPlanApproved: true,
  stagedCohortsDefined: true,
  canaryPercent: 5,
  maxCanaryPercent: 10,
  expansionStepCount: 3,
  minExpansionStepCount: 3,
  rollbackWindowHours: 48,
  minRollbackWindowHours: 24,
  rollbackRunbookReady: true,
  changelogReady: true,
  releaseBundleReady: true,
  installerSmokePassed: true,
  docsPublicationReady: true,
  supportCommsReady: true,
  statusPageDraftReady: true,
  telemetryDashboardsReady: true,
  releaseOwnerAssigned: true,
  releaseTrainSlotReserved: true,
  artifactRetentionReady: true,
  manualPromotionRequired: true,
  rcFlagDefaultOff: true,
  publishTagEnabled: false,
  globalRolloutEnabled: false,
  autoRolloutEnabled: false,
  actorId: 'rollout-operator',
  rolloutPlanReceiptId: 'rollout-plan-1',
  canaryCohortId: 'canary-cohort-1',
  stagedCohortPlanId: 'staged-cohorts-1',
  rollbackRunbookId: 'rollback-runbook-1',
  changelogId: 'changelog-1',
  releaseBundleId: 'release-bundle-1',
  installerSmokeReceiptId: 'installer-smoke-1',
  docsPublicationId: 'docs-publication-1',
  commsPlanId: 'comms-plan-1',
  telemetryDashboardId: 'telemetry-dashboard-1',
  releaseOwnerId: 'release-owner-1',
  releaseTrainSlotId: 'release-train-slot-1',
  artifactRetentionPolicyId: 'artifact-retention-1',
  reason: 'phase-81-test',
};

function createSource(
  overrides: Partial<CapabilityAutopilotReleaseCandidateSnapshot> = {},
): CapabilityAutopilotReleaseCandidateSnapshot {
  return {
    phase: '80',
    releaseCandidateGateId: 'executor-gemini-cli-release-candidate-1',
    generatedAt: FIXED_NOW.toISOString(),
    surface: 'capability-autopilot-release-candidate-gate',
    capabilityId: 'executor-gemini-cli',
    status: 'release_candidate_ready',
    recommendation: 'promote_to_release_candidate',
    summary: {
      ok: true,
      passed: 7,
      warnings: 0,
      failed: 0,
    },
    sourceSnapshotPhase: '79',
    sourceStatus: 'field_trial_ready',
    sourceRecommendation: 'start_limited_beta_field_trial',
    releaseCandidateApproved: true,
    fieldTrialEvidence: {
      fieldTrialCompleted: true,
      observedParticipants: 5,
      minObservedParticipants: 5,
      feedbackResponseCount: 5,
      minFeedbackResponses: 4,
      satisfactionScore: 92,
      minSatisfactionScore: 85,
      successCriteriaPassed: true,
      trialReportId: 'trial-report-1',
    },
    incidentReview: {
      p0IncidentCount: 0,
      p1IncidentCount: 0,
      maxP1Incidents: 0,
      openRollbackRequiredCount: 0,
      incidentReviewId: 'incident-review-1',
    },
    readinessControls: {
      rollbackRehearsalFresh: true,
      supportLoadOk: true,
      docsUpdated: true,
      releaseNotesReady: true,
      stagedRolloutPlanReady: true,
      killSwitchReady: true,
      rolloutPlanId: 'rollout-plan-rc-1',
      killSwitchReceiptId: 'kill-switch-1',
    },
    governance: {
      telemetryReviewPassed: true,
      privacyReviewPassed: true,
      rcFlagDefaultOff: true,
      globalRolloutEnabled: false,
      autoPromoteEnabled: false,
      telemetryReviewId: 'telemetry-review-1',
      privacyReviewId: 'privacy-review-1',
    },
    blockers: [],
    checks: [],
    audit: {
      sourceGeneratedAt: FIXED_NOW.toISOString(),
      sourceFieldTrialId: 'field-trial-1',
      actorId: 'rc-operator',
      reason: 'phase-80-test',
      releaseCandidateReceiptId: 'release-candidate-1',
    },
    nextRecommendedPhase: {
      phase: '81',
      title: 'Capability Autopilot v1.1 Release Rollout Plan',
      reason: 'Prepare rollout plan.',
    },
    metadata: {
      autoExecute: false,
      releaseCandidateReady: true,
    },
    ...overrides,
  };
}

function createService() {
  return new CapabilityAutopilotReleaseRolloutPlanService({
    now: () => FIXED_NOW,
  });
}

describe('CapabilityAutopilotReleaseRolloutPlanService', () => {
  it('recommends preparing manual v1.1 rollout when RC source and plan controls are ready', () => {
    const service = createService();
    const snapshot = service.buildRolloutPlanSnapshot(createSource(), readyOptions);

    expect(snapshot).toMatchObject({
      phase: '81',
      status: 'rollout_plan_ready',
      recommendation: 'prepare_manual_v1_1_rollout',
      summary: {
        ok: true,
        failed: 0,
      },
      rollout: {
        stagedCohortsDefined: true,
        canaryPercent: 5,
        maxCanaryPercent: 10,
        expansionStepCount: 3,
        minExpansionStepCount: 3,
        rollbackWindowHours: 48,
        minRollbackWindowHours: 24,
        limitedCanary: true,
      },
      releaseAssets: {
        changelogReady: true,
        releaseBundleReady: true,
        installerSmokePassed: true,
        docsPublicationReady: true,
      },
      operations: {
        rollbackRunbookReady: true,
        supportCommsReady: true,
        telemetryDashboardsReady: true,
        releaseOwnerAssigned: true,
      },
      safeguards: {
        manualPromotionRequired: true,
        rcFlagDefaultOff: true,
        publishTagEnabled: false,
        globalRolloutEnabled: false,
        autoRolloutEnabled: false,
      },
      metadata: {
        autoExecute: false,
        rolloutPlanReady: true,
      },
    });
    expect(snapshot.blockers).toEqual([]);
    expect(JSON.stringify(snapshot)).not.toContain('rawText');
    expect(JSON.stringify(snapshot)).not.toContain('normalizedText');
  });

  it('holds release candidate when source is not RC-ready', () => {
    const service = createService();
    const source = createSource({
      status: 'blocked',
      recommendation: 'extend_beta',
      summary: {
        ok: false,
        passed: 5,
        warnings: 0,
        failed: 1,
      },
    });

    const snapshot = service.buildRolloutPlanSnapshot(source, readyOptions);

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.recommendation).toBe('hold_release_candidate');
    expect(snapshot.blockers).toContain('source_release_candidate_not_ready:blocked');
    expect(snapshot.checks.find((check) => check.id === 'capability-autopilot-release-rollout:source-ready'))
      .toMatchObject({
        status: 'fail',
      });
  });

  it('blocks rollout plan when staged canary or rollback window is unsafe', () => {
    const service = createService();
    const snapshot = service.buildRolloutPlanSnapshot(createSource(), {
      ...readyOptions,
      stagedCohortsDefined: false,
      canaryPercent: 20,
      maxCanaryPercent: 10,
      expansionStepCount: 1,
      minExpansionStepCount: 3,
      rollbackWindowHours: 6,
      minRollbackWindowHours: 24,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.rollout.limitedCanary).toBe(false);
    expect(snapshot.blockers).toEqual(expect.arrayContaining([
      'staged_cohorts_required',
      'canary_percent_out_of_bounds',
      'expansion_steps_not_defined',
      'rollback_window_too_short',
    ]));
  });

  it('blocks rollout plan when assets, operations or safeguards are missing', () => {
    const service = createService();
    const snapshot = service.buildRolloutPlanSnapshot(createSource(), {
      ...readyOptions,
      changelogReady: false,
      releaseBundleReady: false,
      rollbackRunbookReady: false,
      telemetryDashboardsReady: false,
      releaseOwnerAssigned: false,
      manualPromotionRequired: false,
      rcFlagDefaultOff: false,
      publishTagEnabled: true,
      globalRolloutEnabled: true,
      autoRolloutEnabled: true,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.blockers).toEqual(expect.arrayContaining([
      'changelog_required',
      'release_bundle_required',
      'rollback_runbook_required',
      'telemetry_dashboards_required',
      'release_owner_required',
      'manual_promotion_required',
      'rc_flag_default_off_required',
      'publish_tag_not_allowed_in_plan',
      'global_rollout_not_allowed',
      'auto_rollout_not_allowed',
    ]));
  });

  it('renders the next phase for release execution gate', () => {
    const service = createService();
    const snapshot = service.buildRolloutPlanSnapshot(createSource(), readyOptions);

    expect(service.renderReport(snapshot)).toContain('Fase 81 - Capability Autopilot v1.1 Release Rollout Plan');
    expect(service.renderReport(snapshot)).toContain('proxima fase recomendada: 82 - Capability Autopilot v1.1 Release Execution Gate');
  });
});
