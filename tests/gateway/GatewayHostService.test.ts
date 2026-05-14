import { fetchJson } from '../helpers/dashboardWebTestUtils.js';
import { bootstrapGateway, startGatewayHost } from '../../src/gateway/index.js';

describe('Gateway host service', () => {
  it('boots the gateway core and reaches channel_ready', async () => {
    const runtime = await bootstrapGateway({});
    const snapshot = runtime.buildSnapshot();
    await runtime.stop();

    expect(snapshot.lifecycle.state).toBe('channel_ready');
    expect(snapshot.channels.total).toBe(3);
    expect(snapshot.domains).toEqual(
      expect.objectContaining({
        total: 12,
        initialized: 12,
        pending: 0,
      }),
    );
    expect(snapshot.channels.ids).toEqual(
      expect.arrayContaining(['cli', 'web', 'telegram']),
    );
  });

  it('starts an http host for the canonical gateway api', async () => {
    const { runtime, host, url } = await startGatewayHost({}, {
      host: '127.0.0.1',
      port: 0,
    });

    const gatewayStatus = await fetchJson(`${url}/api/v1/gateway/status`);
    const opsHealth = await fetchJson(`${url}/api/v1/ops/health`);

    await host.stop();
    await runtime.stop();

    expect(gatewayStatus.status).toBe(200);
    expect(gatewayStatus.payload).toEqual(
      expect.objectContaining({
        status: 'ready',
        version: expect.any(String),
      }),
    );
    expect(opsHealth.status).toBe(200);
    expect(opsHealth.payload).toEqual(
      expect.objectContaining({
        healthy: true,
      }),
    );
  });
});
