import { createHash } from 'crypto';
import type { CapabilityAutopilotPreflightCheck } from './CapabilityAutopilotPreflightEntrypointService.js';
import type { CapabilityAutopilotBetaReadinessSnapshot } from './CapabilityAutopilotBetaReadinessGateService.js';

export type CapabilityAutopilotBetaFieldTrialStatus =
  | 'field_trial_ready'
  | 'blocked';

export type CapabilityAutopilotBetaFieldTrialRecommendation =
  | 'start_limited_beta_field_trial'
  | 'hold_beta';

export type CapabilityAutopilotBetaFieldTrialOptions = {
  fieldTrialApproved?: boolean;
  participantCount?: number;
  maxParticipants?: number;
  rolloutPercent?: number;
  rolloutLimitPercent?: number;
  feedbackChannelReady?: boolean;
  supportRotationReady?: boolean;
  successCriteriaDefined?: boolean;
  rollbackRehearsalPassed?: boolean;
  incidentThresholdOk?: boolean;
  telemetryOptInReady?: boolean;
  privacyNoticeReady?: boolean;
  betaFlagDefaultOff?: boolean;
  globalRolloutEnabled?: boolean;
  autoEnrollEnabled?: boolean;
  actorId?: string | null;
  fieldTrialReceiptId?: string | null;
  cohortId?: string | null;
  feedbackChannelId?: string | null;
  supportRotationId?: string | null;
  rollbackRehearsalReceiptId?: string | null;
  successCriteriaId?: string | null;
  privacyNoticeReceiptId?: string | null;
  reason?: string | null;
};

export type CapabilityAutopilotBetaFieldTrialSnapshot = {
  phase: '79';
  fieldTrialId: string;
  generatedAt: string;
  surface: 'capability-autopilot-beta-field-trial-loop';
  capabilityId: string;
  status: CapabilityAutopilotBetaFieldTrialStatus;
  recommendation: CapabilityAutopilotBetaFieldTrialRecommendation;
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  sourceSnapshotPhase: CapabilityAutopilotBetaReadinessSnapshot['phase'];
  sourceStatus: CapabilityAutopilotBetaReadinessSnapshot['status'];
  sourceRecommendation: CapabilityAutopilotBetaReadinessSnapshot['recommendation'];
  fieldTrialApproved: boolean;
  betaFlagDefaultOff: boolean;
  globalRolloutEnabled: boolean;
  autoEnrollEnabled: boolean;
  cohort: {
    cohortId: string | null;
    participantCount: number;
    maxParticipants: number;
    rolloutPercent: number;
    rolloutLimitPercent: number;
    limited: boolean;
  };
  feedbackLoop: {
    feedbackChannelReady: boolean;
    feedbackChannelId: string | null;
    supportRotationReady: boolean;
    supportRotationId: string | null;
    successCriteriaDefined: boolean;
    successCriteriaId: string | null;
  };
  safetyControls: {
    rollbackRehearsalPassed: boolean;
    rollbackRehearsalReceiptId: string | null;
    incidentThresholdOk: boolean;
    telemetryOptInReady: boolean;
    privacyNoticeReady: boolean;
    privacyNoticeReceiptId: string | null;
  };
  blockers: string[];
  checks: CapabilityAutopilotPreflightCheck[];
  audit: {
    sourceGeneratedAt: string;
    sourceBetaReadinessId: string;
    actorId: string | null;
    reason: string | null;
    fieldTrialReceiptId: string | null;
  };
  nextRecommendedPhase: {
    phase: '80';
    title: string;
    reason: string;
  };
  metadata: Record<string, unknown>;
};

export type CapabilityAutopilotBetaFieldTrialLoopRuntime = {
  now?: () => Date;
};

type ResolvedOptions = {
  fieldTrialApproved: boolean;
  participantCount: number;
  maxParticipants: number;
  rolloutPercent: number;
  rolloutLimitPercent: number;
  feedbackChannelReady: boolean;
  supportRotationReady: boolean;
  successCriteriaDefined: boolean;
  rollbackRehearsalPassed: boolean;
  incidentThresholdOk: boolean;
  telemetryOptInReady: boolean;
  privacyNoticeReady: boolean;
  betaFlagDefaultOff: boolean;
  globalRolloutEnabled: boolean;
  autoEnrollEnabled: boolean;
};

export class CapabilityAutopilotBetaFieldTrialLoopService {
  private readonly now: () => Date;

  constructor(runtime: CapabilityAutopilotBetaFieldTrialLoopRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildFieldTrialSnapshot(
    source: CapabilityAutopilotBetaReadinessSnapshot,
    options: CapabilityAutopilotBetaFieldTrialOptions = {},
  ): CapabilityAutopilotBetaFieldTrialSnapshot {
    const generatedAt = this.now().toISOString();
    const resolved = this.resolveOptions(options);
    const blockers = this.resolveBlockers(source, resolved);
    const checks = this.buildChecks(source, resolved, blockers);
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;
    const status: CapabilityAutopilotBetaFieldTrialStatus = failed > 0 || blockers.length > 0
      ? 'blocked'
      : 'field_trial_ready';
    const recommendation: CapabilityAutopilotBetaFieldTrialRecommendation = status === 'field_trial_ready'
      ? 'start_limited_beta_field_trial'
      : 'hold_beta';

    return {
      phase: '79',
      fieldTrialId: this.buildFieldTrialId(source, generatedAt, options.fieldTrialReceiptId || null),
      generatedAt,
      surface: 'capability-autopilot-beta-field-trial-loop',
      capabilityId: source.capabilityId,
      status,
      recommendation,
      summary: {
        ok: status === 'field_trial_ready',
        passed,
        warnings,
        failed,
      },
      sourceSnapshotPhase: source.phase,
      sourceStatus: source.status,
      sourceRecommendation: source.recommendation,
      fieldTrialApproved: resolved.fieldTrialApproved,
      betaFlagDefaultOff: resolved.betaFlagDefaultOff,
      globalRolloutEnabled: resolved.globalRolloutEnabled,
      autoEnrollEnabled: resolved.autoEnrollEnabled,
      cohort: {
        cohortId: options.cohortId || null,
        participantCount: resolved.participantCount,
        maxParticipants: resolved.maxParticipants,
        rolloutPercent: resolved.rolloutPercent,
        rolloutLimitPercent: resolved.rolloutLimitPercent,
        limited: this.isCohortLimited(resolved),
      },
      feedbackLoop: {
        feedbackChannelReady: resolved.feedbackChannelReady,
        feedbackChannelId: options.feedbackChannelId || null,
        supportRotationReady: resolved.supportRotationReady,
        supportRotationId: options.supportRotationId || null,
        successCriteriaDefined: resolved.successCriteriaDefined,
        successCriteriaId: options.successCriteriaId || null,
      },
      safetyControls: {
        rollbackRehearsalPassed: resolved.rollbackRehearsalPassed,
        rollbackRehearsalReceiptId: options.rollbackRehearsalReceiptId || null,
        incidentThresholdOk: resolved.incidentThresholdOk,
        telemetryOptInReady: resolved.telemetryOptInReady,
        privacyNoticeReady: resolved.privacyNoticeReady,
        privacyNoticeReceiptId: options.privacyNoticeReceiptId || null,
      },
      blockers,
      checks,
      audit: {
        sourceGeneratedAt: source.generatedAt,
        sourceBetaReadinessId: source.betaReadinessId,
        actorId: options.actorId || null,
        reason: options.reason || null,
        fieldTrialReceiptId: options.fieldTrialReceiptId || null,
      },
      nextRecommendedPhase: {
        phase: '80',
        title: 'Capability Autopilot Release Candidate Gate',
        reason:
          'Depois do field trial beta, o proximo passo e decidir release candidate com sinais reais, incidentes, feedback e rollback rehearsal auditados.',
      },
      metadata: {
        phase: 'capability-autopilot-phase-79',
        sourceSnapshotStatus: source.status,
        sourceRecommendation: source.recommendation,
        autoExecute: false,
        recommendation,
        fieldTrialReady: status === 'field_trial_ready',
        limitedCohort: this.isCohortLimited(resolved),
        participantCount: resolved.participantCount,
        rolloutPercent: resolved.rolloutPercent,
        betaFlagDefaultOff: resolved.betaFlagDefaultOff,
        globalRolloutEnabled: resolved.globalRolloutEnabled,
        autoEnrollEnabled: resolved.autoEnrollEnabled,
      },
    };
  }

  public renderReport(snapshot: CapabilityAutopilotBetaFieldTrialSnapshot): string {
    const lines: string[] = [];
    lines.push('[capability-autopilot-beta-field-trial] Fase 79 - Capability Autopilot Beta Field Trial Loop');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`recommendation: ${snapshot.recommendation}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`capability: ${snapshot.capabilityId}`);
    lines.push(`cohort: ${snapshot.cohort.participantCount}/${snapshot.cohort.maxParticipants} participants | rollout=${snapshot.cohort.rolloutPercent}%/${snapshot.cohort.rolloutLimitPercent}%`);
    lines.push('');
    for (const item of snapshot.checks) {
      lines.push(`[${item.status}] ${item.title}`);
      lines.push(`  ${item.reason}`);
      for (const evidence of item.evidence) {
        lines.push(`  - ${evidence}`);
      }
    }
    lines.push('');
    lines.push(`proxima fase recomendada: ${snapshot.nextRecommendedPhase.phase} - ${snapshot.nextRecommendedPhase.title}`);
    lines.push(snapshot.nextRecommendedPhase.reason);
    return lines.join('\n');
  }

  private resolveOptions(options: CapabilityAutopilotBetaFieldTrialOptions): ResolvedOptions {
    return {
      fieldTrialApproved: options.fieldTrialApproved === true,
      participantCount: this.resolveNumber(options.participantCount, 0),
      maxParticipants: this.resolveNumber(options.maxParticipants, 0),
      rolloutPercent: this.resolveNumber(options.rolloutPercent, 0),
      rolloutLimitPercent: this.resolveNumber(options.rolloutLimitPercent, 0),
      feedbackChannelReady: options.feedbackChannelReady === true,
      supportRotationReady: options.supportRotationReady === true,
      successCriteriaDefined: options.successCriteriaDefined === true,
      rollbackRehearsalPassed: options.rollbackRehearsalPassed === true,
      incidentThresholdOk: options.incidentThresholdOk === true,
      telemetryOptInReady: options.telemetryOptInReady === true,
      privacyNoticeReady: options.privacyNoticeReady === true,
      betaFlagDefaultOff: options.betaFlagDefaultOff === true,
      globalRolloutEnabled: options.globalRolloutEnabled === true,
      autoEnrollEnabled: options.autoEnrollEnabled === true,
    };
  }

  private resolveNumber(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private resolveBlockers(
    source: CapabilityAutopilotBetaReadinessSnapshot,
    options: ResolvedOptions,
  ): string[] {
    const blockers: string[] = [];
    if (
      source.status !== 'beta_candidate_ready' ||
      source.recommendation !== 'promote_to_beta_candidate' ||
      !source.summary.ok
    ) {
      blockers.push(`source_beta_readiness_not_ready:${source.status}`);
    }
    if (!options.fieldTrialApproved) {
      blockers.push('field_trial_approval_required');
    }
    if (!Number.isInteger(options.participantCount) || options.participantCount <= 0 || options.maxParticipants <= 0) {
      blockers.push('participant_cohort_required');
    }
    if (options.participantCount > options.maxParticipants) {
      blockers.push('participant_cap_exceeded');
    }
    if (options.rolloutPercent <= 0 || options.rolloutLimitPercent <= 0 || options.rolloutPercent > options.rolloutLimitPercent) {
      blockers.push('rollout_percent_out_of_bounds');
    }
    if (!options.feedbackChannelReady) {
      blockers.push('feedback_channel_required');
    }
    if (!options.supportRotationReady) {
      blockers.push('support_rotation_required');
    }
    if (!options.successCriteriaDefined) {
      blockers.push('success_criteria_required');
    }
    if (!options.rollbackRehearsalPassed) {
      blockers.push('rollback_rehearsal_required');
    }
    if (!options.incidentThresholdOk) {
      blockers.push('incident_threshold_not_ok');
    }
    if (!options.telemetryOptInReady) {
      blockers.push('telemetry_opt_in_required');
    }
    if (!options.privacyNoticeReady) {
      blockers.push('privacy_notice_required');
    }
    if (!options.betaFlagDefaultOff) {
      blockers.push('beta_flag_default_off_required');
    }
    if (options.globalRolloutEnabled) {
      blockers.push('global_rollout_not_allowed');
    }
    if (options.autoEnrollEnabled) {
      blockers.push('auto_enroll_not_allowed');
    }
    return Array.from(new Set(blockers));
  }

  private buildChecks(
    source: CapabilityAutopilotBetaReadinessSnapshot,
    options: ResolvedOptions,
    blockers: string[],
  ): CapabilityAutopilotPreflightCheck[] {
    const serialized = JSON.stringify({ source });

    return [
      this.check(
        'capability-autopilot-beta-field-trial:source-ready',
        'beta readiness source ready',
        source.status === 'beta_candidate_ready' && source.recommendation === 'promote_to_beta_candidate' && source.summary.ok ? 'pass' : 'fail',
        'Field trial beta so pode partir de beta readiness pronto.',
        [
          `sourceStatus=${source.status}`,
          `sourceRecommendation=${source.recommendation}`,
          `sourceOk=${source.summary.ok}`,
        ],
      ),
      this.check(
        'capability-autopilot-beta-field-trial:bounded-cohort',
        'coorte beta limitada',
        options.fieldTrialApproved && this.isCohortLimited(options) ? 'pass' : 'fail',
        'Field trial exige aprovacao explicita, participantes limitados e rollout percentual abaixo do limite.',
        [
          `fieldTrialApproved=${options.fieldTrialApproved}`,
          `participantCount=${options.participantCount}`,
          `maxParticipants=${options.maxParticipants}`,
          `rolloutPercent=${options.rolloutPercent}`,
          `rolloutLimitPercent=${options.rolloutLimitPercent}`,
        ],
      ),
      this.check(
        'capability-autopilot-beta-field-trial:feedback-loop',
        'feedback e suporte prontos',
        options.feedbackChannelReady && options.supportRotationReady && options.successCriteriaDefined ? 'pass' : 'fail',
        'Beta field trial exige canal de feedback, rotacao de suporte e criterios objetivos de sucesso.',
        [
          `feedbackChannelReady=${options.feedbackChannelReady}`,
          `supportRotationReady=${options.supportRotationReady}`,
          `successCriteriaDefined=${options.successCriteriaDefined}`,
        ],
      ),
      this.check(
        'capability-autopilot-beta-field-trial:safety-controls',
        'rollback rehearsal e seguranca ativos',
        options.rollbackRehearsalPassed &&
          options.incidentThresholdOk &&
          options.betaFlagDefaultOff &&
          !options.globalRolloutEnabled &&
          !options.autoEnrollEnabled
          ? 'pass'
          : 'fail',
        'O trial deve continuar reversivel, com flag beta off por padrao, sem rollout global e sem auto-enroll.',
        [
          `rollbackRehearsalPassed=${options.rollbackRehearsalPassed}`,
          `incidentThresholdOk=${options.incidentThresholdOk}`,
          `betaFlagDefaultOff=${options.betaFlagDefaultOff}`,
          `globalRolloutEnabled=${options.globalRolloutEnabled}`,
          `autoEnrollEnabled=${options.autoEnrollEnabled}`,
        ],
      ),
      this.check(
        'capability-autopilot-beta-field-trial:privacy-telemetry',
        'privacy e telemetria opt-in',
        options.telemetryOptInReady && options.privacyNoticeReady ? 'pass' : 'fail',
        'Participantes beta precisam de telemetria opt-in e aviso de privacidade aprovado.',
        [
          `telemetryOptInReady=${options.telemetryOptInReady}`,
          `privacyNoticeReady=${options.privacyNoticeReady}`,
        ],
      ),
      this.check(
        'capability-autopilot-beta-field-trial:no-blockers',
        'sem blockers de field trial',
        blockers.length === 0 ? 'pass' : 'fail',
        'Nao pode haver blocker agregado para iniciar field trial beta.',
        blockers.length > 0 ? blockers : ['blockers=0'],
      ),
      this.check(
        'capability-autopilot-beta-field-trial:no-raw-payload',
        'sem payload cru serializado',
        !serialized.includes('rawText') && !serialized.includes('normalizedText') ? 'pass' : 'fail',
        'Snapshot publico do field trial nao pode reintroduzir intent cru.',
        [
          `containsRawKeys=${String(serialized.includes('rawText') || serialized.includes('normalizedText'))}`,
        ],
      ),
    ];
  }

  private isCohortLimited(options: ResolvedOptions): boolean {
    return Number.isInteger(options.participantCount) &&
      options.participantCount > 0 &&
      options.maxParticipants > 0 &&
      options.participantCount <= options.maxParticipants &&
      options.rolloutPercent > 0 &&
      options.rolloutLimitPercent > 0 &&
      options.rolloutPercent <= options.rolloutLimitPercent;
  }

  private buildFieldTrialId(
    source: CapabilityAutopilotBetaReadinessSnapshot,
    generatedAt: string,
    fieldTrialReceiptId: string | null,
  ): string {
    const digest = createHash('sha256')
      .update([
        source.capabilityId,
        source.phase,
        source.betaReadinessId,
        source.generatedAt,
        generatedAt,
        fieldTrialReceiptId || '<none>',
      ].join('|'), 'utf8')
      .digest('hex')
      .slice(0, 16);
    return `${source.capabilityId}-beta-field-trial-${digest}`;
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
