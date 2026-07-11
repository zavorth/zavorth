import fs from 'fs';
import os from 'os';
import path from 'path';
import { DiscordGateway } from '../../src/gateways/channels/discord/DiscordGateway.stub';

describe('DiscordGateway stub', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('tracks started state', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-discord-stub-state-'));
    tempDirs.push(root);
    const gateway = new DiscordGateway(undefined, {
      outboxDir: path.join(root, 'outbox'),
      statusFile: path.join(root, 'status.json'),
      allowedChannelIds: ['chat-1'],
      allowDirectMessages: true,
    });

    expect(gateway.isStarted()).toBe(false);
    await gateway.start();
    expect(gateway.isStarted()).toBe(true);
    await gateway.stop();
    expect(gateway.isStarted()).toBe(false);
  });

  it('forwards simulated messages to the attached broker', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-discord-stub-msg-'));
    tempDirs.push(root);
    const broker = {
      registerGateway: jest.fn(),
      processMessage: jest.fn().mockResolvedValue(undefined),
      broadcast: jest.fn(),
    };
    const gateway = new DiscordGateway(broker as any, {
      outboxDir: path.join(root, 'outbox'),
      statusFile: path.join(root, 'status.json'),
      allowedChannelIds: ['chat-1'],
      allowDirectMessages: true,
    });

    await gateway.simulateIncomingMessage({
      userId: 'user-1',
      chatId: 'chat-1',
      channelId: 'chat-1',
      guildId: null,
      rawText: 'ola mundo',
      isGroup: false,
    });

    expect(broker.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'discord',
        userId: 'user-1',
        isGroup: false,
        rawText: 'ola mundo',
      }),
    );
  });

  it('fails fast when simulating a message without a broker', async () => {
    const gateway = new DiscordGateway(undefined, {
      allowDirectMessages: true,
      allowedChannelIds: ['chat-1'],
    });

    await expect(
      gateway.simulateIncomingMessage({
        userId: 'user-1',
        chatId: 'chat-1',
        channelId: 'chat-1',
        guildId: null,
        rawText: 'ola',
        isGroup: false,
      }),
    ).rejects.toThrow('DiscordGateway stub has no broker attached.');
  });
});
