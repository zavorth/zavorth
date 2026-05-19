import {
  CapabilityAutopilotReleaseCandidateGateService,
  type CapabilityAutopilotReleaseCandidateOptions,
} from '../../src/services/CapabilityAutopilotReleaseCandidateGateService';
import type { CapabilityAutopilotBetaFieldTrialSnapshot } from '../../src/services/CapabilityAutopilotBetaFieldTrialLoopService';

const FIXED_NOW = new Date('2026-04-26T10:00:00.000Z');

const readyOptions: CapabilityAutopilotReleaseCandidateOptions = {
  releaseCandidateApproved: true,
  fieldTrialCompleted: true,
  observedParticipants: 5,
  minObservedParticipants: 5,
  feedbackResponseCount: 5,
  minFeedbackResponses: 4,
  satisfactionScore: 92,
  minSatisfactionScore: 85,
  successCriteriaPassed: true,
  p0IncidentCount: 0,
  p1IncidentCount: 0,
  maxP1Incidents: 0,
  openRollbackRequiredCount: 0,
  rollbackRehearsalFresh: true,
  supportLoadOk: true,
  docsUpdated: true,
  releaseNotesReady: true,
  stagedRolloutPlanReady: true,
  killSwitchReady: true,
  telemetryReviewPassed: true,
  privacyReviewPassed: true,
  rcFlagDefaultOff: true,
  globalRolloutEnabled: false,
  autoPromoteEnabled: false,
  actorId: 'rc-operator',
  releaseCandidateReceiptId: 'release-candidate-1',
  trialReportId: 'trial-report-1',
  incidentReviewId: 'incident-review-1',
  rolloutPlanId: 'rollout-plan-1',
  killSwitchReceiptId: 'kill-switch-1',
  telemetryReviewId: 'telemetry-review-1',
  privacyReviewId: 'privacy-review-1',
  reason: 'checkpoint-80-test',
};

function createSource(
  overrides: Partial<CapabilityAutopilotBetaFieldTrialSnapshot> = {},
): CapabilityAutopilotBetaFieldTrialSnapshot {
  return {
    stage: '79',
    fieldTrialId: 'executor-gemini-cli-beta-field-trial-1',
    generatedAt: FIXED_NOW.toISOString(),
    surface: 'capability-autopilot-beta-field-trial-loop',
    capabilityId: 'executor-gemini-cli',
    status: 'field_trial_ready',
    recommendation: 'start_limited_beta_field_trial',
    summary: {
      ok: true,
      passed: 7,
      warnings: 0,
      failed: 0,
    },
    sourceSnapshotStage: '78',
    sourceStatus: 'beta_candidate_ready',
    sourceRecommendation: 'promote_to_beta_candidate',
    fieldTrialApproved: true,
    betaFlagDefaultOff: true,
    globalRolloutEnabled: false,
    autoEnrollEnabled: false,
    cohort: {
      cohortId: 'beta-cohort-limited-1',
      participantCount: 5,
      maxParticipants: 25,
      rolloutPercent: 5,
      rolloutLimitPercent: 10,
      limited: true,
    },
    feedbackLoop: {
      feedbackChannelReady: true,
      feedbackChannelId: 'feedback-channel-1',
      supportRotationReady: true,
      supportRotationId: 'support-rotation-1',
      successCriteriaDefined: true,
      successCriteriaId: 'success-criteria-1',
    },
    safetyControls: {
      rollbackRehearsalPassed: true,
      rollbackRehearsalReceiptId: 'rollback-rehearsal-1',
      incidentThresholdOk: true,
      telemetryOptInReady: true,
      privacyNoticeReady: true,
      privacyNoticeReceiptId: 'privacy-notice-1',
    },
    blockers: [],
    checks: [],
    audit: {
      sourceGeneratedAt: FIXED_NOW.toISOString(),
      sourceBetaReadinessId: 'beta-readiness-1',
      actorId: 'beta-operator',
      reason: 'checkpoint-79-test',
      fieldTrialReceiptId: 'field-trial-1',
    },
    nextRecommendedPhase: {
      phase: '80',
      title: 'Capability Autopilot Release Candidate Gate',
      reason: 'Decide release candidate.',
    },
    metadata: {
      autoExecute: false,
      fieldTrialReady: true,
    },
    ...overrides,
  };
}

function createService() {
  return new CapabilityAutopilotReleaseCandidateGateService({
    now: () => FIXED_NOW,
  });
}

describe('CapabilityAutopilotReleaseCandidateGateService', () => {
  it('recommends release candidate promotion when trial evidence and controls are ready', () => {
    const service = createService();
    const snapshot = service.buildReleaseCandidateSnapshot(createSource(), readyOptions);

    expect(snapshot).toMatchObject({
      phase: '80',
      status: 'release_candidate_ready',
      recommendation: 'promote_to_release_candidate',
      summary: {
        ok: true,
        failed: 0,
      },
      fieldTrialEvidence: {
        fieldTrialCompleted: true,
        observedParticipants: 5,
        minObservedParticipants: 5,
        feedbackResponseCount: 5,
        minFeedbackResponses: 4,
        satisfactionScore: 92,
        minSatisfactionScore: 85,
        successCriteriaPassed: true,
      },
      incidentReview: {
        p0IncidentCount: 0,
        p1IncidentCount: 0,
        openRollbackRequiredCount: 0,
      },
      readinessControls: {
        rollbackRehearsalFresh: true,
        supportLoadOk: true,
        stagedRolloutPlanReady: true,
        killSwitchReady: true,
      },
      governance: {
        telemetryReviewPassed: true,
        privacyReviewPassed: true,
        rcFlagDefaultOff: true,
        globalRolloutEnabled: false,
        autoPromoteEnabled: false,
      },
      metadata: {
        autoExecute: false,
        releaseCandidateReady: true,
      },
    });
    expect(snapshot.blockers).toEqual([]);
    expect(JSON.stringify(snapshot)).not.toContain('rawText');
    expect(JSON.stringify(snapshot)).not.toContain('normalizedText');
  });

  it('extends beta when field trial source is not ready', () => {
    const service = createService();
    const source = createSource({
      status: 'blocked',
      recommendation: 'hold_beta',
      summary: {
        ok: false,
        passed: 5,
        warnings: 0,
        failed: 1,
      },
    });

    const snapshot = service.buildReleaseCandidateSnapshot(source, readyOptions);

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.recommendation).toBe('extend_beta');
    expect(snapshot.blockers).toContain('source_field_trial_not_ready:blocked');
    expect(snapshot.checks.find((check) => check.id === 'capability-autopilot-release-candidate:source-ready'))
      .toMatchObject({
        status: 'fail',
      });
  });

  it('blocks release candidate when trial evidence is incomplete', () => {
    const service = createService();
    const snapshot = service.buildReleaseCandidateSnapshot(createSource(), {
      ...readyOptions,
      fieldTrialCompleted: false,
      observedParticipants: 3,
      minObservedParticipants: 5,
      feedbackResponseCount: 2,
      minFeedbackResponses: 4,
      satisfactionScore: 70,
      minSatisfactionScore: 85,
      successCriteriaPassed: false,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.blockers).toEqual(expect.arrayContaining([
      'field_trial_completion_required',
      'min_observed_participants_not_met',
      'min_feedback_responses_not_met',
      'satisfaction_threshold_not_met',
      'success_criteria_not_met',
    ]));
  });

  it('blocks release candidate when incidents or governance controls fail', () => {
    const service = createService();
    const snapshot = service.buildReleaseCandidateSnapshot(createSource(), {
      ...readyOptions,
      p0IncidentCount: 1,
      p1IncidentCount: 2,
      maxP1Incidents: 0,
      openRollbackRequiredCount: 1,
      rollbackRehearsalFresh: false,
      killSwitchReady: false,
      telemetryReviewPassed: false,
      privacyReviewPassed: false,
      rcFlagDefaultOff: false,
      globalRolloutEnabled: true,
      autoPromoteEnabled: true,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.blockers).toEqual(expect.arrayContaining([
      'p0_incidents_present',
      'p1_incident_budget_exceeded',
      'open_rollback_required',
      'rollback_rehearsal_refresh_required',
      'kill_switch_required',
      'telemetry_review_required',
      'privacy_review_required',
      'rc_flag_default_off_required',
      'global_rollout_not_allowed',
      'auto_promote_not_allowed',
    ]));
  });

  it('renders the next phase for v1.1 release rollout plan', () => {
    const service = createService();
    const snapshot = service.buildReleaseCandidateSnapshot(createSource(), readyOptions);

    expect(service.renderReport(snapshot)).toContain('Etapa 80 - Capability Autopilot Release Candidate Gate');
    expect(service.renderReport(snapshot)).toContain('proximo passo recomendada: 81 - Capability Autopilot v1.1 Release Rollout Plan');
  });
});
