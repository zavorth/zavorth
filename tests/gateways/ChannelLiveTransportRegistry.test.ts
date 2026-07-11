import { ChannelGatewayFactory } from '../../src/gateways/ChannelGatewayFactory';
import { ChannelLiveTransportRegistry } from '../../src/gateways/ChannelLiveTransportRegistry';
import { ChannelCompletenessService } from '../../src/services/ChannelCompletenessService';

describe('ChannelLiveTransportRegistry — all current + future channels', () => {
  it('densifies every factory-registered channel id', () => {
    const ids = ChannelGatewayFactory.listSupportedChannelIds();
    expect(ids.length).toBeGreaterThanOrEqual(29);

    for (const id of ids) {
      const plan = ChannelLiveTransportRegistry.plan({
        channelId: id,
        message: 'hello',
        target: 'target-1',
      });
      expect(plan.firstClass).toBe(true);
      expect(plan.densified).toBe(true);
      expect(plan.channelId).toBe(id);
      expect(plan.kind).toBeTruthy();
      // Either ready (url+body) or explicitly unavailable with reason — never silent gap.
      if (!plan.url) {
        expect(plan.reasonIfUnavailable).toBeTruthy();
      } else {
        expect(plan.body).toBeTruthy();
        expect(['POST', 'PUT']).toContain(plan.method);
      }
    }
  });

  it('future channel ids use env convention fallback without code edits', () => {
    process.env.OPS_CHAT_WEBHOOK_URL = 'https://example.test/hooks/ops';
    const plan = ChannelLiveTransportRegistry.plan({
      channelId: 'ops-chat',
      message: 'ping',
      target: '',
    });
    delete process.env.OPS_CHAT_WEBHOOK_URL;
    expect(plan.densified).toBe(true);
    expect(plan.firstClass).toBe(true);
    expect(plan.kind).toBe('generic-webhook');
    expect(plan.url).toBe('https://example.test/hooks/ops');
    expect(plan.body).toEqual({ text: 'ping' });
  });

  it('completeness snapshot marks liveTransport densified for all factory ids', () => {
    const snapshot = new ChannelCompletenessService().buildSnapshot();
    expect(snapshot.summary.total).toBe(ChannelGatewayFactory.listSupportedChannelIds().length);
    for (const member of snapshot.channels) {
      expect(member.liveTransport.densified).toBe(true);
      expect(member.firstClass).toBe(true);
      expect(member.longTailSecondClass).toBe(false);
    }
  });
});
