import { RuntimeRecoveryService } from '../../src/services/RuntimeRecoveryService';

describe('RuntimeRecoveryService', () => {
  it('treats stale health and Discord degradation as warnings on readonly startup', () => {
    const service = new RuntimeRecoveryService();

    const assessment = service.assess({
      summary: 'Zavorth pronto para uso local.',
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
          lastError: 'Gateway nativo ainda inicializando.',
          updatedAt: null,
        },
        nodeMeshSmoke: { status: 'passed', stale: true },
        systemOverlordSmoke: { status: 'missing', stale: false },
        channelProviderDoctor: { status: 'missing', stale: false },
        remoteTransportDoctor: { status: 'missing', stale: false },
      },
      local: {
        ready: false,
        issues: [],
      },
    } as any, false);

    expect(assessment.readyForUse).toBe(true);
    expect(assessment.discordRepair.status).toBe('not_applicable');
    expect(assessment.discordRepair.summary).toContain('dormente no perfil atual');
    expect(assessment.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Existem 1 check(s) de health com renovacao leve recomendada'),
      ]),
    );
  });
});
