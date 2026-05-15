import { describe, expect, it } from '@jest/globals';
import { ZavorthAutonomySliderService } from '../../src/services/ZavorthAutonomySliderService';

describe('ZavorthAutonomySliderService', () => {
  it('builds a safe slider projection without applying runtime authority', () => {
    const snapshot = new ZavorthAutonomySliderService().buildContract({
      profile: 'personal',
      level: 'advanced',
    });

    expect(snapshot.surface).toBe('autonomy-slider');
    expect(snapshot.currentLevel).toBe('balanced');
    expect(snapshot.requestedLevel).toBe('advanced');
    expect(snapshot.changeRisk).toBe('more_autonomous');
    expect(snapshot.applyPlan.canApplyAutomatically).toBe(false);
    expect(snapshot.applyPlan.requiresPolicyBroker).toBe(true);
    expect(snapshot.applyPlan.storesRawSecrets).toBe(false);
  });

  it('treats business as governed evidence mode rather than maximum freedom', () => {
    const snapshot = new ZavorthAutonomySliderService().buildContract({
      profile: 'developer',
      level: 'business',
    });

    expect(snapshot.requestedLevel).toBe('business');
    expect(snapshot.changeRisk).toBe('governed_business');
    expect(snapshot.policyPreview.approvalStyle).toContain('TTL');
    expect(snapshot.invariants.some((entry) => entry.includes('maximum evidence'))).toBe(true);
  });

  it('can infer stricter autonomy from natural language', () => {
    const snapshot = new ZavorthAutonomySliderService().buildContract({
      profile: 'power',
      intent: 'be more careful and ask before anything sensitive',
    });

    expect(snapshot.currentLevel).toBe('advanced');
    expect(snapshot.requestedLevel).toBe('conservative');
    expect(snapshot.changeRisk).toBe('stricter');
    expect(snapshot.policyPreview.asksFirst.length).toBeGreaterThan(0);
  });
});
