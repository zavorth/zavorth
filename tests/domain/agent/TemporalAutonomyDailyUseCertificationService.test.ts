import { ZavorthTemporalAutonomyDailyUseCertificationService } from '../../../src/services/ZavorthTemporalAutonomyDailyUseCertificationService';

describe('ZavorthTemporalAutonomyDailyUseCertificationService', () => {
  const now = () => new Date('2026-05-12T10:00:00.000Z');

  it('certifies all daily-use matrix areas from existing governed gates', async () => {
    const service = new ZavorthTemporalAutonomyDailyUseCertificationService({ now });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.status).toBe('certified');
    expect(snapshot.gate).toBe('checkpoint-8-certification-and-daily-use-gate');
    expect(snapshot.summary).toMatchObject({
      matrixAreas: 7,
      passedMatrixAreas: 7,
      failedMatrixAreas: 0,
      dailyUseCertified: true,
    });
    expect(snapshot.matrix.map((entry) => entry.area)).toEqual(expect.arrayContaining([
      'scheduled_tasks',
      'approvals',
      'rollback',
      'acp_bridge',
      'mcp_governance',
      'channel_ux',
      'agentrun_resilience',
    ]));
  });

  it('blocks or safely handles the required abuse scenarios', async () => {
    const service = new ZavorthTemporalAutonomyDailyUseCertificationService({ now });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.summary.failedAbuseScenarios).toBe(0);
    expect(snapshot.abuseScenarios).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'cron_permission_escalation', status: 'blocked', gatewayCalled: false }),
      expect.objectContaining({ id: 'cron_creates_cron', status: 'blocked', gatewayCalled: false }),
      expect.objectContaining({ id: 'expired_approval', status: 'blocked', gatewayCalled: false }),
      expect.objectContaining({ id: 'acp_bypass', status: 'blocked', gatewayCalled: false }),
      expect.objectContaining({ id: 'channel_without_button_fallback', status: 'passed', executionPerformed: false }),
    ]));
    expect(snapshot.abuseScenarios.every((scenario) => scenario.executionPerformed === false)).toBe(true);
  });

  it('proves fallback rendering for channels without native buttons', async () => {
    const service = new ZavorthTemporalAutonomyDailyUseCertificationService({ now });

    const snapshot = await service.buildSnapshot();
    const scenario = snapshot.abuseScenarios.find((entry) => entry.id === 'channel_without_button_fallback');

    expect(scenario).toMatchObject({
      status: 'passed',
      policySurface: 'channel-renderer',
      blocked: false,
    });
    expect(snapshot.channelCapability.summary.telegramPrivileged).toBe(false);
    expect(snapshot.safety.channelFallbackWithoutButtons).toBe(true);
  });
});
