import { ReleaseCertificationProfileHardeningService } from '../../src/services/ReleaseCertificationProfileHardeningService.js';

describe('ReleaseCertificationProfileHardeningService Intent model4', () => {
  it('certifies private, release-candidate and public-launch profiles together', () => {
    const snapshot = new ReleaseCertificationProfileHardeningService({
      now: () => new Date('2026-05-04T23:40:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.checkpoint-14');
    expect(snapshot.status).toBe('certified');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        profiles: 3,
        certifiedProfiles: 3,
        releaseReadyProfiles: 3,
        failedProfiles: 0,
        gates: 7,
        passedGates: 7,
        failedGates: 0,
        finalReceipts: 30,
        sourceOpenGaps: 0,
        sourceP0Gaps: 0,
        sourceP1Gaps: 0,
        sourceP2Gaps: 0,
        warnings: 0,
        waivers: 0,
        releaseReady: true,
        liveExternalCallRequired: false,
        liveChannelSendRequired: false,
        liveDeviceRequired: false,
        liveMemoryWriteRequired: false,
        filesystemReadRequired: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.profileResults.map((result) => result.profile)).toEqual([
      'private-absorption',
      'release-candidate',
      'public-launch',
    ]);
    expect(snapshot.profileResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          profile: 'release-candidate',
          status: 'certified',
          releaseReady: true,
          sourceP0Gaps: 0,
          sourceP1Gaps: 0,
          sourceP2Gaps: 0,
          receipts: 10,
        }),
        expect.objectContaining({
          profile: 'public-launch',
          status: 'certified',
          releaseReady: true,
          sourceP0Gaps: 0,
          sourceP1Gaps: 0,
          sourceP2Gaps: 0,
          receipts: 10,
        }),
      ]),
    );
  });

  it('publishes strict policy, commands and final receipts for release operators', () => {
    const snapshot = new ReleaseCertificationProfileHardeningService({
      now: () => new Date('2026-05-04T23:45:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.profilePolicyMatrix).toHaveLength(3);
    expect(snapshot.profilePolicyMatrix).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          profile: 'release-candidate',
          maxP0Gaps: 0,
          maxP1Gaps: 0,
          maxP2Gaps: 0,
          requireCertifiedStatus: true,
          requireReleaseReady: true,
          requireNoWarnings: true,
          requireNoWaivers: true,
          requireReadyCommand: expect.stringContaining('--require-ready'),
        }),
        expect.objectContaining({
          profile: 'public-launch',
          requireReadyCommand: expect.stringContaining('--profile=public-launch'),
        }),
      ]),
    );
    expect(snapshot.finalReceipts).toHaveLength(30);
    expect(snapshot.finalReceipts[0]).toEqual(
      expect.objectContaining({
        id: expect.stringContaining('release-profile-hardening.'),
        noLiveIo: true,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.commands).toEqual(
      expect.objectContaining({
        releaseCandidate: 'npm run parity-certify:release-candidate --silent',
        publicLaunch: 'npm run parity-certify:public-launch --silent',
        nextStage: 'Public launch smoke and evidence ledger',
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        hardensAllProfiles: true,
        requiresReleaseCandidate: true,
        requiresPublicLaunch: true,
        requiresFinalReceipts: true,
        requiresZeroP0P1P2: true,
        noWaiversForFinalCertification: true,
        secretsSerialized: false,
      }),
    );
  });

  it('formats release hardening text', () => {
    const service = new ReleaseCertificationProfileHardeningService({
      now: () => new Date('2026-05-04T23:50:00.000Z'),
    });
    const report = service.formatHardeningText();

    expect(report).toContain('Zavorth Release Certification Profile Hardening');
    expect(report).toContain('Status: certified');
    expect(report).toContain('Profiles: 3/3 certified');
    expect(report).toContain('Source gaps: 0 (P0 0, P1 0, P2 0)');
    expect(report).toContain('Final receipts: 30');
    expect(report).toContain('Release ready: true');
    expect(report).toContain('public-launch: certified');
    expect(report).toContain('Next: Public launch smoke and evidence ledger');
  });
});
