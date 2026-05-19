import { ParityCertificationService } from '../../src/services/ParityCertificationService.js';

describe('ParityCertificationService Certification matrix', () => {
  it('builds certified private absorption certification after remaining runtime decisions', () => {
    const snapshot = new ParityCertificationService({
      now: () => new Date('2026-05-04T19:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.checkpoint-9');
    expect(snapshot.profile).toBe('private-absorption');
    expect(snapshot.status).toBe('certified');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        gates: 10,
        passed: 10,
        warned: 0,
        failed: 0,
        waived: 0,
        blockingFailures: 0,
        requiredWarnings: 0,
        releaseReady: true,
        sourceOperationalStatus: 'passed',
        sourceOpenGaps: 0,
        sourceP0Gaps: 0,
        sourceP1Gaps: 0,
        sourceP2Gaps: 0,
        generatedPluginManifests: 72,
        pluginCapabilities: 98,
        receipts: 10,
        liveExternalCallRequired: false,
        liveChannelSendRequired: false,
        liveDeviceRequired: false,
        liveMemoryWriteRequired: false,
        filesystemReadRequired: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'p0-gap-budget',
          status: 'pass',
          severity: 'blocking',
          observed: 0,
        }),
      ]),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        certificationOnly: true,
        consumesOperationalSnapshot: true,
        noExternalCalls: true,
        noLiveSends: true,
        noDeviceAccess: true,
        noMemoryWrites: true,
        noArtifactBodyReads: true,
        waiversMustBeExplicit: true,
        secretsSerialized: false,
      }),
    );
  });

  it('ignores obsolete explicit waivers when the P0 gate already passes', () => {
    const snapshot = new ParityCertificationService({
      now: () => new Date('2026-05-04T19:10:00.000Z'),
      waivers: [
        {
          id: 'private-preview-provider-waiver',
          gateId: 'p0-gap-budget',
          approved: true,
          reason: 'Private preview can proceed while unsupported provider routes are signed as non-goals.',
          acceptedBy: 'operator',
          expiresAt: '2026-12-31T23:59:59.000Z',
        },
      ],
    }).buildSnapshot();

    expect(snapshot.status).toBe('certified');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        failed: 0,
        waived: 0,
        blockingFailures: 0,
        releaseReady: true,
      }),
    );
    expect(snapshot.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'p0-gap-budget',
          status: 'pass',
          waiver: null,
        }),
      ]),
    );
  });

  it('tightens P1 gaps for release-candidate profile', () => {
    const snapshot = new ParityCertificationService({
      now: () => new Date('2026-05-04T19:20:00.000Z'),
      profile: 'release-candidate',
    }).buildSnapshot();

    expect(snapshot.profile).toBe('release-candidate');
    expect(snapshot.status).toBe('certified');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        failed: 0,
        warned: 0,
        blockingFailures: 0,
        requiredWarnings: 0,
      }),
    );
    expect(snapshot.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'p1-gap-budget',
          status: 'pass',
          observed: 0,
        }),
        expect.objectContaining({
          id: 'p2-decision-register',
          status: 'pass',
          observed: 0,
        }),
      ]),
    );
  });

  it('formats certification text for operators', () => {
    const service = new ParityCertificationService({
      now: () => new Date('2026-05-04T19:30:00.000Z'),
    });
    const report = service.formatCertificationText();

    expect(report).toContain('Zavorth Parity Certification');
    expect(report).toContain('Profile: private-absorption');
    expect(report).toContain('Status: certified');
    expect(report).toContain('Source gaps: 0 (P0 0, P1 0, P2 0)');
    expect(report).toContain('Release ready: true');
    expect(report).toContain('Next: Release certification profile hardening');
  });
});
