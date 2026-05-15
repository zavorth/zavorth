import { ZavorthCliExperienceParityService } from '../../src/services/ZavorthCliExperienceParityService';

describe('ZavorthCliExperienceParityService', () => {
  it('builds a simple CLI entrypoint that mirrors daily dashboard concepts', () => {
    const snapshot = new ZavorthCliExperienceParityService({
      now: () => new Date('2026-05-15T12:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.surface).toBe('cli-experience-parity');
    expect(snapshot.entryCommands).toEqual(expect.arrayContaining(['zavorth daily', 'zavorth cli-home']));
    expect(snapshot.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({
        command: expect.stringContaining('zavorth guided-missions'),
        mirrorsDashboardHome: true,
      }),
      expect.objectContaining({
        command: expect.stringContaining('zavorth ask-runtime'),
        risk: 'read_only',
      }),
    ]));
    expect(snapshot.safety.cliCanExecuteTargetAction).toBe(false);
    expect(snapshot.safety.policyBrokerRequiredForActions).toBe(true);
  });

  it('keeps convenience commands as projections instead of hidden mutation shortcuts', () => {
    const snapshot = new ZavorthCliExperienceParityService().buildSnapshot();

    expect(snapshot.commands.every((command) => command.cliCanExecuteTargetAction === false)).toBe(true);
    expect(snapshot.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ command: 'zavorth trust-panel' }),
      expect.objectContaining({ command: 'zavorth visual-receipts' }),
      expect.objectContaining({ command: 'zavorth satellite-approvals' }),
    ]));
    expect(snapshot.invariants.join(' ')).toContain('not a privileged executor');
  });
});
