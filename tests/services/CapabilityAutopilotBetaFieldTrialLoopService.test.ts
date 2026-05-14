import {
  CapabilityAutopilotBetaFieldTrialLoopService,
  type CapabilityAutopilotBetaFieldTrialOptions,
} from '../../src/services/CapabilityAutopilotBetaFieldTrialLoopService';
import type { CapabilityAutopilotBetaReadinessSnapshot } from '../../src/services/CapabilityAutopilotBetaReadinessGateService';

const FIXED_NOW = new Date('2026-04-26T09:00:00.000Z');

const readyOptions: CapabilityAutopilotBetaFieldTrialOptions = {
  fieldTrialApproved: true,
  participantCount: 5,
  maxParticipants: 25,
  rolloutPercent: 5,
  rolloutLimitPercent: 10,
  feedbackChannelReady: true,
  supportRotationReady: true,
  successCriteriaDefined: true,
  rollbackRehearsalPassed: true,
  incidentThresholdOk: true,
  telemetryOptInReady: true,
  privacyNoticeReady: true,
  betaFlagDefaultOff: true,
  globalRolloutEnabled: false,
  autoEnrollEnabled: false,
  actorId: 'beta-operator',
  fieldTrialReceiptId: 'field-trial-1',
  cohortId: 'beta-cohort-limited-1',
  feedbackChannelId: 'feedback-channel-1',
  supportRotationId: 'support-rotation-1',
  rollbackRehearsalReceiptId: 'rollback-rehearsal-1',
  successCriteriaId: 'success-criteria-1',
  privacyNoticeReceiptId: 'privacy-notice-1',
  reason: 'phase-79-test',
};

function createSource(
  overrides: Partial<CapabilityAutopilotBetaReadinessSnapshot> = {},
): CapabilityAutopilotBetaReadinessSnapshot {
  return {
    phase: '78',
    betaReadinessId: 'executor-gemini-cli-beta-readiness-1',
    generatedAt: FIXED_NOW.toISOString(),
    surface: 'capability-autopilot-beta-readiness-gate',
    capabilityId: 'executor-gemini-cli',
    status: 'beta_candidate_ready',
    recommendation: 'promote_to_beta_candidate',
    summary: {
      ok: true,
      passed: 7,
      warnings: 0,
      failed: 0,
    },
    sourceSnapshotPhase: '77',
    sourceStatus: 'ready',
    betaChecklistApproved: true,
    releaseNotesReady: true,
    featureFlagDefaultOff: true,
    rollbackDrillReady: true,
    telemetryOptInReady: true,
    docsUpdated: true,
    minVerifiedEntries: 2,
    verifiedEntries: 2,
    rollbackRequiredEntries: 2,
    rollbackAvailableEntries: 2,
    rollbackInvokedEntries: 0,
    auditPersistedEntries: 2,
    rollbackLedgerPersistedEntries: 2,
    entrySummaries: [],
    blockers: [],
    checks: [],
    releaseControls: {
      betaReadinessReceiptId: 'beta-readiness-1',
      releaseChecklistId: 'release-checklist-1',
      flagPolicyId: 'flag-policy-1',
      rollbackDrillReceiptId: 'rollback-drill-1',
      telemetryReceiptId: 'telemetry-1',
      docsReceiptId: 'docs-1',
    },
    audit: {
      sourceGeneratedAt: FIXED_NOW.toISOString(),
      actorId: 'release-operator',
      reason: 'phase-78-test',
    },
    nextRecommendedPhase: {
      phase: '79',
      title: 'Capability Autopilot Beta Field Trial Loop',
      reason: 'Operate limited beta field trial.',
    },
    metadata: {
      autoExecute: false,
      betaCandidateReady: true,
    },
    ...overrides,
  };
}

function createService() {
  return new CapabilityAutopilotBetaFieldTrialLoopService({
    now: () => FIXED_NOW,
  });
}

describe('CapabilityAutopilotBetaFieldTrialLoopService', () => {
  it('recommends starting a limited beta field trial when source and controls are ready', () => {
    const service = createService();
    const snapshot = service.buildFieldTrialSnapshot(createSource(), readyOptions);

    expect(snapshot).toMatchObject({
      phase: '79',
      status: 'field_trial_ready',
      recommendation: 'start_limited_beta_field_trial',
      summary: {
        ok: true,
        failed: 0,
      },
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
        supportRotationReady: true,
        successCriteriaDefined: true,
      },
      safetyControls: {
        rollbackRehearsalPassed: true,
        incidentThresholdOk: true,
        privacyNoticeReady: true,
      },
      metadata: {
        autoExecute: false,
        fieldTrialReady: true,
        limitedCohort: true,
      },
    });
    expect(snapshot.blockers).toEqual([]);
    expect(JSON.stringify(snapshot)).not.toContain('rawText');
    expect(JSON.stringify(snapshot)).not.toContain('normalizedText');
  });

  it('holds beta when beta readiness source is not promotable', () => {
    const service = createService();
    const source = createSource({
      status: 'blocked',
      recommendation: 'stay_alpha',
      summary: {
        ok: false,
        passed: 5,
        warnings: 0,
        failed: 1,
      },
    });

    const snapshot = service.buildFieldTrialSnapshot(source, readyOptions);

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.recommendation).toBe('hold_beta');
    expect(snapshot.blockers).toContain('source_beta_readiness_not_ready:blocked');
    expect(snapshot.checks.find((check) => check.id === 'capability-autopilot-beta-field-trial:source-ready'))
      .toMatchObject({
        status: 'fail',
      });
  });

  it('blocks field trial when cohort or rollout limits are exceeded', () => {
    const service = createService();
    const snapshot = service.buildFieldTrialSnapshot(createSource(), {
      ...readyOptions,
      participantCount: 30,
      maxParticipants: 25,
      rolloutPercent: 20,
      rolloutLimitPercent: 10,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.blockers).toEqual(expect.arrayContaining([
      'participant_cap_exceeded',
      'rollout_percent_out_of_bounds',
    ]));
    expect(snapshot.cohort.limited).toBe(false);
  });

  it('blocks field trial when feedback, rollback or privacy controls are missing', () => {
    const service = createService();
    const snapshot = service.buildFieldTrialSnapshot(createSource(), {
      ...readyOptions,
      feedbackChannelReady: false,
      supportRotationReady: false,
      rollbackRehearsalPassed: false,
      privacyNoticeReady: false,
      globalRolloutEnabled: true,
      autoEnrollEnabled: true,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.blockers).toEqual(expect.arrayContaining([
      'feedback_channel_required',
      'support_rotation_required',
      'rollback_rehearsal_required',
      'privacy_notice_required',
      'global_rollout_not_allowed',
      'auto_enroll_not_allowed',
    ]));
  });

  it('renders the next phase for release candidate gate', () => {
    const service = createService();
    const snapshot = service.buildFieldTrialSnapshot(createSource(), readyOptions);

    expect(service.renderReport(snapshot)).toContain('Fase 79 - Capability Autopilot Beta Field Trial Loop');
    expect(service.renderReport(snapshot)).toContain('proxima fase recomendada: 80 - Capability Autopilot Release Candidate Gate');
  });
});
