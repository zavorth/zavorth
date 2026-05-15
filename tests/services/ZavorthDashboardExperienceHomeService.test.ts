import { ZavorthDashboardExperienceHomeService } from '../../src/services/ZavorthDashboardExperienceHomeService';

describe('ZavorthDashboardExperienceHomeService', () => {
  it('builds a simple dashboard home without execution authority', () => {
    const snapshot = new ZavorthDashboardExperienceHomeService({
      now: () => new Date('2026-05-15T12:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.surface).toBe('dashboard-experience-home');
    expect(snapshot.route).toBe('/dashboard');
    expect(snapshot.greeting).toBe('Hello, Operator.');
    expect(snapshot.primaryMissions.length).toBeGreaterThanOrEqual(4);
    expect(snapshot.runtimeQuestions.length).toBeGreaterThanOrEqual(4);
    expect(snapshot.safety.dashboardCanExecuteTargetAction).toBe(false);
    expect(snapshot.safety.policyBrokerRequiredForActions).toBe(true);
  });

  it('keeps mission starters as prompts, not hidden actions', () => {
    const snapshot = new ZavorthDashboardExperienceHomeService().buildSnapshot();

    expect(snapshot.primaryMissions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'review-a-repo',
        risk: 'medium',
        approvalExpectation: expect.stringContaining('approval'),
      }),
      expect.objectContaining({
        id: 'check-readiness',
        risk: 'low',
        approvalExpectation: expect.stringContaining('Read-only'),
      }),
    ]));
    expect(snapshot.invariants.join(' ')).toContain('not an execution shortcut');
  });
});
