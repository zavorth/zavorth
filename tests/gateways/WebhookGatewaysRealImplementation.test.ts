import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ChannelGatewayFactory } from '../../src/gateways/ChannelGatewayFactory.js';
import { config } from '../../src/config/index.js';

describe('WebhookGatewaysRealImplementation', () => {
  let tmpDirs: string[] = [];

  const createTestGateway = (channelId: string, fetchMock: any) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `zavorth-test-${channelId}-`));
    tmpDirs.push(root);

    return ChannelGatewayFactory.createFromId(channelId, {
      eventBus: { emit: jest.fn() } as any,
      policyManager: { verifyAccess: jest.fn(async () => true) } as any,
      outboxDir: path.join(root, 'outbox'),
      statusFile: path.join(root, 'status.json'),
      fetchImpl: fetchMock,
    });
  };

  afterEach(() => {
    for (const dir of tmpDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Ignore removal errors
      }
    }
    tmpDirs = [];
  });

  const testCases = [
    {
      channelId: 'matrix',
      configSetup: () => {
        config.matrixBaseUrl = 'http://matrix-test';
        config.matrixAccessToken = 'token-123';
      },
      configTeardown: () => {
        config.matrixBaseUrl = '';
        config.matrixAccessToken = '';
      },
      webhookPayload: {
        sender: '@alice:matrix.org',
        room_id: '!room:matrix.org',
        content: { body: 'hello matrix' },
      },
      expectedInbound: {
        userId: '@alice:matrix.org',
        chatId: '!room:matrix.org',
        rawText: 'hello matrix',
      },
      sendPayload: {
        to: '!room:matrix.org',
        text: 'hello back matrix',
      },
      expectedFetch: {
        url: 'http://matrix-test/_matrix/client/v3/rooms/!room%3Amatrix.org/send/m.room.message/',
        method: 'PUT',
        bodyContains: 'hello back matrix',
      },
    },
    {
      channelId: 'line',
      configSetup: () => {
        config.lineChannelAccessToken = 'line-token';
      },
      configTeardown: () => {
        config.lineChannelAccessToken = '';
      },
      webhookPayload: {
        events: [
          {
            type: 'message',
            message: {
              type: 'text',
              text: 'hello line',
              id: 'msg-line',
            },
            source: {
              type: 'group',
              userId: 'user-line',
              groupId: 'chat-line',
            },
          },
        ],
      },
      expectedInbound: {
        userId: 'user-line',
        chatId: 'chat-line',
        rawText: 'hello line',
      },
      sendPayload: {
        to: 'chat-line',
        text: 'hello back line',
      },
      expectedFetch: {
        url: 'https://api.line.me/v2/bot/message/push',
        method: 'POST',
        bodyContains: 'hello back line',
      },
    },
    {
      channelId: 'google-chat',
      configSetup: () => {
        config.googleChatWebhookUrl = 'http://gchat-webhook';
      },
      configTeardown: () => {
        config.googleChatWebhookUrl = '';
      },
      webhookPayload: {
        message: {
          sender: {
            name: 'user-gchat',
          },
          space: {
            name: 'chat-gchat',
          },
          text: 'hello gchat',
        },
      },
      expectedInbound: {
        userId: 'user-gchat',
        chatId: 'chat-gchat',
        rawText: 'hello gchat',
      },
      sendPayload: {
        text: 'hello back gchat',
      },
      expectedFetch: {
        url: 'http://gchat-webhook',
        method: 'POST',
        bodyContains: 'hello back gchat',
      },
    },
    {
      channelId: 'feishu',
      configSetup: () => {
        config.feishuWebhookUrl = 'http://feishu-webhook';
      },
      configTeardown: () => {
        config.feishuWebhookUrl = '';
      },
      webhookPayload: {
        userId: 'user-feishu',
        chatId: 'chat-feishu',
        text: 'hello feishu',
      },
      expectedInbound: {
        userId: 'user-feishu',
        chatId: 'chat-feishu',
        rawText: 'hello feishu',
      },
      sendPayload: {
        text: 'hello back feishu',
      },
      expectedFetch: {
        url: 'http://feishu-webhook',
        method: 'POST',
        bodyContains: 'hello back feishu',
      },
    },
    {
      channelId: 'irc',
      configSetup: () => {
        config.ircBridgeUrl = 'http://irc-bridge';
      },
      configTeardown: () => {
        config.ircBridgeUrl = '';
      },
      webhookPayload: {
        userId: 'user-irc',
        chatId: 'chat-irc',
        text: 'hello irc',
      },
      expectedInbound: {
        userId: 'user-irc',
        chatId: 'chat-irc',
        rawText: 'hello irc',
      },
      sendPayload: {
        to: 'channel-irc',
        text: 'hello back irc',
      },
      expectedFetch: {
        url: 'http://irc-bridge/send',
        method: 'POST',
        bodyContains: 'hello back irc',
      },
    },
    {
      channelId: 'qq',
      configSetup: () => {
        config.qqSendUrl = 'http://qq-send';
      },
      configTeardown: () => {
        config.qqSendUrl = '';
      },
      webhookPayload: {
        userId: 'user-qq',
        chatId: 'chat-qq',
        text: 'hello qq',
      },
      expectedInbound: {
        userId: 'user-qq',
        chatId: 'chat-qq',
        rawText: 'hello qq',
      },
      sendPayload: {
        to: 'chat-qq',
        text: 'hello back qq',
      },
      expectedFetch: {
        url: 'http://qq-send',
        method: 'POST',
        bodyContains: 'hello back qq',
      },
    },
    {
      channelId: 'zalo',
      configSetup: () => {
        config.zaloSendUrl = 'http://zalo-send';
        config.zaloAccessToken = 'zalo-token';
      },
      configTeardown: () => {
        config.zaloSendUrl = '';
        config.zaloAccessToken = '';
      },
      webhookPayload: {
        userId: 'user-zalo',
        chatId: 'chat-zalo',
        text: 'hello zalo',
      },
      expectedInbound: {
        userId: 'user-zalo',
        chatId: 'chat-zalo',
        rawText: 'hello zalo',
      },
      sendPayload: {
        to: 'chat-zalo',
        text: 'hello back zalo',
      },
      expectedFetch: {
        url: 'http://zalo-send',
        method: 'POST',
        bodyContains: 'hello back zalo',
      },
    },
    {
      channelId: 'wecom',
      configSetup: () => {
        config.wecomWebhookUrl = 'http://wecom-webhook';
      },
      configTeardown: () => {
        config.wecomWebhookUrl = '';
      },
      webhookPayload: {
        userId: 'user-wecom',
        chatId: 'chat-wecom',
        text: 'hello wecom',
      },
      expectedInbound: {
        userId: 'user-wecom',
        chatId: 'chat-wecom',
        rawText: 'hello wecom',
      },
      sendPayload: {
        text: 'hello back wecom',
      },
      expectedFetch: {
        url: 'http://wecom-webhook',
        method: 'POST',
        bodyContains: 'hello back wecom',
      },
    },
    {
      channelId: 'weixin',
      configSetup: () => {
        config.weixinBridgeUrl = 'http://weixin-bridge';
      },
      configTeardown: () => {
        config.weixinBridgeUrl = '';
      },
      webhookPayload: {
        userId: 'user-weixin',
        chatId: 'chat-weixin',
        text: 'hello weixin',
      },
      expectedInbound: {
        userId: 'user-weixin',
        chatId: 'chat-weixin',
        rawText: 'hello weixin',
      },
      sendPayload: {
        to: 'chat-weixin',
        text: 'hello back weixin',
      },
      expectedFetch: {
        url: 'http://weixin-bridge/send',
        method: 'POST',
        bodyContains: 'hello back weixin',
      },
    },
    {
      channelId: 'yuanbao',
      configSetup: () => {
        config.yuanbaoBridgeUrl = 'http://yuanbao-bridge';
      },
      configTeardown: () => {
        config.yuanbaoBridgeUrl = '';
      },
      webhookPayload: {
        userId: 'user-yuanbao',
        chatId: 'chat-yuanbao',
        text: 'hello yuanbao',
      },
      expectedInbound: {
        userId: 'user-yuanbao',
        chatId: 'chat-yuanbao',
        rawText: 'hello yuanbao',
      },
      sendPayload: {
        to: 'chat-yuanbao',
        text: 'hello back yuanbao',
      },
      expectedFetch: {
        url: 'http://yuanbao-bridge/send',
        method: 'POST',
        bodyContains: 'hello back yuanbao',
      },
    },
    {
      channelId: 'sms',
      configSetup: () => {
        config.smsSendUrl = 'http://sms-send';
        config.smsProviderToken = 'sms-token';
      },
      configTeardown: () => {
        config.smsSendUrl = '';
        config.smsProviderToken = '';
      },
      webhookPayload: {
        userId: 'user-sms',
        chatId: 'chat-sms',
        text: 'hello sms',
      },
      expectedInbound: {
        userId: 'user-sms',
        chatId: 'chat-sms',
        rawText: 'hello sms',
      },
      sendPayload: {
        to: 'chat-sms',
        text: 'hello back sms',
      },
      expectedFetch: {
        url: 'http://sms-send',
        method: 'POST',
        bodyContains: 'hello back sms',
      },
    },
    {
      channelId: 'home-assistant',
      configSetup: () => {
        config.homeAssistantWebhookUrl = 'http://there is-webhook';
      },
      configTeardown: () => {
        config.homeAssistantWebhookUrl = '';
      },
      webhookPayload: {
        userId: 'user-there is',
        chatId: 'chat-there is',
        text: 'hello there is',
      },
      expectedInbound: {
        userId: 'user-there is',
        chatId: 'chat-there is',
        rawText: 'hello there is',
      },
      sendPayload: {
        text: 'hello back there is',
      },
      expectedFetch: {
        url: 'http://there is-webhook',
        method: 'POST',
        bodyContains: 'hello back there is',
      },
    },
    {
      channelId: 'voice-call',
      configSetup: () => {
        config.voiceCallBridgeUrl = 'http://voice-bridge';
      },
      configTeardown: () => {
        config.voiceCallBridgeUrl = '';
      },
      webhookPayload: {
        userId: 'user-voice',
        chatId: 'chat-voice',
        text: 'hello voice',
      },
      expectedInbound: {
        userId: 'user-voice',
        chatId: 'chat-voice',
        rawText: 'hello voice',
      },
      sendPayload: {
        to: 'chat-voice',
        text: 'hello back voice',
      },
      expectedFetch: {
        url: 'http://voice-bridge/send',
        method: 'POST',
        bodyContains: 'hello back voice',
      },
    },
    {
      channelId: 'google-meet',
      configSetup: () => {
        config.googleMeetBridgeUrl = 'http://meet-bridge';
      },
      configTeardown: () => {
        config.googleMeetBridgeUrl = '';
      },
      webhookPayload: {
        userId: 'user-meet',
        chatId: 'chat-meet',
        text: 'hello meet',
      },
      expectedInbound: {
        userId: 'user-meet',
        chatId: 'chat-meet',
        rawText: 'hello meet',
      },
      sendPayload: {
        to: 'chat-meet',
        text: 'hello back meet',
      },
      expectedFetch: {
        url: 'http://meet-bridge/send',
        method: 'POST',
        bodyContains: 'hello back meet',
      },
    },
    {
      channelId: 'twitch',
      configSetup: () => {
        config.twitchBridgeUrl = 'http://twitch-bridge';
      },
      configTeardown: () => {
        config.twitchBridgeUrl = '';
      },
      webhookPayload: {
        userId: 'user-twitch',
        chatId: 'chat-twitch',
        text: 'hello twitch',
      },
      expectedInbound: {
        userId: 'user-twitch',
        chatId: 'chat-twitch',
        rawText: 'hello twitch',
      },
      sendPayload: {
        to: 'chat-twitch',
        text: 'hello back twitch',
      },
      expectedFetch: {
        url: 'http://twitch-bridge/send',
        method: 'POST',
        bodyContains: 'hello back twitch',
      },
    },
    {
      channelId: 'nextcloud-talk',
      configSetup: () => {
        config.nextcloudTalkWebhookUrl = 'http://nc-webhook';
      },
      configTeardown: () => {
        config.nextcloudTalkWebhookUrl = '';
      },
      webhookPayload: {
        userId: 'user-nc',
        chatId: 'chat-nc',
        text: 'hello nc',
      },
      expectedInbound: {
        userId: 'user-nc',
        chatId: 'chat-nc',
        rawText: 'hello nc',
      },
      sendPayload: {
        text: 'hello back nc',
      },
      expectedFetch: {
        url: 'http://nc-webhook',
        method: 'POST',
        bodyContains: 'hello back nc',
      },
    },
    {
      channelId: 'mattermost',
      configSetup: () => {
        config.mattermostWebhookUrl = 'http://mm-webhook';
      },
      configTeardown: () => {
        config.mattermostWebhookUrl = '';
      },
      webhookPayload: {
        userId: 'user-mm',
        chatId: 'chat-mm',
        text: 'hello mm',
      },
      expectedInbound: {
        userId: 'user-mm',
        chatId: 'chat-mm',
        rawText: 'hello mm',
      },
      sendPayload: {
        text: 'hello back mm',
      },
      expectedFetch: {
        url: 'http://mm-webhook',
        method: 'POST',
        bodyContains: 'hello back mm',
      },
    },
    {
      channelId: 'synology-chat',
      configSetup: () => {
        config.synologyChatWebhookUrl = 'http://synology-webhook';
      },
      configTeardown: () => {
        config.synologyChatWebhookUrl = '';
      },
      webhookPayload: {
        userId: 'user-synology',
        chatId: 'chat-synology',
        text: 'hello synology',
      },
      expectedInbound: {
        userId: 'user-synology',
        chatId: 'chat-synology',
        rawText: 'hello synology',
      },
      sendPayload: {
        text: 'hello back synology',
      },
      expectedFetch: {
        url: 'http://synology-webhook',
        method: 'POST',
        bodyContains: 'hello back synology',
      },
    },
    {
      channelId: 'clickclack',
      configSetup: () => {
        config.clickclackWebhookUrl = 'http://cc-webhook';
      },
      configTeardown: () => {
        config.clickclackWebhookUrl = '';
      },
      webhookPayload: {
        userId: 'user-cc',
        chatId: 'chat-cc',
        text: 'hello cc',
      },
      expectedInbound: {
        userId: 'user-cc',
        chatId: 'chat-cc',
        rawText: 'hello cc',
      },
      sendPayload: {
        text: 'hello back cc',
      },
      expectedFetch: {
        url: 'http://cc-webhook',
        method: 'POST',
        bodyContains: 'hello back cc',
      },
    },
    {
      channelId: 'nostr',
      configSetup: () => {
        config.nostrBridgeUrl = 'http://nostr-bridge';
      },
      configTeardown: () => {
        config.nostrBridgeUrl = '';
      },
      webhookPayload: {
        userId: 'user-nostr',
        chatId: 'chat-nostr',
        text: 'hello nostr',
      },
      expectedInbound: {
        userId: 'user-nostr',
        chatId: 'chat-nostr',
        rawText: 'hello nostr',
      },
      sendPayload: {
        to: 'chat-nostr',
        text: 'hello back nostr',
      },
      expectedFetch: {
        url: 'http://nostr-bridge/send',
        method: 'POST',
        bodyContains: 'hello back nostr',
      },
    },
  ];

  it.each(testCases)('correctly processes live message send and webhook ingress for $channelId', async (tc) => {
    tc.configSetup();

    const fetchCalls: { url: string; init: any }[] = [];
    const fetchMock = async (url: string, init: any) => {
      fetchCalls.push({ url, init });
      return { ok: true, status: 200 } as any;
    };

    const gateway = createTestGateway(tc.channelId, fetchMock);
    expect(gateway).not.toBeNull();

    try {
      // 1. Test Inbound Webhook parsing
      let receivedEvent: any = null;
      (gateway as any).eventBus.emit = jest.fn(async (event: any) => {
        receivedEvent = event;
        return true;
      });

      const inboundOk = await gateway!.onMessageReceived(tc.webhookPayload);
      expect(inboundOk).toBe(true);
      expect(receivedEvent).not.toBeNull();
      expect(receivedEvent.payload.payload.data).toEqual(expect.objectContaining({
        platform: tc.channelId,
        userId: tc.expectedInbound.userId,
        chatId: tc.expectedInbound.chatId,
        rawText: tc.expectedInbound.rawText,
      }));

      // 2. Test Live Send dispatch
      const sendResult = await gateway!.sendMessage(tc.sendPayload);
      expect(sendResult.ok).toBe(true);
      expect(sendResult.status).toBe('delivered');

      expect(fetchCalls).toHaveLength(1);
      const call = fetchCalls[0];
      expect(call.url).toContain(tc.expectedFetch.url);
      expect(call.init.method).toBe(tc.expectedFetch.method);
      expect(call.init.body).toContain(tc.expectedFetch.bodyContains);

    } finally {
      tc.configTeardown();
    }
  });
});
