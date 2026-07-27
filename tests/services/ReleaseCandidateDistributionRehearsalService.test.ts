import { ReleaseCandidateDistributionRehearsalService } from '../../src/services/ReleaseCandidateDistributionRehearsalService.js';

describe('ReleaseCandidateDistributionRehearsalService Intent model7', () => {
  it('rehearses distribution from the frozen release candidate package', () => {
    const snapshot = new ReleaseCandidateDistributionRehearsalService({
      now: () => new Date('2026-05-05T01:10:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.checkpoint-17');
    expect(snapshot.status).toBe('rehearsed');
    expect(snapshot.releaseCandidate).toEqual(
      expect.objectContaining({
        id: 'zavorth@1.1.0-rc.1',
        packageName: 'zavorth',
        packageVersion: '1.1.0',
        channel: 'release-candidate',
        npmDistTag: 'rc',
        distributionRehearsalOnly: true,
      }),
    );
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        steps: 12,
        requiredSteps: 12,
        dryReadySteps: 8,
        operatorReadySteps: 4,
        blockedSteps: 0,
        gates: 7,
        passedGates: 7,
        failedGates: 0,
        receipts: 12,
        freezeStatus: 'frozen',
        packageFrozen: true,
        rehearsalReady: true,
        npmPublishExecuted: false,
        githubReleaseCreated: false,
        gitTagMoved: false,
        installerExecuted: false,
        remoteStateMutated: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'pack-dry-run-rehearsal',
          status: 'dry-ready',
          command: 'npm pack --dry-run',
        }),
        expect.objectContaining({
          id: 'npm-rc-publish-dry-run',
          status: 'dry-ready',
          command: 'npm publish --dry-run --tag rc',
        }),
        expect.objectContaining({
          id: 'github-release-draft-plan',
          status: 'operator-ready',
        }),
      ]),
    );
  });

  it('keeps distribution rehearsal side-effect free and publishes commands', () => {
    const snapshot = new ReleaseCandidateDistributionRehearsalService({
      now: () => new Date('2026-05-05T01:15:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.receipts).toHaveLength(12);
    expect(snapshot.receipts[0]).toEqual(
      expect.objectContaining({
        id: expect.stringContaining('release-candidate-distribution.'),
        noRemoteMutation: true,
        noPackagePublished: true,
        noGitTagMoved: true,
        noInstallerExecuted: true,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'no-publiction-side-effects',
          status: 'pass',
          observed: true,
        }),
        expect.objectContaining({
          id: 'rollback-and-installer-rehearsed',
          status: 'pass',
          observed: 'true/true',
        }),
      ]),
    );
    expect(snapshot.commands).toEqual(
      expect.objectContaining({
        run: 'npm run release-candidate-distribution-rehearsal --silent',
        runJson: 'npm run release-candidate-distribution-rehearsal:json --silent',
        check: 'npm run release-candidate-distribution-rehearsal:check --silent',
        requireRehearsed: 'npm run release-candidate-distribution-rehearsal --silent -- --require-rehearsed',
        freeze: 'npm run release-candidate-freeze --silent -- --require-frozen',
        packDryRun: 'npm pack --dry-run',
        npmPublishDryRun: 'npm publish --dry-run --tag rc',
        nextAction: 'Pre-canary go/no-go alignment',
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        rehearsalOnly: true,
        consumesReleaseCandidateFreeze: true,
        noNpmPublish: true,
        noGithubReleaseCreated: true,
        noGitTagMoved: true,
        noStableTagMoved: true,
        noLatestTagMoved: true,
        noInstallerExecuted: true,
        noRemoteMutationByDefault: true,
        noNetworkRequiredByDefault: true,
        secretsSerialized: false,
      }),
    );
  });

  it('formats release candidate distribution rehearsal text', () => {
    const service = new ReleaseCandidateDistributionRehearsalService({
      now: () => new Date('2026-05-05T01:20:00.000Z'),
    });
    const report = service.formatRehearsalText();

    expect(report).toContain('Zavorth Release Candidate Distribution Rehearsal');
    expect(report).toContain('Status: rehearsed');
    expect(report).toContain('Release candidate: zavorth@1.1.0-rc.1');
    expect(report).toContain('Steps: 8 dry-ready, 4 operator-ready, 0 blocked');
    expect(report).toContain('Package frozen: true');
    expect(report).toContain('Rehearsal ready: true');
    expect(report).toContain('Remote state mutated: false');
    expect(report).toContain('Next: Pre-canary go/no-go alignment');
  });
});
