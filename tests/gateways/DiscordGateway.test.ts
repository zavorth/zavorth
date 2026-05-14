import fs from 'fs';
import os from 'os';
import path from 'path';
import { DiscordGateway } from '../../src/gateways/DiscordGateway';
import { ZavorthAgentGateway } from '../../src/runtime/agent';
import { DiscordSurfacePolicyService } from '../../src/services/DiscordSurfacePolicyService';

function createTempPaths() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-discord-native-'));
  return {
    root,
    stateFilePath: path.join(root, 'runtime', 'state.json'),
    statusFilePath: path.join(root, 'runtime', 'status.json'),
  };
}

function createFakeClient() {
  const listeners = new Map<string, Array<(...args: any[]) => void>>();
  const onceListeners = new Map<string, Array<(...args: any[]) => void>>();
  const send = jest.fn(async () => undefined);
  const setGlobalCommands = jest.fn(async () => undefined);
  const setGuildCommands = jest.fn(async () => undefined);
  const client = {
    user: { id: 'bot-1', tag: 'Zavorth#0001' },
    login: jest.fn(async () => {
      for (const handlers of Array.from(onceListeners.values())) {
        handlers.forEach((handler) => handler(client));
      }
      onceListeners.clear();
      return 'token';
    }),
    destroy: jest.fn(),
    on: jest.fn((event: string, listener: (...args: any[]) => void) => {
      listeners.set(event, [...(listeners.get(event) || []), listener]);
      return client;
    }),
    once: jest.fn((event: string, listener: (...args: any[]) => void) => {
      onceListeners.set(event, [...(onceListeners.get(event) || []), listener]);
      return client;
    }),
    isReady: jest.fn(() => true),
    application: {
      commands: {
        set: setGlobalCommands,
      },
    },
    guilds: {
      fetch: jest.fn(async () => ({
        commands: {
          set: setGuildCommands,
        },
      })),
    },
    channels: {
      fetch: jest.fn(async () => ({
        send,
      })),
    },
    __emit(event: string, ...args: any[]) {
      for (const listener of listeners.get(event) || []) {
        listener(...args);
      }
    },
    __send: send,
    __setGlobalCommands: setGlobalCommands,
    __setGuildCommands: setGuildCommands,
  };
  return client;
}

describe('DiscordGateway native client', () => {
  it('starts the native client, forwards allowlisted guild messages to the broker and replies back to Discord', async () => {
    const temp = createTempPaths();
    const fakeClient = createFakeClient();
    const broker = {
      processMessage: jest.fn(async (ctx: any) => {
        await ctx.reply('Resposta nativa', {
          components: [
            {
              type: 1,
              components: [{ type: 2, style: 1, label: 'Status', custom_id: '/channels status discord' }],
            },
          ],
        });
      }),
    };
    const reply = jest.fn(async () => undefined);
    const gateway = new DiscordGateway({
      broker: broker as any,
      token: 'discord-token',
      enabled: true,
      allowedGuildIds: ['guild-1'],
      allowDirectMessages: false,
      stateFilePath: temp.stateFilePath,
      statusFilePath: temp.statusFilePath,
      clientFactory: () => fakeClient as any,
      discordSurfacePolicyService: new DiscordSurfacePolicyService({ commandExposure: 'operator', publicServerMode: false }),
    });

    await gateway.start();
    expect(fakeClient.__setGuildCommands).toHaveBeenCalled();
    await gateway.simulateIncomingMessage({
      id: 'msg-1',
      author: { id: 'discord-user-1', bot: false },
      guildId: 'guild-1',
      channelId: 'channel-1',
      content: 'continue a tarefa',
      attachments: { size: 0 },
      reply,
      channel: {
        send: jest.fn(async () => undefined),
      },
    });

    expect(fakeClient.login).toHaveBeenCalledWith('discord-token');
    expect(broker.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'discord',
        userId: 'discord-user-1',
        chatId: 'discord:guild:guild-1:channel:channel-1',
        rawText: 'continue a tarefa',
        transport: 'text',
      }),
    );
    expect(reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Resposta nativa',
        components: expect.arrayContaining([
          expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({ label: 'Status' }),
            ]),
          }),
        ]),
      }),
    );
    expect(gateway.readStatus()).toEqual(
      expect.objectContaining({
        mode: 'native',
        enabled: true,
        started: true,
        processedCount: 1,
      }),
    );

    fs.rmSync(temp.root, { recursive: true, force: true });
  });

  it('routes natural Discord text through ZavorthAgentGateway before the broker fallback', async () => {
    const temp = createTempPaths();
    const broker = { processMessage: jest.fn(async () => undefined) };
    const agentGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T16:00:00.000Z'),
      idFactory: (prefix) => `${prefix}-discord-native`,
      executor: ({ request }) => ({
        status: 'completed',
        summary: 'Discord entrou pelo AgentGateway.',
        replyText: `agent:${request.channel}:${request.text}`,
      }),
    });
    const reply = jest.fn(async () => undefined);
    const gateway = new DiscordGateway({
      broker: broker as any,
      agentGateway,
      token: 'discord-token',
      enabled: true,
      allowedGuildIds: ['guild-1'],
      allowDirectMessages: false,
      stateFilePath: temp.stateFilePath,
      statusFilePath: temp.statusFilePath,
      clientFactory: () => createFakeClient() as any,
      discordSurfacePolicyService: new DiscordSurfacePolicyService({ commandExposure: 'operator', publicServerMode: false }),
    });

    await gateway.simulateIncomingMessage({
      id: 'msg-agent-1',
      author: { id: 'discord-user-1', bot: false },
      guildId: 'guild-1',
      channelId: 'channel-1',
      content: 'continue a tarefa',
      attachments: { size: 0 },
      reply,
    });

    expect(broker.processMessage).not.toHaveBeenCalled();
    expect(agentGateway.buildSnapshot({ activeSessionId: 'discord:guild:guild-1:channel:channel-1' }).activeRun)
      .toEqual(expect.objectContaining({
        channel: 'discord',
        input: 'continue a tarefa',
        metadata: expect.objectContaining({
          legacyUnifiedGatewayBypassed: true,
        }),
      }));
    expect(reply).toHaveBeenCalledWith(expect.objectContaining({
      content: 'agent:discord:continue a tarefa',
    }));

    fs.rmSync(temp.root, { recursive: true, force: true });
  });

  it('rejects direct messages when DMs are disabled but preserves attachment metadata when guild traffic is allowed', async () => {
    const temp = createTempPaths();
    const broker = { processMessage: jest.fn(async () => undefined) };
    const gateway = new DiscordGateway({
      broker: broker as any,
      token: 'discord-token',
      enabled: true,
      allowedGuildIds: [],
      allowDirectMessages: false,
      stateFilePath: temp.stateFilePath,
      statusFilePath: temp.statusFilePath,
      clientFactory: () => createFakeClient() as any,
      discordSurfacePolicyService: new DiscordSurfacePolicyService({ commandExposure: 'operator', publicServerMode: false }),
    });

    await gateway.simulateIncomingMessage({
      author: { id: 'discord-user-1', bot: false },
      guildId: null,
      channelId: 'dm-1',
      content: 'oi',
      attachments: { size: 0 },
    });
    await gateway.simulateIncomingMessage({
      author: { id: 'discord-user-1', bot: false },
      guildId: 'guild-1',
      channelId: 'channel-1',
      content: '',
      attachments: [
        {
          id: 'att-1',
          name: 'arquivo.txt',
          url: 'https://example.com/arquivo.txt',
          contentType: 'text/plain',
          size: 128,
        },
      ],
      channel: {
        send: jest.fn(async () => undefined),
      },
    });

    expect(broker.processMessage).toHaveBeenCalledTimes(1);
    expect(broker.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        rawText: expect.stringContaining('Anexos do Discord'),
        attachments: [
          expect.objectContaining({
            name: 'arquivo.txt',
            url: 'https://example.com/arquivo.txt',
          }),
        ],
      }),
    );
    expect(gateway.readStatus()).toEqual(
      expect.objectContaining({
        rejectedCount: 1,
      }),
    );

    fs.rmSync(temp.root, { recursive: true, force: true });
  });

  it('preserves thread context and handles slash commands through the broker', async () => {
    const temp = createTempPaths();
    const fakeClient = createFakeClient();
    const broker = {
      processMessage: jest.fn(async (ctx: any) => {
        await ctx.reply('Status enviado');
      }),
    };
    const interactionReply = jest.fn(async () => undefined);
    const interactionFollowUp = jest.fn(async () => undefined);
    const gateway = new DiscordGateway({
      broker: broker as any,
      token: 'discord-token',
      enabled: true,
      allowedGuildIds: ['guild-1'],
      allowDirectMessages: false,
      stateFilePath: temp.stateFilePath,
      statusFilePath: temp.statusFilePath,
      clientFactory: () => fakeClient as any,
      discordSurfacePolicyService: new DiscordSurfacePolicyService({ commandExposure: 'operator', publicServerMode: false }),
    });

    await gateway.start();
    await gateway.simulateIncomingMessage({
      author: { id: 'discord-user-1', bot: false },
      guildId: 'guild-1',
      channelId: 'thread-1',
      content: 'acompanhe isso',
      attachments: [],
      channel: {
        parentId: 'channel-1',
        type: 'PublicThread',
        send: jest.fn(async () => undefined),
      },
    });
    await gateway.simulateInteraction({
      isChatInputCommand: () => true,
      commandName: 'commands',
      user: { id: 'discord-user-1', bot: false },
      guildId: 'guild-1',
      channelId: 'thread-1',
      channel: {
        parentId: 'channel-1',
        type: 'PublicThread',
        send: jest.fn(async () => undefined),
      },
      options: {
        getString: jest.fn((name: string) => (name === 'input' ? 'channel' : null)),
        getBoolean: jest.fn(() => null),
        getAttachment: jest.fn(() => null),
      },
      reply: interactionReply,
      followUp: interactionFollowUp,
      editReply: jest.fn(async () => undefined),
      replied: false,
      deferred: false,
    });

    expect(broker.processMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        transport: 'slash_command',
        rawText: '/commands channel',
        chatId: 'discord:guild:guild-1:channel:channel-1:thread:thread-1',
        nativeCommand: expect.objectContaining({
          name: 'commands',
        }),
      }),
    );
    expect(interactionReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Status enviado',
      }),
    );

    fs.rmSync(temp.root, { recursive: true, force: true });
  });

  it('routes safe Discord component callbacks through the shared broker path', async () => {
    const temp = createTempPaths();
    const fakeClient = createFakeClient();
    const broker = {
      processMessage: jest.fn(async (ctx: any) => {
        await ctx.reply('Catalogo recebido');
      }),
    };
    const interactionReply = jest.fn(async () => undefined);
    const gateway = new DiscordGateway({
      broker: broker as any,
      token: 'discord-token',
      enabled: true,
      allowedGuildIds: ['guild-1'],
      allowDirectMessages: false,
      stateFilePath: temp.stateFilePath,
      statusFilePath: temp.statusFilePath,
      clientFactory: () => fakeClient as any,
      discordSurfacePolicyService: new DiscordSurfacePolicyService({ commandExposure: 'operator', publicServerMode: false }),
    });

    await gateway.start();
    await gateway.simulateInteraction({
      isChatInputCommand: () => false,
      isButton: () => true,
      customId: '/commands channel',
      message: { id: 'message-1' },
      user: { id: 'discord-user-1', bot: false },
      guildId: 'guild-1',
      channelId: 'channel-1',
      channel: {
        send: jest.fn(async () => undefined),
      },
      reply: interactionReply,
      followUp: jest.fn(async () => undefined),
      editReply: jest.fn(async () => undefined),
      replied: false,
      deferred: false,
    });

    expect(broker.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        transport: 'interaction',
        rawText: '/commands channel',
        messageId: 'message-1',
        nativeCommand: expect.objectContaining({
          name: 'component',
          args: '/commands channel',
        }),
      }),
    );
    expect(interactionReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Catalogo recebido',
      }),
    );

    fs.rmSync(temp.root, { recursive: true, force: true });
  });

  it('rejects forged Discord component callbacks that would mutate channel state', async () => {
    const temp = createTempPaths();
    const fakeClient = createFakeClient();
    const broker = {
      processMessage: jest.fn(async () => undefined),
    };
    const interactionReply = jest.fn(async () => undefined);
    const gateway = new DiscordGateway({
      broker: broker as any,
      token: 'discord-token',
      enabled: true,
      allowedGuildIds: ['guild-1'],
      allowDirectMessages: false,
      stateFilePath: temp.stateFilePath,
      statusFilePath: temp.statusFilePath,
      clientFactory: () => fakeClient as any,
      discordSurfacePolicyService: new DiscordSurfacePolicyService({ commandExposure: 'operator', publicServerMode: false }),
    });

    await gateway.start();
    await gateway.simulateInteraction({
      isChatInputCommand: () => false,
      isButton: () => true,
      customId: '/channels logout whatsapp',
      user: { id: 'discord-user-1', bot: false },
      guildId: 'guild-1',
      channelId: 'channel-1',
      channel: {
        send: jest.fn(async () => undefined),
      },
      reply: interactionReply,
      followUp: jest.fn(async () => undefined),
      editReply: jest.fn(async () => undefined),
      replied: false,
      deferred: false,
    });

    expect(broker.processMessage).not.toHaveBeenCalled();
    expect(interactionReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('exige comando explicito'),
      }),
    );
    expect(gateway.readStatus()).toEqual(
      expect.objectContaining({
        rejectedCount: 1,
      }),
    );

    fs.rmSync(temp.root, { recursive: true, force: true });
  });

  it('translates the operator workflow slash command into the canonical workflow text payload', async () => {
    const temp = createTempPaths();
    const fakeClient = createFakeClient();
    const broker = {
      processMessage: jest.fn(async (ctx: any) => {
        await ctx.reply('Workflow SDD recebido');
      }),
    };
    const interactionReply = jest.fn(async () => undefined);
    const gateway = new DiscordGateway({
      broker: broker as any,
      token: 'discord-token',
      enabled: true,
      allowedGuildIds: ['guild-1'],
      allowDirectMessages: false,
      stateFilePath: temp.stateFilePath,
      statusFilePath: temp.statusFilePath,
      clientFactory: () => fakeClient as any,
      discordSurfacePolicyService: new DiscordSurfacePolicyService({ commandExposure: 'operator', publicServerMode: false }),
    });

    await gateway.start();
    await gateway.simulateInteraction({
      isChatInputCommand: () => true,
      commandName: 'workflow',
      user: { id: 'discord-owner-1', bot: false },
      guildId: 'guild-1',
      channelId: 'channel-1',
      channel: {
        send: jest.fn(async () => undefined),
      },
      options: {
        getString: jest.fn((name: string) => {
          if (name === 'mode') {
            return 'sdd';
          }
          if (name === 'input') {
            return 'multisurface/shared-command-contract';
          }
          return null;
        }),
        getBoolean: jest.fn(() => null),
        getAttachment: jest.fn(() => null),
      },
      reply: interactionReply,
      followUp: jest.fn(async () => undefined),
      editReply: jest.fn(async () => undefined),
      replied: false,
      deferred: false,
    });

    expect(broker.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        transport: 'slash_command',
        rawText: '/workflow sdd multisurface/shared-command-contract',
        nativeCommand: expect.objectContaining({
          name: 'workflow',
          options: expect.objectContaining({
            mode: 'sdd',
          }),
        }),
      }),
    );
    expect(interactionReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Workflow SDD recebido',
      }),
    );

    fs.rmSync(temp.root, { recursive: true, force: true });
  });

  it('broadcasts to recently active Discord channels after receiving traffic', async () => {
    const temp = createTempPaths();
    const fakeClient = createFakeClient();
    const gateway = new DiscordGateway({
      broker: { processMessage: jest.fn(async () => undefined) } as any,
      token: 'discord-token',
      enabled: true,
      allowedGuildIds: ['guild-1'],
      allowDirectMessages: true,
      stateFilePath: temp.stateFilePath,
      statusFilePath: temp.statusFilePath,
      clientFactory: () => fakeClient as any,
      discordSurfacePolicyService: new DiscordSurfacePolicyService({ commandExposure: 'operator', publicServerMode: false }),
    });

    await gateway.start();
    await gateway.simulateIncomingMessage({
      author: { id: 'discord-user-1', bot: false },
      guildId: 'guild-1',
      channelId: 'channel-9',
      content: 'status',
      attachments: { size: 0 },
      channel: {
        send: jest.fn(async () => undefined),
      },
    });
    await gateway.broadcast('status ok');

    expect(fakeClient.channels.fetch).toHaveBeenCalledWith('channel-9');
    expect(fakeClient.__send).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'status ok',
      }),
    );

    fs.rmSync(temp.root, { recursive: true, force: true });
  });

  it('keeps public-server broadcasts away from guild channels and only targets recent owner DMs', async () => {
    const temp = createTempPaths();
    const fakeClient = createFakeClient();
    const gateway = new DiscordGateway({
      broker: { processMessage: jest.fn(async () => undefined) } as any,
      token: 'discord-token',
      enabled: true,
      allowedGuildIds: ['guild-1'],
      allowDirectMessages: true,
      stateFilePath: temp.stateFilePath,
      statusFilePath: temp.statusFilePath,
      clientFactory: () => fakeClient as any,
      discordSurfacePolicyService: new DiscordSurfacePolicyService({
        publicServerMode: true,
        allowedChannelIds: ['channel-9'],
        ownerUserIds: ['discord-owner'],
        commandExposure: 'minimal',
      }),
    });

    await gateway.start();
    await gateway.simulateIncomingMessage({
      author: { id: 'discord-user-1', bot: false },
      guildId: 'guild-1',
      channelId: 'channel-9',
      content: 'task publica',
      attachments: { size: 0 },
      channel: {
        send: jest.fn(async () => undefined),
      },
    });
    await gateway.simulateIncomingMessage({
      author: { id: 'discord-owner', bot: false },
      guildId: null,
      channelId: 'dm-owner',
      content: 'status em dm',
      attachments: { size: 0 },
      channel: {
        send: jest.fn(async () => undefined),
      },
    });

    await gateway.broadcast('status reservado');

    expect(fakeClient.channels.fetch).toHaveBeenCalledTimes(1);
    expect(fakeClient.channels.fetch).toHaveBeenCalledWith('dm-owner');
    expect(fakeClient.__send).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'status reservado',
      }),
    );

    fs.rmSync(temp.root, { recursive: true, force: true });
  });

  it('keeps operational broadcasts restricted to admin/operator roles when role filters are provided', async () => {
    const temp = createTempPaths();
    const fakeClient = createFakeClient();
    const gateway = new DiscordGateway({
      broker: { processMessage: jest.fn(async () => undefined) } as any,
      token: 'discord-token',
      enabled: true,
      allowedGuildIds: ['guild-1'],
      allowDirectMessages: true,
      stateFilePath: temp.stateFilePath,
      statusFilePath: temp.statusFilePath,
      clientFactory: () => fakeClient as any,
      discordSurfacePolicyService: new DiscordSurfacePolicyService({ commandExposure: 'operator', publicServerMode: false }),
    });

    await gateway.start();
    await gateway.simulateIncomingMessage({
      author: { id: 'discord-user-1', bot: false },
      guildId: 'guild-1',
      channelId: 'channel-9',
      content: 'status',
      attachments: { size: 0 },
      channel: {
        send: jest.fn(async () => undefined),
      },
    });
    await gateway.broadcast('status viewer', ['viewer']);

    expect(fakeClient.channels.fetch).not.toHaveBeenCalled();

    fs.rmSync(temp.root, { recursive: true, force: true });
  });

  it('does not fall back to global slash registration when a guild allowlist is configured and the lookup fails', async () => {
    const temp = createTempPaths();
    const fakeClient = createFakeClient();
    fakeClient.guilds.fetch.mockRejectedValueOnce(new Error('Unknown Guild'));
    const gateway = new DiscordGateway({
      broker: { processMessage: jest.fn(async () => undefined) } as any,
      token: 'discord-token',
      enabled: true,
      allowedGuildIds: ['guild-1'],
      allowDirectMessages: false,
      stateFilePath: temp.stateFilePath,
      statusFilePath: temp.statusFilePath,
      clientFactory: () => fakeClient as any,
      discordSurfacePolicyService: new DiscordSurfacePolicyService({ commandExposure: 'operator', publicServerMode: false }),
    });

    await gateway.start();

    expect(fakeClient.__setGlobalCommands).not.toHaveBeenCalled();
    expect(gateway.readStatus()).toEqual(
      expect.objectContaining({
        started: true,
        enabled: true,
      }),
    );

    fs.rmSync(temp.root, { recursive: true, force: true });
  });

  it('registers global slash commands only when the runtime is not pinned to allowlisted guilds', async () => {
    const temp = createTempPaths();
    const fakeClient = createFakeClient();
    const gateway = new DiscordGateway({
      broker: { processMessage: jest.fn(async () => undefined) } as any,
      token: 'discord-token',
      enabled: true,
      allowedGuildIds: [],
      allowDirectMessages: true,
      stateFilePath: temp.stateFilePath,
      statusFilePath: temp.statusFilePath,
      clientFactory: () => fakeClient as any,
      discordSurfacePolicyService: new DiscordSurfacePolicyService({ commandExposure: 'minimal', publicServerMode: false }),
    });

    await gateway.start();

    expect(fakeClient.__setGlobalCommands).toHaveBeenCalled();
    fs.rmSync(temp.root, { recursive: true, force: true });
  });

  it('does not register slash commands when Discord exposure is none', async () => {
    const temp = createTempPaths();
    const fakeClient = createFakeClient();
    const gateway = new DiscordGateway({
      broker: { processMessage: jest.fn(async () => undefined) } as any,
      token: 'discord-token',
      enabled: true,
      allowedGuildIds: ['guild-1'],
      allowDirectMessages: false,
      stateFilePath: temp.stateFilePath,
      statusFilePath: temp.statusFilePath,
      clientFactory: () => fakeClient as any,
      discordSurfacePolicyService: new DiscordSurfacePolicyService({ commandExposure: 'none', publicServerMode: false }),
    });

    await gateway.start();

    expect(fakeClient.__setGuildCommands).not.toHaveBeenCalled();
    expect(fakeClient.__setGlobalCommands).not.toHaveBeenCalled();
    expect(gateway.readStatus()).toEqual(
      expect.objectContaining({
        commandExposure: 'none',
        started: true,
      }),
    );

    fs.rmSync(temp.root, { recursive: true, force: true });
  });

  it('rejects non-allowlisted guild channels but accepts threads under an allowlisted parent channel', async () => {
    const temp = createTempPaths();
    const broker = { processMessage: jest.fn(async () => undefined) };
    const gateway = new DiscordGateway({
      broker: broker as any,
      token: 'discord-token',
      enabled: true,
      allowedGuildIds: ['guild-1'],
      allowDirectMessages: false,
      stateFilePath: temp.stateFilePath,
      statusFilePath: temp.statusFilePath,
      clientFactory: () => createFakeClient() as any,
      discordSurfacePolicyService: new DiscordSurfacePolicyService({
        commandExposure: 'minimal',
        allowedChannelIds: ['channel-allowed'],
      }),
    });

    await gateway.simulateIncomingMessage({
      author: { id: 'discord-user-1', bot: false },
      guildId: 'guild-1',
      channelId: 'channel-blocked',
      content: 'oi',
      attachments: { size: 0 },
      channel: {
        send: jest.fn(async () => undefined),
      },
    });
    await gateway.simulateIncomingMessage({
      author: { id: 'discord-user-1', bot: false },
      guildId: 'guild-1',
      channelId: 'thread-1',
      content: 'acompanhe este fluxo',
      attachments: [],
      channel: {
        parentId: 'channel-allowed',
        type: 'PublicThread',
        send: jest.fn(async () => undefined),
      },
    });

    expect(broker.processMessage).toHaveBeenCalledTimes(1);
    expect(broker.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 'discord:guild:guild-1:channel:channel-allowed:thread:thread-1',
      }),
    );
    expect(gateway.readStatus()).toEqual(
      expect.objectContaining({
        rejectedCount: 1,
        processedCount: 1,
        allowedChannelIds: ['channel-allowed'],
      }),
    );

    fs.rmSync(temp.root, { recursive: true, force: true });
  });

  it('captures broker failures from Discord runtime events without leaking rejections', async () => {
    const temp = createTempPaths();
    const fakeClient = createFakeClient();
    const gateway = new DiscordGateway({
      broker: {
        processMessage: jest.fn(async () => {
          throw new Error('broker offline');
        }),
      } as any,
      token: 'discord-token',
      enabled: true,
      allowedGuildIds: ['guild-1'],
      allowDirectMessages: false,
      stateFilePath: temp.stateFilePath,
      statusFilePath: temp.statusFilePath,
      clientFactory: () => fakeClient as any,
      discordSurfacePolicyService: new DiscordSurfacePolicyService({ commandExposure: 'operator', publicServerMode: false }),
    });

    await gateway.start();
    fakeClient.__emit('messageCreate', {
      author: { id: 'discord-user-1', bot: false },
      guildId: 'guild-1',
      channelId: 'channel-1',
      content: 'status',
      attachments: { size: 0 },
      channel: {
        send: jest.fn(async () => undefined),
      },
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(gateway.readStatus()).toEqual(
      expect.objectContaining({
        mode: 'native',
        started: true,
        lastError: 'broker offline',
      }),
    );

    fs.rmSync(temp.root, { recursive: true, force: true });
  });

  it('rejects public-server attachments for non-owners before they reach the broker', async () => {
    const temp = createTempPaths();
    const broker = { processMessage: jest.fn(async () => undefined) };
    const gateway = new DiscordGateway({
      broker: broker as any,
      token: 'discord-token',
      enabled: true,
      allowedGuildIds: ['guild-1'],
      allowDirectMessages: true,
      stateFilePath: temp.stateFilePath,
      statusFilePath: temp.statusFilePath,
      clientFactory: () => createFakeClient() as any,
      discordSurfacePolicyService: new DiscordSurfacePolicyService({
        publicServerMode: true,
        allowedChannelIds: ['channel-1'],
        ownerUserIds: ['discord-owner'],
        allowAttachmentsInPublicServerMode: false,
        commandExposure: 'minimal',
      }),
    });

    await gateway.simulateIncomingMessage({
      author: { id: 'discord-user-1', bot: false },
      guildId: 'guild-1',
      channelId: 'channel-1',
      content: 'veja o anexo',
      attachments: [
        {
          id: 'att-1',
          name: 'arquivo.txt',
          url: 'https://example.com/arquivo.txt',
          contentType: 'text/plain',
          size: 128,
        },
      ],
      channel: {
        send: jest.fn(async () => undefined),
      },
    });

    expect(broker.processMessage).not.toHaveBeenCalled();
    expect(gateway.readStatus()).toEqual(
      expect.objectContaining({
        rejectedCount: 1,
        lastError: 'Anexos estao bloqueados por padrao no Discord publico deste runtime.',
      }),
    );

    fs.rmSync(temp.root, { recursive: true, force: true });
  });
});
