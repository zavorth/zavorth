#!/usr/bin/env node
import { asErrorLike } from '../src/utils/errorLike';
import {
  readNestedJsonFromTsxScript,
  readNumberArg,
  readOptionalNumberArg,
} from './lib/capability-autopilot-script-utils.js';
import { CapabilityAutopilotReleaseCandidateGateService } from '../src/services/CapabilityAutopilotReleaseCandidateGateService.js';
import type { CapabilityAutopilotBetaFieldTrialSnapshot } from '../src/services/CapabilityAutopilotBetaFieldTrialLoopService.js';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
const releaseCandidateApproved = !argv.includes('--no-rc-approval');
const fieldTrialCompleted = !argv.includes('--field-trial-incomplete');
const successCriteriaPassed = !argv.includes('--success-criteria-failed');
const rollbackRehearsalFresh = !argv.includes('--rollback-rehearsal-stale');
const supportLoadOk = !argv.includes('--support-load-high');
const docsUpdated = !argv.includes('--docs-stale');
const releaseNotesReady = !argv.includes('--no-release-notes');
const stagedRolloutPlanReady = !argv.includes('--no-staged-rollout-plan');
const killSwitchReady = !argv.includes('--no-kill-switch');
const telemetryReviewPassed = !argv.includes('--telemetry-review-failed');
const privacyReviewPassed = !argv.includes('--privacy-review-failed');
const rcFlagDefaultOff = !argv.includes('--rc-flag-on-by-default');
const globalRolloutEnabled = argv.includes('--global-rollout');
const autoPromoteEnabled = argv.includes('--auto-promote');
const observedParticipants = readOptionalNumberArg(argv, '--observed-participants=');
const minObservedParticipants = readOptionalNumberArg(argv, '--min-observed-participants=');
const feedbackResponseCount = readOptionalNumberArg(argv, '--feedback-responses=');
const minFeedbackResponses = readOptionalNumberArg(argv, '--min-feedback-responses=');
const satisfactionScore = readNumberArg(argv, '--satisfaction-score=', 92);
const minSatisfactionScore = readNumberArg(argv, '--min-satisfaction-score=', 85);
const p0IncidentCount = readNumberArg(argv, '--p0-incidents=', 0);
const p1IncidentCount = readNumberArg(argv, '--p1-incidents=', 0);
const maxP1Incidents = readNumberArg(argv, '--max-p1-incidents=', 0);
const openRollbackRequiredCount = readNumberArg(argv, '--open-rollback-required=', 0);

main();

function main(): void {
  try {
    const source = readFieldTrialSource();
    const service = new CapabilityAutopilotReleaseCandidateGateService();
    const snapshot = service.buildReleaseCandidateSnapshot(source, {
      releaseCandidateApproved,
      fieldTrialCompleted,
      observedParticipants,
      minObservedParticipants,
      feedbackResponseCount,
      minFeedbackResponses,
      satisfactionScore,
      minSatisfactionScore,
      successCriteriaPassed,
      p0IncidentCount,
      p1IncidentCount,
      maxP1Incidents,
      openRollbackRequiredCount,
      rollbackRehearsalFresh,
      supportLoadOk,
      docsUpdated,
      releaseNotesReady,
      stagedRolloutPlanReady,
      killSwitchReady,
      telemetryReviewPassed,
      privacyReviewPassed,
      rcFlagDefaultOff,
      globalRolloutEnabled,
      autoPromoteEnabled,
      actorId: 'gate-80-gate',
      releaseCandidateReceiptId: 'gate-80-release-candidate',
      trialReportId: 'gate-80-trial-report',
      incidentReviewId: 'gate-80-incident-review',
      rolloutPlanId: stagedRolloutPlanReady ? 'gate-80-staged-rollout-plan' : null,
      killSwitchReceiptId: killSwitchReady ? 'gate-80-kill-switch' : null,
      telemetryReviewId: telemetryReviewPassed ? 'gate-80-telemetry-review' : null,
      privacyReviewId: privacyReviewPassed ? 'gate-80-privacy-review' : null,
      reason: 'gate-80-release-candidate-gate',
    });

    if (asJson) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      process.stdout.write(`${service.renderReport(snapshot)}\n`);
    }

    if (requirePass && !snapshot.summary.ok) {
      process.exitCode = 1;
    }
  } catch (error: unknown) {
    const err = asErrorLike(error);

    process.stderr.write(`[capability-autopilot-release-candidate] failure: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

function readFieldTrialSource(): CapabilityAutopilotBetaFieldTrialSnapshot {
  return readNestedJsonFromTsxScript(
    'scripts/capability-autopilot-beta-field-trial.ts',
    argv,
    {
      dropArgs: [
        '--json',
        '--require-pass',
        '--gate',
        '--no-rc-approval',
        '--field-trial-incomplete',
        '--success-criteria-failed',
        '--rollback-rehearsal-stale',
        '--support-load-high',
        '--docs-stale',
        '--no-release-notes',
        '--no-staged-rollout-plan',
        '--no-kill-switch',
        '--telemetry-review-failed',
        '--privacy-review-failed',
        '--rc-flag-on-by-default',
        '--global-rollout',
        '--auto-promote',
      ],
      dropPrefixes: [
        '--observed-participants=',
        '--min-observed-participants=',
        '--feedback-responses=',
        '--min-feedback-responses=',
        '--satisfaction-score=',
        '--min-satisfaction-score=',
        '--p0-incidents=',
        '--p1-incidents=',
        '--max-p1-incidents=',
        '--open-rollback-required=',
      ],
    },
  );
}
