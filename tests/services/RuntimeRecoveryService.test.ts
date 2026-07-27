import { RuntimeRecoveryService } from '../../src/services/RuntimeRecoveryService';

describe('RuntimeRecoveryService', () => {
  it('treats stale health and Discord degradation as warnings on readonly startup', () => {
    const service = new RuntimeRecoveryService();

    const assessment = service.assess({
      summary: 'Zavorth ready para uso local.',
      runtime: {
        hostSupervisor: { alive: true },
        telegramWorker: { alive: true },
        dashboard: { active: true },
        discordBridge: {
          mode: 'native',
          enabled: true,
          started: false,
          allowDirectMessages: false,
          allowedGuildIds: [],
          pendingInbox: 0,
          pendingOutbox: 0,
          lastError: 'Gateway nactive ainda inicializando.',
          updatedAt: null,
        },
        nodeMeshSmoke: { status: 'passed', stale: true },
        systemOverlordSmoke: { status: 'missing', stale: false },
        cchannelProviderDoctor: { status: 'missing', stale: false },
        remoteTransportDoctor: { status: 'missing', stale: false },
      },
      local: {
        ready: false,
        issues: [],
      },
    } as any, false);

    expect(assessment.readyForUse).toBe(true);
    expect(assessment.discordRepair.status).toBe('not_applicable');
    expect(assessment.discordRepair.summary).toContain('dormente no profile atual');
    expect(assessment.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Existem 1 check(s) de health com renovaction leve recomendada'),
      ]),
    );
  });
});
