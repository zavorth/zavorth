import { ZavorthBridgeRemotePlaybookService } from '../../src/services/ZavorthBridgeRemotePlaybookService';

describe('ZavorthBridgeRemotePlaybookService', () => {
  it('builds a recovery playbook for inactive remote mode under cooldown', () => {
    const service = new ZavorthBridgeRemotePlaybookService();
    const playbook = service.build({
      checkedAt: '2026-03-29T23:40:00.000Z',
      repairRequested: true,
      forceRepair: false,
      initialStatus: {} as any,
      finalStatus: {} as any,
      initialIncidents: {
        primaryCode: 'remote_mode_inactive',
        severity: 'warning',
        codes: ['remote_mode_inactive'],
        autoRepairableActions: ['activate-remote-mode'],
      },
      finalIncidents: {
        primaryCode: 'remote_mode_inactive',
        severity: 'warning',
        codes: ['remote_mode_inactive'],
        autoRepairableActions: ['activate-remote-mode'],
      },
      repairPolicy: {
        cooldownActive: true,
        cooldownUntil: '2026-03-29T23:50:00.000Z',
        flappingLikely: true,
        matchingRecentFailures: 3,
        reason: 'Cooldown active ate 2026-03-29T23:50:00.000Z; o automatic repair was suppressed to avoid a loop.',
      },
      actions: [],
      readyBefore: false,
      readyAfter: false,
      repaired: false,
      remainingRecommendations: ['Ative o modo remoto'],
      summary: 'Cooldown active',
      playbook: {} as any,
    });

    expect(playbook.title).toContain('Modo remoto');
    expect(playbook.urgency).toBe('warning');
    expect(playbook.retryGuidance).toContain('Cooldown active');
    expect(playbook.automaticActions).toEqual(['automatic repair suppressed by cooldown']);
  });
});
