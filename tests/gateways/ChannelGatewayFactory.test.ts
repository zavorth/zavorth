import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ChannelGatewayFactory } from '../../src/gateways/ChannelGatewayFactory.js';

describe('ChannelGatewayFactory', () => {
  it('registers every declared webhook channel with its canonical identifier', () => {
    const expectedIds = [
      'matrix', 'line', 'google-chat', 'feishu', 'irc', 'qq', 'zalo', 'wecom', 'weixin', 'yuanbao',
      'sms', 'home-assistant', 'voice-call', 'google-meet', 'twitch', 'nextcloud-talk', 'mattermost',
      'synology-chat', 'clickclack', 'nostr', 'telegram', 'discord', 'slack', 'whatsapp', 'signal',
      'imessage', 'teams', 'email', 'instagram',
    ];

    const registry = ChannelGatewayFactory.createAll();

    expect(ChannelGatewayFactory.listSupportedChannelIds()).toEqual(expectedIds);
    expect(registry.listGateways().map((gateway) => gateway.id).sort()).toEqual([...expectedIds].sort());
  });

  it.each(ChannelGatewayFactory.listSupportedChannelIds())('%s persists an unconfigured send as a local outbox receipt', async (channelId) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `zavorth-${channelId}-`));
    const gateway = ChannelGatewayFactory.createFromId(channelId, {
      eventBus: { emit: jest.fn() } as any,
      policyManager: { verifyAccess: jest.fn(async () => true) } as any,
      outboxDir: path.join(root, 'outbox'),
      statusFile: path.join(root, 'status.json'),
    });

    try {
      expect(gateway).not.toBeNull();
      const delivery = await gateway!.sendMessage({ text: 'coverage message', recipients: ['test-recipient'] });
      expect(delivery).toEqual(expect.objectContaining({ ok: true, status: 'queued', transport: 'local-outbox' }));
      expect(fs.readdirSync(path.join(root, 'outbox'))).toHaveLength(1);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
