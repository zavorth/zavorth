import { CanaryExecutionApprovalLedgerService } from '../../src/services/CanaryExecutionApprovalLedgerService.js';

describe('CanaryExecutionApprovalLedgerService Preview engine0', () => {
  it('builds an approval ledger from the canary dry-run plan', () => {
    const snapshot = new CanaryExecutionApprovalLedgerService({
      now: () => new Date('2026-05-05T04:10:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.checkpoint-20');
    expect(snapshot.status).toBe('ledger-ready');
    expect(snapshot.releaseCandidate).toEqual(
      expect.objectContaining({
        id: 'zavorth@1.1.0-rc.1',
        packageName: 'zavorth',
        packageVersion: '1.1.0',
        channel: 'release-candidate',
        npmDistTag: 'rc',
        approvalLedgerOnly: true,
      }),
    );
    expect(snapshot.ledger).toEqual(
      expect.objectContaining({
        state: 'ready-for-signature',
        effectiveDecision: 'hold',
        readyForSignature: true,
        signed: false,
        launchAuthorized: false,
        executionApproved: false,
        approvalReceiptId: null,
        ledgerId: 'canary-execution-approval-ledger',
        canaryCohortId: 'dry-run-canary-cohort',
        featureFlagKey: 'zavorth.rc.1.1.canary',
        observationWindowHours: 48,
      }),
    );
    expect(snapshot.ledger.requiredSignatures).toEqual([
      'releaseApprover',
      'manualOperator',
      'rollbackOwner',
      'incidentCommander',
      'auditOwner',
    ]);
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        entries: 14,
        requiredEntries: 14,
        linkedEntries: 2,
        approvalReadyEntries: 6,
        operatorReadyEntries: 3,
        lockedEntries: 3,
        blockedEntries: 0,
        gates: 8,
        passedGates: 8,
        failedGates: 0,
        receipts: 14,
        canaryPlanStatus: 'dry-run-ready',
        canaryPlanDryRunReady: true,
        releaseExecutionGateLinked: true,
        requiredSignatureSlotsReady: true,
        rollbackCheckpointReady: true,
        auditSinkReady: true,
        supportBridgeReady: true,
        observabilityDashboardReady: true,
        approvalLedgerReady: true,
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

  it('keeps approval ledger unsigned and launch held', () => {
    const snapshot = new CanaryExecutionApprovalLedgerService({
      now: () => new Date('2026-05-05T04:15:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.receipts).toHaveLength(14);
    expect(snapshot.receipts[0]).toEqual(
      expect.objectContaining({
        id: expect.stringContaining('canary-execution-approval.'),
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
          id: 'required-signature-slots-ready',
          status: 'pass',
          observed: true,
        }),
        expect.objectContaining({
          id: 'launch-side-effects-blocked',
          status: 'pass',
          observed: true,
        }),
        expect.objectContaining({
          id: 'publiction-and-promotion-held',
          status: 'pass',
          observed: true,
        }),
      ]),
    );
    expect(snapshot.commands).toEqual(
      expect.objectContaining({
        run: 'npm run canary-execution-approval-ledger --silent',
        runJson: 'npm run canary-execution-approval-ledger:json --silent',
        check: 'npm run canary-execution-approval-ledger:check --silent',
        requireLedgerReady: 'npm run canary-execution-approval-ledger --silent -- --require-ledger-ready',
        canaryPlanDryRun: 'npm run canary-plan-dry-run-hold --silent -- --require-dry-run-ready',
        releaseExecutionGate: 'npm run capability-autopilot:release-execution --silent -- --no-execution-approval --no-tag-approval --no-publish-approval --no-canary-launch-approval',
        approvalLedgerSign: 'manual:sign-canary-execution-approval-ledger --requires-release-approver-manual-operator-rollback-owner-incident-commander-audit-owner',
        launchHold: 'policy:hold-canary-launch --until-signed-ledger-and-launch-rehearsal',
        nextAction: 'Canary launch rehearsal',
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        approvalLedgerOnly: true,
        consumesCanaryPlanDryRun: true,
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
        explicitSignatureRequired: true,
        rollbackCheckpointRequired: true,
        auditSinkRequired: true,
        supportBridgeRequired: true,
        observabilityDashboardRequired: true,
        noRemoteMutationByDefault: true,
        noNetworkRequiredByDefault: true,
        secretsSerialized: false,
      }),
    );
  });

  it('formats canary execution approval ledger text', () => {
    const service = new CanaryExecutionApprovalLedgerService({
      now: () => new Date('2026-05-05T04:20:00.000Z'),
    });
    const report = service.formatLedgerText();

    expect(report).toContain('Zavorth Canary Execution Approval Ledger');
    expect(report).toContain('Status: ledger-ready');
    expect(report).toContain('Release candidate: zavorth@1.1.0-rc.1');
    expect(report).toContain('Ledger state: ready-for-signature');
    expect(report).toContain('Effective decision: hold');
    expect(report).toContain('Ready for signature: true');
    expect(report).toContain('Signed: false');
    expect(report).toContain('Launch authorized: false');
    expect(report).toContain('Entries: 2 linked, 6 approval-ready, 3 operator-ready, 3 locked, 0 blocked');
    expect(report).toContain('Approval ledger ready: true');
    expect(report).toContain('Signature recorded: false');
    expect(report).toContain('Canary started: false');
    expect(report).toContain('Remote state mutated: false');
    expect(report).toContain('Next: Canary launch rehearsal');
  });
});
