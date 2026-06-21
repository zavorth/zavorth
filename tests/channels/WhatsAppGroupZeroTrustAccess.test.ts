import fs from 'fs';
import os from 'os';
import path from 'path';
import { ChannelPolicyManager } from '../../src/channels/policies/ChannelPolicyManager.js';

describe('WhatsApp group zero-trust access', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('normalizes WhatsApp allowlist into separate allowed users and groups', async () => {
    const manager = createManager({
      allowedList: ['+15550001111', '120363025555555555@g.us', ' +15550001111 '],
    });

    const policy = manager.getPolicy('whatsapp');

    expect(policy?.allowedUsers).toEqual(['+15550001111']);
    expect(policy?.allowedGroups).toEqual(['120363025555555555@g.us']);
  });

  it('allows DMs only for explicitly allowed users', async () => {
    const manager = createManager({
      allowedList: ['+15550001111', '120363025555555555@g.us'],
    });

    await expect(manager.verifyChatAccess('whatsapp', '+15550001111', '+15550001111')).resolves.toBe(true);
    await expect(manager.verifyChatAccess('whatsapp', '+15559990000', '+15559990000')).resolves.toBe(false);
  });

  it('allows groups only by explicit group chat ID without trusting every participant', async () => {
    const manager = createManager({
      allowedList: ['+15550001111', '120363025555555555@g.us'],
    });

    await expect(manager.verifyGroupAccess('whatsapp', '120363025555555555@g.us')).resolves.toBe(true);
    await expect(manager.verifyGroupAccess('whatsapp', '120363029999999999@g.us')).resolves.toBe(false);
    await expect(manager.verifyChatAccess('whatsapp', '120363025555555555@g.us', '+15559990000')).resolves.toBe(true);
    await expect(manager.verifyUserAccess('whatsapp', '+15559990000')).resolves.toBe(false);
    await expect(manager.verifyUserAccess('whatsapp', '+15550001111')).resolves.toBe(true);
  });
});

function createManager(input: { allowedList: string[] }): ChannelPolicyManager {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-whatsapp-groups-access-'));
  const policyFile = path.join(root, 'channel-policies.json');
  fs.writeFileSync(policyFile, `${JSON.stringify({
    version: 1,
    updatedAt: '2026-06-17T00:00:00.000Z',
    policies: {
      whatsapp: {
        channelId: 'whatsapp',
        isOpenAccess: false,
        allowedList: input.allowedList,
        blockedList: [],
        updatedAt: '2026-06-17T00:00:00.000Z',
      },
    },
  }, null, 2)}\n`);
  const manager = new ChannelPolicyManager({ policyFile, cacheWindowMs: 0 });
  return manager;
}
