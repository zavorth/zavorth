import { ChannelGatewayFactory } from '../../src/gateways/ChannelGatewayFactory';
import { ChannelLiveTransportRegistry } from '../../src/gateways/ChannelLiveTransportRegistry';
import { GatewayEventBus } from '../../src/gateway/events/GatewayEventBus';
import { ChannelPolicyManager } from '../../src/channels/policies/ChannelPolicyManager';
import type { WebhookGateway } from '../../src/gateways/WebhookGateway';
import { config } from '../../src/config/index';

/**
 * Live API integration contracts for every factory channel.
 * Uses densified transport plans + mocked fetch (real HTTP shape, no network).
 * Injects temporary config credentials so "configured" live path is exercised.
 */
describe('Channel live API integration (all factory channels)', () => {
  const ids = ChannelGatewayFactory.listSupportedChannelIds();

  function openPolicy(): ChannelPolicyManager {
    const policyManager = new ChannelPolicyManager({
      policyFile: require('path').join(require('os').tmpdir(), `zavorth-live-api-${Date.now()}-${Math.random()}.json`),
    });
    jest.spyOn(policyManager, 'verifyAccess').mockResolvedValue(true);
    return policyManager;
  }

  function injectCredentials(id: string): () => void {
    const c = config as any;
    const snapshot: Record<string, unknown> = {};
    const set = (key: string, value: unknown) => {
      snapshot[key] = c[key];
      c[key] = value;
    };

    switch (id) {
      case 'matrix':
        set('matrixBaseUrl', 'https://matrix.example.org');
        set('matrixAccessToken', 'syt_test_token');
        set('matrixDefaultRoomId', '!room:example.org');
        break;
      case 'line':
        set('lineChannelAccessToken', 'line-token');
        set('lineDefaultTargetId', 'Uline');
        break;
      case 'telegram':
        set('telegramBotToken', '123:ABC');
        set('telegramDefaultChatId', '42');
        break;
      case 'discord':
        set('discordBotToken', 'discord-bot');
        set('discordAllowedChannelIds', ['chan-1']);
        set('discordWebhookUrl', '');
        break;
      case 'slack':
        set('slackBotToken', 'xoxb-test');
        set('slackAllowedChannelIds', ['C1']);
        set('slackApiBaseUrl', 'https://slack.com/api');
        set('slackWebhookUrl', '');
        break;
      case 'whatsapp':
        set('whatsappAccessToken', 'wa-token');
        set('whatsappPhoneNumberId', 'pn-1');
        set('whatsappCloudApiVersion', 'v20.0');
        set('whatsappAllowedChatIds', ['5511999']);
        break;
      case 'signal':
        set('signalJsonRpcUrl', 'http://127.0.0.1:8080/api/v1/rpc');
        set('signalAccountNumber', '+15550001');
        set('signalAllowedRecipients', ['+15550002']);
        break;
      case 'teams':
        set('teamsWebhookUrl', 'https://outlook.office.com/webhook/test');
        break;
      case 'instagram':
        set('instagramAccessToken', 'ig-token');
        set('instagramBusinessAccountId', 'ig-biz');
        set('instagramAllowedRecipientIds', ['ig-user']);
        set('instagramGraphApiVersion', 'v20.0');
        break;
      case 'email':
        set('emailSmtpHost', 'smtp.example.com');
        set('emailSmtpPort', 587);
        set('emailAllowedRecipients', ['a@b.c']);
        break;
      case 'google-chat':
        set('googleChatWebhookUrl', 'https://chat.googleapis.com/v1/spaces/x/messages-key=1');
        break;
      case 'feishu':
        set('feishuWebhookUrl', 'https://open.feishu.cn/open-apis/bot/v2/hook/x');
        break;
      case 'wecom':
        set('wecomWebhookUrl', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send-key=x');
        break;
      case 'home-assistant':
        set('homeAssistantWebhookUrl', 'https://there is.example/api/webhook/zav');
        break;
      case 'nextcloud-talk':
        set('nextcloudTalkWebhookUrl', 'https://nc.example/hooks/zav');
        break;
      case 'mattermost':
        set('mattermostWebhookUrl', 'https://mm.example/hooks/zav');
        break;
      case 'synology-chat':
        set('synologyChatWebhookUrl', 'https://syno.example/webapi/entry.cgi');
        break;
      case 'clickclack':
        set('clickclackWebhookUrl', 'https://clickclack.example/hook');
        break;
      case 'qq':
        set('qqSendUrl', 'https://qq.example/send');
        break;
      case 'zalo':
        set('zaloSendUrl', 'https://zalo.example/send');
        set('zaloAccessToken', 'zalo-token');
        break;
      case 'sms':
        set('smsSendUrl', 'https://sms.example/send');
        set('smsProviderToken', 'sms-token');
        break;
      case 'irc':
        set('ircBridgeUrl', 'https://irc-bridge.example');
        break;
      case 'weixin':
        set('weixinBridgeUrl', 'https://weixin-bridge.example');
        break;
      case 'yuanbao':
        set('yuanbaoBridgeUrl', 'https://yuanbao-bridge.example');
        break;
      case 'voice-call':
        set('voiceCallBridgeUrl', 'https://voice-bridge.example');
        break;
      case 'google-meet':
        set('googleMeetBridgeUrl', 'https://meet-bridge.example');
        break;
      case 'twitch':
        set('twitchBridgeUrl', 'https://twitch-bridge.example');
        break;
      case 'nostr':
        set('nostrBridgeUrl', 'https://nostr-bridge.example');
        break;
      case 'imessage':
        set('imessageBridgeUrl', 'https://imessage-bridge.example');
        break;
      default:
        break;
    }

    return () => {
      for (const [key, value] of Object.entries(snapshot)) {
        c[key] = value;
      }
    };
  }

  function targetFor(id: string): string {
    switch (id) {
      case 'matrix': return '!room:example.org';
      case 'line': return 'Uline';
      case 'telegram': return '42';
      case 'discord': return 'chan-1';
      case 'slack': return 'C1';
      case 'whatsapp': return '5511999';
      case 'signal': return '+15550002';
      case 'instagram': return 'ig-user';
      case 'email': return 'a@b.c';
      case 'qq':
      case 'zalo':
      case 'sms':
        return 'recipient-1';
      default:
        return 'target-1';
    }
  }

  it('has densified live plan with executable HTTP contract for every factory channel', () => {
    expect(ids.length).toBeGreaterThanOrEqual(29);
    for (const id of ids) {
      const restore = injectCredentials(id);
      try {
        const plan = ChannelLiveTransportRegistry.plan({
          channelId: id,
          message: `live-contract:${id}`,
          target: targetFor(id),
        });
        expect(plan.densified).toBe(true);
        expect(plan.firstClass).toBe(true);
        expect(plan.kind).not.toBe('none');
        if (id === 'email') {
          // SMTP mediated — body present, synthetic transport
          expect(plan.body).toBeTruthy();
          expect(plan.kind).toBe('email-smtp-bridge');
        } else {
          expect(plan.url).toBeTruthy();
          expect(plan.body).toBeTruthy();
          expect(['POST', 'PUT']).toContain(plan.method);
        }
      } finally {
        restore();
      }
    }
  });

  it('executes live send path with mocked fetch for every non-email factory channel', async () => {
    const failures: string[] = [];

    for (const id of ids) {
      if (id === 'email') continue; // outbox/smtp mediated
      const restore = injectCredentials(id);
      const calls: Array<{ url: string; method: string; body: any }> = [];
      const fetchImpl = jest.fn(async (url: any, init-: any) => {
        let body: any = null;
        try {
          body = init?.body ? JSON.parse(String(init.body)) : null;
        } catch {
          body = init?.body || null;
        }
        calls.push({
          url: String(url),
          method: String(init?.method || 'GET').toUpperCase(),
          body,
        });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      });

      try {
        const gateway = ChannelGatewayFactory.createFromId(id, {
          eventBus: new GatewayEventBus(),
          policyManager: openPolicy(),
          fetchImpl: fetchImpl as any,
        }) as WebhookGateway;
        expect(gateway).toBeTruthy();
        jest.spyOn(gateway, 'resolveConfigured').mockReturnValue(true);
        await gateway.initialize();

        const expected = ChannelLiveTransportRegistry.plan({
          channelId: id,
          message: `ping-${id}`,
          target: targetFor(id),
        });

        const result = await gateway.sendMessage({
          text: `ping-${id}`,
          chatId: targetFor(id),
          recipients: [targetFor(id)],
        });

        if (!result.ok || result.status !== 'delivered') {
          failures.push(`${id}: status=${result.status} reason=${result.reason || ''}`);
          continue;
        }
        if (fetchImpl.mock.calls.length < 1) {
          failures.push(`${id}: fetch not called`);
          continue;
        }
        const call = calls[0];
        if (expected.url && !call.url.includes(new URL(expected.url).hostname) && !call.url.startsWith(expected.url.slice(0, 32))) {
          // hostname or prefix match
          if (!call.url.startsWith(expected.url.split('-')[0].slice(0, 40))) {
            // allow path variations for matrix room txn id
            if (!(id === 'matrix' && call.url.includes('/_matrix/client/v3/rooms/'))) {
              failures.push(`${id}: unexpected url ${call.url} vs ${expected.url}`);
            }
          }
        }
        if (expected.method && call.method !== expected.method) {
          failures.push(`${id}: method ${call.method} != ${expected.method}`);
        }
      } catch (error: unknown) {
        failures.push(`${id}: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        restore();
      }
    }

    expect(failures).toEqual([]);
  }, 120_000);

  it('email densified path queues without raw SMTP network', async () => {
    const restore = injectCredentials('email');
    try {
      const gateway = ChannelGatewayFactory.createFromId('email', {
        eventBus: new GatewayEventBus(),
        policyManager: openPolicy(),
        fetchImpl: jest.fn(async () => new Response('should-not-be-called', { status: 500 })) as any,
      }) as WebhookGateway;
      jest.spyOn(gateway, 'resolveConfigured').mockReturnValue(true);
      await gateway.initialize();
      const result = await gateway.sendMessage({ text: 'hello mail', chatId: 'a@b.c' });
      expect(result.ok).toBe(true);
      expect(['queued', 'delivered']).toContain(result.status);
    } finally {
      restore();
    }
  });
});
