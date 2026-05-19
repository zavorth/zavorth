import { CanaryPlanDryRunHoldService } from '../../src/services/CanaryPlanDryRunHoldService.js';

describe('CanaryPlanDryRunHoldService Intent model9', () => {
  it('builds a canary dry-run plan from pre-canary go/no-go alignment', () => {
    const snapshot = new CanaryPlanDryRunHoldService({
      now: () => new Date('2026-05-05T03:10:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.checkpoint-19');
    expect(snapshot.status).toBe('dry-run-ready');
    expect(snapshot.releaseCandidate).toEqual(
      expect.objectContaining({
        id: 'zavorth@1.1.0-rc.1',
        packageName: 'zavorth',
        packageVersion: '1.1.0',
        channel: 'release-candidate',
        npmDistTag: 'rc',
        canaryPlanDryRunOnly: true,
      }),
    );
    expect(snapshot.plan).toEqual(
      expect.objectContaining({
        state: 'dry-run-ready',
        effectiveDecision: 'hold',
        executable: false,
        launchAuthorized: false,
        canaryCohortId: 'dry-run-canary-cohort',
        cohortPercent: 5,
        maxCohortPercent: 10,
        featureFlagKey: 'zavorth.rc.1.1.canary',
        featureFlagDefault: 'off',
        observationWindowHours: 48,
        minimumObservationWindowHours: 24,
      }),
    );
    expect(snapshot.plan.rollbackTrigger).toEqual(
      expect.objectContaining({
        errorRatePercent: 1,
        p95LatencyMs: 2500,
        crashFreePercent: 99.5,
        supportSeverity: 'high',
        killSwitchRequired: true,
      }),
    );
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        controls: 14,
        requiredControls: 14,
        alignedControls: 2,
        dryRunReadyControls: 6,
        operatorReadyControls: 2,
        lockedControls: 4,
        blockedControls: 0,
        gates: 8,
        passedGates: 8,
        failedGates: 0,
        receipts: 14,
        preCanaryAlignmentStatus: 'aligned',
        preCanaryAlignmentReady: true,
        rolloutPlanDryRunLinked: true,
        cohortDefined: true,
        flagDefaultOffDefined: true,
        observationWindowDefined: true,
        rollbackTriggerDefined: true,
        canaryPlanDryRunReady: true,
        canaryStartAuthorized: false,
        canaryStarted: false,
        rolloutStarted: false,
        deployExecuted: false,
        promotionExecuted: false,
        remoteStateMutated: false,
        npmPublishExecuted: false,
        githubReleaseCreated: false,
        gitTagMoved: false,
        secretValuesSerialized: false,
      }),
    );
  });

  it('keeps canary launch and promotion on hold', () => {
    const snapshot = new CanaryPlanDryRunHoldService({
      now: () => new Date('2026-05-05T03:15:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.receipts).toHaveLength(14);
    expect(snapshot.receipts[0]).toEqual(
      expect.objectContaining({
        id: expect.stringContaining('canary-plan-dry-run.'),
        noCanaryStarted: true,
        noRolloutStarted: true,
        noDeployExecuted: true,
        noPromotionExecuted: true,
        noPackagePublished: true,
        noRemoteMutation: true,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'cohort-flag-observation-defined',
          status: 'pass',
          observed: true,
        }),
        expect.objectContaining({
          id: 'canary-launch-side-effects-blocked',
          status: 'pass',
          observed: true,
        }),
        expect.objectContaining({
          id: 'promotion-and-publication-held',
          status: 'pass',
          observed: true,
        }),
      ]),
    );
    expect(snapshot.commands).toEqual(
      expect.objectContaining({
        run: 'npm run canary-plan-dry-run-hold --silent',
        runJson: 'npm run canary-plan-dry-run-hold:json --silent',
        check: 'npm run canary-plan-dry-run-hold:check --silent',
        requireDryRunReady: 'npm run canary-plan-dry-run-hold --silent -- --require-dry-run-ready',
        preCanaryAlignment: 'npm run pre-canary-go-no-go-alignment --silent -- --require-aligned',
        capabilityAutopilotRolloutPlan: 'npm run capability-autopilot:release-rollout --silent -- --require-pass',
        releaseExecutionHold: 'manual:hold-release-execution --no-publish --no-tag --no-canary-start',
        canaryPromotionHold: 'manual:hold-canary-promotion --no-next-cohort --no-auto-promote',
        nextStage: 'Canary execution approval ledger',
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        canaryPlanOnly: true,
        dryRunOnly: true,
        consumesPreCanaryGoNoGoAlignment: true,
        noCanaryStarted: true,
        noRolloutStarted: true,
        noDeployExecuted: true,
        noPromotionExecuted: true,
        noNpmPublish: true,
        noGithubReleaseCreated: true,
        noGitTagMoved: true,
        noStableTagMoved: true,
        noLatestTagMoved: true,
        noAutomaticPromotion: true,
        noSkipCanary: true,
        explicitLaunchApprovalRequired: true,
        rollbackTriggerRequired: true,
        observationWindowRequired: true,
        noRemoteMutationByDefault: true,
        noNetworkRequiredByDefault: true,
        secretsSerialized: false,
      }),
    );
  });

  it('formats canary plan dry-run text', () => {
    const service = new CanaryPlanDryRunHoldService({
      now: () => new Date('2026-05-05T03:20:00.000Z'),
    });
    const report = service.formatDryRunText();

    expect(report).toContain('Zavorth Canary Plan Dry-Run and Hold');
    expect(report).toContain('Status: dry-run-ready');
    expect(report).toContain('Release candidate: zavorth@1.1.0-rc.1');
    expect(report).toContain('Plan state: dry-run-ready');
    expect(report).toContain('Effective decision: hold');
    expect(report).toContain('Cohort: 5%/10%');
    expect(report).toContain('Feature flag: zavorth.rc.1.1.canary=off');
    expect(report).toContain('Observation window: 48h');
    expect(report).toContain('Controls: 2 aligned, 6 dry-run-ready, 2 operator-ready, 4 locked, 0 blocked');
    expect(report).toContain('Canary plan dry-run ready: true');
    expect(report).toContain('Canary start authorized: false');
    expect(report).toContain('Promotion executed: false');
    expect(report).toContain('Remote state mutated: false');
    expect(report).toContain('Next: Canary execution approval ledger');
  });
});
