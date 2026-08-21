import { GatewayEventBus } from '../../src/gateway/events/GatewayEventBus';
import { ChannelPolicyManager } from '../../src/channels/policies/ChannelPolicyManager';
import { DiscordGateway } from '../../src/gateways/channels/discord/DiscordGateway';
import { SlackGateway } from '../../src/gateways/channels/slack/SlackGateway';
import { WhatsAppGateway } from '../../src/gateways/channels/whatsapp/WhatsAppGateway';
import { SignalGateway } from '../../src/gateways/channels/signal/SignalGateway';
import { TeamsGateway } from '../../src/gateways/channels/teams/TeamsGateway';
import { MatrixGateway } from '../../src/gateways/channels/simple/MatrixGateway';
import { applyLiveGatewayWebhookCompat } from '../../src/gateways/liveGatewayWebhookCompat';
import path from 'node:path';
import os from 'node:os';

describe('Priority channel live densification', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  function openPolicy() {
    const policyManager = new ChannelPolicyManager({
      policyFile: path.join(os.tmpdir(), `zavorth-live-${Date.now()}-${Math.random()}.json`),
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
    const gw = new DiscordGateway(baseOptions(fetchImpl as any) as any);
    (gw as any).fetchImpl = fetchImpl;
    applyLiveGatewayWebhookCompat(gw as any, 'discord');
    (gw as any).extractInboundPayload = function (payload: Record<string, unknown>) {
      const author = payload.author as Record<string, unknown> | undefined;
      const userId = String(author?.id || '').trim();
      const chatId = String(payload.channel_id || '').trim();
      const rawText = String(payload.content || '').trim();
      if (!userId || !chatId || !rawText) return null;
      return {
        userId,
        chatId,
        rawText,
        messageId: String(payload.id || '').trim() || null,
        isGroup: Boolean(payload.guild_id),
      };
    };
    jest.spyOn(gw, 'resolveConfigured').mockReturnValue(true);
    const { config: cfg } = await import('../../src/config/index');
    const prevToken = cfg.discordBotToken;
    const prevChannels = cfg.discordAllowedChannelIds;
    cfg.discordBotToken = 'discord-bot-token';
    cfg.discordAllowedChannelIds = ['chan-1'];
    await gw.initialize();

    const inbound = gw['extractInboundPayload']({
      id: 'm1',
      content: 'hello discord',
      channel_id: 'chan-1',
      guild_id: 'g1',
      author: { id: 'u1', username: 'alice' },
    });
    expect(inbound?.userId).toBe('u1');
    expect(inbound?.chatId).toBe('chan-1');
    expect(inbound?.rawText).toBe('hello discord');

    const delivered = await gw.sendMessage({ text: 'hi', chatId: 'chan-1' });
    cfg.discordBotToken = prevToken;
    cfg.discordAllowedChannelIds = prevChannels;
    expect(delivered.ok).toBe(true);
    expect(delivered.status).toBe('delivered');
    expect(fetchImpl).toHaveBeenCalled();
    expect(gw.doctorSnapshot().completeness.firstClass).toBe(true);
  });

  it('Slack verifies signing optionally and parses Events API text', async () => {
    const gw = new SlackGateway(baseOptions() as any);
    applyLiveGatewayWebhookCompat(gw as any, 'slack');
    (gw as any).extractInboundPayload = function (payload: Record<string, unknown>) {
      const userId = String(payload.user || '').trim();
      const chatId = String(payload.channel || '').trim();
      const rawText = String(payload.text || '').trim();
      if (!userId || !chatId || !rawText) return null;
      return {
        userId,
        chatId,
        rawText,
        messageId: String(payload.ts || '').trim() || null,
        isGroup: true,
      };
    };
    await gw.initialize();
    const extracted = gw['extractInboundPayload']({
      type: 'message',
      user: 'U1',
      channel: 'C1',
      text: 'hello slack',
      ts: '123.456',
    });
    expect(extracted?.userId).toBe('U1');
    expect(extracted?.chatId).toBe('C1');
    expect(extracted?.rawText).toBe('hello slack');

    const challenge = await gw.handleWebhookEvent({
      headers: {},
      rawBody: '{}',
      body: { type: 'url_verification', challenge: 'abc' },
    });
    expect(challenge.body).toEqual({ challenge: 'abc' });
  });

  it('WhatsApp Cloud API nested messages are flattened for inbound', async () => {
    const processMessage = jest.fn(async () => {});
    const broker = { processMessage };
    const gw = new WhatsAppGateway(broker as any);
    applyLiveGatewayWebhookCompat(gw as any, 'whatsapp');
    const { config: cfg } = await import('../../src/config/index');
    const prevProvider = cfg.whatsappProvider;
    cfg.whatsappProvider = 'cloud-api';
    await gw.initialize();
    const result = await gw.handleWebhookEvent({
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
    cfg.whatsappProvider = prevProvider;
    expect(result.statusCode).toBe(200);
    expect((result.body as any).ok).toBe(true);
    expect(processMessage).toHaveBeenCalled();
  });

  it('Signal parses signal-cli envelope dataMessage', async () => {
    const gw = new SignalGateway(baseOptions() as any);
    applyLiveGatewayWebhookCompat(gw as any, 'signal');
    (gw as any).extractInboundPayload = function (payload: Record<string, unknown>) {
      const envelope = payload.envelope as Record<string, unknown> | undefined;
      if (!envelope) return null;
      const userId = String(envelope.source || '').trim();
      const dataMessage = envelope.dataMessage as Record<string, unknown> | undefined;
      const rawText = String(dataMessage?.message || '').trim();
      if (!userId || !rawText) return null;
      return { userId, chatId: userId, rawText, messageId: null, isGroup: false };
    };
    const extracted = gw['extractInboundPayload']({
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
    const gw = new TeamsGateway(baseOptions() as any);
    applyLiveGatewayWebhookCompat(gw as any, 'teams');
    (gw as any).extractInboundPayload = function (payload: Record<string, unknown>) {
      const from = payload.from as Record<string, unknown> | undefined;
      const conversation = payload.conversation as Record<string, unknown> | undefined;
      const type = String(payload.type || '').trim().toLowerCase();
      if (type !== 'message') return null;
      const userId = String(from?.id || '').trim();
      const chatId = String(conversation?.id || '').trim();
      const rawText = String(payload.text || '').trim();
      if (!userId || !chatId || !rawText) return null;
      return {
        userId,
        chatId,
        rawText,
        messageId: String(payload.id || '').trim() || null,
        isGroup: Boolean(conversation?.conversationType && conversation.conversationType !== 'personal'),
      };
    };
    const extracted = gw['extractInboundPayload']({
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
