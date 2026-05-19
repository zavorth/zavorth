#!/usr/bin/env node
import {
  readNestedJsonFromTsxScript,
  readNumberArg,
} from './lib/capability-autopilot-script-utils.js';
import { CapabilityAutopilotReleaseRolloutPlanService } from '../src/services/CapabilityAutopilotReleaseRolloutPlanService.js';
import type { CapabilityAutopilotReleaseCandidateSnapshot } from '../src/services/CapabilityAutopilotReleaseCandidateGateService.js';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
const rolloutPlanApproved = !argv.includes('--no-rollout-plan-approval');
const stagedCohortsDefined = !argv.includes('--no-staged-cohorts');
const rollbackRunbookReady = !argv.includes('--no-rollback-runbook');
const changelogReady = !argv.includes('--no-changelog');
const releaseBundleReady = !argv.includes('--no-release-bundle');
const installerSmokePassed = !argv.includes('--installer-smoke-failed');
const docsPublicationReady = !argv.includes('--docs-publication-missing');
const supportCommsReady = !argv.includes('--no-support-comms');
const statusPageDraftReady = !argv.includes('--no-status-page-draft');
const telemetryDashboardsReady = !argv.includes('--no-telemetry-dashboards');
const releaseOwnerAssigned = !argv.includes('--no-release-owner');
const releaseTrainSlotReserved = !argv.includes('--no-release-train-slot');
const artifactRetentionReady = !argv.includes('--no-artifact-retention');
const manualPromotionRequired = !argv.includes('--manual-promotion-not-required');
const rcFlagDefaultOff = !argv.includes('--rc-flag-on-by-default');
const publishTagEnabled = argv.includes('--publish-tag');
const globalRolloutEnabled = argv.includes('--global-rollout');
const autoRolloutEnabled = argv.includes('--auto-rollout');
const canaryPercent = readNumberArg(argv, '--canary-percent=', 5);
const maxCanaryPercent = readNumberArg(argv, '--max-canary-percent=', 10);
const expansionStepCount = readNumberArg(argv, '--expansion-steps=', 3);
const minExpansionStepCount = readNumberArg(argv, '--min-expansion-steps=', 3);
const rollbackWindowHours = readNumberArg(argv, '--rollback-window-hours=', 48);
const minRollbackWindowHours = readNumberArg(argv, '--min-rollback-window-hours=', 24);

main();

function main(): void {
  try {
    const source = readReleaseCandidateSource();
    const service = new CapabilityAutopilotReleaseRolloutPlanService();
    const snapshot = service.buildRolloutPlanSnapshot(source, {
      rolloutPlanApproved,
      stagedCohortsDefined,
      canaryPercent,
      maxCanaryPercent,
      expansionStepCount,
      minExpansionStepCount,
      rollbackWindowHours,
      minRollbackWindowHours,
      rollbackRunbookReady,
      changelogReady,
      releaseBundleReady,
      installerSmokePassed,
      docsPublicationReady,
      supportCommsReady,
      statusPageDraftReady,
      telemetryDashboardsReady,
      releaseOwnerAssigned,
      releaseTrainSlotReserved,
      artifactRetentionReady,
      manualPromotionRequired,
      rcFlagDefaultOff,
      publishTagEnabled,
      globalRolloutEnabled,
      autoRolloutEnabled,
      actorId: 'checkpoint-81-gate',
      rolloutPlanReceiptId: 'checkpoint-81-release-rollout-plan',
      canaryCohortId: stagedCohortsDefined ? 'checkpoint-81-canary-cohort' : null,
      stagedCohortPlanId: stagedCohortsDefined ? 'checkpoint-81-staged-cohorts' : null,
      rollbackRunbookId: rollbackRunbookReady ? 'checkpoint-81-rollback-runbook' : null,
      changelogId: changelogReady ? 'checkpoint-81-changelog' : null,
      releaseBundleId: releaseBundleReady ? 'checkpoint-81-release-bundle' : null,
      installerSmokeReceiptId: installerSmokePassed ? 'checkpoint-81-installer-smoke' : null,
      docsPublicationId: docsPublicationReady ? 'checkpoint-81-docs-publication' : null,
      commsPlanId: supportCommsReady ? 'checkpoint-81-support-comms' : null,
      telemetryDashboardId: telemetryDashboardsReady ? 'checkpoint-81-telemetry-dashboard' : null,
      releaseOwnerId: releaseOwnerAssigned ? 'checkpoint-81-release-owner' : null,
      releaseTrainSlotId: releaseTrainSlotReserved ? 'checkpoint-81-release-train-slot' : null,
      artifactRetentionPolicyId: artifactRetentionReady ? 'checkpoint-81-artifact-retention' : null,
      reason: 'checkpoint-81-release-rollout-plan',
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
    process.stderr.write(`[capability-autopilot-release-rollout] falha: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

function readReleaseCandidateSource(): CapabilityAutopilotReleaseCandidateSnapshot {
  return readNestedJsonFromTsxScript(
    'scripts/capability-autopilot-release-candidate.ts',
    argv,
    {
      dropArgs: [
        '--json',
        '--require-pass',
        '--gate',
        '--no-rollout-plan-approval',
        '--no-staged-cohorts',
        '--no-rollback-runbook',
        '--no-changelog',
        '--no-release-bundle',
        '--installer-smoke-failed',
        '--docs-publication-missing',
        '--no-support-comms',
        '--no-status-page-draft',
        '--no-telemetry-dashboards',
        '--no-release-owner',
        '--no-release-train-slot',
        '--no-artifact-retention',
        '--manual-promotion-not-required',
        '--rc-flag-on-by-default',
        '--publish-tag',
        '--global-rollout',
        '--auto-rollout',
      ],
      dropPrefixes: [
        '--canary-percent=',
        '--max-canary-percent=',
        '--expansion-steps=',
        '--min-expansion-steps=',
        '--rollback-window-hours=',
        '--min-rollback-window-hours=',
      ],
    },
  );
}
