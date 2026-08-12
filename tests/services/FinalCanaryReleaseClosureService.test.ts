import { FinalCanaryReleaseClosureService } from '../../src/services/FinalCanaryReleaseClosureService.js';

describe('FinalCanaryReleaseClosureService Preview engine4', () => {
  it('builds final closure from the canary promotion decision ledger', () => {
    const snapshot = new FinalCanaryReleaseClosureService({
      now: () => new Date('2026-05-05T05:30:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.checkpoint-24');
    expect(snapshot.status).toBe('closure-ready');
    expect(snapshot.releaseCandidate).toEqual(
      expect.objectContaining({
        id: 'zavorth@1.1.0-rc.1',
        packageName: 'zavorth',
        packageVersion: '1.1.0',
        channel: 'release-candidate',
        npmDistTag: 'rc',
        finalClosureOnly: true,
      }),
    );
    expect(snapshot.closure).toEqual(
      expect.objectContaining({
        state: 'closure-ready',
        stageRange: '20-24',
        effectiveDecision: 'hold',
        finalSequenceDecision: 'closed-dry-run',
        canaryDryRunSequenceComplete: true,
        readyForSeparateManualReleaseDecision: true,
        manualReleaseDecisionRecorded: false,
        canaryCohortId: 'dry-run-canary-cohort',
        featureFlagKey: 'zavorth.rc.1.1.canary',
        observationWindowHours: 48,
        selectedPromotionDecision: 'hold',
        recommendedPromotionDecision: 'await-live-evidence',
        noFurtherAutomatedStage: true,
        sequenceClosesAtStage24: true,
      }),
    );
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        items: 16,
        requiredItems: 16,
        linkedItems: 2,
        closureReadyItems: 8,
        operatorReadyItems: 3,
        lockedItems: 3,
        blockedItems: 0,
        gates: 10,
        passedGates: 10,
        failedGates: 0,
        receipts: 16,
        promotionDecisionLedgerStatus: 'decision-ledger-ready',
        promotionDecisionLedgerReady: true,
        heldReleaseExecutionGateLinked: true,
        previewEngine0Linked: true,
        previewEngine1Linked: true,
        previewEngine2Linked: true,
        previewEngine3Linked: true,
        stageChainComplete: true,
        closureEvidenceComplete: true,
        manualHandoffsReady: true,
        finalCanaryReleaseClosureReady: true,
        manualReleaseDecisionRecorded: false,
        releaseExecuted: false,
        canaryStarted: false,
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

  it('keeps final closure dry-run only and ends the automated phase chain', () => {
    const snapshot = new FinalCanaryReleaseClosureService({
      now: () => new Date('2026-05-05T05:35:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.receipts).toHaveLength(16);
    expect(snapshot.receipts[0]).toEqual(
      expect.objectContaining({
        id: expect.stringContaining('final-canary-release-closure.'),
        manualReleaseDecisionRecorded: false,
        noReleaseExecuted: true,
        noCanaryStarted: true,
        noCanaryExpanded: true,
        noRollbackExecuted: true,
        noPauseExecuted: true,
        noPackagePublished: true,
        noReleaseCreated: true,
        noTagMoved: true,
        noRemoteMutation: true,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'phase-chain-complete',
          status: 'pass',
          observed: true,
        }),
        expect.objectContaining({
          id: 'live-side-effects-blocked',
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
        run: 'npm run final-canary-release-closure --silent',
        runJson: 'npm run final-canary-release-closure:json --silent',
        check: 'npm run final-canary-release-closure:check --silent',
        requireClosureReady: 'npm run final-canary-release-closure --silent -- --require-closure-ready',
        promotionDecisionLedger: 'npm run canary-promotion-decision-ledger --silent -- --require-ledger-ready',
        releaseExecutionHeld: 'npm run capability-autopilot:release-execution --silent -- --no-execution-approval --no-tag-approval --no-publish-approval --no-canary-launch-approval',
        chainValidation: 'dry-run:validate-canary-chain --phases 20-24 --no-execute',
        manualReleaseDecisionHandoff: 'manual:open-release-decision-outside-dry-run-chain --requires-signed-evidence',
        completion: 'Canary dry-run sequence complete at Preview engine4',
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        finalClosureOnly: true,
        consumesCanaryPromotionDecisionLedger: true,
        closesCanaryDryRunSequence: true,
        sequenceClosesAtStage24: true,
        noFurtherAutomatedStage: true,
        noManualReleaseDecisionRecordedByDefault: true,
        noReleaseExecuted: true,
        noCanaryStarted: true,
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
        separateManualReleaseDecisionRequired: true,
        signedMonitoringEvidenceRequiredForFuturePromotion: true,
        auditClosureRequired: true,
        incidentCommanderRequired: true,
        supportBridgeRequired: true,
        noRemoteMutationByDefault: true,
        noNetworkRequiredByDefault: true,
        secretsSerialized: false,
      }),
    );
  });

  it('formats final canary release closure text', () => {
    const service = new FinalCanaryReleaseClosureService({
      now: () => new Date('2026-05-05T05:40:00.000Z'),
    });
    const report = service.formatClosureText();

    expect(report).toContain('Zavorth Final Canary Release Closure');
    expect(report).toContain('Status: closure-ready');
    expect(report).toContain('Release candidate: zavorth@1.1.0-rc.1');
    expect(report).toContain('Closure state: closure-ready');
    expect(report).toContain('Phase range: 20-24');
    expect(report).toContain('Effective decision: hold');
    expect(report).toContain('Final sequence decision: closed-dry-run');
    expect(report).toContain('Canary dry-run sequence complete: true');
    expect(report).toContain('Ready for separate manual release decision: true');
    expect(report).toContain('Manual release decision recorded: false');
    expect(report).toContain('No further automated stage: true');
    expect(report).toContain('Sequence closes at Preview engine4: true');
    expect(report).toContain('Items: 2 linked, 8 closure-ready, 3 operator-ready, 3 locked, 0 blocked');
    expect(report).toContain('Promotion decision ledger ready: true');
    expect(report).toContain('Phase chain complete: true');
    expect(report).toContain('Final closure ready: true');
    expect(report).toContain('Release executed: false');
    expect(report).toContain('Canary started: false');
    expect(report).toContain('Canary expanded: false');
    expect(report).toContain('Rollback executed: false');
    expect(report).toContain('Remote state mutated: false');
    expect(report).toContain('Completion: Canary dry-run sequence complete at Preview engine4');
  });
});
