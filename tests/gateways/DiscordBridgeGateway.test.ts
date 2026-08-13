import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  DiscordBridgeGateway,
  signDiscordBridgeEnvelope,
  type DiscordBridgeInboundEnvelope,
} from '../../src/adapters/channels/DiscordBridgeGateway';
import { ZavorthAgentGateway } from '../../src/runtime/agent';

function createTempPaths() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-discord-bridge-'));
  return {
    root,
    inboxDir: path.join(root, 'inbox'),
    processedDir: path.join(root, 'processed'),
    rejectedDir: path.join(root, 'rejected'),
    outboxDir: path.join(root, 'outbox'),
    stateFilePath: path.join(root, 'runtime', 'state.json'),
    statusFilePath: path.join(root, 'runtime', 'status.json'),
    secretFilePath: path.join(root, 'runtime', 'secret.key'),
  };
}

function createSignedEnvelope(
  secret: string,
  overrides: Partial<DiscordBridgeInboundEnvelope> = {},
): DiscordBridgeInboundEnvelope {
  const envelope: DiscordBridgeInboundEnvelope = {
    protocol: 'ZAVORTH_DISCORD_BRIDGE_V1' as const,
    eventId: 'discord-event-default',
    createdAt: new Date().toISOString(),
    author: {
      id: 'user-1',
      username: 'operator',
    },
    channel: {
      id: 'channel-1',
      guildId: 'guild-1',
      type: 'guild_text',
    },
    message: {
      id: 'discord-msg-default',
      content: 'continue a tarefa',
    },
    signature: '',
    ...overrides,
  };
  envelope.signature = signDiscordBridgeEnvelope(secret, {
    ...envelope,
    signature: undefined as never,
  });
  return envelope;
}

describe('DiscordBridgeGateway', () => {
  it('processes a signed relay envelope, forwards it to the broker and writes replies to the outbox', async () => {
    const temp = createTempPaths();
    const secret = 'discord-bridge-secret';
    const timestamp = new Date().toISOString();
    const broker = {
      registerGateway: jest.fn(),
      broadcast: jest.fn(),
      processMessage: jest.fn(async (ctx: any) => {
        await ctx.reply('Resposta do Zavorth', {
          components: [
            {
              type: 1,
              components: [{ type: 2, style: 1, label: 'Status', custom_id: '/channels status discord' }],
            },
          ],
        });
      }),
    };
    const gateway = new DiscordBridgeGateway({
      broker: broker as any,
      enabled: true,
      secret,
      allowedGuildIds: ['guild-1'],
      inboxDir: temp.inboxDir,
      processedDir: temp.processedDir,
      rejectedDir: temp.rejectedDir,
      outboxDir: temp.outboxDir,
      stateFilePath: temp.stateFilePath,
      statusFilePath: temp.statusFilePath,
      secretFilePath: temp.secretFilePath,
    });
    const envelope: DiscordBridgeInboundEnvelope = {
      protocol: 'ZAVORTH_DISCORD_BRIDGE_V1' as const,
      eventId: 'discord-event-1',
      createdAt: timestamp,
      author: {
        id: 'user-1',
        username: 'operator',
      },
      channel: {
        id: 'channel-1',
        guildId: 'guild-1',
        type: 'guild_text',
      },
      message: {
        id: 'discord-msg-1',
        content: 'continue a tarefa',
      },
      signature: '',
    };
    envelope.signature = signDiscordBridgeEnvelope(secret, {
      ...envelope,
      signature: undefined as never,
    });

    fs.mkdirSync(temp.inboxDir, { recursive: true });
    fs.writeFileSync(path.join(temp.inboxDir, 'message.json'), JSON.stringify(envelope, null, 2), 'utf8');

    await gateway.processInboxOnce();

    expect(broker.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'discord',
        userId: 'user-1',
        chatId: 'discord:guild:guild-1:channel:channel-1',
        rawText: 'continue a tarefa',
      }),
    );
    expect(fs.readdirSync(temp.processedDir)).toHaveLength(1);
    expect(fs.readdirSync(temp.rejectedDir)).toHaveLength(0);
    const outboxFiles = fs.readdirSync(temp.outboxDir);
    expect(outboxFiles).toHaveLength(1);
    const outbox = JSON.parse(
      fs.readFileSync(path.join(temp.outboxDir, outboxFiles[0]), 'utf8'),
    ) as Record<string, any>;
    expect(outbox.kind).toBe('reply');
    expect(outbox.payload.text).toBe('Resposta do Zavorth');
    expect(outbox.payload.components?.[0]?.components?.[0]?.label).toBe('Status');

    fs.rmSync(temp.root, { recursive: true, force: true });
  });

  it('routes natural Discord bridge envelopes through ZavorthAgentGateway before broker fallback', async () => {
    const temp = createTempPaths();
    const secret = 'discord-bridge-secret';
    const broker = {
      registerGateway: jest.fn(),
      broadcast: jest.fn(),
      processMessage: jest.fn(async () => undefined),
    };
    const agentGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T16:05:00.000Z'),
      idFactory: (prefix) => `${prefix}-discord-bridge`,
      executor: ({ request }) => ({
        status: 'completed',
        summary: 'Discord bridge entrou pelo AgentGateway.',
        replyText: `agent:${request.channel}:${request.text}`,
      }),
    });
    const gateway = new DiscordBridgeGateway({
      broker: broker as any,
      agentGateway,
      enabled: true,
      secret,
      allowedGuildIds: ['guild-1'],
      inboxDir: temp.inboxDir,
      processedDir: temp.processedDir,
      rejectedDir: temp.rejectedDir,
      outboxDir: temp.outboxDir,
      stateFilePath: temp.stateFilePath,
      statusFilePath: temp.statusFilePath,
      secretFilePath: temp.secretFilePath,
    });

    const result = await gateway.ingestEnvelope(createSignedEnvelope(secret, {
      eventId: 'discord-event-agent',
      message: {
        id: 'discord-msg-agent',
        content: 'continue a tarefa',
      },
    }));

    expect(result).toEqual({ accepted: true, chatId: 'discord:guild:guild-1:channel:channel-1' });
    expect(broker.processMessage).not.toHaveBeenCalled();
    expect(agentGateway.buildSnapshot({ activeSessionId: 'discord:guild:guild-1:channel:channel-1' }).activeRun)
      .toEqual(expect.objectContaining({
        channel: 'discord',
        input: 'continue a tarefa',
        metadata: expect.objectContaining({
          legacyUnifiedGatewayBypassed: true,
          bridge: true,
        }),
      }));
    const outboxFiles = fs.readdirSync(temp.outboxDir);
    expect(outboxFiles).toHaveLength(1);
    const outbox = JSON.parse(fs.readFileSync(path.join(temp.outboxDir, outboxFiles[0]), 'utf8'));
    expect(outbox.payload.text).toBe('agent:discord:continue a tarefa');

    fs.rmSync(temp.root, { recursive: true, force: true });
  }, 30000);

  it('rejects unsigned or unauthorized relay envelopes', async () => {
    const temp = createTempPaths();
    const gateway = new DiscordBridgeGateway({
      broker: { processMessage: jest.fn() } as any,
      enabled: true,
      secret: 'secret',
      allowDirectMessages: false,
      allowedGuildIds: ['guild-ok'],
      inboxDir: temp.inboxDir,
      processedDir: temp.processedDir,
      rejectedDir: temp.rejectedDir,
      outboxDir: temp.outboxDir,
      stateFilePath: temp.stateFilePath,
      statusFilePath: temp.statusFilePath,
      secretFilePath: temp.secretFilePath,
    });
    const envelope: DiscordBridgeInboundEnvelope = {
      protocol: 'ZAVORTH_DISCORD_BRIDGE_V1' as const,
      eventId: 'discord-event-2',
      createdAt: new Date().toISOString(),
      author: {
        id: 'user-2',
      },
      channel: {
        id: 'channel-1',
        guildId: 'guild-bad',
        type: 'guild_text',
      },
      message: {
        id: 'discord-msg-2',
        content: 'ola',
      },
      signature: 'invalid-signature',
    };

    fs.mkdirSync(temp.inboxDir, { recursive: true });
    fs.writeFileSync(path.join(temp.inboxDir, 'message.json'), JSON.stringify(envelope, null, 2), 'utf8');

    await gateway.processInboxOnce();

    expect(fs.readdirSync(temp.rejectedDir)).toHaveLength(1);
    expect(fs.existsSync(path.join(temp.inboxDir, 'message.json'))).toBe(false);

    fs.rmSync(temp.root, { recursive: true, force: true });
  });

  it('writes role-aware broadcasts to the outbox when started', async () => {
    const temp = createTempPaths();
    const gateway = new DiscordBridgeGateway({
      enabled: true,
      secret: 'secret',
      allowDirectMessages: true,
      inboxDir: temp.inboxDir,
      processedDir: temp.processedDir,
      rejectedDir: temp.rejectedDir,
      outboxDir: temp.outboxDir,
      stateFilePath: temp.stateFilePath,
      statusFilePath: temp.statusFilePath,
      secretFilePath: temp.secretFilePath,
      pollIntervalMs: 999999,
    });

    await gateway.start();
    await gateway.broadcast('status ok', ['operator']);

    const outboxFiles = fs.readdirSync(temp.outboxDir);
    expect(outboxFiles).toHaveLength(1);
    const outbox = JSON.parse(
      fs.readFileSync(path.join(temp.outboxDir, outboxFiles[0]), 'utf8'),
    ) as Record<string, any>;
    expect(outbox.kind).toBe('broadcast');
    expect(outbox.target.roles).toEqual(['operator']);
    await gateway.stop();

    fs.rmSync(temp.root, { recursive: true, force: true });
  });

  it('rejects expired envelopes before they hit the broker', async () => {
    const temp = createTempPaths();
    const secret = 'discord-bridge-secret';
    const broker = { processMessage: jest.fn() };
    const gateway = new DiscordBridgeGateway({
      broker: broker as any,
      enabled: true,
      secret,
      allowedGuildIds: ['guild-1'],
      maxAgeMs: 60_000,
      inboxDir: temp.inboxDir,
      processedDir: temp.processedDir,
      rejectedDir: temp.rejectedDir,
      outboxDir: temp.outboxDir,
      stateFilePath: temp.stateFilePath,
      statusFilePath: temp.statusFilePath,
      secretFilePath: temp.secretFilePath,
    });
    const envelope = createSignedEnvelope(secret, {
      eventId: 'discord-event-expired',
      createdAt: '2026-03-01T00:00:00.000Z',
      message: {
        id: 'discord-msg-expired',
        content: 'ola',
      },
    });

    const result = await gateway.ingestEnvelope(envelope);

    expect(result).toEqual({
      accepted: false,
      reason: 'Discord bridge envelope expired or came from the future.',
    });
    expect(broker.processMessage).not.toHaveBeenCalled();
    fs.rmSync(temp.root, { recursive: true, force: true });
  });

  it('rejects direct messages when DMs are disabled and attachments in the first phase', async () => {
    const temp = createTempPaths();
    const secret = 'discord-bridge-secret';
    const gateway = new DiscordBridgeGateway({
      broker: { processMessage: jest.fn() } as any,
      enabled: true,
      secret,
      allowDirectMessages: false,
      allowedGuildIds: [],
      inboxDir: temp.inboxDir,
      processedDir: temp.processedDir,
      rejectedDir: temp.rejectedDir,
      outboxDir: temp.outboxDir,
      stateFilePath: temp.stateFilePath,
      statusFilePath: temp.statusFilePath,
      secretFilePath: temp.secretFilePath,
    });

    const directMessage = createSignedEnvelope(secret, {
      eventId: 'discord-event-dm',
      channel: {
        id: 'dm-channel-1',
        guildId: null,
        type: 'dm',
      },
      message: {
        id: 'discord-msg-dm',
        content: 'oi',
      },
    });
    const withAttachment = createSignedEnvelope(secret, {
      eventId: 'discord-event-attachment',
      message: {
        id: 'discord-msg-attachment',
        content: 'arquivo',
        attachments: [{ id: 'att-1' }],
      },
    });

    await expect(gateway.ingestEnvelope(directMessage)).resolves.toEqual({
      accepted: false,
      reason: 'Discord bridge direct messages are disabled.',
    });
    await expect(gateway.ingestEnvelope(withAttachment)).resolves.toEqual({
      accepted: false,
      reason: 'Discord bridge does not accept attachments in this initial release state.',
    });
    fs.rmSync(temp.root, { recursive: true, force: true });
  });

  it('persists replay protection across gateway restarts', async () => {
    const temp = createTempPaths();
    const secret = 'discord-bridge-secret';
    const broker = { processMessage: jest.fn(async () => undefined) };
    const gateway = new DiscordBridgeGateway({
      broker: broker as any,
      enabled: true,
      secret,
      allowedGuildIds: ['guild-1'],
      inboxDir: temp.inboxDir,
      processedDir: temp.processedDir,
      rejectedDir: temp.rejectedDir,
      outboxDir: temp.outboxDir,
      stateFilePath: temp.stateFilePath,
      statusFilePath: temp.statusFilePath,
      secretFilePath: temp.secretFilePath,
    });
    const envelope = createSignedEnvelope(secret, {
      eventId: 'discord-event-replay-1',
      message: {
        id: 'discord-msg-replay-1',
        content: 'retome',
      },
    });

    await expect(gateway.ingestEnvelope(envelope)).resolves.toEqual({
      accepted: true,
      chatId: 'discord:guild:guild-1:channel:channel-1',
    });

    const restartedGateway = new DiscordBridgeGateway({
      broker: broker as any,
      enabled: true,
      secret,
      allowedGuildIds: ['guild-1'],
      inboxDir: temp.inboxDir,
      processedDir: temp.processedDir,
      rejectedDir: temp.rejectedDir,
      outboxDir: temp.outboxDir,
      stateFilePath: temp.stateFilePath,
      statusFilePath: temp.statusFilePath,
      secretFilePath: temp.secretFilePath,
    });

    await expect(restartedGateway.ingestEnvelope(envelope)).resolves.toEqual({
      accepted: false,
      reason: 'Discord bridge rejected replay for message discord-msg-replay-1.',
    });
    expect(broker.processMessage).toHaveBeenCalledTimes(1);
    fs.rmSync(temp.root, { recursive: true, force: true });
  });

  it('moves the envelope to rejected when broker delegation fails', async () => {
    const temp = createTempPaths();
    const secret = 'discord-bridge-secret';
    const gateway = new DiscordBridgeGateway({
      broker: {
        processMessage: jest.fn(async () => {
          throw new Error('broker indisponivel');
        }),
      } as any,
      enabled: true,
      secret,
      allowedGuildIds: ['guild-1'],
      inboxDir: temp.inboxDir,
      processedDir: temp.processedDir,
      rejectedDir: temp.rejectedDir,
      outboxDir: temp.outboxDir,
      stateFilePath: temp.stateFilePath,
      statusFilePath: temp.statusFilePath,
      secretFilePath: temp.secretFilePath,
    });
    const envelope = createSignedEnvelope(secret, {
      eventId: 'discord-event-broker-fail',
      message: {
        id: 'discord-msg-broker-fail',
        content: 'falhe',
      },
    });

    fs.mkdirSync(temp.inboxDir, { recursive: true });
    fs.writeFileSync(path.join(temp.inboxDir, 'message.json'), JSON.stringify(envelope, null, 2), 'utf8');

    await gateway.processInboxOnce();

    expect(fs.readdirSync(temp.processedDir)).toHaveLength(0);
    expect(fs.readdirSync(temp.rejectedDir)).toHaveLength(1);
    const status = gateway.readStatus();
    expect(status?.lastError).toBe('broker indisponivel');
    fs.rmSync(temp.root, { recursive: true, force: true });
  });
});
