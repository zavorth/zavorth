import { CanaryMonitoringRollbackGateService } from '../../src/services/CanaryMonitoringRollbackGateService.js';

describe('CanaryMonitoringRollbackGateService Preview engine2', () => {
  it('builds a monitoring and rollback gate from the canary launch rehearsal', () => {
    const snapshot = new CanaryMonitoringRollbackGateService({
      now: () => new Date('2026-05-05T04:50:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.checkpoint-22');
    expect(snapshot.status).toBe('monitoring-gate-ready');
    expect(snapshot.releaseCandidate).toEqual(
      expect.objectContaining({
        id: 'zavorth@1.1.0-rc.1',
        packageName: 'zavorth',
        packageVersion: '1.1.0',
        channel: 'release-candidate',
        npmDistTag: 'rc',
        monitoringGateOnly: true,
      }),
    );
    expect(snapshot.monitoring).toEqual(
      expect.objectContaining({
        state: 'monitoring-gate-ready',
        effectiveDecision: 'hold',
        canaryCohortId: 'dry-run-canary-cohort',
        featureFlagKey: 'zavorth.rc.1.1.canary',
        observationWindowHours: 48,
        monitoringCadenceMinutes: 15,
        initialCanaryPercent: 5,
        maxCanaryPercentBeforePromotion: 5,
        abortThresholdsDefined: true,
        healthSignalMode: 'dry-run',
        rollbackTriggerMode: 'dry-run',
        rollbackCommandRehearsed: true,
        liveTrafficObserved: false,
        rollbackRecommended: false,
        promotable: false,
      }),
    );
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        controls: 17,
        requiredControls: 17,
        linkedControls: 2,
        monitoringReadyControls: 6,
        rollbackReadyControls: 4,
        operatorReadyControls: 2,
        lockedControls: 3,
        blockedControls: 0,
        gates: 10,
        passedGates: 10,
        failedGates: 0,
        receipts: 17,
        launchRehearsalStatus: 'rehearsal-ready',
        launchRehearsalReady: true,
        heldReleaseExecutionGateLinked: true,
        observationWindowDefined: true,
        telemetryDashboardReady: true,
        healthBudgetReady: true,
        errorRateThresholdReady: true,
        latencyThresholdReady: true,
        cohortExposureBounded: true,
        abortThresholdsReady: true,
        rollbackTriggersReady: true,
        rollbackCommandRehearsed: true,
        killSwitchReady: true,
        auditEvidenceReady: true,
        operatorHandoffsReady: true,
        monitoringRollbackGateReady: true,
        liveTrafficObserved: false,
        signatureRecorded: false,
        launchAuthorized: false,
        executionApproved: false,
        canaryStarted: false,
        rollbackExecuted: false,
        rolloutStarted: false,
        promotionExecuted: false,
        remoteStateMutated: false,
        npmPublishExecuted: false,
        githubReleaseCreated: false,
        gitTagMoved: false,
        secretValuesSerialized: false,
      }),
    );
  });

  it('keeps monitoring gate dry-run only and promotion held', () => {
    const snapshot = new CanaryMonitoringRollbackGateService({
      now: () => new Date('2026-05-05T04:55:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.receipts).toHaveLength(17);
    expect(snapshot.receipts[0]).toEqual(
      expect.objectContaining({
        id: expect.stringContaining('canary-monitoring-rollback.'),
        liveTrafficObserved: false,
        noCanaryStarted: true,
        noRollbackExecuted: true,
        noPromotionExecuted: true,
        noPackagePublished: true,
        noRemoteMutation: true,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'monitoring-signals-ready',
          status: 'pass',
          observed: true,
        }),
        expect.objectContaining({
          id: 'rollback-controls-ready',
          status: 'pass',
          observed: true,
        }),
        expect.objectContaining({
          id: 'publication-and-promotion-held',
          status: 'pass',
          observed: true,
        }),
      ]),
    );
    expect(snapshot.commands).toEqual(
      expect.objectContaining({
        run: 'npm run canary-monitoring-rollback-gate --silent',
        runJson: 'npm run canary-monitoring-rollback-gate:json --silent',
        check: 'npm run canary-monitoring-rollback-gate:check --silent',
        requireGateReady: 'npm run canary-monitoring-rollback-gate --silent -- --require-gate-ready',
        launchRehearsal: 'npm run canary-launch-rehearsal --silent -- --require-rehearsed',
        releaseExecutionHeld: 'npm run capability-autopilot:release-execution --silent -- --no-execution-approval --no-tag-approval --no-publish-approval --no-canary-launch-approval',
        monitoringDryRun: 'dry-run:monitor-canary --cohort dry-run-canary-cohort --window-hours 48 --no-traffic',
        rollbackDryRun: 'dry-run:rollback-command --checkpoint required --no-execute',
        nextStage: 'Canary promotion decision ledger',
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        monitoringGateOnly: true,
        consumesCanaryLaunchRehearsal: true,
        noLiveTrafficByDefault: true,
        noSignatureRecordedByDefault: true,
        noLaunchAuthorizedByDefault: true,
        noCanaryStarted: true,
        noRollbackExecuted: true,
        noRolloutStarted: true,
        noPromotionExecuted: true,
        noNpmPublish: true,
        noGithubReleaseCreated: true,
        noGitTagMoved: true,
        noStableTagMoved: true,
        noLatestTagMoved: true,
        noAutomaticExecution: true,
        noAutomaticPromotion: true,
        abortThresholdsRequired: true,
        observationWindowRequired: true,
        healthSignalsRequired: true,
        rollbackGateRequiredBeforePromotion: true,
        incidentCommanderRequired: true,
        supportBridgeRequired: true,
        auditEvidenceRequired: true,
        manualPromotionRequired: true,
        noRemoteMutationByDefault: true,
        noNetworkRequiredByDefault: true,
        secretsSerialized: false,
      }),
    );
  });

  it('formats canary monitoring rollback gate text', () => {
    const service = new CanaryMonitoringRollbackGateService({
      now: () => new Date('2026-05-05T05:00:00.000Z'),
    });
    const report = service.formatGateText();

    expect(report).toContain('Zavorth Canary Monitoring And Rollback Gate');
    expect(report).toContain('Status: monitoring-gate-ready');
    expect(report).toContain('Release candidate: zavorth@1.1.0-rc.1');
    expect(report).toContain('Monitoring state: monitoring-gate-ready');
    expect(report).toContain('Effective decision: hold');
    expect(report).toContain('Observation window: 48h');
    expect(report).toContain('Monitoring cadence: 15m');
    expect(report).toContain('Abort thresholds defined: true');
    expect(report).toContain('Rollback command rehearsed: true');
    expect(report).toContain('Live traffic observed: false');
    expect(report).toContain('Promotable: false');
    expect(report).toContain('Controls: 2 linked, 6 monitoring-ready, 4 rollback-ready, 2 operator-ready, 3 locked, 0 blocked');
    expect(report).toContain('Launch rehearsal ready: true');
    expect(report).toContain('Monitoring rollback gate ready: true');
    expect(report).toContain('Canary started: false');
    expect(report).toContain('Rollback executed: false');
    expect(report).toContain('Promotion executed: false');
    expect(report).toContain('Remote state mutated: false');
    expect(report).toContain('Next: Canary promotion decision ledger');
  });
});
