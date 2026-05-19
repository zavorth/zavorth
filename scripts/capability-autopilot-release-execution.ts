#!/usr/bin/env node
import {
  readArg,
  readNestedJsonFromTsxScript,
  readNumberArg,
} from './lib/capability-autopilot-script-utils.js';
import { CapabilityAutopilotReleaseExecutionGateService } from '../src/services/CapabilityAutopilotReleaseExecutionGateService.js';
import type { CapabilityAutopilotReleaseRolloutPlanSnapshot } from '../src/services/CapabilityAutopilotReleaseRolloutPlanService.js';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const requirePass = argv.includes('--require-pass') || argv.includes('--gate');
const releaseExecutionApproved = !argv.includes('--no-execution-approval');
const manualOperatorPresent = !argv.includes('--no-manual-operator');
const versionManifestReady = !argv.includes('--no-version-manifest');
const releaseBranchClean = !argv.includes('--branch-dirty');
const tagCreationApproved = !argv.includes('--no-tag-approval');
const publishApproved = !argv.includes('--no-publish-approval');
const releaseBundleVerified = !argv.includes('--no-release-bundle-verify');
const signedArtifactsReady = !argv.includes('--no-signed-artifacts');
const provenanceReady = !argv.includes('--no-provenance');
const changelogFrozen = !argv.includes('--changelog-unfrozen');
const docsFrozen = !argv.includes('--docs-unfrozen');
const canaryLaunchApproved = !argv.includes('--no-canary-launch-approval');
const canaryCohortReady = !argv.includes('--no-canary-cohort');
const smokeBeforeCanaryPassed = !argv.includes('--pre-canary-smoke-failed');
const rollbackCheckpointReady = !argv.includes('--no-rollback-checkpoint');
const rollbackDryRunPassed = !argv.includes('--rollback-dry-run-failed');
const observabilityLive = !argv.includes('--no-observability');
const incidentCommanderAssigned = !argv.includes('--no-incident-commander');
const supportBridgeReady = !argv.includes('--no-support-bridge');
const auditSinkReady = !argv.includes('--no-audit-sink');
const autoExecuteEnabled = argv.includes('--auto-execute');
const globalRolloutEnabled = argv.includes('--global-rollout');
const skipCanaryEnabled = argv.includes('--skip-canary');
const releaseVersion = readArg(argv, '--release-version=') || '1.1.0-rc.0';
const releaseTag = readArg(argv, '--release-tag=') || `v${releaseVersion}`;
const initialCanaryPercent = readNumberArg(argv, '--initial-canary-percent=', 5);
const maxInitialCanaryPercent = readNumberArg(argv, '--max-initial-canary-percent=', 5);

main();

function main(): void {
  try {
    const source = readRolloutPlanSource();
    const service = new CapabilityAutopilotReleaseExecutionGateService();
    const snapshot = service.buildExecutionSnapshot(source, {
      releaseExecutionApproved,
      manualOperatorPresent,
      releaseVersion,
      releaseTag,
      versionManifestReady,
      releaseBranchClean,
      tagCreationApproved,
      publishApproved,
      releaseBundleVerified,
      signedArtifactsReady,
      provenanceReady,
      changelogFrozen,
      docsFrozen,
      canaryLaunchApproved,
      initialCanaryPercent,
      maxInitialCanaryPercent,
      canaryCohortReady,
      smokeBeforeCanaryPassed,
      rollbackCheckpointReady,
      rollbackDryRunPassed,
      observabilityLive,
      incidentCommanderAssigned,
      supportBridgeReady,
      auditSinkReady,
      autoExecuteEnabled,
      globalRolloutEnabled,
      skipCanaryEnabled,
      actorId: 'checkpoint-82-gate',
      executionGateReceiptId: 'checkpoint-82-release-execution',
      versionManifestId: versionManifestReady ? 'checkpoint-82-version-manifest' : null,
      tagApprovalReceiptId: tagCreationApproved ? 'checkpoint-82-tag-approval' : null,
      publishApprovalReceiptId: publishApproved ? 'checkpoint-82-publish-approval' : null,
      artifactVerificationReceiptId: releaseBundleVerified ? 'checkpoint-82-artifact-verification' : null,
      provenanceReceiptId: provenanceReady ? 'checkpoint-82-provenance' : null,
      canaryLaunchReceiptId: canaryLaunchApproved ? 'checkpoint-82-canary-launch' : null,
      smokeReceiptId: smokeBeforeCanaryPassed ? 'checkpoint-82-pre-canary-smoke' : null,
      rollbackCheckpointId: rollbackCheckpointReady ? 'checkpoint-82-rollback-checkpoint' : null,
      rollbackDryRunReceiptId: rollbackDryRunPassed ? 'checkpoint-82-rollback-dry-run' : null,
      observabilityDashboardId: observabilityLive ? 'checkpoint-82-observability' : null,
      incidentCommanderId: incidentCommanderAssigned ? 'checkpoint-82-incident-commander' : null,
      supportBridgeId: supportBridgeReady ? 'checkpoint-82-support-bridge' : null,
      auditReceiptId: auditSinkReady ? 'checkpoint-82-audit' : null,
      reason: 'checkpoint-82-release-execution-gate',
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
    process.stderr.write(`[capability-autopilot-release-execution] falha: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

function readRolloutPlanSource(): CapabilityAutopilotReleaseRolloutPlanSnapshot {
  return readNestedJsonFromTsxScript(
    'scripts/capability-autopilot-release-rollout.ts',
    argv,
    {
      dropArgs: [
        '--json',
        '--require-pass',
        '--gate',
        '--no-execution-approval',
        '--no-manual-operator',
        '--no-version-manifest',
        '--branch-dirty',
        '--no-tag-approval',
        '--no-publish-approval',
        '--no-release-bundle-verify',
        '--no-signed-artifacts',
        '--no-provenance',
        '--changelog-unfrozen',
        '--docs-unfrozen',
        '--no-canary-launch-approval',
        '--no-canary-cohort',
        '--pre-canary-smoke-failed',
        '--no-rollback-checkpoint',
        '--rollback-dry-run-failed',
        '--no-observability',
        '--no-incident-commander',
        '--no-support-bridge',
        '--no-audit-sink',
        '--auto-execute',
        '--global-rollout',
        '--skip-canary',
      ],
      dropPrefixes: [
        '--release-version=',
        '--release-tag=',
        '--initial-canary-percent=',
        '--max-initial-canary-percent=',
      ],
    },
  );
}
