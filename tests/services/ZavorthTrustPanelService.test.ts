import { describe, expect, it } from '@jest/globals';
import { ZavorthTrustPanelService } from '../../src/services/ZavorthTrustPanelService';

describe('ZavorthTrustPanelService', () => {
  it('explains what Zavorth can do alone, what asks first and what is blocked', () => {
    const snapshot = new ZavorthTrustPanelService().buildContract({
      profile: 'personal',
    });

    expect(snapshot.surface).toBe('trust-panel');
    expect(snapshot.advanced.commandCenterCanExecute).toBe(false);
    expect(snapshot.safety.projectionOnly).toBe(true);
    expect(snapshot.buckets.find((bucket) => bucket.id === 'can_do_alone')?.rules.length).toBeGreaterThan(0);
    expect(snapshot.buckets.find((bucket) => bucket.id === 'asks_first')?.rules.some((rule) => rule.id === 'workspace-mutation')).toBe(true);
    expect(snapshot.buckets.find((bucket) => bucket.id === 'blocked')?.rules.some((rule) => rule.id === 'raw-secret-handling')).toBe(true);
  });

  it('keeps business mode evidence-first without granting extra authority', () => {
    const snapshot = new ZavorthTrustPanelService().buildContract({
      profile: 'business',
      category: 'security',
    });

    expect(snapshot.selectedProfile).toBe('business');
    expect(snapshot.autonomy).toBe('business');
    expect(snapshot.summary.headline).toContain('Business mode');
    expect(snapshot.advanced.policyBrokerAuthority).toBe(true);
    expect(snapshot.advanced.rawSecretsSerialized).toBe(false);
  });

  it('surfaces capability setup needs without turning setup into execution', () => {
    const snapshot = new ZavorthTrustPanelService().buildContract({
      category: 'communication',
    });

    expect(snapshot.capabilitySignals.total).toBeGreaterThan(0);
    expect(snapshot.safety.liveActionsRequirePolicyBroker).toBe(true);
    expect(snapshot.setupHighlights.every((card) => card.primaryAction.mutatesState === false)).toBe(true);
  });
});
