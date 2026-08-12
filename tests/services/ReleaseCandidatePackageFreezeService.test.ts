import { ReleaseCandidatePackageFreezeService } from '../../src/services/ReleaseCandidatePackageFreezeService.js';

describe('ReleaseCandidatePackageFreezeService Intent model6', () => {
  it('freezes a release candidate package from the public launch smoke ledger', () => {
    const snapshot = new ReleaseCandidatePackageFreezeService({
      now: () => new Date('2026-05-05T00:40:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.checkpoint-16');
    expect(snapshot.status).toBe('frozen');
    expect(snapshot.package).toEqual(
      expect.objectContaining({
        name: 'zavorth',
        version: '1.1.0',
        releaseCandidateId: 'zavorth@1.1.0-rc.1',
        channel: 'release-candidate',
        npmDistTag: 'rc',
        stableTagAllowed: false,
        latestTagAllowed: false,
      }),
    );
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        artifacts: 11,
        requiredArtifacts: 11,
        lockedArtifacts: 11,
        manualPendingArtifacts: 0,
        blockedArtifacts: 0,
        gates: 7,
        passedGates: 7,
        failedGates: 0,
        receipts: 11,
        publicLaunchLedgerStatus: 'ready',
        publicLaunchReady: true,
        packageFrozen: true,
        publishAllowed: false,
        npmPublishExecuted: false,
        gitTagMoved: false,
        installerExecuted: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'package-manifest-lock',
          status: 'locked',
        }),
        expect.objectContaining({
          id: 'npm-pack-dry-run-lock',
          status: 'dry-ready',
          command: 'npm pack --dry-run',
        }),
        expect.objectContaining({
          id: 'public-launch-smoke-ledger-lock',
          command: 'npm run public-launch-smoke-ledger --silent -- --require-ready',
        }),
      ]),
    );
  });

  it('keeps freeze side-effect free and publishes operator commands', () => {
    const snapshot = new ReleaseCandidatePackageFreezeService({
      now: () => new Date('2026-05-05T00:45:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.receipts).toHaveLength(11);
    expect(snapshot.receipts[0]).toEqual(
      expect.objectContaining({
        id: expect.stringContaining('release-candidate-freeze.'),
        noPublish: true,
        noTagMoved: true,
        noInstallerExecuted: true,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'no-publish-side-effects',
          status: 'pass',
          observed: true,
        }),
        expect.objectContaining({
          id: 'package-identity-frozen',
          status: 'pass',
          observed: 'zavorth@1.1.0-rc.1',
        }),
      ]),
    );
    expect(snapshot.commands).toEqual(
      expect.objectContaining({
        run: 'npm run release-candidate-freeze --silent',
        runJson: 'npm run release-candidate-freeze:json --silent',
        check: 'npm run release-candidate-freeze:check --silent',
        requireFrozen: 'npm run release-candidate-freeze --silent -- --require-frozen',
        build: 'npm run build --silent',
        typecheck: 'npm run runtime:check --silent',
        packDryRun: 'npm pack --dry-run',
        smokeLedger: 'npm run public-launch-smoke-ledger --silent -- --require-ready',
        nextStage: 'Release candidate distribution rehearsal',
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        freezeOnly: true,
        consumesPublicLaunchSmokeLedger: true,
        noNpmPublish: true,
        noGitTagMoved: true,
        noStableTagMoved: true,
        noLatestTagMoved: true,
        noInstallerExecuted: true,
        noNetworkRequiredByDefault: true,
        secretsSerialized: false,
      }),
    );
  });

  it('formats release candidate freeze text', () => {
    const service = new ReleaseCandidatePackageFreezeService({
      now: () => new Date('2026-05-05T00:50:00.000Z'),
    });
    const report = service.formatFreezeText();

    expect(report).toContain('Zavorth Release Candidate Package Freeze');
    expect(report).toContain('Status: frozen');
    expect(report).toContain('Package: zavorth@1.1.0-rc.1');
    expect(report).toContain('Artifacts: 11/11 locked');
    expect(report).toContain('Public launch ledger: ready, ready true');
    expect(report).toContain('Package frozen: true');
    expect(report).toContain('Publish allowed: false');
    expect(report).toContain('Next: Release candidate distribution rehearsal');
  });
});
