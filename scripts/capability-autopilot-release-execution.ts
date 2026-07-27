#!/usr/bin/env node
import { asErrorLike } from '../src/utils/errorLike';
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
      actorId: 'gate-82-gate',
      executionGateReceiptId: 'gate-82-release-execution',
      versionManifestId: versionManifestReady ? 'gate-82-version-manifest' : null,
      tagApprovalReceiptId: tagCreationApproved ? 'gate-82-tag-approval' : null,
      publishApprovalReceiptId: publishApproved ? 'gate-82-publish-approval' : null,
      artifactVerificationReceiptId: releaseBundleVerified ? 'gate-82-artifact-verification' : null,
      provenanceReceiptId: provenanceReady ? 'gate-82-provenance' : null,
      canaryLaunchReceiptId: canaryLaunchApproved ? 'gate-82-canary-launch' : null,
      smokeReceiptId: smokeBeforeCanaryPassed ? 'gate-82-pre-canary-smoke' : null,
      rollbackCheckpointId: rollbackCheckpointReady ? 'gate-82-rollback-checkpoint' : null,
      rollbackDryRunReceiptId: rollbackDryRunPassed ? 'gate-82-rollback-dry-run' : null,
      observabilityZavorthControlId: observabilityLive ? 'gate-82-observability' : null,
      incidentCommanderId: incidentCommanderAssigned ? 'gate-82-incident-commander' : null,
      supportBridgeId: supportBridgeReady ? 'gate-82-support-bridge' : null,
      auditReceiptId: auditSinkReady ? 'gate-82-audit' : null,
      reason: 'gate-82-release-execution-gate',
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

    process.stderr.write(`[capability-autopilot-release-execution] failure: ${error instanceof Error ? error.message : String(error)}\n`);
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
