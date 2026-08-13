import { ChannelGatewayFactory } from '../../src/gateways/ChannelGatewayFactory.js';
import { ChannelMeshConsistencyService } from '../../src/services/ChannelMeshConsistencyService.js';

describe('ChannelGatewayRegistryMesh Integration', () => {
  it('correctly integrates ChannelGatewayRegistry with ChannelMeshConsistencyService to build consistency snapshot', () => {
    // 1. Create a registry containing all unconfigured gateways
    const gatewayRegistry = ChannelGatewayFactory.createAll();
    expect(gatewayRegistry.size).toBeGreaterThanOrEqual(22);

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
    expect(snapshot.entries.length).toBeGreaterThanOrEqual(20);

    // 6. Ensure all generated entries have mapped features
    for (const entry of snapshot.entries) {
      expect(entry.route.features).toBeDefined();
      expect(typeof entry.route.features.inbound).toBe('boolean');
      expect(typeof entry.route.features.outbound).toBe('boolean');
    }
  });
});
