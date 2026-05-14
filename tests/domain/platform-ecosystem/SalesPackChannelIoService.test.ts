import {
  SalesPackChannelIoService,
} from '../../../src/services/SalesPackChannelIoService.js';

function deterministicIdFactory(): (prefix: string) => string {
  let next = 0;
  return (prefix: string) => `${prefix}-${++next}`;
}

describe('SalesPackChannelIoService', () => {
  it('normalizes local inbound messages into the Sales Pack flow with idempotency', () => {
    const service = new SalesPackChannelIoService({
      mode: 'stub',
      now: () => new Date('2026-05-08T12:00:00.000Z'),
      idFactory: deterministicIdFactory(),
    });

    const first = service.receiveInbound({
      tenantId: 'demo-org',
      channelAccountId: 'sales-channel-whatsapp',
      platform: 'whatsapp',
      provider: 'local-stub',
      providerMessageId: 'msg-1',
      customerId: 'lead-ana',
      text: 'Achei caro, mas ainda tenho interesse.',
      traceId: 'trace-channel-io',
    });
    const duplicate = service.receiveInbound({
      tenantId: 'demo-org',
      platform: 'whatsapp',
      provider: 'local-stub',
      providerMessageId: 'msg-1',
      customerId: 'lead-ana',
      text: 'Achei caro, mas ainda tenho interesse.',
      traceId: 'trace-channel-io',
    });

    expect(first.status).toBe('processed');
    expect(first.conversationResult?.signal.intent).toBe('price_objection');
    expect(duplicate.status).toBe('duplicate');
    expect(duplicate.conversationResult).toBeNull();
    expect(service.buildSnapshot().summary).toMatchObject({
      inboundReceived: 2,
      processed: 1,
      duplicates: 1,
      knownMessageIds: 1,
    });
  });

  it('normalizes WhatsApp Cloud API message and status payloads', () => {
    const service = new SalesPackChannelIoService({
      mode: 'cloud-api',
      now: () => new Date('2026-05-08T12:00:00.000Z'),
      idFactory: deterministicIdFactory(),
    });

    const message = service.receiveInbound({
      provider: 'whatsapp-cloud-api',
      body: {
        entry: [{
          id: 'business-1',
          changes: [{
            value: {
              metadata: { phone_number_id: 'phone-1' },
              messages: [{
                id: 'wamid-1',
                from: '5511999999999',
                timestamp: '1778241600',
                text: { body: 'Ainda tem vaga?' },
              }],
            },
          }],
        }],
      },
    });
    const status = service.receiveInbound({
      provider: 'whatsapp-cloud-api',
      body: {
        entry: [{
          id: 'business-1',
          changes: [{
            value: {
              metadata: { phone_number_id: 'phone-1' },
              statuses: [{ id: 'wamid-1', status: 'delivered' }],
            },
          }],
        }],
      },
    });

    expect(message.status).toBe('processed');
    expect(message.message).toMatchObject({
      tenantId: 'business-1',
      channelAccountId: 'phone-1',
      customerId: '5511999999999',
      providerMessageId: 'wamid-1',
      platform: 'whatsapp',
    });
    expect(message.conversationResult?.signal.intent).toBe('availability');
    expect(status.status).toBe('status_only');
    expect(service.buildSnapshot().summary).toMatchObject({
      processed: 1,
      statusOnly: 1,
    });
  });

  it('rejects payloads that cannot establish customer text context', () => {
    const service = new SalesPackChannelIoService({
      now: () => new Date('2026-05-08T12:00:00.000Z'),
      idFactory: deterministicIdFactory(),
    });

    const result = service.receiveInbound({
      provider: 'generic-webhook',
      customerId: 'lead-empty',
      text: ' ',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('rejected');
    expect(service.buildSnapshot().summary.rejected).toBe(1);
  });
});
