import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { AuthorizedChatRegistry } from '../../../src/channels/policies/AuthorizedChatRegistry.js';

describe('AuthorizedChatRegistry', () => {
  const tempDirs: string[] = [];
  const originalCwd = process.cwd();

  afterEach(() => {
    process.chdir(originalCwd);
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('persists the real Telegram chat id seen after authorized ingress', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-telegram-chat-registry-'));
    tempDirs.push(dir);
    const registryPath = path.join(dir, 'telegram-authorized-chats.json');
    const registry = new AuthorizedChatRegistry({ registryPath });

    const record = registry.recordAuthorizedContext({
      chat: { id: 123456, type: 'private' },
      from: { id: 42, username: 'operator', first_name: 'Grey' },
    });

    expect(record?.channelId).toBe('telegram');
    expect(record?.chatId).toBe('123456');
    expect(record?.userId).toBe('42');

    const snapshot = registry.read();
    expect(snapshot.chats).toHaveLength(1);
    expect(snapshot.chats[0]).toMatchObject({
      channelId: 'telegram',
      chatId: '123456',
      userId: '42',
      chatType: 'private',
      username: 'operator',
      source: 'telegram-ingress',
    });
  });

  it('updates last seen instead of duplicating the same chat/user pair', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-telegram-chat-registry-'));
    tempDirs.push(dir);
    const registryPath = path.join(dir, 'telegram-authorized-chats.json');
    const registry = new AuthorizedChatRegistry({ registryPath });

    registry.recordAuthorizedContext({
      chat: { id: 123456, type: 'private' },
      from: { id: 42, username: 'operator' },
    });
    registry.recordAuthorizedContext({
      chat: { id: 123456, type: 'private' },
      from: { id: 42, username: 'operator2' },
    });

    const snapshot = registry.read();
    expect(snapshot.chats).toHaveLength(1);
    expect(snapshot.chats[0].username).toBe('operator2');
  });

  it('normalizes legacy snapshots without channel ids back onto the owning channel', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-legacy-chat-registry-'));
    tempDirs.push(dir);
    const registryPath = path.join(dir, 'telegram-authorized-chats.json');
    fs.writeFileSync(
      registryPath,
      `${JSON.stringify(
        {
          version: 1,
          updatedAt: '2026-04-08T20:00:00.000Z',
          chats: [
            {
              chatId: '-100200300',
              chatType: 'supergroup',
              userId: '42',
              username: 'operator',
              firstName: 'Grey',
              lastSeenAt: '2026-04-08T19:00:00.000Z',
              source: 'telegram-ingress',
            },
          ],
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const snapshot = new AuthorizedChatRegistry({ registryPath }).read();

    expect(snapshot.chats).toHaveLength(1);
    expect(snapshot.chats[0]).toMatchObject({
      channelId: 'telegram',
      chatId: '-100200300',
      userId: '42',
      source: 'telegram-ingress',
    });
  });

  it('writes custom channels into their own <channelId>-authorized-chats.json contract', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-chat-registry-'));
    tempDirs.push(root);
    process.chdir(root);

    const registry = new AuthorizedChatRegistry({ channelId: 'whatsapp' });
    const record = registry.recordAuthorizedContext({
      chat: { id: '5511999999999@c.us', type: 'group' },
      from: { id: 'u1', username: 'lead' },
    });

    expect(record?.channelId).toBe('whatsapp');
    expect(record?.source).toBe('whatsapp-ingress');

    const expectedPath = path.join(root, 'data', 'runtime', 'whatsapp-authorized-chats.json');
    expect(fs.existsSync(expectedPath)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(expectedPath, 'utf8')) as { chats: Array<{ channelId?: string; chatId?: string }> };
    expect(parsed.chats[0]).toMatchObject({ channelId: 'whatsapp', chatId: '5511999999999@c.us' });
  });
});
