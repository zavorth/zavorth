#!/usr/bin/env node
import { asErrorLike } from '../src/utils/errorLike';
import {
  readNestedJsonFromTsxScript,
  readNumberArg,
} from './lib/capability-autopilot-script-utils.js';
import { CapabilityAutopilotCanaryMonitoringPromotionGateService } from '../src/services/CapabilityAutopilotCanaryMonitoringPromotionGateService.js';
import type { CapabilityAutopilotReleaseExecutionSnapshot } from '../src/services/CapabilityAutopilotReleaseExecutionGateService.js';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
const canaryObservationComplete = !argv.includes('--observation-incomplete');
const telemetryFresh = !argv.includes('--telemetry-stale');
const metricsWindowComplete = !argv.includes('--metrics-window-incomplete');
const rollbackTriggered = argv.includes('--rollback-triggered');
const rollbackRecommended = argv.includes('--rollback-recommended');
const supportLoadOk = !argv.includes('--support-load-high');
const canaryCohortStable = !argv.includes('--canary-unstable');
const promotionApproved = !argv.includes('--no-promotion-approval');
const rollbackRunbookReady = !argv.includes('--no-rollback-runbook');
const observabilityReviewReady = !argv.includes('--no-observability-review');
const auditPersisted = !argv.includes('--no-audit-persisted');
const autoPromoteEnabled = argv.includes('--auto-promote');
const globalRolloutEnabled = argv.includes('--global-rollout');
const skipApprovalEnabled = argv.includes('--skip-approval');
const observationWindowMinutes = readNumberArg(argv, '--observation-window-minutes=', 120);
const minObservationWindowMinutes = readNumberArg(argv, '--min-observation-window-minutes=', 60);
const errorRatePercent = readNumberArg(argv, '--error-rate=', 0.2);
const maxErrorRatePercent = readNumberArg(argv, '--max-error-rate=', 1);
const p95LatencyMs = readNumberArg(argv, '--p95-latency=', 850);
const maxP95LatencyMs = readNumberArg(argv, '--max-p95-latency=', 1200);
const successRatePercent = readNumberArg(argv, '--success-rate=', 99.5);
const minSuccessRatePercent = readNumberArg(argv, '--min-success-rate=', 99);
const crashFreePercent = readNumberArg(argv, '--crash-free=', 99.95);
const minCrashFreePercent = readNumberArg(argv, '--min-crash-free=', 99.9);
const p0IncidentCount = readNumberArg(argv, '--p0-incidents=', 0);
const p1IncidentCount = readNumberArg(argv, '--p1-incidents=', 0);
const maxP1Incidents = readNumberArg(argv, '--max-p1-incidents=', 0);
const denytiveFeedbackPercent = readNumberArg(argv, '--denytive-feedback=', 5);
const maxNegativeFeedbackPercent = readNumberArg(argv, '--max-denytive-feedback=', 15);
const nextCohortPercent = readNumberArg(argv, '--next-cohort-percent=', 10);
const maxNextCohortPercent = readNumberArg(argv, '--max-next-cohort-percent=', 25);

main();

function main(): void {
  try {
    const source = readReleaseExecutionSource();
    const service = new CapabilityAutopilotCanaryMonitoringPromotionGateService();
    const snapshot = service.buildCanaryPromotionSnapshot(source, {
      canaryObservationComplete,
      observationWindowMinutes,
      minObservationWindowMinutes,
      telemetryFresh,
      metricsWindowComplete,
      errorRatePercent,
      maxErrorRatePercent,
      p95LatencyMs,
      maxP95LatencyMs,
      successRatePercent,
      minSuccessRatePercent,
      crashFreePercent,
      minCrashFreePercent,
      p0IncidentCount,
      p1IncidentCount,
      maxP1Incidents,
      rollbackTriggered,
      rollbackRecommended,
      supportLoadOk,
      denytiveFeedbackPercent,
      maxNegativeFeedbackPercent,
      canaryCohortStable,
      promotionApproved,
      nextCohortPercent,
      maxNextCohortPercent,
      rollbackRunbookReady,
      observabilityReviewReady,
      auditPersisted,
      autoPromoteEnabled,
      globalRolloutEnabled,
      skipApprovalEnabled,
      actorId: 'gate-83-gate',
      canaryPromotionReceiptId: 'gate-83-canary-promotion',
      observationWindowId: canaryObservationComplete ? 'gate-83-observation-window' : null,
      telemetrySnapshotId: telemetryFresh ? 'gate-83-telemetry-snapshot' : null,
      incidentReviewId: 'gate-83-incident-review',
      feedbackSummaryId: 'gate-83-feedback-summary',
      nextCohortId: 'gate-83-next-cohort',
      promotionApprovalId: promotionApproved ? 'gate-83-promotion-approval' : null,
      rollbackRunbookId: rollbackRunbookReady ? 'gate-83-rollback-runbook' : null,
      observabilityReviewId: observabilityReviewReady ? 'gate-83-observability-review' : null,
      auditReceiptId: auditPersisted ? 'gate-83-audit' : null,
      reason: 'gate-83-canary-monitoring-promotion-gate',
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

    process.stderr.write(`[capability-autopilot-canary-promotion] failure: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

function readReleaseExecutionSource(): CapabilityAutopilotReleaseExecutionSnapshot {
  return readNestedJsonFromTsxScript(
    'scripts/capability-autopilot-release-execution.ts',
    argv,
    {
      dropArgs: [
        '--json',
        '--require-pass',
        '--gate',
        '--observation-incomplete',
        '--telemetry-stale',
        '--metrics-window-incomplete',
        '--rollback-triggered',
        '--rollback-recommended',
        '--support-load-high',
        '--canary-unstable',
        '--no-promotion-approval',
        '--no-rollback-runbook',
        '--no-observability-review',
        '--no-audit-persisted',
        '--auto-promote',
        '--global-rollout',
        '--skip-approval',
      ],
      dropPrefixes: [
        '--observation-window-minutes=',
        '--min-observation-window-minutes=',
        '--error-rate=',
        '--max-error-rate=',
        '--p95-latency=',
        '--max-p95-latency=',
        '--success-rate=',
        '--min-success-rate=',
        '--crash-free=',
        '--min-crash-free=',
        '--p0-incidents=',
        '--p1-incidents=',
        '--max-p1-incidents=',
        '--denytive-feedback=',
        '--max-denytive-feedback=',
        '--next-cohort-percent=',
        '--max-next-cohort-percent=',
      ],
    },
  );
}
