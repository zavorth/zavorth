import { ZavorthCapabilityAbsorptionService } from '../../src/services/ZavorthCapabilityAbsorptionService.js';

describe('ZavorthCapabilityAbsorptionService', () => {
  it('builds an honest Phase 1 absorption map for OpenClaw, Hermes and Zavorth-native capabilities', () => {
    const service = new ZavorthCapabilityAbsorptionService({
      now: () => new Date('2026-05-24T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-24.phase-1-capability-absorption-map');
    expect(snapshot.status).toBe('attention');
    expect(snapshot.summary.total).toBeGreaterThanOrEqual(16);
    expect(snapshot.summary.native).toBeGreaterThanOrEqual(2);
    expect(snapshot.summary.partial).toBeGreaterThanOrEqual(4);
    expect(snapshot.summary.liveProofStillRequired).toBeGreaterThanOrEqual(4);
    expect(snapshot.summary.rawSecretsSerialized).toBe(false);
    expect(snapshot.summary.externalIoPerformed).toBe(false);
    expect(snapshot.summary.workspaceMutationPerformed).toBe(false);
    expect(snapshot.policy.catalogIsNotLiveProof).toBe(true);
    expect(snapshot.policy.securityPolicyCannotBeLearnedAway).toBe(true);
    expect(snapshot.items.map((item) => item.id)).toEqual(expect.arrayContaining([
      'governance-policy-broker-receipts',
      'openclaw-style-onboarding',
      'channels-long-tail',
      'hermes-learning-loop',
      'dashboard-hermes-ui',
      'native-browser-cdp',
      'terminal-backends',
      'native-companion-apps',
      'product-live-qa',
    ]));
    expect(snapshot.items.find((item) => item.id === 'channels-long-tail')?.status).toBe('cataloged');
    expect(snapshot.items.find((item) => item.id === 'product-live-qa')?.status).toBe('requires_credentials');
  });
});
