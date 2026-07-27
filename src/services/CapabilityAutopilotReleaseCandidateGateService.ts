import { createHash } from 'crypto';
import type { CapabilityAutopilotPreflightCheck } from './CapabilityAutopilotPreflightEntrypointService.js';
import type { CapabilityAutopilotBetaFieldTrialSnapshot } from './CapabilityAutopilotBetaFieldTrialLoopService.js';

export type CapabilityAutopilotReleaseCandidateStatus =
  | 'release_candidate_ready'
  | 'blocked';

export type CapabilityAutopilotReleaseCandidateRecommendation =
  | 'promote_to_release_candidate'
  | 'extend_beta';

export type CapabilityAutopilotReleaseCandidateOptions = {
  releaseCandidateApproved?: boolean;
  fieldTrialCompleted?: boolean;
  observedParticipants?: number;
  minObservedParticipants?: number;
  feedbackResponseCount?: number;
  minFeedbackResponses?: number;
  satisfactionScore?: number;
  minSatisfactionScore?: number;
  successCriteriaPassed?: boolean;
  p0IncidentCount?: number;
  p1IncidentCount?: number;
  maxP1Incidents?: number;
  openRollbackRequiredCount?: number;
  rollbackRehearsalFresh?: boolean;
  supportLoadOk?: boolean;
  docsUpdated?: boolean;
  releaseNotesReady?: boolean;
  stagedRolloutPlanReady?: boolean;
  killSwitchReady?: boolean;
  telemetryReviewPassed?: boolean;
  privacyReviewPassed?: boolean;
  rcFlagDefaultOff?: boolean;
  globalRolloutEnabled?: boolean;
  autoPromoteEnabled?: boolean;
  actorId?: string | null;
  releaseCandidateReceiptId?: string | null;
  trialReportId?: string | null;
  incidentReviewId?: string | null;
  rolloutPlanId?: string | null;
  killSwitchReceiptId?: string | null;
  telemetryReviewId?: string | null;
  privacyReviewId?: string | null;
  reason?: string | null;
};

export type CapabilityAutopilotReleaseCandidateSnapshot = {
  gate: 'capability-autopilot-release-candidate';
  releaseCandidateGateId: string;
  generatedAt: string;
  surface: 'capability-autopilot-release-candidate-gate';
  capabilityId: string;
  status: CapabilityAutopilotReleaseCandidateStatus;
  recommendation: CapabilityAutopilotReleaseCandidateRecommendation;
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  sourceSnapshotGate: CapabilityAutopilotBetaFieldTrialSnapshot['gate'];
  sourceStatus: CapabilityAutopilotBetaFieldTrialSnapshot['status'];
  sourceRecommendation: CapabilityAutopilotBetaFieldTrialSnapshot['recommendation'];
  releaseCandidateApproved: boolean;
  fieldTrialEvidence: {
    fieldTrialCompleted: boolean;
    observedParticipants: number;
    minObservedParticipants: number;
    feedbackResponseCount: number;
    minFeedbackResponses: number;
    satisfactionScore: number;
    minSatisfactionScore: number;
    successCriteriaPassed: boolean;
    trialReportId: string | null;
  };
  incidentReview: {
    p0IncidentCount: number;
    p1IncidentCount: number;
    maxP1Incidents: number;
    openRollbackRequiredCount: number;
    incidentReviewId: string | null;
  };
  readinessControls: {
    rollbackRehearsalFresh: boolean;
    supportLoadOk: boolean;
    docsUpdated: boolean;
    releaseNotesReady: boolean;
    stagedRolloutPlanReady: boolean;
    killSwitchReady: boolean;
    rolloutPlanId: string | null;
    killSwitchReceiptId: string | null;
  };
  governance: {
    telemetryReviewPassed: boolean;
    privacyReviewPassed: boolean;
    rcFlagDefaultOff: boolean;
    globalRolloutEnabled: boolean;
    autoPromoteEnabled: boolean;
    telemetryReviewId: string | null;
    privacyReviewId: string | null;
  };
  blockers: string[];
  checks: CapabilityAutopilotPreflightCheck[];
  audit: {
    sourceGeneratedAt: string;
    sourceFieldTrialId: string;
    actorId: string | null;
    reason: string | null;
    releaseCandidateReceiptId: string | null;
  };
  nextRecommendedGate: {
    gate: 'capability-autopilot-release-rollout-plan';
    title: string;
    reason: string;
  };
  metadata: Record<string, unknown>;
};

export type CapabilityAutopilotReleaseCandidateGateRuntime = {
  now?: () => Date;
};

type ResolvedOptions = {
  releaseCandidateApproved: boolean;
  fieldTrialCompleted: boolean;
  observedParticipants: number;
  minObservedParticipants: number;
  feedbackResponseCount: number;
  minFeedbackResponses: number;
  satisfactionScore: number;
  minSatisfactionScore: number;
  successCriteriaPassed: boolean;
  p0IncidentCount: number;
  p1IncidentCount: number;
  maxP1Incidents: number;
  openRollbackRequiredCount: number;
  rollbackRehearsalFresh: boolean;
  supportLoadOk: boolean;
  docsUpdated: boolean;
  releaseNotesReady: boolean;
  stagedRolloutPlanReady: boolean;
  killSwitchReady: boolean;
  telemetryReviewPassed: boolean;
  privacyReviewPassed: boolean;
  rcFlagDefaultOff: boolean;
  globalRolloutEnabled: boolean;
  autoPromoteEnabled: boolean;
};

export class CapabilityAutopilotReleaseCandidateGateService {
  private readonly now: () => Date;

  constructor(runtime: CapabilityAutopilotReleaseCandidateGateRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildReleaseCandidateSnapshot(
    source: CapabilityAutopilotBetaFieldTrialSnapshot,
    options: CapabilityAutopilotReleaseCandidateOptions = {},
  ): CapabilityAutopilotReleaseCandidateSnapshot {
    const generatedAt = this.now().toISOString();
    const resolved = this.resolveOptions(source, options);
    const blockers = this.resolveBlockers(source, resolved);
    const checks = this.buildChecks(source, resolved, blockers);
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;
    const status: CapabilityAutopilotReleaseCandidateStatus = failed > 0 || blockers.length > 0
      ? 'blocked'
      : 'release_candidate_ready';
    const recommendation: CapabilityAutopilotReleaseCandidateRecommendation = status === 'release_candidate_ready'
      ? 'promote_to_release_candidate'
      : 'extend_beta';

    return {
      gate: 'capability-autopilot-release-candidate',
      releaseCandidateGateId: this.buildReleaseCandidateGateId(source, generatedAt, options.releaseCandidateReceiptId || null),
      generatedAt,
      surface: 'capability-autopilot-release-candidate-gate',
      capabilityId: source.capabilityId,
      status,
      recommendation,
      summary: {
        ok: status === 'release_candidate_ready',
        passed,
        warnings,
        failed,
      },
      sourceSnapshotGate: source.gate,
      sourceStatus: source.status,
      sourceRecommendation: source.recommendation,
      releaseCandidateApproved: resolved.releaseCandidateApproved,
      fieldTrialEvidence: {
        fieldTrialCompleted: resolved.fieldTrialCompleted,
        observedParticipants: resolved.observedParticipants,
        minObservedParticipants: resolved.minObservedParticipants,
        feedbackResponseCount: resolved.feedbackResponseCount,
        minFeedbackResponses: resolved.minFeedbackResponses,
        satisfactionScore: resolved.satisfactionScore,
        minSatisfactionScore: resolved.minSatisfactionScore,
        successCriteriaPassed: resolved.successCriteriaPassed,
        trialReportId: options.trialReportId || null,
      },
      incidentReview: {
        p0IncidentCount: resolved.p0IncidentCount,
        p1IncidentCount: resolved.p1IncidentCount,
        maxP1Incidents: resolved.maxP1Incidents,
        openRollbackRequiredCount: resolved.openRollbackRequiredCount,
        incidentReviewId: options.incidentReviewId || null,
      },
      readinessControls: {
        rollbackRehearsalFresh: resolved.rollbackRehearsalFresh,
        supportLoadOk: resolved.supportLoadOk,
        docsUpdated: resolved.docsUpdated,
        releaseNotesReady: resolved.releaseNotesReady,
        stagedRolloutPlanReady: resolved.stagedRolloutPlanReady,
        killSwitchReady: resolved.killSwitchReady,
        rolloutPlanId: options.rolloutPlanId || null,
        killSwitchReceiptId: options.killSwitchReceiptId || null,
      },
      governance: {
        telemetryReviewPassed: resolved.telemetryReviewPassed,
        privacyReviewPassed: resolved.privacyReviewPassed,
        rcFlagDefaultOff: resolved.rcFlagDefaultOff,
        globalRolloutEnabled: resolved.globalRolloutEnabled,
        autoPromoteEnabled: resolved.autoPromoteEnabled,
        telemetryReviewId: options.telemetryReviewId || null,
        privacyReviewId: options.privacyReviewId || null,
      },
      blockers,
      checks,
      audit: {
        sourceGeneratedAt: source.generatedAt,
        sourceFieldTrialId: source.fieldTrialId,
        actorId: options.actorId || null,
        reason: options.reason || null,
        releaseCandidateReceiptId: options.releaseCandidateReceiptId || null,
      },
      nextRecommendedGate: {
        gate: 'capability-autopilot-release-rollout-plan',
        title: 'Capability Autopilot v1.1 Release Rollout Plan',
        reason:
          'after do release candidate, o next passo e preparar rollout gradual de v1.1 com cohorts, rollback, changelog e promotion manual.',
      },
      metadata: {
        gate: 'capability-autopilot-release-candidate',
        sourceSnapshotStatus: source.status,
        sourceRecommendation: source.recommendation,
        autoExecute: false,
        recommendation,
        releaseCandidateReady: status === 'release_candidate_ready',
        observedParticipants: resolved.observedParticipants,
        feedbackResponseCount: resolved.feedbackResponseCount,
        satisfactionScore: resolved.satisfactionScore,
        p0IncidentCount: resolved.p0IncidentCount,
        p1IncidentCount: resolved.p1IncidentCount,
        globalRolloutEnabled: resolved.globalRolloutEnabled,
        autoPromoteEnabled: resolved.autoPromoteEnabled,
      },
    };
  }

  public renderReport(snapshot: CapabilityAutopilotReleaseCandidateSnapshot): string {
    const lines: string[] = [];
    lines.push('[capability-autopilot-release-candidate] Capability Autopilot Release Candidate Gate');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`recommendation: ${snapshot.recommendation}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`capability: ${snapshot.capabilityId}`);
    lines.push(`trial: participants=${snapshot.fieldTrialEvidence.observedParticipants}/${snapshot.fieldTrialEvidence.minObservedParticipants} feedback=${snapshot.fieldTrialEvidence.feedbackResponseCount}/${snapshot.fieldTrialEvidence.minFeedbackResponses} satisfaction=${snapshot.fieldTrialEvidence.satisfactionScore}/${snapshot.fieldTrialEvidence.minSatisfactionScore}`);
    lines.push(`incidents: p0=${snapshot.incidentReview.p0IncidentCount} p1=${snapshot.incidentReview.p1IncidentCount}/${snapshot.incidentReview.maxP1Incidents} rollbackOpen=${snapshot.incidentReview.openRollbackRequiredCount}`);
    lines.push('');
    for (const item of snapshot.checks) {
      lines.push(`[${item.status}] ${item.title}`);
      lines.push(`  ${item.reason}`);
      for (const evidence of item.evidence) {
        lines.push(`  - ${evidence}`);
      }
    }
    lines.push('');
    lines.push(`next passo recomendada: ${snapshot.nextRecommendedGate.gate} - ${snapshot.nextRecommendedGate.title}`);
    lines.push(snapshot.nextRecommendedGate.reason);
    return lines.join('\n');
  }

  private resolveOptions(
    source: CapabilityAutopilotBetaFieldTrialSnapshot,
    options: CapabilityAutopilotReleaseCandidateOptions,
  ): ResolvedOptions {
    return {
      releaseCandidateApproved: options.releaseCandidateApproved === true,
      fieldTrialCompleted: options.fieldTrialCompleted === true,
      observedParticipants: this.resolveNumber(options.observedParticipants, source.cohort.participantCount),
      minObservedParticipants: this.resolveNumber(options.minObservedParticipants, source.cohort.participantCount),
      feedbackResponseCount: this.resolveNumber(options.feedbackResponseCount, source.cohort.participantCount),
      minFeedbackResponses: this.resolveNumber(options.minFeedbackResponses, Math.max(1, source.cohort.participantCount)),
      satisfactionScore: this.resolveNumber(options.satisfactionScore, 0),
      minSatisfactionScore: this.resolveNumber(options.minSatisfactionScore, 0),
      successCriteriaPassed: options.successCriteriaPassed === true,
      p0IncidentCount: this.resolveNumber(options.p0IncidentCount, 0),
      p1IncidentCount: this.resolveNumber(options.p1IncidentCount, 0),
      maxP1Incidents: this.resolveNumber(options.maxP1Incidents, 0),
      openRollbackRequiredCount: this.resolveNumber(options.openRollbackRequiredCount, 0),
      rollbackRehearsalFresh: options.rollbackRehearsalFresh === true,
      supportLoadOk: options.supportLoadOk === true,
      docsUpdated: options.docsUpdated === true,
      releaseNotesReady: options.releaseNotesReady === true,
      stagedRolloutPlanReady: options.stagedRolloutPlanReady === true,
      killSwitchReady: options.killSwitchReady === true,
      telemetryReviewPassed: options.telemetryReviewPassed === true,
      privacyReviewPassed: options.privacyReviewPassed === true,
      rcFlagDefaultOff: options.rcFlagDefaultOff === true,
      globalRolloutEnabled: options.globalRolloutEnabled === true,
      autoPromoteEnabled: options.autoPromoteEnabled === true,
    };
  }

  private resolveNumber(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private resolveBlockers(
    source: CapabilityAutopilotBetaFieldTrialSnapshot,
    options: ResolvedOptions,
  ): string[] {
    const blockers: string[] = [];
    if (
      source.status !== 'field_trial_ready' ||
      source.recommendation !== 'start_limited_beta_field_trial' ||
      !source.summary.ok
    ) {
      blockers.push(`source_field_trial_not_ready:${source.status}`);
    }
    if (!options.releaseCandidateApproved) {
      blockers.push('release_candidate_approval_required');
    }
    if (!options.fieldTrialCompleted) {
      blockers.push('field_trial_completion_required');
    }
    if (options.observedParticipants < options.minObservedParticipants || options.minObservedParticipants <= 0) {
      blockers.push('min_observed_participants_not_met');
    }
    if (options.feedbackResponseCount < options.minFeedbackResponses || options.minFeedbackResponses <= 0) {
      blockers.push('min_feedback_responses_not_met');
    }
    if (options.satisfactionScore < options.minSatisfactionScore) {
      blockers.push('satisfaction_threshold_not_met');
    }
    if (!options.successCriteriaPassed) {
      blockers.push('success_criteria_not_met');
    }
    if (options.p0IncidentCount > 0) {
      blockers.push('p0_incidents_present');
    }
    if (options.p1IncidentCount > options.maxP1Incidents) {
      blockers.push('p1_incident_budget_exceeded');
    }
    if (options.openRollbackRequiredCount > 0) {
      blockers.push('open_rollback_required');
    }
    if (!options.rollbackRehearsalFresh) {
      blockers.push('rollback_rehearsal_refresh_required');
    }
    if (!options.supportLoadOk) {
      blockers.push('support_load_not_ok');
    }
    if (!options.docsUpdated) {
      blockers.push('docs_update_required');
    }
    if (!options.releaseNotesReady) {
      blockers.push('release_notes_required');
    }
    if (!options.stagedRolloutPlanReady) {
      blockers.push('staged_rollout_plan_required');
    }
    if (!options.killSwitchReady) {
      blockers.push('kill_switch_required');
    }
    if (!options.telemetryReviewPassed) {
      blockers.push('telemetry_review_required');
    }
    if (!options.privacyReviewPassed) {
      blockers.push('privacy_review_required');
    }
    if (!options.rcFlagDefaultOff) {
      blockers.push('rc_flag_default_off_required');
    }
    if (options.globalRolloutEnabled) {
      blockers.push('global_rollout_not_allowed');
    }
    if (options.autoPromoteEnabled) {
      blockers.push('auto_promote_not_allowed');
    }
    return Array.from(new Set(blockers));
  }

  private buildChecks(
    source: CapabilityAutopilotBetaFieldTrialSnapshot,
    options: ResolvedOptions,
    blockers: string[],
  ): CapabilityAutopilotPreflightCheck[] {
    const serialized = JSON.stringify({ source });

    return [
      this.check(
        'capability-autopilot-release-candidate:source-ready',
        'field trial source ready',
        source.status === 'field_trial_ready' && source.recommendation === 'start_limited_beta_field_trial' && source.summary.ok ? 'pass' : 'fail',
        'Release candidate can only start from ready field-trial beta.',
        [
          `sourceStatus=${source.status}`,
          `sourceRecommendation=${source.recommendation}`,
          `sourceOk=${source.summary.ok}`,
        ],
      ),
      this.check(
        'capability-autopilot-release-candidate:trial-evidence',
        'evidence de field trial suficiente',
        options.releaseCandidateApproved &&
          options.fieldTrialCompleted &&
          options.observedParticipants >= options.minObservedParticipants &&
          options.feedbackResponseCount >= options.minFeedbackResponses &&
          options.satisfactionScore >= options.minSatisfactionScore &&
          options.successCriteriaPassed ? 'pass'
          : 'fail',
        'RC requires completed trial, explicit approval, participants, feedback, and fulfilled success criteria.',
        [
          `releaseCandidateApproved=${options.releaseCandidateApproved}`,
          `fieldTrialCompleted=${options.fieldTrialCompleted}`,
          `observedParticipants=${options.observedParticipants}`,
          `minObservedParticipants=${options.minObservedParticipants}`,
          `feedbackResponseCount=${options.feedbackResponseCount}`,
          `minFeedbackResponses=${options.minFeedbackResponses}`,
          `satisfactionScore=${options.satisfactionScore}`,
          `minSatisfactionScore=${options.minSatisfactionScore}`,
          `successCriteriaPassed=${options.successCriteriaPassed}`,
        ],
      ),
      this.check(
        'capability-autopilot-release-candidate:incident-budget',
        'budget de incidentes respeitado',
        options.p0IncidentCount === 0 &&
          options.p1IncidentCount <= options.maxP1Incidents &&
          options.openRollbackRequiredCount === 0
          ? 'pass'
          : 'fail',
        'RC cannot have P0, above budget, or open rollback required.',
        [
          `p0IncidentCount=${options.p0IncidentCount}`,
          `p1IncidentCount=${options.p1IncidentCount}`,
          `maxP1Incidents=${options.maxP1Incidents}`,
          `openRollbackRequiredCount=${options.openRollbackRequiredCount}`,
        ],
      ),
      this.check(
        'capability-autopilot-release-candidate:operational-readiness',
        'readiness operational para RC',
        options.rollbackRehearsalFresh &&
          options.supportLoadOk &&
          options.docsUpdated &&
          options.releaseNotesReady &&
          options.stagedRolloutPlanReady &&
          options.killSwitchReady ? 'pass'
          : 'fail',
        'RC requires fresh rollback rehearsal, healthy support, docs, release notes, staged plan, and kill switch.',
        [
          `rollbackRehearsalFresh=${options.rollbackRehearsalFresh}`,
          `supportLoadOk=${options.supportLoadOk}`,
          `docsUpdated=${options.docsUpdated}`,
          `releaseNotesReady=${options.releaseNotesReady}`,
          `stagedRolloutPlanReady=${options.stagedRolloutPlanReady}`,
          `killSwitchReady=${options.killSwitchReady}`,
        ],
      ),
      this.check(
        'capability-autopilot-release-candidate:governance',
        'approved RC governance',
        options.telemetryReviewPassed &&
          options.privacyReviewPassed &&
          options.rcFlagDefaultOff &&
          !options.globalRolloutEnabled &&
          !options.autoPromoteEnabled ? 'pass'
          : 'fail',
        'RC requires telemetry/privacy review, default-off flag, and no automatic promotion.',
        [
          `telemetryReviewPassed=${options.telemetryReviewPassed}`,
          `privacyReviewPassed=${options.privacyReviewPassed}`,
          `rcFlagDefaultOff=${options.rcFlagDefaultOff}`,
          `globalRolloutEnabled=${options.globalRolloutEnabled}`,
          `autoPromoteEnabled=${options.autoPromoteEnabled}`,
        ],
      ),
      this.check(
        'capability-autopilot-release-candidate:no-blockers',
        'without blockers de release candidate',
        blockers.length === 0 ? 'pass' : 'fail',
        'There can be no aggregate blocker to promote release candidate.',
        blockers.length > 0 ? blockers : ['blockers=0'],
      ),
      this.check(
        'capability-autopilot-release-candidate:no-raw-payload',
        'without payload cru serializado',
        !serialized.includes('rawText') && !serialized.includes('normalizedText') ? 'pass' : 'fail',
        'Public RC snapshot cannot reintroduce raw intent.',
        [
          `containsRawKeys=${String(serialized.includes('rawText') || serialized.includes('normalizedText'))}`,
        ],
      ),
    ];
  }

  private buildReleaseCandidateGateId(
    source: CapabilityAutopilotBetaFieldTrialSnapshot,
    generatedAt: string,
    releaseCandidateReceiptId: string | null,
  ): string {
    const digest = createHash('sha256')
      .update([
        source.capabilityId,
        source.gate,
        source.fieldTrialId,
        source.generatedAt,
        generatedAt,
        releaseCandidateReceiptId || '<none>',
      ].join('|'), 'utf8')
      .digest('hex')
      .slice(0, 16);
    return `${source.capabilityId}-release-candidate-${digest}`;
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
