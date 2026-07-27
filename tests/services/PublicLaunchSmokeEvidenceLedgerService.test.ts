import { PublicLaunchSmokeEvidenceLedgerService } from '../../src/services/PublicLaunchSmokeEvidenceLedgerService.js';

describe('PublicLaunchSmokeEvidenceLedgerService Intent model5', () => {
  it('builds a public launch-ready smoke evidence ledger', () => {
    const snapshot = new PublicLaunchSmokeEvidenceLedgerService({
      now: () => new Date('2026-05-05T00:10:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.checkpoint-15');
    expect(snapshot.status).toBe('ready');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        entries: 14,
        requiredDrySmokes: 10,
        requiredDryPassed: 10,
        optInLiveSmokes: 4,
        optInLivePending: 4,
        blocked: 0,
        gates: 6,
        passedGates: 6,
        failedGates: 0,
        receipts: 14,
        releaseHardeningStatus: 'certified',
        releaseHardeningReady: true,
        publicLaunchReady: true,
        liveExternalCallRequired: false,
        liveChannelSendRequired: false,
        liveDeviceRequired: false,
        liveMemoryWriteRequired: false,
        filesystemReadRequired: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'public-launch-certification',
          mode: 'dry-proof',
          status: 'dry-passed',
          requiredForPublicLaunch: true,
        }),
        expect.objectContaining({
          id: 'release-bundle-dry-smoke',
          command: 'npm run release-path:check --silent',
        }),
      ]),
    );
    expect(snapshot.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'required-dry-smokes-complete',
          status: 'pass',
          observed: '10/10',
        }),
        expect.objectContaining({
          id: 'no-live-io-by-default',
          status: 'pass',
        }),
      ]),
    );
  });

  it('keeps live smokes opt-in and outside default launch readiness', () => {
    const snapshot = new PublicLaunchSmokeEvidenceLedgerService({
      now: () => new Date('2026-05-05T00:15:00.000Z'),
    }).buildSnapshot();

    const liveEntries = snapshot.entries.filter((entry) => entry.mode === 'opt-in-live');
    expect(liveEntries).toHaveLength(4);
    expect(liveEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'provider-live-opt-in',
          requiredForPublicLaunch: false,
          status: 'live-pending',
          liveExternalCallRequired: true,
        }),
        expect.objectContaining({
          id: 'channel-live-opt-in',
          requiredForPublicLaunch: false,
          status: 'live-pending',
          liveChannelSendRequired: true,
        }),
        expect.objectContaining({
          id: 'satellite-device-opt-in',
          requiredForPublicLaunch: false,
          status: 'live-pending',
          liveDeviceRequired: true,
        }),
      ]),
    );
    expect(snapshot.commands.optInLiveCommands).toHaveLength(4);
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        evidenceLedgerOnly: true,
        consumesReleaseHardening: true,
        requiredSmokesAreDryProofs: true,
        liveSmokesAreOptIn: true,
        noExternalCallsByDefault: true,
        noLiveChannelSendsByDefault: true,
        noDeviceAccessByDefault: true,
        noMemoryWritesByDefault: true,
        noArtifactBodyReadsByDefault: true,
        secretsSerialized: false,
      }),
    );
  });

  it('publishes receipts and operator commands for public launch evidence', () => {
    const snapshot = new PublicLaunchSmokeEvidenceLedgerService({
      now: () => new Date('2026-05-05T00:20:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.receipts).toHaveLength(14);
    expect(snapshot.receipts[0]).toEqual(
      expect.objectContaining({
        id: expect.stringContaining('public-launch-smoke.'),
        noLiveIoByDefault: true,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.commands).toEqual(
      expect.objectContaining({
        run: 'npm run public-launch-smoke-ledger --silent',
        runJson: 'npm run public-launch-smoke-ledger:json --silent',
        check: 'npm run public-launch-smoke-ledger:check --silent',
        requireReady: 'npm run public-launch-smoke-ledger --silent -- --require-ready',
        nextAction: 'Release candidate package freeze',
      }),
    );
    expect(snapshot.commands.drySmokeCommands).toEqual(
      expect.arrayContaining([
        'npm run release-certify:public-launch --silent',
        'npm run release-certification-hardening --silent -- --require-ready',
        'npm run runtime:check --silent',
      ]),
    );
  });

  it('formats public launch smoke evidence text', () => {
    const service = new PublicLaunchSmokeEvidenceLedgerService({
      now: () => new Date('2026-05-05T00:25:00.000Z'),
    });
    const report = service.formatLedgerText();

    expect(report).toContain('Zavorth Public Launch Smoke Evidence Ledger');
    expect(report).toContain('Status: ready');
    expect(report).toContain('Required dry smokes: 10/10');
    expect(report).toContain('Opt-in live smokes: 4/4 pending');
    expect(report).toContain('Receipts: 14');
    expect(report).toContain('Public launch ready: true');
    expect(report).toContain('provider-live-opt-in');
    expect(report).toContain('Next: Release candidate package freeze');
  });
});
