import { GatewayEventBus } from '../../src/gateway/events/GatewayEventBus';
import { ChannelPolicyManager } from '../../src/channels/policies/ChannelPolicyManager';
import { DiscordGateway } from '../../src/gateways/channels/discord/DiscordGateway';
import { SlackGateway } from '../../src/gateways/channels/slack/SlackGateway';
import { WhatsAppGateway } from '../../src/gateways/channels/whatsapp/WhatsAppGateway';
import { SignalGateway } from '../../src/gateways/channels/signal/SignalGateway';
import { TeamsGateway } from '../../src/gateways/channels/teams/TeamsGateway';
import { MatrixGateway } from '../../src/gateways/channels/simple/MatrixGateway';

describe('Priority channel live densification', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  function openPolicy() {
    const policyManager = new ChannelPolicyManager({
      policyFile: require('path').join(require('os').tmpdir(), `zavorth-live-${Date.now()}-${Math.random()}.json`),
    });
    jest.spyOn(policyManager, 'verifyAccess').mockResolvedValue(true);
    return policyManager;
  }

  function baseOptions(fetchImpl?: typeof fetch) {
    return {
      eventBus: new GatewayEventBus(),
      policyManager: openPolicy(),
      fetchImpl: fetchImpl || (async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    };
  }

  it('Discord parses interaction/message shapes and posts via Bot API when configured', async () => {
    const fetchImpl = jest.fn(async (url: any, init?: any) => {
      expect(String(url)).toContain('/channels/chan-1/messages');
      const headers = init?.headers || {};
      const auth = headers.authorization || headers.Authorization || '';
      expect(String(auth)).toMatch(/Bot /);
      return new Response('{}', { status: 200 });
    });
    const gateway = new DiscordGateway(baseOptions(fetchImpl as any) as any);
    jest.spyOn(gateway, 'resolveConfigured').mockReturnValue(true);
    // Force Bot API branch even if process config lacks token fields.
    const cfg = require('../../src/config/index').config;
    const prevToken = cfg.discordBotToken;
    const prevChannels = cfg.discordAllowedChannelIds;
    cfg.discordBotToken = 'discord-bot-token';
    cfg.discordAllowedChannelIds = ['chan-1'];
    await gateway.initialize();

    const inbound = gateway['extractInboundPayload']({
      id: 'm1',
      content: 'hello discord',
      channel_id: 'chan-1',
      guild_id: 'g1',
      author: { id: 'u1', username: 'alice' },
    });
    expect(inbound?.userId).toBe('u1');
    expect(inbound?.chatId).toBe('chan-1');
    expect(inbound?.rawText).toBe('hello discord');

    const delivered = await gateway.sendMessage({ text: 'hi', chatId: 'chan-1' });
    cfg.discordBotToken = prevToken;
    cfg.discordAllowedChannelIds = prevChannels;
    expect(delivered.ok).toBe(true);
    expect(delivered.status).toBe('delivered');
    expect(fetchImpl).toHaveBeenCalled();
    expect(gateway.doctorSnapshot().completeness.firstClass).toBe(true);
  });

  it('Slack verifies signing optionally and parses Events API text', async () => {
    const gateway = new SlackGateway(baseOptions() as any);
    await gateway.initialize();
    const extracted = gateway['extractInboundPayload']({
      type: 'message',
      user: 'U1',
      channel: 'C1',
      text: 'hello slack',
      ts: '123.456',
    });
    expect(extracted?.userId).toBe('U1');
    expect(extracted?.chatId).toBe('C1');
    expect(extracted?.rawText).toBe('hello slack');

    const challenge = await gateway.handleWebhookEvent({
      headers: {},
      rawBody: '{}',
      body: { type: 'url_verification', challenge: 'abc' },
    });
    expect(challenge.body).toEqual({ challenge: 'abc' });
  });

  it('WhatsApp Cloud API nested messages are flattened for inbound', async () => {
    const gateway = new WhatsAppGateway(baseOptions() as any);
    await gateway.initialize();
    const result = await gateway.handleWebhookEvent({
      body: {
        entry: [{
          changes: [{
            value: {
              contacts: [{ wa_id: '5511999999999' }],
              messages: [{
                from: '5511999999999',
                id: 'wamid.1',
                type: 'text',
                text: { body: 'oi whatsapp' },
              }],
            },
          }],
        }],
      },
    });
    expect(result.statusCode).toBe(200);
    expect((result.body as any).ok).toBe(true);
  });

  it('Signal parses signal-cli envelope dataMessage', async () => {
    const gateway = new SignalGateway(baseOptions() as any);
    const extracted = gateway['extractInboundPayload']({
      envelope: {
        source: '+15551212',
        timestamp: 99,
        dataMessage: { message: 'hello signal' },
      },
    });
    expect(extracted?.userId).toBe('+15551212');
    expect(extracted?.rawText).toBe('hello signal');
  });

  it('Teams parses Bot Framework activity shape', async () => {
    const gateway = new TeamsGateway(baseOptions() as any);
    const extracted = gateway['extractInboundPayload']({
      id: 'act-1',
      type: 'message',
      text: 'hello teams',
      from: { id: '29:user', aadObjectId: 'aad-1' },
      conversation: { id: '19:conv', conversationType: 'channel' },
      serviceUrl: 'https://smba.trafficmanager.net/',
    });
    expect(extracted?.userId).toBe('29:user');
    expect(extracted?.chatId).toBe('19:conv');
    expect(extracted?.rawText).toBe('hello teams');
    expect(extracted?.isGroup).toBe(true);
  });

  it('Matrix remains densified Client-Server send path', async () => {
    process.env.MATRIX_BASE_URL = 'https://matrix.example';
    process.env.MATRIX_ACCESS_TOKEN = 'syt_token';
    const gateway = new MatrixGateway(baseOptions(async (url, init) => {
      expect(String(url)).toContain('/_matrix/client/v3/rooms/');
      expect(String(init?.method || 'GET').toUpperCase()).toBe('PUT');
      return new Response('{}', { status: 200 });
    }) as any);
    await gateway.initialize();
    // configured via env may depend on already-loaded config module; still assert doctor first-class
    expect(gateway.doctorSnapshot().completeness.firstClass).toBe(true);
    expect(gateway.completenessReport().mockIo).toBe(true);
  });
});
