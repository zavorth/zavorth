import { CanaryLaunchRehearsalService } from '../../src/services/CanaryLaunchRehearsalService.js';

describe('CanaryLaunchRehearsalService Phase 21', () => {
  it('builds a launch rehearsal from the canary execution approval ledger', () => {
    const snapshot = new CanaryLaunchRehearsalService({
      now: () => new Date('2026-05-05T04:30:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.phase-21');
    expect(snapshot.status).toBe('rehearsal-ready');
    expect(snapshot.releaseCandidate).toEqual(
      expect.objectContaining({
        id: 'zavorth@1.1.0-rc.1',
        packageName: 'zavorth',
        packageVersion: '1.1.0',
        channel: 'release-candidate',
        npmDistTag: 'rc',
        launchRehearsalOnly: true,
      }),
    );
    expect(snapshot.rehearsal).toEqual(
      expect.objectContaining({
        state: 'rehearsal-ready',
        effectiveDecision: 'hold',
        signaturePathRehearsed: true,
        signedLedgerFixture: 'unsigned-fixture',
        launchCommandRendered: true,
        launchAuthorized: false,
        executable: false,
        canaryCohortId: 'dry-run-canary-cohort',
        featureFlagKey: 'zavorth.rc.1.1.canary',
        observationWindowHours: 48,
        prelaunchSmokeMode: 'dry-run',
        rollbackCheckpointMode: 'dry-run',
        auditSinkMode: 'dry-run',
      }),
    );
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        steps: 15,
        requiredSteps: 15,
        linkedSteps: 2,
        rehearsalReadySteps: 8,
        operatorReadySteps: 2,
        lockedSteps: 3,
        blockedSteps: 0,
        gates: 9,
        passedGates: 9,
        failedGates: 0,
        receipts: 15,
        approvalLedgerStatus: 'ledger-ready',
        approvalLedgerReady: true,
        heldReleaseExecutionGateLinked: true,
        signaturePathRehearsed: true,
        launchCommandRehearsed: true,
        prelaunchSmokeRehearsed: true,
        featureFlagRehearsed: true,
        cohortRoutingRehearsed: true,
        rollbackCheckpointRehearsed: true,
        killSwitchRehearsed: true,
        auditSinkRehearsed: true,
        observabilityHandoffReady: true,
        supportBridgeReady: true,
        launchRehearsalReady: true,
        signatureRecorded: false,
        launchAuthorized: false,
        executionApproved: false,
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

  it('keeps launch rehearsal dry-run only and launch held', () => {
    const snapshot = new CanaryLaunchRehearsalService({
      now: () => new Date('2026-05-05T04:35:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.receipts).toHaveLength(15);
    expect(snapshot.receipts[0]).toEqual(
      expect.objectContaining({
        id: expect.stringContaining('canary-launch-rehearsal.'),
        signatureRecorded: false,
        launchAuthorized: false,
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
          id: 'signed-ledger-and-launch-command-rehearsed',
          status: 'pass',
          observed: true,
        }),
        expect.objectContaining({
          id: 'launch-side-effects-blocked',
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
        run: 'npm run canary-launch-rehearsal --silent',
        runJson: 'npm run canary-launch-rehearsal:json --silent',
        check: 'npm run canary-launch-rehearsal:check --silent',
        requireRehearsed: 'npm run canary-launch-rehearsal --silent -- --require-rehearsed',
        approvalLedger: 'npm run canary-execution-approval-ledger --silent -- --require-ledger-ready',
        releaseExecutionHeld: 'npm run capability-autopilot:release-execution --silent -- --no-execution-approval --no-tag-approval --no-publish-approval --no-canary-launch-approval',
        launchCommandDryRun: 'dry-run:render-canary-launch-command --no-execute',
        rollbackDryRun: 'dry-run:rollback-checkpoint --no-write',
        nextPhase: 'Canary monitoring and rollback gate',
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        launchRehearsalOnly: true,
        consumesCanaryExecutionApprovalLedger: true,
        noSignatureRecordedByDefault: true,
        noLaunchAuthorizedByDefault: true,
        noCanaryStarted: true,
        noRolloutStarted: true,
        noDeployExecuted: true,
        noPromotionExecuted: true,
        noNpmPublish: true,
        noGithubReleaseCreated: true,
        noGitTagMoved: true,
        noStableTagMoved: true,
        noLatestTagMoved: true,
        noAutomaticExecution: true,
        noAutomaticPromotion: true,
        signedLedgerRequiredForRealLaunch: true,
        launchRehearsalRequiredBeforeRealCanary: true,
        rollbackCheckpointRequired: true,
        auditSinkRequired: true,
        observabilityHandoffRequired: true,
        supportBridgeRequired: true,
        noRemoteMutationByDefault: true,
        noNetworkRequiredByDefault: true,
        secretsSerialized: false,
      }),
    );
  });

  it('formats canary launch rehearsal text', () => {
    const service = new CanaryLaunchRehearsalService({
      now: () => new Date('2026-05-05T04:40:00.000Z'),
    });
    const report = service.formatRehearsalText();

    expect(report).toContain('Zavorth Canary Launch Rehearsal');
    expect(report).toContain('Status: rehearsal-ready');
    expect(report).toContain('Release candidate: zavorth@1.1.0-rc.1');
    expect(report).toContain('Rehearsal state: rehearsal-ready');
    expect(report).toContain('Effective decision: hold');
    expect(report).toContain('Signed ledger fixture: unsigned-fixture');
    expect(report).toContain('Launch command rendered: true');
    expect(report).toContain('Steps: 2 linked, 8 rehearsal-ready, 2 operator-ready, 3 locked, 0 blocked');
    expect(report).toContain('Approval ledger ready: true');
    expect(report).toContain('Launch rehearsal ready: true');
    expect(report).toContain('Signature recorded: false');
    expect(report).toContain('Launch authorized: false');
    expect(report).toContain('Canary started: false');
    expect(report).toContain('Remote state mutated: false');
    expect(report).toContain('Next: Canary monitoring and rollback gate');
  });
});
