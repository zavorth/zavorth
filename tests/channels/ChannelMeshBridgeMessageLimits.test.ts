import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  buildInboundChannelEvent,
  extractChannelMeshReplyEvent,
} from '../../src/channels/contracts/ChannelMessageContract.js';
import { ChannelPolicyManager } from '../../src/channels/policies/ChannelPolicyManager.js';
import { GatewayEventBus } from '../../src/gateway/events/GatewayEventBus.js';
import { EmailChannelAdapter } from '../../src/gateways/channels/email/EmailChannelAdapter.js';
import { IMessageMacBridgeAdapter } from '../../src/gateways/channels/imessage/IMessageMacBridgeAdapter.js';
import { SignalChannelAdapter } from '../../src/gateways/channels/signal/SignalChannelAdapter.js';
import { SlackChannelAdapter } from '../../src/gateways/channels/slack/SlackChannelAdapter.js';
import { TeamsChannelAdapter } from '../../src/gateways/channels/teams/TeamsChannelAdapter.js';
import { WhatsAppChannelAdapter } from '../../src/gateways/channels/whatsapp/WhatsAppChannelAdapter.js';
import { ZavorthAgentGateway } from '../../src/runtime/agent/index.js';

function repeatWord(word: string, times: number): string {
  return Array.from({ length: times }, () => word).join(' ');
}

describe('declared channel message limits', () => {
  const tempDirs: string[] = [];

  function createIsolatedPolicyManager(env: Record<string, string> = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-policy-'));
    tempDirs.push(root);
    return new ChannelPolicyManager({
      policyFile: path.join(root, 'channel-policies.json'),
      env: env as NodeJS.ProcessEnv,
    });
  }

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('declares the platform char limit on every outbox adapter', () => {
    const eventBus = new GatewayEventBus();
    const policyManager = new ChannelPolicyManager();

    expect(new SignalChannelAdapter(eventBus, policyManager, '').messageCharLimit).toBe(4096);
    expect(new WhatsAppChannelAdapter(eventBus, policyManager, '').messageCharLimit).toBe(4096);
    expect(new TeamsChannelAdapter(eventBus, policyManager, '').messageCharLimit).toBe(4096);
    expect(new EmailChannelAdapter(eventBus, policyManager, '').messageCharLimit).toBe(4096);
    expect(new IMessageMacBridgeAdapter(eventBus, policyManager, '', {}).messageCharLimit).toBe(4096);
    expect(new SlackChannelAdapter(eventBus, policyManager, '').messageCharLimit).toBe(4000);
  });

  it('lets the bridge char-limit override win over the built-in platform table', async () => {
    const policyManager = createIsolatedPolicyManager({
      ZAVORTH_CHANNEL_POLICY_SLACK_OPEN: 'true',
    });
    await policyManager.loadPolicies();
    const eventBus = new GatewayEventBus();
    const outboundReplies: Array<{ text: string }> = [];
    eventBus.subscribe('public_ws', (event) => {
      const reply = extractChannelMeshReplyEvent(event, 'slack');
      if (reply) {
        outboundReplies.push({ text: reply.text });
      }
    });

    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T15:00:00.000Z'),
      executor: () => ({
        status: 'completed',
        summary: 'Long operational report generated.',
        replyText: repeatWord('alpha', 200),
      }),
    });
    const overrideLimit = 120;
    gateway.attachChannelMeshEventBus(eventBus, {}, {
      onboardingGate: null,
      getCharLimitOverride: (platform) => (platform === 'slack' ? overrideLimit : undefined),
    });

    await eventBus.emit(
      buildInboundChannelEvent({
        platform: 'slack',
        userId: 'U123',
        chatId: 'C-ops',
        rawText: 'report the deploy status',
        messageId: '171234.0100',
        now: new Date('2026-04-27T14:59:00.000Z'),
      }),
    );

    expect(outboundReplies.length).toBeGreaterThan(1);
    for (const reply of outboundReplies) {
      expect(reply.text.length).toBeLessThanOrEqual(overrideLimit);
    }
    expect(outboundReplies.map((reply) => reply.text).join(' ')).toContain('alpha');
  });

  it('keeps the built-in platform table when no override is declared', async () => {
    const policyManager = createIsolatedPolicyManager({
      ZAVORTH_CHANNEL_POLICY_SLACK_OPEN: 'true',
    });
    await policyManager.loadPolicies();
    const eventBus = new GatewayEventBus();
    const outboundReplies: Array<{ text: string }> = [];
    eventBus.subscribe('public_ws', (event) => {
      const reply = extractChannelMeshReplyEvent(event, 'slack');
      if (reply) {
        outboundReplies.push({ text: reply.text });
      }
    });

    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T15:10:00.000Z'),
      executor: () => ({
        status: 'completed',
        summary: 'Short confirmation.',
        replyText: 'done',
      }),
    });
    gateway.attachChannelMeshEventBus(eventBus, {}, { onboardingGate: null });

    await eventBus.emit(
      buildInboundChannelEvent({
        platform: 'slack',
        userId: 'U123',
        chatId: 'C-ops',
        rawText: 'short ack please',
        messageId: '171234.0101',
        now: new Date('2026-04-27T15:09:00.000Z'),
      }),
    );

    expect(outboundReplies).toEqual([{ text: 'done' }]);
  });
});
