import { ZavorthDashboardExperienceHomeService } from '../../src/services/ZavorthDashboardExperienceHomeService';

describe('ZavorthDashboardExperienceHomeService', () => {
  it('builds a simple dashboard home without execution authority', () => {
    const snapshot = new ZavorthDashboardExperienceHomeService({
      now: () => new Date('2026-05-15T12:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.surface).toBe('dashboard-experience-home');
    expect(snapshot.route).toBe('/dashboard');
    expect(snapshot.greeting).toBe('Hello, Operator.');
    expect(snapshot.simpleNavigation.headline).toContain('Inbox, Tasks, Approvals, Receipts and Connectors');
    expect(snapshot.simpleNavigation.areas.map((area) => area.id)).toEqual([
      'inbox',
      'tasks',
      'approvals',
      'receipts',
      'connectors',
    ]);
    expect(snapshot.gettingStarted.title).toBe('Primeiros passos');
    expect(snapshot.gettingStarted.summary).toContain('demo is optional');
    expect(snapshot.gettingStarted.steps.map((step) => step.command)).toEqual(expect.arrayContaining([
      'zavorth setup --dry-run',
      'zavorth go',
      'zavorth demo browser',
      'zavorth connectors doctor',
    ]));
    expect(snapshot.gettingStarted.steps.find((step) => step.id === 'demo')?.optional).toBe(true);
    expect(snapshot.primaryMissions.length).toBeGreaterThanOrEqual(4);
    expect(snapshot.runtimeQuestions.length).toBeGreaterThanOrEqual(4);
    expect(snapshot.permissionPanel.title).toBe('Permissoes');
    expect(snapshot.permissionPanel.items.map((item) => item.id)).toEqual([
      'permissions',
      'auto-approvals',
      'extreme-mode',
      'revoke',
      'receipts',
    ]);
    expect(snapshot.permissionPanel.defaultPosture).toContain('Projection-only');
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
    expect(snapshot.invariants.join(' ')).toContain('before internal runtime names');
    expect(snapshot.permissionPanel.items.find((item) => item.id === 'extreme-mode')?.risk).toBe('critical');
    expect(snapshot.permissionPanel.items.find((item) => item.id === 'auto-approvals')?.summary).toContain('escopo');
  });
});
