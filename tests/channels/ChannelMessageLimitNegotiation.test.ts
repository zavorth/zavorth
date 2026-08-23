import { GatewayRuntime } from '../../src/gateway/core/GatewayRuntime.js';
import type { GatewayChannelAdapter } from '../../src/gateway/channels/GatewayChannelAdapter.js';
import {
  buildInboundChannelEvent,
  extractChannelMeshReplyEvent,
} from '../../src/channels/contracts/ChannelMessageContract.js';
import {
  getChannelMessageLimitDirectory,
  resolveOutboundCharLimitOverride,
} from '../../src/channels/formatting/ChannelMessageLimitDirectory.js';
import { parseChannelMessageCharLimitOverrides } from '../../src/config/sections/channelConfig.js';
import { GatewayEventBus } from '../../src/gateway/events/GatewayEventBus.js';
import { ZavorthAgentGateway } from '../../src/runtime/agent/index.js';

function createAdapter(
  overrides: Partial<GatewayChannelAdapter> & { id: string },
): GatewayChannelAdapter {
  return {
    name: `${overrides.id} adapter`,
    type: 'async',
    initialize: async () => undefined,
    shutdown: async () => undefined,
    ...overrides,
  } as GatewayChannelAdapter;
}

describe('channel message limit negotiation and precedence', () => {
  const limitDirectory = getChannelMessageLimitDirectory();

  beforeEach(() => {
    limitDirectory.resetForTests();
  });

  afterEach(() => {
    limitDirectory.resetForTests();
  });

  it('negotiates the char limit once during registration and caches the result', async () => {
    const runtime = new GatewayRuntime();
    const negotiateMessageCharLimit = jest.fn().mockResolvedValue(777);
    const adapter = createAdapter({
      id: 'negotiation-probe',
      messageCharLimit: 4096,
      negotiateMessageCharLimit,
    });

    await runtime.registerChannel(adapter);

    expect(negotiateMessageCharLimit).toHaveBeenCalledTimes(1);
    expect(getChannelMessageLimitDirectory().getNegotiatedLimit('negotiation-probe')).toBe(777);
    expect(getChannelMessageLimitDirectory().getDeclaredLimit('negotiation-probe')).toBe(4096);
    expect(resolveOutboundCharLimitOverride('negotiation-probe', {})).toBe(777);
  });

  it('keeps the declared limit when the negotiation declines with null', async () => {
    const runtime = new GatewayRuntime();
    await runtime.registerChannel(
      createAdapter({
        id: 'declined-negotiation',
        messageCharLimit: 1234,
        negotiateMessageCharLimit: jest.fn().mockResolvedValue(null),
      }),
    );

    expect(getChannelMessageLimitDirectory().getNegotiatedLimit('declined-negotiation')).toBeUndefined();
    expect(resolveOutboundCharLimitOverride('declined-negotiation', {})).toBe(1234);
  });

  it('keeps the declared limit when negotiation throws instead of failing registration', async () => {
    const runtime = new GatewayRuntime();
    await runtime.registerChannel(
      createAdapter({
        id: 'failed-negotiation',
        messageCharLimit: 2222,
        negotiateMessageCharLimit: jest.fn().mockRejectedValue(new Error('api offline')),
      }),
    );

    expect(runtime.getChannel('failed-negotiation')).toBeDefined();
    expect(getChannelMessageLimitDirectory().getNegotiatedLimit('failed-negotiation')).toBeUndefined();
    expect(resolveOutboundCharLimitOverride('failed-negotiation', {})).toBe(2222);
  });

  it('resolves overrides with config > negotiated > declared precedence', () => {
    const directory = getChannelMessageLimitDirectory();
    directory.recordDeclaredLimit('precedence-probe', 4000);
    directory.recordNegotiatedLimit('precedence-probe', 3000);

    // No workspace override: negotiated wins over declared.
    expect(resolveOutboundCharLimitOverride('precedence-probe', {})).toBe(3000);

    // Workspace configuration wins over both adapter-derived values.
    expect(resolveOutboundCharLimitOverride('precedence-probe', { 'precedence-probe': 2500 })).toBe(2500);

    // Without a negotiation outcome, the declared value applies.
    directory.recordNegotiatedLimit('precedence-probe', null);
    expect(resolveOutboundCharLimitOverride('precedence-probe', {})).toBe(4000);

    // Nothing recorded: undefined defers to the built-in platform table.
    expect(resolveOutboundCharLimitOverride('unregistered-platform', {})).toBeUndefined();
  });

  it('parses the workspace config surface once into sanitized per-platform overrides', () => {
    expect(
      parseChannelMessageCharLimitOverrides('telegram=3000;slack=not-a-number\nemail=4096'),
    ).toEqual({ telegram: 3000, email: 4096 });
    expect(parseChannelMessageCharLimitOverrides('')).toEqual({});
    expect(parseChannelMessageCharLimitOverrides('no-separator; =7; slack=0')).toEqual({});
  });

  it('applies the default bridge char-limit resolution when no explicit override is provided', async () => {
    const directory = getChannelMessageLimitDirectory();
    directory.recordDeclaredLimit('slack', 4000);
    directory.recordNegotiatedLimit('slack', 60);

    const eventBus = new GatewayEventBus();
    const outboundReplies: Array<{ text: string }> = [];
    eventBus.subscribe('public_ws', (event) => {
      const reply = extractChannelMeshReplyEvent(event, 'slack');
      if (reply) {
        outboundReplies.push({ text: reply.text });
      }
    });

    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T17:00:00.000Z'),
      executor: () => ({
        status: 'completed',
        summary: 'Long negotiation report generated.',
        replyText: `${'beta '.repeat(60)}trim`,
      }),
    });
    gateway.attachChannelMeshEventBus(eventBus, {}, { onboardingGate: null });

    await eventBus.emit(
      buildInboundChannelEvent({
        platform: 'slack',
        userId: 'U123',
        chatId: 'C-limits',
        rawText: 'report the negotiation status',
        messageId: '171234.1700',
        now: new Date('2026-04-27T16:59:00.000Z'),
      }),
    );

    expect(outboundReplies.length).toBeGreaterThan(1);
    for (const reply of outboundReplies) {
      expect(reply.text.length).toBeLessThanOrEqual(60);
    }
  });
});
