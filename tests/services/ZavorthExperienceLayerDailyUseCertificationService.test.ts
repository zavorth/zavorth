import { ZavorthExperienceLayerDailyUseCertificationService } from '../../src/services/ZavorthExperienceLayerDailyUseCertificationService';

describe('ZavorthExperienceLayerDailyUseCertificationService', () => {
  it('certifies every Experience Layer phase for daily use', () => {
    const snapshot = new ZavorthExperienceLayerDailyUseCertificationService({
      now: () => new Date('2026-05-15T12:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.surface).toBe('experience-layer-daily-use-certification');
    expect(snapshot.result).toBe('passed');
    expect(snapshot.coveredPhases).toBe(13);
    expect(snapshot.phases).toHaveLength(13);
    expect(snapshot.phases.map((phase) => phase.command)).toEqual(expect.arrayContaining([
      'zavorth onboard conversation',
      'zavorth missions guide',
      'zavorth trust-panel',
      'zavorth visual-receipts',
      'zavorth dashboard-home',
      'zavorth daily',
    ]));
  });

  it('keeps the full experience layer as governed projection, not hidden authority', () => {
    const snapshot = new ZavorthExperienceLayerDailyUseCertificationService().buildSnapshot();

    expect(snapshot.safety).toEqual({
      projectionsOnly: true,
      hiddenExecutionAuthority: false,
      policyBrokerRequiredForSensitiveActions: true,
      rawSecretsSerialized: false,
    });
    expect(snapshot.phases.every((phase) => phase.status !== 'blocked')).toBe(true);
    expect(snapshot.invariants.join(' ')).toContain('No profile, dashboard card, CLI entrypoint or Satellite card grants extra authority');
  });
});
