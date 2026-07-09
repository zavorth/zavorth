import { ChannelGatewayFactory } from '../../src/gateways/ChannelGatewayFactory.js';
import { ChannelMeshConsistencyService } from '../../src/services/ChannelMeshConsistencyService.js';

describe('ChannelGatewayRegistryMesh Integration', () => {
  it('correctly integrates ChannelGatewayRegistry with ChannelMeshConsistencyService to build consistency snapshot', () => {
    // 1. Create a registry containing all 29 unconfigured gateways
    const gatewayRegistry = ChannelGatewayFactory.createAll();
    expect(gatewayRegistry.size).toBe(29); // 20 novos + 9 legados (incluindo telegram)

    // 2. Instantiate ChannelMeshConsistencyService using the registry
    const consistencyService = new ChannelMeshConsistencyService({
      gatewayRegistry,
      now: () => new Date('2026-06-20T12:00:00.000Z'),
    });

    // 3. Build snapshot
    const snapshot = consistencyService.buildSnapshot();
    console.log("SNAPSHOT ENTRIES:", JSON.stringify(snapshot.entries.map(e => ({ name: e.normalizedSourceName, canonical: e.canonicalChannelId, status: e.status, strategy: e.route.transportStrategy, path: e.route.webhookPath })), null, 2));

    // 4. Validate snapshot integrity
    expect(snapshot.primitiveId).toBe('channel.message');
    expect(snapshot.summary.sourceChannels).toBeGreaterThanOrEqual(20);
    expect(snapshot.summary.secretValuesSerialized).toBe(false);

    // 5. Validate specific gateway-backed channel structures inside the snapshot
    expect(snapshot.entries).toEqual(
      expect.arrayContaining([
        // Matrix gateway should map to gateway-adapter transport
        expect.objectContaining({
          normalizedSourceName: 'matrix',
          canonicalChannelId: 'matrix',
          status: 'adapter-backed',
          route: expect.objectContaining({
            transportStrategy: 'gateway-adapter',
          }),
        }),
        // Google Chat gateway is webhook-runtime-backed
        expect.objectContaining({
          normalizedSourceName: 'googlechat',
          canonicalChannelId: 'google-chat',
          status: 'adapter-backed',
          route: expect.objectContaining({
            transportStrategy: 'webhook-runtime',
            webhookPath: '/api/webhooks/google-chat',
          }),
        }),
        // Slack gateway is webhook-runtime-backed
        expect.objectContaining({
          normalizedSourceName: 'slack',
          canonicalChannelId: 'slack',
          status: 'adapter-backed',
          route: expect.objectContaining({
            transportStrategy: 'webhook-runtime',
            webhookPath: '/api/webhooks/slack',
          }),
        }),
        // Telegram bot gateway should map to gateway-adapter transport since it is refactored to WebhookGateway subclass
        expect.objectContaining({
          normalizedSourceName: 'telegram',
          canonicalChannelId: 'telegram',
          status: 'adapter-backed',
          route: expect.objectContaining({
            transportStrategy: 'gateway-adapter',
          }),
        }),
      ]),
    );

    // 6. Ensure all generated entries have mapped features
    for (const entry of snapshot.entries) {
      expect(entry.route.features).toBeDefined();
      expect(typeof entry.route.features.inbound).toBe('boolean');
      expect(typeof entry.route.features.outbound).toBe('boolean');
    }
  });
});
