import { CanaryPromotionDecisionLedgerService } from '../../src/services/CanaryPromotionDecisionLedgerService.js';

describe('CanaryPromotionDecisionLedgerService Phase 23', () => {
  it('builds a promotion decision ledger from the canary monitoring rollback gate', () => {
    const snapshot = new CanaryPromotionDecisionLedgerService({
      now: () => new Date('2026-05-05T05:10:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.phase-23');
    expect(snapshot.status).toBe('decision-ledger-ready');
    expect(snapshot.releaseCandidate).toEqual(
      expect.objectContaining({
        id: 'zavorth@1.1.0-rc.1',
        packageName: 'zavorth',
        packageVersion: '1.1.0',
        channel: 'release-candidate',
        npmDistTag: 'rc',
        promotionDecisionLedgerOnly: true,
      }),
    );
    expect(snapshot.ledger).toEqual(
      expect.objectContaining({
        state: 'ready-for-signed-evidence',
        effectiveDecision: 'hold',
        selectedDecision: 'hold',
        availableDecisions: ['expand', 'pause', 'rollback'],
        recommendedDecision: 'await-live-evidence',
        canaryCohortId: 'dry-run-canary-cohort',
        featureFlagKey: 'zavorth.rc.1.1.canary',
        observationWindowHours: 48,
        currentCanaryPercent: 5,
        nextCohortPercent: 10,
        signedMonitoringEvidenceRequired: true,
        signedMonitoringEvidenceRecorded: false,
        promotionAuthorized: false,
        rollbackRecommended: false,
        pauseRecommended: false,
        promotable: false,
      }),
    );
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        entries: 16,
        requiredEntries: 16,
        linkedEntries: 2,
        decisionReadyEntries: 8,
        operatorReadyEntries: 3,
        lockedEntries: 3,
        blockedEntries: 0,
        gates: 10,
        passedGates: 10,
        failedGates: 0,
        receipts: 16,
        monitoringRollbackGateStatus: 'monitoring-gate-ready',
        monitoringRollbackGateReady: true,
        heldReleaseExecutionGateLinked: true,
        decisionOptionsExplicit: true,
        signedMonitoringEvidenceSlotReady: true,
        promotionApproverReady: true,
        manualOperatorReady: true,
        auditDecisionLedgerReady: true,
        operatorHandoffsReady: true,
        promotionDecisionLedgerReady: true,
        signedEvidenceRecorded: false,
        promotionAuthorized: false,
        canaryExpanded: false,
        rollbackExecuted: false,
        pauseExecuted: false,
        rolloutStarted: false,
        remoteStateMutated: false,
        npmPublishExecuted: false,
        githubReleaseCreated: false,
        gitTagMoved: false,
        secretValuesSerialized: false,
      }),
    );
  });

  it('keeps promotion decision ledger dry-run only and execution held', () => {
    const snapshot = new CanaryPromotionDecisionLedgerService({
      now: () => new Date('2026-05-05T05:15:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.receipts).toHaveLength(16);
    expect(snapshot.receipts[0]).toEqual(
      expect.objectContaining({
        id: expect.stringContaining('canary-promotion-decision.'),
        signedEvidenceRecorded: false,
        noPromotionAuthorized: true,
        noCanaryExpanded: true,
        noRollbackExecuted: true,
        noPauseExecuted: true,
        noPackagePublished: true,
        noRemoteMutation: true,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'decision-options-explicit',
          status: 'pass',
          observed: true,
        }),
        expect.objectContaining({
          id: 'promotion-side-effects-blocked',
          status: 'pass',
          observed: true,
        }),
        expect.objectContaining({
          id: 'rollback-and-pause-side-effects-blocked',
          status: 'pass',
          observed: true,
        }),
      ]),
    );
    expect(snapshot.commands).toEqual(
      expect.objectContaining({
        run: 'npm run canary-promotion-decision-ledger --silent',
        runJson: 'npm run canary-promotion-decision-ledger:json --silent',
        check: 'npm run canary-promotion-decision-ledger:check --silent',
        requireLedgerReady: 'npm run canary-promotion-decision-ledger --silent -- --require-ledger-ready',
        monitoringRollbackGate: 'npm run canary-monitoring-rollback-gate --silent -- --require-gate-ready',
        releaseExecutionHeld: 'npm run capability-autopilot:release-execution --silent -- --no-execution-approval --no-tag-approval --no-publish-approval --no-canary-launch-approval',
        promotionDecisionDryRun: 'dry-run:canary-promotion-decision --cohort dry-run-canary-cohort --from 5 --to 10 --no-execute',
        rollbackDecisionDryRun: 'dry-run:canary-rollback-decision --checkpoint required --no-execute',
        nextPhase: 'Final canary release closure',
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        promotionDecisionLedgerOnly: true,
        consumesCanaryMonitoringRollbackGate: true,
        noSignedEvidenceRecordedByDefault: true,
        noPromotionAuthorizedByDefault: true,
        noCanaryExpanded: true,
        noRollbackExecuted: true,
        noPauseExecuted: true,
        noRolloutStarted: true,
        noNpmPublish: true,
        noGithubReleaseCreated: true,
        noGitTagMoved: true,
        noStableTagMoved: true,
        noLatestTagMoved: true,
        noAutomaticExecution: true,
        noAutomaticPromotion: true,
        signedMonitoringEvidenceRequired: true,
        manualPromotionApprovalRequired: true,
        rollbackDecisionRequiredBeforeRollback: true,
        pauseDecisionRequiredBeforePause: true,
        finalClosureRequiredBeforeRelease: true,
        auditDecisionLedgerRequired: true,
        incidentCommanderRequired: true,
        supportBridgeRequired: true,
        noRemoteMutationByDefault: true,
        noNetworkRequiredByDefault: true,
        secretsSerialized: false,
      }),
    );
  });

  it('formats canary promotion decision ledger text', () => {
    const service = new CanaryPromotionDecisionLedgerService({
      now: () => new Date('2026-05-05T05:20:00.000Z'),
    });
    const report = service.formatLedgerText();

    expect(report).toContain('Zavorth Canary Promotion Decision Ledger');
    expect(report).toContain('Status: decision-ledger-ready');
    expect(report).toContain('Release candidate: zavorth@1.1.0-rc.1');
    expect(report).toContain('Ledger state: ready-for-signed-evidence');
    expect(report).toContain('Effective decision: hold');
    expect(report).toContain('Selected decision: hold');
    expect(report).toContain('Recommended decision: await-live-evidence');
    expect(report).toContain('Available decisions: expand, pause, rollback');
    expect(report).toContain('Current canary percent: 5');
    expect(report).toContain('Next cohort percent: 10');
    expect(report).toContain('Signed monitoring evidence recorded: false');
    expect(report).toContain('Promotion authorized: false');
    expect(report).toContain('Promotable: false');
    expect(report).toContain('Entries: 2 linked, 8 decision-ready, 3 operator-ready, 3 locked, 0 blocked');
    expect(report).toContain('Monitoring rollback gate ready: true');
    expect(report).toContain('Promotion decision ledger ready: true');
    expect(report).toContain('Canary expanded: false');
    expect(report).toContain('Rollback executed: false');
    expect(report).toContain('Pause executed: false');
    expect(report).toContain('Remote state mutated: false');
    expect(report).toContain('Next: Final canary release closure');
  });
});
