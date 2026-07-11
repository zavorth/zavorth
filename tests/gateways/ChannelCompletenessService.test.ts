import { ChannelCompletenessService } from '../../src/services/ChannelCompletenessService';
import { ChannelGatewayFactory } from '../../src/gateways/ChannelGatewayFactory';

describe('ChannelCompletenessService — all factory channels first-class', () => {
  const now = () => new Date('2026-07-10T18:00:00.000Z');

  it('inventories every factory channel as first-class with full completeness bar', () => {
    const factoryIds = ChannelGatewayFactory.listSupportedChannelIds();
    expect(factoryIds.length).toBeGreaterThanOrEqual(20);

    const service = new ChannelCompletenessService({ now });
    const snapshot = service.buildSnapshot();

    expect(snapshot.policy.allChannelsFirstClass).toBe(true);
    expect(snapshot.policy.longTailNotSecondClass).toBe(true);
    expect(snapshot.summary.total).toBe(factoryIds.length);
    expect(snapshot.summary.firstClass).toBe(factoryIds.length);
    expect(snapshot.summary.completeCodeLevel).toBe(factoryIds.length);
    expect(snapshot.missingFromFactory).toEqual([]);

    for (const id of factoryIds) {
      const member = snapshot.channels.find((entry) => entry.id === id);
      expect(member).toBeTruthy();
      expect(member!.firstClass).toBe(true);
      expect(member!.longTailSecondClass).toBe(false);
      expect(member!.completeness).toEqual(expect.objectContaining({
        inbound: true,
        outbound: true,
        allowlist: true,
        doctor: true,
        outboxFallback: true,
        mockIo: true,
        redaction: true,
        commandDeck: true,
        continuitySessionKey: true,
        installScaffold: true,
        firstClass: true,
      }));
      expect(member!.doctor?.channelId).toBe(id);
      expect(member!.installScaffold.command).toContain(id);
      expect(member!.continuity.handoffRequiresApproval).toBe(true);
    }
  });

  it('smokes mock inbound/outbound for every factory channel without network', async () => {
    const service = new ChannelCompletenessService({ now });
    const results = await service.smokeAll();
    expect(results.length).toBe(ChannelGatewayFactory.listSupportedChannelIds().length);

    for (const result of results) {
      expect(result.doctor).toBeTruthy();
      expect(result.doctor!.completeness.firstClass).toBe(true);
      // Outbound may queue to local outbox when not configured — still ok delivery path
      expect(result.outbound.ok).toBe(true);
    }
  }, 120_000);

  it('resolves channel id aliases when creating gateways from factory', () => {
    expect(ChannelGatewayFactory.createFromId('googlechat')?.id).toBe('google-chat');
    expect(ChannelGatewayFactory.createFromId('msteams')?.id).toBe('teams');
    expect(ChannelGatewayFactory.createFromId('qqbot')?.id).toBe('qq');
    expect(ChannelGatewayFactory.createFromId('google-chat')?.id).toBe('google-chat');
    expect(ChannelGatewayFactory.createFromId('teams')?.id).toBe('teams');
    expect(ChannelGatewayFactory.createFromId('qq')?.id).toBe('qq');
  });
});
