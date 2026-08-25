import fs from 'fs';
import os from 'os';
import path from 'path';
import { ChannelPolicyManager } from '../../src/channels/policies/ChannelPolicyManager.js';


describe('ChannelPolicyManager', () => {
  const tempDirs: string[] = [];
  const originalCwd = path.resolve(__dirname, '../../');

  afterEach(() => {
    process.chdir(originalCwd);
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('loads default channel policies and persists them locally', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-policy-'));
    tempDirs.push(root);
    const policyFile = path.join(root, 'channel-policies.json');
    const manager = new ChannelPolicyManager({
      policyFile,
      now: () => new Date('2026-04-08T20:00:00.000Z'),
    });

    const policies = await manager.loadPolicies();

    expect(policies.map((entry) => entry.channelId)).toEqual([
      'discord',
      'email',
      'imessage',
      'instagram',
      'signal',
      'slack',
      'teams',
      'telegram',
      'whatsapp',
    ]);
    expect(await manager.verifyAccess('slack', 'U123456')).toBe(false);
    expect(await manager.verifyAccess('whatsapp', '+551100000000')).toBe(false);
    expect(fs.existsSync(policyFile)).toBe(true);
  });

  it('supports persisted updates and blocks identifiers in the local blocklist', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-policy-update-'));
    tempDirs.push(root);
    const policyFile = path.join(root, 'channel-policies.json');
    const manager = new ChannelPolicyManager({ policyFile });
    await manager.loadPolicies();

    await manager.setPolicy('slack', {
      isOpenAccess: true,
      blockedList: ['spammer@corp.com', 'U-blocked'],
    });

    const reloaded = new ChannelPolicyManager({ policyFile });
    await reloaded.loadPolicies();

    expect(await reloaded.verifyAccess('slack', 'U-BLOCKED')).toBe(false);
    expect(await reloaded.verifyAccess('slack', 'U-healthy')).toBe(true);
  });

  it('describes policy posture per channel and exposes a snapshot summary', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-policy-summary-'));
    tempDirs.push(root);
    const policyFile = path.join(root, 'channel-policies.json');
    const manager = new ChannelPolicyManager({
      policyFile,
      env: {
        ZAVORTH_CHANNEL_POLICY_SLACK_OPEN: 'true',
        ZAVORTH_CHANNEL_POLICY_SLACK_BLOCKED: 'U-bad',
        ZAVORTH_CHANNEL_POLICY_WHATSAPP_ALLOWED: '+5511999999999',
      } as NodeJS.ProcessEnv,
      now: () => new Date('2026-04-13T15:10:00.000Z'),
    });
    await manager.loadPolicies();

    const slack = manager.describePolicy('slack');
    const whatsapp = manager.describePolicy('whatsapp');
    const snapshot = manager.buildSnapshot(['slack', 'whatsapp']);

    expect(slack).toEqual(expect.objectContaining({
      channelId: 'slack',
      state: 'open',
      blockedCount: 1,
    }));
    expect(whatsapp).toEqual(expect.objectContaining({
      channelId: 'whatsapp',
      state: 'allowlist',
      allowedCount: 1,
    }));
    expect(snapshot.summary).toEqual({
      total: 2,
      open: 1,
      allowlist: 1,
      mixed: 0,
      blockedOnly: 0,
      closed: 0,
    });
  });

  it('reloads file-backed allowlists after the configured cache window', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-policy-reload-'));
    tempDirs.push(root);
    const policyFile = path.join(root, 'channel-policies.json');
    let nowMs = Date.parse('2026-04-27T10:00:00.000Z');
    const manager = new ChannelPolicyManager({
      policyFile,
      cacheWindowMs: 1_000,
      now: () => new Date(nowMs),
    });
    await manager.loadPolicies();

    writePolicyState(policyFile, '2026-04-27T10:00:01.000Z', {
      telegram: {
        channelId: 'telegram',
        isOpenAccess: false,
        allowedList: ['user:42'],
        blockedList: [],
        updatedAt: '2026-04-27T10:00:01.000Z',
      },
    });

    nowMs = Date.parse('2026-04-27T10:00:00.500Z');
    expect(await manager.verifyAccess('telegram', 'user:42')).toBe(false);

    nowMs = Date.parse('2026-04-27T10:00:01.100Z');
    expect(await manager.verifyAccess('telegram', 'user:42')).toBe(true);
    expect(manager.getLastReloadReceipt()).toEqual(expect.objectContaining({
      actor: 'system',
      reason: 'cache-expired',
      cacheWindowMs: 1_000,
      changedChannels: expect.arrayContaining(['telegram']),
    }));
  });

  it('records operator reload receipts for explicit policy refreshes', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-policy-reload-receipt-'));
    tempDirs.push(root);
    const policyFile = path.join(root, 'channel-policies.json');
    const manager = new ChannelPolicyManager({
      policyFile,
      cacheWindowMs: 60_000,
      now: () => new Date('2026-04-27T11:00:00.000Z'),
    });
    await manager.loadPolicies();

    writePolicyState(policyFile, '2026-04-27T11:00:30.000Z', {
      slack: {
        channelId: 'slack',
        isOpenAccess: true,
        allowedList: [],
        blockedList: ['user:blocked'],
        updatedAt: '2026-04-27T11:00:30.000Z',
      },
    });

    const receipt = await manager.reloadPolicies({
      actor: 'operator:test',
      reason: 'unit-test-policy-change',
    });

    expect(receipt).toEqual(expect.objectContaining({
      actor: 'operator:test',
      reason: 'unit-test-policy-change',
      source: policyFile,
      previousPolicyCount: 9,
      nextPolicyCount: 1,
      changedChannels: expect.arrayContaining(['slack']),
    }));
    expect(await manager.verifyAccess('slack', 'user:healthy')).toBe(true);
    expect(await manager.verifyAccess('slack', 'user:blocked')).toBe(false);
  });

  it('loads canonical .zavorth channel policy on default load', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-policy-canonical-'));
    tempDirs.push(root);
    process.chdir(root);
    const canonicalPolicyFile = path.join(root, '.zavorth', 'channel-policies.json');
    fs.mkdirSync(path.dirname(canonicalPolicyFile), { recursive: true });
    writePolicyState(canonicalPolicyFile, '2026-04-27T12:00:00.000Z', {
      telegram: {
        channelId: 'telegram',
        isOpenAccess: false,
        allowedList: ['user:canonical'],
        blockedList: [],
        updatedAt: '2026-04-27T12:00:00.000Z',
      },
    });

    const manager = new ChannelPolicyManager({ cacheWindowMs: 0 });
    await manager.loadPolicies();

    expect(fs.existsSync(canonicalPolicyFile)).toBe(true);
    expect(await manager.verifyAccess('telegram', 'user:canonical')).toBe(true);
  });

  it('defaults user roles to admin when no role resolver is configured', () => {
    const manager = new ChannelPolicyManager();

    expect(manager.getUserRoles('999')).toEqual(['admin']);
    expect(manager.isAdminUser('999')).toBe(true);
  });

  it('resolves explicit configured roles live per query', () => {
    const roles: Record<string, string[]> = {};
    const manager = new ChannelPolicyManager({ resolveUserRoles: () => roles });

    expect(manager.isAdminUser('42')).toBe(true);

    roles['42'] = ['vice-owner'];

    expect(manager.getUserRoles('42')).toEqual(['vice-owner']);
    expect(manager.isAdminUser('42')).toBe(false);
  });

  it('classifies fun, read-only and group-admin command sets', () => {
    const manager = new ChannelPolicyManager();

    expect(manager.isFunCommand('/roll')).toBe(true);
    expect(manager.isFunCommand('/coinflip')).toBe(true);
    expect(manager.isFunCommand('/ban')).toBe(false);

    expect(manager.isReadOnlyAllowedCommand('/access')).toBe(true);
    expect(manager.isReadOnlyAllowedCommand('/bootstrap')).toBe(true);
    expect(manager.isReadOnlyAllowedCommand('/run')).toBe(false);

    expect(manager.isGroupAdminCommand('/ban')).toBe(true);
    expect(manager.isGroupAdminCommand('/setwelcome')).toBe(true);
    expect(manager.isGroupAdminCommand('/start')).toBe(false);
  });

  it('blocks privileged system commands for non-admin roles', () => {
    const manager = new ChannelPolicyManager();

    expect(manager.isCommandBlockedForNonAdmin('/codex')).toBe(true);
    expect(manager.isCommandBlockedForNonAdmin('/approve')).toBe(true);
    expect(manager.isCommandBlockedForNonAdmin('/external')).toBe(true);
    expect(manager.isCommandBlockedForNonAdmin('/roll')).toBe(false);
    expect(manager.isCommandBlockedForNonAdmin('/start')).toBe(false);
  });

  it('treats only slash-prefixed privileged tokens as hidden privileged input', () => {
    const manager = new ChannelPolicyManager();

    expect(manager.isHiddenPrivilegedInput('/ag_prompt x')).toBe(true);
    expect(manager.isHiddenPrivilegedInput('abrir zavorthBridge')).toBe(false);
    expect(manager.isHiddenPrivilegedInput('  /ÁG_PROMPT   x ')).toBe(true);
    expect(manager.isHiddenPrivilegedInput('/autorepair force')).toBe(true);
    expect(manager.isHiddenPrivilegedInput('')).toBe(false);
  });

  it('classifies mutable commands while the host is in read-only mode', () => {
    const manager = new ChannelPolicyManager();

    expect(manager.isMutableCommandWhileHostReadonly('/run', '/run npm test')).toBe(true);
    expect(manager.isMutableCommandWhileHostReadonly('', 'plain message')).toBe(false);
    expect(manager.isMutableCommandWhileHostReadonly('/access', '/access remote')).toBe(false);
    expect(manager.isMutableCommandWhileHostReadonly('/roll', '/roll')).toBe(false);
    expect(manager.isMutableCommandWhileHostReadonly('/hostauth', '/hostauth status')).toBe(false);
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
