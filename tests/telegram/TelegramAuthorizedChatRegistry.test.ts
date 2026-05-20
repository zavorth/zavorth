import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { TelegramAuthorizedChatRegistry } from '../../src/telegram/TelegramAuthorizedChatRegistry.js';

describe('TelegramAuthorizedChatRegistry', () => {
  it('persists the real Telegram chat id seen after authorized ingress', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-telegram-chat-registry-'));
    const registryPath = path.join(dir, 'telegram-authorized-chats.json');
    const registry = new TelegramAuthorizedChatRegistry(registryPath);

    const record = registry.recordAuthorizedContext({
      chat: { id: 123456, type: 'private' },
      from: { id: 42, username: 'operator', first_name: 'Grey' },
    } as any);

    expect(record?.chatId).toBe('123456');
    expect(record?.userId).toBe('42');

    const snapshot = registry.read();
    expect(snapshot.chats).toHaveLength(1);
    expect(snapshot.chats[0]).toMatchObject({
      chatId: '123456',
      userId: '42',
      chatType: 'private',
      username: 'operator',
      source: 'telegram-ingress',
    });
  });

  it('updates last seen instead of duplicating the same chat/user pair', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-telegram-chat-registry-'));
    const registryPath = path.join(dir, 'telegram-authorized-chats.json');
    const registry = new TelegramAuthorizedChatRegistry(registryPath);

    registry.recordAuthorizedContext({
      chat: { id: 123456, type: 'private' },
      from: { id: 42, username: 'operator' },
    } as any);
    registry.recordAuthorizedContext({
      chat: { id: 123456, type: 'private' },
      from: { id: 42, username: 'operator2' },
    } as any);

    const snapshot = registry.read();
    expect(snapshot.chats).toHaveLength(1);
    expect(snapshot.chats[0].username).toBe('operator2');
  });
});
