import fs from 'fs';
import os from 'os';
import path from 'path';
import { GatewayEventBus } from '../../src/gateway/events/GatewayEventBus.js';
import { SlackChannelAdapter } from '../../src/channels/adapters/SlackChannelAdapter.js';
import { WhatsAppChannelAdapter } from '../../src/channels/adapters/WhatsAppChannelAdapter.js';
import { SignalChannelAdapter } from '../../src/channels/adapters/SignalChannelAdapter.js';
import { IMessageMacBridgeAdapter } from '../../src/channels/adapters/IMessageMacBridgeAdapter.js';
import { TeamsChannelAdapter } from '../../src/channels/adapters/TeamsChannelAdapter.js';
import { EmailChannelAdapter } from '../../src/channels/adapters/EmailChannelAdapter.js';
import { ChannelPolicyManager } from '../../src/channels/policies/ChannelPolicyManager.js';

describe('Channel Mesh adapters', () => {
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

  it('blocks unauthorized WhatsApp payloads before they reach the event bus', async () => {
    const policyManager = createIsolatedPolicyManager({
      ZAVORTH_CHANNEL_POLICY_WHATSAPP_ALLOWED: '+5511999999999',
    });
    await policyManager.loadPolicies();
    const eventBus = new GatewayEventBus();
    const emitSpy = jest.spyOn(eventBus, 'emit');
    const adapter = new WhatsAppChannelAdapter(eventBus, policyManager, 'wa_token');

    await adapter.onMessageReceived?.({
      fromNumber: '+551100000000',
      text: 'hello',
    });

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('emits canonical events for allowed Slack messages', async () => {
    const policyManager = createIsolatedPolicyManager({
      ZAVORTH_CHANNEL_POLICY_SLACK_OPEN: 'true',
    });
    await policyManager.loadPolicies();
    const eventBus = new GatewayEventBus();
    const emitSpy = jest.spyOn(eventBus, 'emit').mockResolvedValue();
    const adapter = new SlackChannelAdapter(eventBus, policyManager, 'xoxb-live');

    await adapter.onMessageReceived?.({
      user: 'U123456',
      text: 'deploy approved',
      channel: 'C-ops',
    });

    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'public_ws',
      payload: expect.objectContaining({
        id: expect.stringContaining('slack-'),
        type: 'event',
        payload: expect.objectContaining({
          topic: 'im_message',
          data: expect.objectContaining({
            platform: 'slack',
            userId: 'U123456',
            channelId: 'C-ops',
            rawText: 'deploy approved',
            normalizedInboundMessage: expect.objectContaining({
              userId: 'U123456',
              sessionId: 'slack:C-ops',
              channel: 'api',
              text: 'deploy approved',
              metadata: expect.objectContaining({
                source: 'channel-mesh',
                platform: 'slack',
                normalizedInboundMessage: true,
              }),
            }),
          }),
        }),
      }),
    }));
  });

  it('writes Slack outbound envelopes to the local outbox', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-slack-adapter-'));
    tempDirs.push(root);
    const outboxDir = path.join(root, 'slack-outbox');
    const eventBus = new GatewayEventBus();
    const policyManager = new ChannelPolicyManager();
    await policyManager.loadPolicies();
    const adapter = new SlackChannelAdapter(eventBus, policyManager, '', {
      outboxDir,
      now: () => new Date('2026-04-08T20:30:00.000Z'),
    });

    await adapter.sendMessage({
      channelId: 'C-ops',
      text: 'deploy ready',
    });

    const files = fs.readdirSync(outboxDir);
    const envelope = JSON.parse(fs.readFileSync(path.join(outboxDir, files[0]), 'utf8'));
    expect(envelope).toEqual(expect.objectContaining({
      platform: 'slack',
      channelId: 'C-ops',
      message: 'deploy ready',
      transport: 'local-outbox',
    }));
  });

  it('writes WhatsApp outbound envelopes to the local outbox', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-whatsapp-adapter-'));
    tempDirs.push(root);
    const outboxDir = path.join(root, 'whatsapp-outbox');
    const eventBus = new GatewayEventBus();
    const policyManager = new ChannelPolicyManager();
    await policyManager.loadPolicies();
    const adapter = new WhatsAppChannelAdapter(eventBus, policyManager, '', {
      outboxDir,
      now: () => new Date('2026-04-08T20:31:00.000Z'),
    });

    await adapter.sendMessage({
      chatId: '+5511999999999',
      text: 'agente online',
    });

    const files = fs.readdirSync(outboxDir);
    const envelope = JSON.parse(fs.readFileSync(path.join(outboxDir, files[0]), 'utf8'));
    expect(envelope).toEqual(expect.objectContaining({
      platform: 'whatsapp',
      chatId: '+5511999999999',
      message: 'agente online',
      transport: 'local-outbox',
    }));
  });

  it('emits canonical events for allowed Signal messages and writes bridge outbox envelopes', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-signal-adapter-'));
    tempDirs.push(root);
    const outboxDir = path.join(root, 'signal-outbox');
    const policyManager = new ChannelPolicyManager({
      policyFile: path.join(root, 'channel-policies.json'),
      env: {
        ZAVORTH_CHANNEL_POLICY_SIGNAL_ALLOWED: '+5511999999999',
      } as NodeJS.ProcessEnv,
    });
    await policyManager.loadPolicies();
    const eventBus = new GatewayEventBus();
    const emitSpy = jest.spyOn(eventBus, 'emit').mockResolvedValue();
    const adapter = new SignalChannelAdapter(eventBus, policyManager, 'signal-cli', {
      outboxDir,
      now: () => new Date('2026-04-11T12:00:00.000Z'),
    });

    await adapter.onMessageReceived?.({
      sender: '+5511999999999',
      message: 'approve deploy',
      timestamp: 'sig-1',
    });
    await adapter.sendMessage({
      recipient: '+5511999999999',
      text: 'deploy approved',
    });

    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'public_ws',
      payload: expect.objectContaining({
        id: 'signal-sig-1',
        payload: expect.objectContaining({
          data: expect.objectContaining({
            platform: 'signal',
            rawText: 'approve deploy',
          }),
        }),
      }),
    }));
    const files = fs.readdirSync(outboxDir);
    const envelope = JSON.parse(fs.readFileSync(path.join(outboxDir, files[0]), 'utf8'));
    expect(envelope).toEqual(expect.objectContaining({
      platform: 'signal',
      recipient: '+5511999999999',
      message: 'deploy approved',
      transport: 'signal-cli-configured',
    }));
  });

  it('keeps iMessage bridge approval-first before writing outbound envelopes', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-imessage-adapter-'));
    tempDirs.push(root);
    const outboxDir = path.join(root, 'imessage-outbox');
    const policyManager = new ChannelPolicyManager({
      policyFile: path.join(root, 'channel-policies.json'),
      env: {
        ZAVORTH_CHANNEL_POLICY_IMESSAGE_ALLOWED: 'alice@example.com',
      } as NodeJS.ProcessEnv,
    });
    await policyManager.loadPolicies();
    const eventBus = new GatewayEventBus();
    const emitSpy = jest.spyOn(eventBus, 'emit').mockResolvedValue();
    const adapter = new IMessageMacBridgeAdapter(eventBus, policyManager, 'mac-node-1', {
      outboxDir,
      readOnly: false,
      requireApproval: true,
      now: () => new Date('2026-04-11T12:01:00.000Z'),
    });

    await adapter.onMessageReceived?.({
      sender: 'alice@example.com',
      text: 'status-',
      guid: 'im-1',
    });
    await expect(adapter.sendMessage({
      recipient: 'alice@example.com',
      text: 'online',
    })).rejects.toThrow('approval');
    await adapter.sendMessage({
      recipient: 'alice@example.com',
      text: 'online',
      approved: true,
    });

    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'public_ws',
      payload: expect.objectContaining({
        id: 'imessage-im-1',
      }),
    }));
    const files = fs.readdirSync(outboxDir);
    const envelope = JSON.parse(fs.readFileSync(path.join(outboxDir, files[0]), 'utf8'));
    expect(envelope).toEqual(expect.objectContaining({
      platform: 'imessage',
      recipient: 'alice@example.com',
      approved: true,
      transport: 'mac-bridge-configured',
    }));
  });

  it('emits canonical events for allowed Teams messages and writes graph-bot envelopes', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-teams-adapter-'));
    tempDirs.push(root);
    const outboxDir = path.join(root, 'teams-outbox');
    const policyManager = new ChannelPolicyManager({
      policyFile: path.join(root, 'channel-policies.json'),
      env: {
        ZAVORTH_CHANNEL_POLICY_TEAMS_ALLOWED: 'aad-user-1',
      } as NodeJS.ProcessEnv,
    });
    await policyManager.loadPolicies();
    const eventBus = new GatewayEventBus();
    const emitSpy = jest.spyOn(eventBus, 'emit').mockResolvedValue();
    const adapter = new TeamsChannelAdapter(eventBus, policyManager, 'teams-app', {
      outboxDir,
      now: () => new Date('2026-04-11T12:02:00.000Z'),
    });

    await adapter.onMessageReceived?.({
      from: { id: 'aad-user-1' },
      conversation: { id: 'conversation-1' },
      text: 'approve rollout',
      id: 'teams-1',
    });
    await adapter.sendMessage({
      conversationId: 'conversation-1',
      text: 'rollout approved',
    });

    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'public_ws',
      payload: expect.objectContaining({
        id: 'teams-teams-1',
        payload: expect.objectContaining({
          data: expect.objectContaining({
            platform: 'teams',
            chatId: 'conversation-1',
            rawText: 'approve rollout',
          }),
        }),
      }),
    }));
    const files = fs.readdirSync(outboxDir);
    const envelope = JSON.parse(fs.readFileSync(path.join(outboxDir, files[0]), 'utf8'));
    expect(envelope).toEqual(expect.objectContaining({
      platform: 'teams',
      conversationId: 'conversation-1',
      message: 'rollout approved',
      transport: 'graph-bot-configured',
    }));
  });

  it('emits canonical events for allowed Email messages and writes smtp envelopes', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-email-adapter-'));
    tempDirs.push(root);
    const outboxDir = path.join(root, 'email-outbox');
    const policyManager = new ChannelPolicyManager({
      policyFile: path.join(root, 'channel-policies.json'),
      env: {
        ZAVORTH_CHANNEL_POLICY_EMAIL_ALLOWED: 'ops@example.test',
      } as NodeJS.ProcessEnv,
    });
    await policyManager.loadPolicies();
    const eventBus = new GatewayEventBus();
    const emitSpy = jest.spyOn(eventBus, 'emit').mockResolvedValue();
    const adapter = new EmailChannelAdapter(eventBus, policyManager, 'smtp', {
      outboxDir,
      now: () => new Date('2026-04-11T12:03:00.000Z'),
    });

    await adapter.onMessageReceived?.({
      from: 'ops@example.test',
      subject: 'Deploy',
      text: 'pode subir',
      messageId: 'mail-1',
    });
    await adapter.sendMessage({
      recipient: 'ops@example.test',
      subject: 'Deploy reply',
      text: 'subindo agora',
    });

    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'public_ws',
      payload: expect.objectContaining({
        id: 'email-mail-1',
        payload: expect.objectContaining({
          data: expect.objectContaining({
            platform: 'email',
            userId: 'ops@example.test',
            subject: 'Deploy',
          }),
        }),
      }),
    }));
    const files = fs.readdirSync(outboxDir);
    const envelope = JSON.parse(fs.readFileSync(path.join(outboxDir, files[0]), 'utf8'));
    expect(envelope).toEqual(expect.objectContaining({
      platform: 'email',
      recipient: 'ops@example.test',
      subject: 'Deploy reply',
      message: 'subindo agora',
      transport: 'smtp-configured',
    }));
  });
});
