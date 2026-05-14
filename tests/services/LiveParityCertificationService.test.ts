import {
  LiveParityCertificationService,
} from '../../src/services/LiveParityCertificationService.js';
import {
  ZAVORTH_LIVE_PARITY_CERTIFICATION_CONTRACT_VERSION,
} from '../../src/contracts/LiveParityCertificationContract.js';

describe('LiveParityCertificationService', () => {
  const now = new Date('2026-05-05T15:00:00.000Z');
  const build = () => new LiveParityCertificationService({ now: () => now });

  it('builds a certified staging-live snapshot for the tracked Source surface', () => {
    const snapshot = build().buildSnapshot({ profile: 'staging-live' });

    expect(snapshot.contractVersion).toBe(ZAVORTH_LIVE_PARITY_CERTIFICATION_CONTRACT_VERSION);
    expect(snapshot.phase).toBe('Phase 13 - Live Parity Certification');
    expect(snapshot.profile).toBe('staging-live');
    expect(snapshot.status).toBe('certified');
    expect(snapshot.summary.sourceModules).toBe(125);
    expect(snapshot.summary.acceptedSourceModules).toBe(125);
    expect(snapshot.summary.providers).toBe(47);
    expect(snapshot.summary.channels).toBe(23);
    expect(snapshot.summary.livePhases).toBe(12);
    expect(snapshot.summary.phaseReports).toBe(12);
    expect(snapshot.summary.stagingLiveSmokeCommands).toBe(125);
    expect(snapshot.summary.configuredOnly).toBe(0);
    expect(snapshot.summary.dryRunOnly).toBe(0);
    expect(snapshot.summary.templateOnly).toBe(0);
    expect(snapshot.summary.planned).toBe(0);
    expect(snapshot.summary.blocked).toBe(0);
    expect(snapshot.summary.misleadingAdapterBacked).toBe(0);
    expect(snapshot.summary.signalAndTeamsOutboxOnly).toBe(false);
    expect(snapshot.summary.generatedProviderManifestsRemaining).toBe(false);
    expect(snapshot.summary.runtimeFamiliesMarkedLiveByPlaceholder).toBe(false);
    expect(snapshot.summary.memoryMarkedLiveWithoutWrite).toBe(false);
    expect(snapshot.summary.artifactsMarkedLiveWithoutReplay).toBe(false);
    expect(snapshot.summary.liveExternalCallRequiredToBuildCertificate).toBe(false);
    expect(snapshot.summary.liveChannelSendRequiredToBuildCertificate).toBe(false);
    expect(snapshot.summary.liveDeviceRequiredToBuildCertificate).toBe(false);
    expect(snapshot.summary.secretValuesSerialized).toBe(false);
  });

  it('keeps production-live truthfully gated by operator receipts', () => {
    const snapshot = build().buildSnapshot({ profile: 'production-live' });

    expect(snapshot.profile).toBe('production-live');
    expect(snapshot.status).toBe('certified');
    expect(snapshot.statement.productionLiveRelease).toBe('not-claimed-without-operator-live-receipts');
    expect(snapshot.statement.externalLiveIo).toBe('not-executed-by-certification');
    expect(snapshot.policy.productionLiveRequiresOperatorReceiptLedger).toBe(true);
    expect(snapshot.policy.noLiveIoDuringCertification).toBe(true);
  });

  it('records all certification evidence, signed gap scope and exclusions', () => {
    const snapshot = build().buildSnapshot();
    const ids = snapshot.evidence.map((item) => item.id);

    expect(ids).toEqual(expect.arrayContaining([
      'absorbed-source-classification',
      'no-disallowed-readiness-status',
      'provider-channel-live-smokes',
      'signal-teams-not-outbox-only',
      'runtime-families-not-placeholder',
      'device-safety-and-trust',
      'memory-artifact-runtime-real-proof',
      'signed-scope-and-exclusions',
      'phase-check-command-coverage',
    ]));
    expect(snapshot.evidence.every((item) => item.status === 'passed')).toBe(true);
    expect(snapshot.gapLedger.length).toBeGreaterThan(0);
    expect(snapshot.gapLedger.every((item) => item.signedScope === true)).toBe(true);
    expect(snapshot.signedExclusionsLedger.length).toBeGreaterThan(0);
    expect(snapshot.signedExclusionsLedger.some((item) => item.targetId.includes('google-meet'))).toBe(true);
    expect(snapshot.receipts).toHaveLength(snapshot.evidence.length);
    expect(snapshot.receipts.every((receipt) => receipt.secretValuesSerialized === false)).toBe(true);
  });

  it('aggregates all live activation phase reports and check commands', () => {
    const snapshot = build().buildSnapshot();

    expect(snapshot.phases).toHaveLength(12);
    expect(snapshot.phases.map((phase) => phase.phaseId)).toEqual(expect.arrayContaining([
      'phase-3-channel-long-tail',
      'phase-5-provider-long-tail',
      'phase-12-memory-artifacts-runtime',
    ]));
    expect(snapshot.phases.every((phase) => phase.checkCommand.length > 0)).toBe(true);
    expect(snapshot.phases.every((phase) => phase.blocked === 0)).toBe(true);
    expect(snapshot.phases.reduce((sum, phase) => sum + phase.stagingLiveSmokeCommands, 0)).toBe(125);
  });

  it('formats a concise operator-readable certification report', () => {
    const report = build().formatCertificationText();

    expect(report).toContain('Status: certified');
    expect(report).toContain('Tracked modules: 125/125');
    expect(report).toContain('Staging-live smoke commands: 125');
    expect(report).toContain('Live activation chain complete');
  });
});
