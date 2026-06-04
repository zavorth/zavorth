import { describe, expect, it } from '@jest/globals';
import { ZavorthChannelCapabilityAtlasService } from '../../src/services/ZavorthChannelCapabilityAtlasService.js';

describe('ZavorthChannelCapabilityAtlasService', () => {
  it('exposes core and long-tail channels in one canonical atlas', () => {
    const snapshot = new ZavorthChannelCapabilityAtlasService({
      now: () => new Date('2026-06-03T12:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.surface).toBe('channel-capability-atlas');
    expect(snapshot.status).toBe('ready');
    expect(snapshot.summary.total).toBeGreaterThanOrEqual(30);
    expect(snapshot.summary.coreNative).toBeGreaterThanOrEqual(9);
    expect(snapshot.summary.nativeConfigurable).toBeGreaterThanOrEqual(25);
    expect(snapshot.summary.doctorAvailable).toBe(snapshot.summary.total);
    expect(snapshot.summary.liveSmokeAvailable).toBeGreaterThanOrEqual(25);

    const byId = new Map(snapshot.channels.map((channel) => [channel.id, channel]));
    expect(byId.get('telegram')).toEqual(expect.objectContaining({
      level: 'core-native',
      dashboardAction: 'connect',
      doctor: expect.objectContaining({ available: true }),
    }));
    expect(byId.get('feishu')).toEqual(expect.objectContaining({
      level: 'native-configurable',
      adapterFamily: 'webhook',
      liveSmoke: expect.objectContaining({ available: true }),
      envRefs: expect.arrayContaining(['FEISHU_WEBHOOK_URL']),
    }));
    expect(byId.has('runtime-adapter-gateway')).toBe(false);
  });

  it('makes the long-tail channels discoverable without external dependency confusion', () => {
    const service = new ZavorthChannelCapabilityAtlasService();
    const snapshot = service.buildSnapshot({ query: 'weixin' });

    expect(snapshot.channels.map((channel) => channel.id)).toContain('weixin');
    expect(snapshot.llmContextBlock).toContain('Channel Capability Atlas');
    expect(snapshot.llmContextBlock).toContain('Core and long-tail channels are Zavorth-native');
    expect(JSON.stringify(snapshot)).not.toMatch(/external dependency required|delegated by default/i);
  });
});
