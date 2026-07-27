import fs from 'fs';
import os from 'os';
import path from 'path';
import { ChannelPolicyManager } from '../../src/channels/policies/ChannelPolicyManager';
import { TelegramChannelContractService } from '../../src/telegram/TelegramChannelContractService';

describe('TelegramChannelContractService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  function createService(options: {
    cacheWindowMs-: number;
    now-: () => Date;
  } = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-telegram-policy-'));
    tempDirs.push(root);
    const policyFile = path.join(root, 'channel-policies.json');
    const manager = new ChannelPolicyManager({
      policyFile,
      cacheWindowMs: options.cacheWindowMs,
      now: options.now,
    });
    return { manager, policyFile, service: new TelegramChannelContractService(manager) };
  }

  it('builds canonical Telegram chat/thread identifiers for the Channel Mesh', () => {
    const { service } = createService();

    const contract = service.buildContract({
      chat: { id: -100123, type: 'supergroup' },
      from: { id: 42 },
      message: { text: '/status', message_thread_id: 777 },
    } as any);

    expect(contract.chatId).toBe('-100123');
    expect(contract.threadId).toBe('777');
    expect(contract.chatHint).toBe('-100123:thread:777');
    expect(contract.transport).toBe('slash_command');
    expect(contract.policyIdentifiers).toEqual(
      expect.arrayContaining(['chat:-100123', 'user:42', 'thread:-100123:777']),
    );
  });

  it('blocks chats and users through the telegram channel policy', async () => {
    const { manager, service } = createService();
    await manager.loadPolicies();
    await manager.setPolicy('telegram', {
      isOpenAccess: false,
      allowedList: ['chat:-100123'],
      blockedList: ['user:666'],
    });

    const allowed = await service.authorize({
      chat: { id: -100123, type: 'supergroup' },
      from: { id: 42 },
      message: { text: '/status' },
    } as any);
    const blocked = await service.authorize({
      chat: { id: -100123, type: 'supergroup' },
      from: { id: 666 },
      message: { text: '/status' },
    } as any);
    const notAllowed = await service.authorize({
      chat: { id: -100999, type: 'supergroup' },
      from: { id: 42 },
      message: { text: '/status' },
    } as any);

    expect(allowed.allowed).toBe(true);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe('telegram-policy-blocked');
    expect(notAllowed.allowed).toBe(false);
    expect(notAllowed.reason).toBe('telegram-policy-not-allowed');
  });

  it('uses reloaded channel policy without recreating the active service', async () => {
    let nowMs = Date.parse('2026-04-27T12:00:00.000Z');
    const { manager, policyFile, service } = createService({
      cacheWindowMs: 500,
      now: () => new Date(nowMs),
    });
    await manager.loadPolicies();

    const blockedBeforeReload = await service.authorize({
      chat: { id: -100123, type: 'supergroup' },
      from: { id: 42 },
      message: { text: '/status' },
    } as any);

    writePolicyState(policyFile, '2026-04-27T12:00:01.000Z', {
      telegram: {
        channelId: 'telegram',
        isOpenAccess: false,
        allowedList: ['user:42'],
        blockedList: [],
        updatedAt: '2026-04-27T12:00:01.000Z',
      },
    });
    nowMs = Date.parse('2026-04-27T12:00:00.600Z');

    const allowedAfterReload = await service.authorize({
      chat: { id: -100123, type: 'supergroup' },
      from: { id: 42 },
      message: { text: '/status' },
    } as any);

    expect(blockedBeforeReload.allowed).toBe(false);
    expect(blockedBeforeReload.reason).toBe('telegram-policy-not-allowed');
    expect(allowedAfterReload.allowed).toBe(true);
    expect(allowedAfterReload.reason).toBe('telegram-policy-allowed');
    expect(manager.getLastReloadReceipt()).toEqual(expect.objectContaining({
      reason: 'cache-expired',
      changedChannels: expect.arrayContaining(['telegram']),
    }));
  });
});

function writePolicyState(
  policyFile: string,
  updatedAt: string,
  policies: Record<string, unknown>,
): void {
  fs.writeFileSync(
    policyFile,
    `${JSON.stringify({ version: 1, updatedAt, policies }, null, 2)}\n`,
    'utf8',
  );
}
