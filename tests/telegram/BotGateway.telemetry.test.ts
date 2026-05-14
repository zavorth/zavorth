import { BotGateway } from '../../src/telegram/BotGateway';

describe('BotGateway telemetry', () => {
  it('records incoming message events without blocking the flow', async () => {
    const gateway = Object.create(BotGateway.prototype) as any;
    gateway.telemetryRuntime = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    await gateway.recordIncomingMessageTelemetry('chat-1', 'user-1', '/status', 'private');

    expect(gateway.telemetryRuntime.record).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'bot-gateway',
        eventType: 'telegram.message_received',
        status: 'received',
        payload: expect.objectContaining({
          chatId: 'chat-1',
          userId: 'user-1',
          isCommand: true,
        }),
      }),
    );
  });
});
