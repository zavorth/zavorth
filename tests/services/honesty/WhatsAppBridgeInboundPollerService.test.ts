import { WhatsAppBridgeInboundPollerService } from '../../../src/services/WhatsAppBridgeInboundPollerService.js';

describe('WhatsAppBridgeInboundPollerService', () => {
  it('delivers long-polled messages to onMessage handler', async () => {
    const seen: Record<string, unknown>[] = [];
    let calls = 0;
    const poller = new WhatsAppBridgeInboundPollerService({
      bridgeUrl: 'http://127.0.0.1:3910',
      pollTimeoutMs: 1000,
      fetchImpl: (async () => {
        calls += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            messages: calls === 1
              ? [{ from: '15551212', chatId: '15551212', text: 'hello bridge' }]
              : [],
          }),
        };
      }) as typeof fetch,
      onMessage: async (message) => {
        seen.push(message);
        return true;
      },
    });

    const first = await poller.pollOnce();
    expect(first.messages).toBe(1);
    expect(first.accepted).toBe(1);
    expect(seen[0]?.text).toBe('hello bridge');
    expect(seen[0]?.provider).toBe('baileys');

    const second = await poller.pollOnce();
    expect(second.messages).toBe(0);

    const snapshot = poller.snapshot();
    expect(snapshot.experimental).toBe(true);
    expect(snapshot.tier).toBe('T2');
    expect(snapshot.stats.messages).toBe(1);
    expect(snapshot.stats.accepted).toBe(1);
  });

  it('uses gateway handleWebhookEvent when provided', async () => {
    const gateway = {
      handleWebhookEvent: jest.fn(async () => ({ statusCode: 200, body: { ok: true } })),
      onMessageReceived: jest.fn(async () => false),
    };
    const poller = new WhatsAppBridgeInboundPollerService({
      bridgeUrl: 'http://bridge.test',
      fetchImpl: (async () => ({
        ok: true,
        status: 200,
        json: async () => ({ messages: [{ from: '1', text: 'ping' }] }),
      })) as typeof fetch,
      gateway,
    });
    const result = await poller.pollOnce();
    expect(result.accepted).toBe(1);
    expect(gateway.handleWebhookEvent).toHaveBeenCalled();
    expect(gateway.onMessageReceived).not.toHaveBeenCalled();
  });

  it('start/stop loop is safe', async () => {
    const poller = new WhatsAppBridgeInboundPollerService({
      bridgeUrl: 'http://127.0.0.1:3910',
      pollTimeoutMs: 1000,
      fetchImpl: (async () => ({
        ok: true,
        status: 200,
        json: async () => ({ messages: [] }),
      })) as typeof fetch,
      sleepImpl: async () => undefined,
      onMessage: async () => true,
    });
    poller.start();
    expect(poller.snapshot().running).toBe(true);
    await poller.stop();
    expect(poller.snapshot().running).toBe(false);
  });
});
