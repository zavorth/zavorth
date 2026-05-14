import { DiscordGateway } from '../../src/gateways/DiscordGateway.stub';

describe('DiscordGateway stub', () => {
  it('tracks started state', async () => {
    const gateway = new DiscordGateway();

    expect(gateway.isStarted()).toBe(false);
    await gateway.start();
    expect(gateway.isStarted()).toBe(true);
    await gateway.stop();
    expect(gateway.isStarted()).toBe(false);
  });

  it('forwards simulated messages to the attached broker', async () => {
    const broker = {
      registerGateway: jest.fn(),
      processMessage: jest.fn().mockResolvedValue(undefined),
      broadcast: jest.fn(),
    };
    const gateway = new DiscordGateway(broker as any);

    await gateway.simulateIncomingMessage({
      userId: 'user-1',
      chatId: 'chat-1',
      rawText: 'ola mundo',
      isGroup: true,
    });

    expect(broker.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'discord',
        userId: 'user-1',
        chatId: 'chat-1',
        isGroup: true,
        rawText: 'ola mundo',
      }),
    );
  });

  it('fails fast when simulating a message without a broker', async () => {
    const gateway = new DiscordGateway();

    await expect(
      gateway.simulateIncomingMessage({
        userId: 'user-1',
        chatId: 'chat-1',
        rawText: 'ola',
      }),
    ).rejects.toThrow('DiscordGateway stub has no broker attached.');
  });
});
