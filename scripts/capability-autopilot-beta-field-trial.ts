#!/usr/bin/env node
import {
  readNestedJsonFromTsxScript,
  readNumberArg,
} from './lib/capability-autopilot-script-utils.js';
import { CapabilityAutopilotBetaFieldTrialLoopService } from '../src/services/CapabilityAutopilotBetaFieldTrialLoopService.js';
import type { CapabilityAutopilotBetaReadinessSnapshot } from '../src/services/CapabilityAutopilotBetaReadinessGateService.js';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
const fieldTrialApproved = !argv.includes('--no-field-trial-approval');
const feedbackChannelReady = !argv.includes('--no-feedback-channel');
const supportRotationReady = !argv.includes('--no-support-rotation');
const successCriteriaDefined = !argv.includes('--no-success-criteria');
const rollbackRehearsalPassed = !argv.includes('--no-rollback-rehearsal');
const incidentThresholdOk = !argv.includes('--incident-threshold-breached');
const privacyNoticeReady = !argv.includes('--no-privacy-notice');
const betaFlagDefaultOff = !argv.includes('--feature-flag-on-by-default');
const globalRolloutEnabled = argv.includes('--global-rollout');
const autoEnrollEnabled = argv.includes('--auto-enroll');
const participantCount = readNumberArg(argv, '--participants=', 5);
const maxParticipants = readNumberArg(argv, '--max-participants=', 25);
const rolloutPercent = readNumberArg(argv, '--rollout-percent=', 5);
const rolloutLimitPercent = readNumberArg(argv, '--rollout-limit-percent=', 10);

main();

function main(): void {
  try {
    const source = readBetaReadinessSource();
    const service = new CapabilityAutopilotBetaFieldTrialLoopService();
    const snapshot = service.buildFieldTrialSnapshot(source, {
      fieldTrialApproved,
      participantCount,
      maxParticipants,
      rolloutPercent,
      rolloutLimitPercent,
      feedbackChannelReady,
      supportRotationReady,
      successCriteriaDefined,
      rollbackRehearsalPassed,
      incidentThresholdOk,
      telemetryOptInReady: source.telemetryOptInReady,
      privacyNoticeReady,
      betaFlagDefaultOff,
      globalRolloutEnabled,
      autoEnrollEnabled,
      actorId: 'phase-79-gate',
      fieldTrialReceiptId: 'phase-79-field-trial',
      cohortId: 'phase-79-limited-beta-cohort',
      feedbackChannelId: feedbackChannelReady ? 'phase-79-feedback-channel' : null,
      supportRotationId: supportRotationReady ? 'phase-79-support-rotation' : null,
      rollbackRehearsalReceiptId: rollbackRehearsalPassed ? 'phase-79-rollback-rehearsal' : null,
      successCriteriaId: successCriteriaDefined ? 'phase-79-success-criteria' : null,
      privacyNoticeReceiptId: privacyNoticeReady ? 'phase-79-privacy-notice' : null,
      reason: 'phase-79-beta-field-trial-loop',
    });

    if (asJson) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      process.stdout.write(`${service.renderReport(snapshot)}\n`);
    }

    if (requirePass && !snapshot.summary.ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`[capability-autopilot-beta-field-trial] falha: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

function readBetaReadinessSource(): CapabilityAutopilotBetaReadinessSnapshot {
  return readNestedJsonFromTsxScript(
    'scripts/capability-autopilot-beta-readiness.ts',
    argv,
    {
      dropArgs: [
        '--json',
        '--require-pass',
        '--gate',
        '--no-field-trial-approval',
        '--no-feedback-channel',
        '--no-support-rotation',
        '--no-success-criteria',
        '--no-rollback-rehearsal',
        '--incident-threshold-breached',
        '--no-privacy-notice',
        '--global-rollout',
        '--auto-enroll',
      ],
      dropPrefixes: [
        '--participants=',
        '--max-participants=',
        '--rollout-percent=',
        '--rollout-limit-percent=',
      ],
    },
  );
}
