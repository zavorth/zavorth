import { PreCanaryGoNoGoAlignmentService } from '../../src/services/PreCanaryGoNoGoAlignmentService.js';

describe('PreCanaryGoNoGoAlignmentService Phase 18', () => {
  it('aligns pre-canary go/no-go from the rehearsed release candidate', () => {
    const snapshot = new PreCanaryGoNoGoAlignmentService({
      now: () => new Date('2026-05-05T02:10:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.phase-18');
    expect(snapshot.status).toBe('aligned');
    expect(snapshot.releaseCandidate).toEqual(
      expect.objectContaining({
        id: 'zavorth@1.1.0-rc.1',
        packageName: 'zavorth',
        packageVersion: '1.1.0',
        channel: 'release-candidate',
        npmDistTag: 'rc',
        preCanaryAlignmentOnly: true,
      }),
    );
    expect(snapshot.decision).toEqual(
      expect.objectContaining({
        state: 'ready-for-decision',
        effectiveDecision: 'hold',
        approvalRecorded: false,
        goDecisionRecorded: false,
        noGoDecisionRecorded: false,
        approvalReceiptId: null,
        approverId: null,
        rollbackOwner: null,
        incidentOwner: null,
      }),
    );
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        controls: 12,
        requiredControls: 12,
        alignedControls: 5,
        operatorReadyControls: 4,
        lockedControls: 3,
        blockedControls: 0,
        gates: 7,
        passedGates: 7,
        failedGates: 0,
        receipts: 12,
        distributionRehearsalStatus: 'rehearsed',
        distributionRehearsed: true,
        preCanaryRuntimeGateLinked: true,
        releaseAdoptionGateLinked: true,
        publicAdoptionGateLinked: true,
        rollbackPreviewLinked: true,
        alignmentReady: true,
        canaryStartAuthorized: false,
        canaryStarted: false,
        rolloutStarted: false,
        deployExecuted: false,
        remoteStateMutated: false,
        npmPublishExecuted: false,
        githubReleaseCreated: false,
        gitTagMoved: false,
        secretValuesSerialized: false,
      }),
    );
  });

  it('keeps go/no-go aligned without authorizing canary start', () => {
    const snapshot = new PreCanaryGoNoGoAlignmentService({
      now: () => new Date('2026-05-05T02:15:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.receipts).toHaveLength(12);
    expect(snapshot.receipts[0]).toEqual(
      expect.objectContaining({
        id: expect.stringContaining('pre-canary-go-no-go.'),
        noCanaryStarted: true,
        noRolloutStarted: true,
        noDeployExecuted: true,
        noPackagePublished: true,
        noRemoteMutation: true,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'go-no-go-decision-ledger-ready',
          status: 'pass',
          observed: true,
        }),
        expect.objectContaining({
          id: 'canary-side-effects-blocked',
          status: 'pass',
          observed: true,
        }),
        expect.objectContaining({
          id: 'no-publication-regression',
          status: 'pass',
          observed: true,
        }),
      ]),
    );
    expect(snapshot.commands).toEqual(
      expect.objectContaining({
        run: 'npm run pre-canary-go-no-go-alignment --silent',
        runJson: 'npm run pre-canary-go-no-go-alignment:json --silent',
        check: 'npm run pre-canary-go-no-go-alignment:check --silent',
        requireAligned: 'npm run pre-canary-go-no-go-alignment --silent -- --require-aligned',
        distributionRehearsal: 'npm run release-candidate-distribution-rehearsal --silent -- --require-rehearsed',
        releaseAdoptionReadiness: 'npm run release-adoption-readiness:check --silent',
        releaseCandidatePreCanary: 'npm run release-candidate-pre-canary:check --silent',
        publicAdoptionPilot: 'npm run public-adoption-pilot-loop:check --silent',
        rollbackPreview: 'npm run release:rollback-preview',
        nextPhase: 'Canary plan dry-run and hold',
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        alignmentOnly: true,
        consumesDistributionRehearsal: true,
        noCanaryStarted: true,
        noRolloutStarted: true,
        noDeployExecuted: true,
        noNpmPublish: true,
        noGithubReleaseCreated: true,
        noGitTagMoved: true,
        noStableTagMoved: true,
        noLatestTagMoved: true,
        noAutomaticPromotion: true,
        explicitApprovalRequired: true,
        approverRequired: true,
        rollbackOwnerRequired: true,
        incidentOwnerRequired: true,
        noRemoteMutationByDefault: true,
        noNetworkRequiredByDefault: true,
        secretsSerialized: false,
      }),
    );
  });

  it('formats pre-canary go/no-go alignment text', () => {
    const service = new PreCanaryGoNoGoAlignmentService({
      now: () => new Date('2026-05-05T02:20:00.000Z'),
    });
    const report = service.formatAlignmentText();

    expect(report).toContain('Zavorth Pre-Canary Go/No-Go Alignment');
    expect(report).toContain('Status: aligned');
    expect(report).toContain('Release candidate: zavorth@1.1.0-rc.1');
    expect(report).toContain('Decision state: ready-for-decision');
    expect(report).toContain('Effective decision: hold');
    expect(report).toContain('Controls: 5 aligned, 4 operator-ready, 3 locked, 0 blocked');
    expect(report).toContain('Distribution rehearsed: true');
    expect(report).toContain('Alignment ready: true');
    expect(report).toContain('Canary start authorized: false');
    expect(report).toContain('Remote state mutated: false');
    expect(report).toContain('Next: Canary plan dry-run and hold');
  });
});
