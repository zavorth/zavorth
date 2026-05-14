import {
  CapabilityAutopilotReleaseExecutionGateService,
  type CapabilityAutopilotReleaseExecutionOptions,
} from '../../src/services/CapabilityAutopilotReleaseExecutionGateService';
import type { CapabilityAutopilotReleaseRolloutPlanSnapshot } from '../../src/services/CapabilityAutopilotReleaseRolloutPlanService';

const FIXED_NOW = new Date('2026-04-26T12:00:00.000Z');

const readyOptions: CapabilityAutopilotReleaseExecutionOptions = {
  releaseExecutionApproved: true,
  manualOperatorPresent: true,
  releaseVersion: '1.1.0-rc.0',
  releaseTag: 'v1.1.0-rc.0',
  versionManifestReady: true,
  releaseBranchClean: true,
  tagCreationApproved: true,
  publishApproved: true,
  releaseBundleVerified: true,
  signedArtifactsReady: true,
  provenanceReady: true,
  changelogFrozen: true,
  docsFrozen: true,
  canaryLaunchApproved: true,
  initialCanaryPercent: 5,
  maxInitialCanaryPercent: 5,
  canaryCohortReady: true,
  smokeBeforeCanaryPassed: true,
  rollbackCheckpointReady: true,
  rollbackDryRunPassed: true,
  observabilityLive: true,
  incidentCommanderAssigned: true,
  supportBridgeReady: true,
  auditSinkReady: true,
  autoExecuteEnabled: false,
  globalRolloutEnabled: false,
  skipCanaryEnabled: false,
  actorId: 'release-operator',
  executionGateReceiptId: 'execution-gate-1',
  versionManifestId: 'version-manifest-1',
  tagApprovalReceiptId: 'tag-approval-1',
  publishApprovalReceiptId: 'publish-approval-1',
  artifactVerificationReceiptId: 'artifact-verify-1',
  provenanceReceiptId: 'provenance-1',
  canaryLaunchReceiptId: 'canary-launch-1',
  smokeReceiptId: 'smoke-1',
  rollbackCheckpointId: 'rollback-checkpoint-1',
  rollbackDryRunReceiptId: 'rollback-dry-run-1',
  observabilityDashboardId: 'observability-dashboard-1',
  incidentCommanderId: 'incident-commander-1',
  supportBridgeId: 'support-bridge-1',
  auditReceiptId: 'audit-1',
  reason: 'phase-82-test',
};

function createSource(
  overrides: Partial<CapabilityAutopilotReleaseRolloutPlanSnapshot> = {},
): CapabilityAutopilotReleaseRolloutPlanSnapshot {
  return {
    phase: '81',
    rolloutPlanId: 'executor-gemini-cli-release-rollout-1',
    generatedAt: FIXED_NOW.toISOString(),
    surface: 'capability-autopilot-release-rollout-plan',
    capabilityId: 'executor-gemini-cli',
    status: 'rollout_plan_ready',
    recommendation: 'prepare_manual_v1_1_rollout',
    summary: {
      ok: true,
      passed: 7,
      warnings: 0,
      failed: 0,
    },
    sourceSnapshotPhase: '80',
    sourceStatus: 'release_candidate_ready',
    sourceRecommendation: 'promote_to_release_candidate',
    rolloutPlanApproved: true,
    rollout: {
      stagedCohortsDefined: true,
      canaryPercent: 5,
      maxCanaryPercent: 10,
      expansionStepCount: 3,
      minExpansionStepCount: 3,
      rollbackWindowHours: 48,
      minRollbackWindowHours: 24,
      canaryCohortId: 'canary-cohort-1',
      stagedCohortPlanId: 'staged-cohorts-1',
      limitedCanary: true,
    },
    releaseAssets: {
      changelogReady: true,
      changelogId: 'changelog-1',
      releaseBundleReady: true,
      releaseBundleId: 'release-bundle-1',
      installerSmokePassed: true,
      installerSmokeReceiptId: 'installer-smoke-1',
      docsPublicationReady: true,
      docsPublicationId: 'docs-publication-1',
    },
    operations: {
      rollbackRunbookReady: true,
      rollbackRunbookId: 'rollback-runbook-1',
      supportCommsReady: true,
      commsPlanId: 'comms-plan-1',
      statusPageDraftReady: true,
      telemetryDashboardsReady: true,
      telemetryDashboardId: 'telemetry-dashboard-1',
      releaseOwnerAssigned: true,
      releaseOwnerId: 'release-owner-1',
      releaseTrainSlotReserved: true,
      releaseTrainSlotId: 'release-train-slot-1',
      artifactRetentionReady: true,
      artifactRetentionPolicyId: 'artifact-retention-1',
    },
    safeguards: {
      manualPromotionRequired: true,
      rcFlagDefaultOff: true,
      publishTagEnabled: false,
      globalRolloutEnabled: false,
      autoRolloutEnabled: false,
    },
    blockers: [],
    checks: [],
    audit: {
      sourceGeneratedAt: FIXED_NOW.toISOString(),
      sourceReleaseCandidateGateId: 'release-candidate-1',
      actorId: 'rollout-operator',
      reason: 'phase-81-test',
      rolloutPlanReceiptId: 'rollout-plan-1',
    },
    nextRecommendedPhase: {
      phase: '82',
      title: 'Capability Autopilot v1.1 Release Execution Gate',
      reason: 'Execute manually.',
    },
    metadata: {
      autoExecute: false,
      rolloutPlanReady: true,
    },
    ...overrides,
  };
}

function createService() {
  return new CapabilityAutopilotReleaseExecutionGateService({
    now: () => FIXED_NOW,
  });
}

describe('CapabilityAutopilotReleaseExecutionGateService', () => {
  it('recommends manual v1.1 release execution when all gates are ready', () => {
    const service = createService();
    const snapshot = service.buildExecutionSnapshot(createSource(), readyOptions);

    expect(snapshot).toMatchObject({
      phase: '82',
      status: 'release_execution_ready',
      recommendation: 'execute_manual_v1_1_release',
      summary: {
        ok: true,
        failed: 0,
      },
      executionIntent: {
        releaseExecutionApproved: true,
        manualOperatorPresent: true,
        releaseVersion: '1.1.0-rc.0',
        releaseTag: 'v1.1.0-rc.0',
        versionManifestReady: true,
        releaseBranchClean: true,
      },
      publishGate: {
        tagCreationApproved: true,
        publishApproved: true,
      },
      artifacts: {
        releaseBundleVerified: true,
        signedArtifactsReady: true,
        provenanceReady: true,
        changelogFrozen: true,
        docsFrozen: true,
      },
      canary: {
        canaryLaunchApproved: true,
        initialCanaryPercent: 5,
        maxInitialCanaryPercent: 5,
        canaryCohortReady: true,
        smokeBeforeCanaryPassed: true,
      },
      rollbackAndObservability: {
        rollbackCheckpointReady: true,
        rollbackDryRunPassed: true,
        observabilityLive: true,
        auditSinkReady: true,
      },
      safeguards: {
        autoExecuteEnabled: false,
        globalRolloutEnabled: false,
        skipCanaryEnabled: false,
      },
      metadata: {
        autoExecute: false,
        releaseExecutionReady: true,
      },
    });
    expect(snapshot.blockers).toEqual([]);
    expect(JSON.stringify(snapshot)).not.toContain('rawText');
    expect(JSON.stringify(snapshot)).not.toContain('normalizedText');
  });

  it('holds rollout plan when source is not rollout-ready', () => {
    const service = createService();
    const source = createSource({
      status: 'blocked',
      recommendation: 'hold_release_candidate',
      summary: {
        ok: false,
        passed: 5,
        warnings: 0,
        failed: 1,
      },
    });

    const snapshot = service.buildExecutionSnapshot(source, readyOptions);

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.recommendation).toBe('hold_rollout_plan');
    expect(snapshot.blockers).toContain('source_rollout_plan_not_ready:blocked');
    expect(snapshot.checks.find((check) => check.id === 'capability-autopilot-release-execution:source-ready'))
      .toMatchObject({
        status: 'fail',
      });
  });

  it('blocks execution when manual intent or version data is incomplete', () => {
    const service = createService();
    const snapshot = service.buildExecutionSnapshot(createSource(), {
      ...readyOptions,
      releaseExecutionApproved: false,
      manualOperatorPresent: false,
      releaseVersion: null,
      releaseTag: 'v1.1.0-rc.0',
      versionManifestReady: false,
      releaseBranchClean: false,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.blockers).toEqual(expect.arrayContaining([
      'release_execution_approval_required',
      'manual_operator_required',
      'release_version_required',
      'version_manifest_required',
      'release_branch_clean_required',
    ]));
  });

  it('blocks execution when publish, canary, rollback or observability gates fail', () => {
    const service = createService();
    const snapshot = service.buildExecutionSnapshot(createSource(), {
      ...readyOptions,
      tagCreationApproved: false,
      publishApproved: false,
      releaseBundleVerified: false,
      signedArtifactsReady: false,
      provenanceReady: false,
      initialCanaryPercent: 20,
      maxInitialCanaryPercent: 5,
      canaryCohortReady: false,
      smokeBeforeCanaryPassed: false,
      rollbackCheckpointReady: false,
      rollbackDryRunPassed: false,
      observabilityLive: false,
      auditSinkReady: false,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.blockers).toEqual(expect.arrayContaining([
      'tag_creation_approval_required',
      'publish_approval_required',
      'release_bundle_verification_required',
      'signed_artifacts_required',
      'provenance_required',
      'initial_canary_percent_out_of_bounds',
      'canary_cohort_required',
      'pre_canary_smoke_required',
      'rollback_checkpoint_required',
      'rollback_dry_run_required',
      'observability_live_required',
      'audit_sink_required',
    ]));
  });

  it('blocks execution when broad automation safeguards are enabled', () => {
    const service = createService();
    const snapshot = service.buildExecutionSnapshot(createSource(), {
      ...readyOptions,
      autoExecuteEnabled: true,
      globalRolloutEnabled: true,
      skipCanaryEnabled: true,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.blockers).toEqual(expect.arrayContaining([
      'auto_execute_not_allowed',
      'global_rollout_not_allowed',
      'skip_canary_not_allowed',
    ]));
  });

  it('renders the next phase for canary monitoring and promotion gate', () => {
    const service = createService();
    const snapshot = service.buildExecutionSnapshot(createSource(), readyOptions);

    expect(service.renderReport(snapshot)).toContain('Fase 82 - Capability Autopilot v1.1 Release Execution Gate');
    expect(service.renderReport(snapshot)).toContain('proxima fase recomendada: 83 - Capability Autopilot v1.1 Canary Monitoring And Promotion Gate');
  });
});
