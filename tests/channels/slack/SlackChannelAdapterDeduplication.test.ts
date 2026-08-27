import { SlackChannelAdapter } from '../../../src/gateways/channels/slack/SlackChannelAdapter.js';
import type { GatewayEventBus } from '../../../src/gateway/events/GatewayEventBus.js';
import type { ChannelPolicyManager } from '../../../src/channels/policies/ChannelPolicyManager.js';

describe('SlackChannelAdapter Concurrency & Deduplication', () => {
  let mockEventBus: {
    subscribe: jest.Mock;
    unsubscribe: jest.Mock;
    emit: jest.Mock;
  };
  let mockPolicyManager: {
    verifyAccess: jest.Mock;
  };

  beforeEach(() => {
    mockEventBus = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      emit: jest.fn(async () => undefined),
    };
    mockPolicyManager = {
      verifyAccess: jest.fn(async () => true),
    };
  });

  it('claims event on first attempt and rejects duplicate event within TTL', () => {
    const adapter = new SlackChannelAdapter(
      mockEventBus as unknown as GatewayEventBus,
      mockPolicyManager as unknown as ChannelPolicyManager,
      'xoxb-test-token',
      { claimTtlMs: 5000 },
    );

    const now = 10000;
    expect(adapter.claimEvent('evt-1001', now)).toBe(true);
    expect(adapter.claimEvent('evt-1001', now + 1000)).toBe(false); // Duplicate rejected
    expect(adapter.claimEvent('evt-1002', now + 1000)).toBe(true);  // Distinct event accepted
    expect(adapter.claimEvent('evt-1001', now + 6000)).toBe(true);  // Accepted after TTL expiry
  });

  it('deduplicates concurrent message retries in onMessageReceived', async () => {
    let currentTime = 20000;
    const adapter = new SlackChannelAdapter(
      mockEventBus as unknown as GatewayEventBus,
      mockPolicyManager as unknown as ChannelPolicyManager,
      'xoxb-test-token',
      { now: () => new Date(currentTime), claimTtlMs: 10000 },
    );

    const payload = {
      event_id: 'Ev08TEST123',
      user: 'U12345',
      channel: 'C67890',
      text: 'Hello Zavorth from Slack',
      ts: '1710000000.000100',
    };

    // First arrival
    await adapter.onMessageReceived(payload);
    expect(mockEventBus.emit).toHaveBeenCalledTimes(1);

    // Immediate Slack retry (same event_id)
    await adapter.onMessageReceived(payload);
    expect(mockEventBus.emit).toHaveBeenCalledTimes(1); // Not called again!

    // Distinct event arrival
    await adapter.onMessageReceived({
      ...payload,
      event_id: 'Ev08TEST456',
      ts: '1710000001.000200',
    });
    expect(mockEventBus.emit).toHaveBeenCalledTimes(2);
  });
});
