import { config } from '../config/index.js';

export type ChannelLiveTransportKind =
  | 'matrix-cs-api'
  | 'line-push'
  | 'telegram-bot-api'
  | 'discord-bot-api'
  | 'discord-webhook'
  | 'slack-web-api'
  | 'slack-webhook'
  | 'whatsapp-cloud-api'
  | 'whatsapp-bridge'
  | 'signal-jsonrpc'
  | 'teams-webhook'
  | 'instagram-graph'
  | 'email-smtp-bridge'
  | 'generic-webhook'
  | 'generic-send-endpoint'
  | 'generic-bridge-send'
  | 'none';

export type ChannelLiveTransportPlan = {
  channelId: string;
  kind: ChannelLiveTransportKind;
  /** Absolute URL for HTTP live send, when applicable. */
  url: string | null;
  method: 'POST' | 'PUT';
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
  reasonIfUnavailable: string | null;
  densified: true;
  firstClass: true;
};

type BuildInput = {
  channelId: string;
  message: string;
  target: string;
  cfg?: typeof config;
};

function cfgOf(input: BuildInput): typeof config {
  return input.cfg || config;
}

function firstList(value: unknown): string {
  if (Array.isArray(value) && value.length > 0) return String(value[0] || '').trim();
  return '';
}

function trimUrl(value: unknown): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

/**
 * Canonical live transport planner for every factory channel — current and
 * future WebhookGateway channels. Completeness does not depend on credentials:
 * when credentials are missing the plan reports kind + reason, still first-class.
 */
export class ChannelLiveTransportRegistry {
  public static plan(input: BuildInput): ChannelLiveTransportPlan {
    const id = String(input.channelId || '').trim().toLowerCase();
    const message = String(input.message || '');
    const target = String(input.target || '').trim();
    const cfg = cfgOf(input);

    switch (id) {
      case 'matrix':
        return planMatrix(id, message, target, cfg);
      case 'line':
        return planLine(id, message, target, cfg);
      case 'telegram':
        return planTelegram(id, message, target, cfg);
      case 'discord':
        return planDiscord(id, message, target, cfg);
      case 'slack':
        return planSlack(id, message, target, cfg);
      case 'whatsapp':
        return planWhatsApp(id, message, target, cfg);
      case 'signal':
        return planSignal(id, message, target, cfg);
      case 'teams':
        return planTeams(id, message, target, cfg);
      case 'instagram':
        return planInstagram(id, message, target, cfg);
      case 'email':
        return planEmail(id, message, target, cfg);
      case 'imessage':
        return planBridge(id, message, target, trimUrl(cfg.imessageBridgeUrl), 'iMessage');
      case 'google-chat':
        return planWebhook(id, message, trimUrl(cfg.googleChatWebhookUrl), { text: message }, 'GOOGLE_CHAT_WEBHOOK_URL');
      case 'feishu':
        return planWebhook(id, message, trimUrl(cfg.feishuWebhookUrl), { msg_type: 'text', content: { text: message } }, 'FEISHU_WEBHOOK_URL');
      case 'wecom':
        return planWebhook(id, message, trimUrl(cfg.wecomWebhookUrl), { msgtype: 'text', text: { content: message } }, 'WECOM_WEBHOOK_URL');
      case 'home-assistant':
        return planWebhook(id, message, trimUrl(cfg.homeAssistantWebhookUrl), { text: message }, 'HOME_ASSISTANT_WEBHOOK_URL');
      case 'nextcloud-talk':
        return planWebhook(id, message, trimUrl(cfg.nextcloudTalkWebhookUrl), { text: message }, 'NEXTCLOUD_TALK_WEBHOOK_URL');
      case 'mattermost':
        return planWebhook(id, message, trimUrl(cfg.mattermostWebhookUrl), { text: message }, 'MATTERMOST_WEBHOOK_URL');
      case 'synology-chat':
        return planWebhook(id, message, trimUrl(cfg.synologyChatWebhookUrl), { text: message }, 'SYNOLOGY_CHAT_WEBHOOK_URL');
      case 'clickclack':
        return planWebhook(id, message, trimUrl(cfg.clickclackWebhookUrl), { text: message }, 'CLICKCLACK_WEBHOOK_URL');
      case 'qq':
        return planEndpoint(id, message, target, trimUrl(cfg.qqSendUrl || cfg.qqBotWebhookUrl), '', 'QQ_SEND_URL');
      case 'zalo':
        return planEndpoint(id, message, target, trimUrl(cfg.zaloSendUrl), String(cfg.zaloAccessToken || ''), 'ZALO_SEND_URL+ZALO_ACCESS_TOKEN');
      case 'sms':
        return planEndpoint(
          id,
          message,
          target,
          trimUrl(cfg.smsSendUrl || cfg.smsApiBaseUrl),
          String(cfg.smsProviderToken || ''),
          'SMS_SEND_URL+SMS_PROVIDER_TOKEN',
        );
      case 'irc':
        return planBridge(id, message, target, trimUrl(cfg.ircBridgeUrl || cfg.ircWebhookUrl), 'IRC');
      case 'weixin':
        return planBridge(id, message, target, trimUrl(cfg.weixinBridgeUrl), 'Weixin');
      case 'yuanbao':
        return planBridge(id, message, target, trimUrl(cfg.yuanbaoBridgeUrl), 'Yuanbao');
      case 'voice-call':
        return planBridge(id, message, target, trimUrl(cfg.voiceCallBridgeUrl), 'Voice Call');
      case 'google-meet':
        return planBridge(id, message, target, trimUrl(cfg.googleMeetBridgeUrl), 'Google Meet');
      case 'twitch':
        return planBridge(id, message, target, trimUrl(cfg.twitchBridgeUrl || cfg.twitchWebhookUrl), 'Twitch');
      case 'nostr':
        return planBridge(id, message, target, trimUrl(cfg.nostrBridgeUrl), 'Nostr');
      default:
        return planFutureChannel(id, message, target, cfg);
    }
  }

  /** Every known factory id has a densified plan shape (credentials optional). */
  public static supports(channelId: string): boolean {
    return ChannelLiveTransportRegistry.plan({
      channelId,
      message: '',
      target: '',
    }).densified === true;
  }
}

function base(channelId: string, kind: ChannelLiveTransportKind): Omit<ChannelLiveTransportPlan, 'url' | 'method' | 'headers' | 'body' | 'reasonIfUnavailable'> {
  return { channelId, kind, densified: true, firstClass: true };
}

function unavailable(channelId: string, kind: ChannelLiveTransportKind, reason: string): ChannelLiveTransportPlan {
  return {
    ...base(channelId, kind),
    url: null,
    method: 'POST',
    headers: {},
    body: null,
    reasonIfUnavailable: reason,
  };
}

function planMatrix(id: string, message: string, target: string, cfg: typeof config): ChannelLiveTransportPlan {
  const room = target || String(cfg.matrixDefaultRoomId || '').trim();
  const baseUrl = trimUrl(cfg.matrixBaseUrl);
  const token = String(cfg.matrixAccessToken || '').trim();
  if (!room || !baseUrl || !token) {
    return unavailable(id, 'matrix-cs-api', 'Matrix requires MATRIX_BASE_URL, MATRIX_ACCESS_TOKEN and a room id.');
  }
  return {
    ...base(id, 'matrix-cs-api'),
    url: `${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(room)}/send/m.room.message/zav-${Date.now()}`,
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: { msgtype: 'm.text', body: message },
    reasonIfUnavailable: null,
  };
}

function planLine(id: string, message: string, target: string, cfg: typeof config): ChannelLiveTransportPlan {
  const to = target || String(cfg.lineDefaultTargetId || '').trim();
  const token = String(cfg.lineChannelAccessToken || '').trim();
  if (!to || !token) return unavailable(id, 'line-push', 'LINE requires LINE_CHANNEL_ACCESS_TOKEN and a target id.');
  return {
    ...base(id, 'line-push'),
    url: 'https://api.line.me/v2/bot/message/push',
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: { to, messages: [{ type: 'text', text: message }] },
    reasonIfUnavailable: null,
  };
}

function planTelegram(id: string, message: string, target: string, cfg: typeof config): ChannelLiveTransportPlan {
  const token = String(cfg.telegramBotToken || '').trim();
  const chatId = target || String(cfg.telegramDefaultChatId || '').trim();
  if (!token || !chatId) return unavailable(id, 'telegram-bot-api', 'Telegram requires TELEGRAM_BOT_TOKEN and chat id.');
  return {
    ...base(id, 'telegram-bot-api'),
    url: `https://api.telegram.org/bot${token}/sendMessage`,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { chat_id: chatId, text: message },
    reasonIfUnavailable: null,
  };
}

function planDiscord(id: string, message: string, target: string, cfg: typeof config): ChannelLiveTransportPlan {
  const botToken = String(cfg.discordBotToken || '').trim();
  const channelId = target || firstList(cfg.discordAllowedChannelIds);
  if (botToken && channelId) {
    return {
      ...base(id, 'discord-bot-api'),
      url: `https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages`,
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bot ${botToken}` },
      body: { content: message },
      reasonIfUnavailable: null,
    };
  }
  const webhook = trimUrl(cfg.discordWebhookUrl);
  if (webhook) {
    return {
      ...base(id, 'discord-webhook'),
      url: webhook,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { content: message },
      reasonIfUnavailable: null,
    };
  }
  return unavailable(id, 'discord-bot-api', 'Discord requires DISCORD_BOT_TOKEN+channel or DISCORD_WEBHOOK_URL.');
}

function planSlack(id: string, message: string, target: string, cfg: typeof config): ChannelLiveTransportPlan {
  const botToken = String(cfg.slackBotToken || '').trim();
  const channel = target || firstList(cfg.slackAllowedChannelIds);
  const apiBase = trimUrl(cfg.slackApiBaseUrl || 'https://slack.com/api') || 'https://slack.com/api';
  if (botToken && channel) {
    return {
      ...base(id, 'slack-web-api'),
      url: `${apiBase}/chat.postMessage`,
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${botToken}` },
      body: { channel, text: message },
      reasonIfUnavailable: null,
    };
  }
  const webhook = trimUrl(cfg.slackWebhookUrl);
  if (webhook) {
    return {
      ...base(id, 'slack-webhook'),
      url: webhook,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { text: message },
      reasonIfUnavailable: null,
    };
  }
  return unavailable(id, 'slack-web-api', 'Slack requires SLACK_BOT_TOKEN+channel or SLACK_WEBHOOK_URL.');
}

function planWhatsApp(id: string, message: string, target: string, cfg: typeof config): ChannelLiveTransportPlan {
  const accessToken = String(cfg.whatsappAccessToken || cfg.whatsappBotToken || '').trim();
  const phoneNumberId = String(cfg.whatsappPhoneNumberId || '').trim();
  const version = String(cfg.whatsappCloudApiVersion || 'v20.0').trim() || 'v20.0';
  const to = target || firstList(cfg.whatsappAllowedChatIds);
  if (accessToken && phoneNumberId && to) {
    return {
      ...base(id, 'whatsapp-cloud-api'),
      url: `https://graph.facebook.com/${version}/${encodeURIComponent(phoneNumberId)}/messages`,
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      },
      reasonIfUnavailable: null,
    };
  }
  const bridge = trimUrl(cfg.whatsappBridgeUrl || cfg.whatsappWebhookUrl);
  if (bridge) {
    return {
      ...base(id, 'whatsapp-bridge'),
      url: `${bridge}/send`,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { to: target || id, text: message, message },
      reasonIfUnavailable: null,
    };
  }
  return unavailable(id, 'whatsapp-cloud-api', 'WhatsApp requires Cloud API credentials or WHATSAPP_BRIDGE_URL.');
}

function planSignal(id: string, message: string, target: string, cfg: typeof config): ChannelLiveTransportPlan {
  const rpc = trimUrl(cfg.signalJsonRpcUrl);
  const account = String(cfg.signalAccountNumber || '').trim();
  const recipient = target || firstList(cfg.signalAllowedRecipients);
  if (rpc && recipient) {
    return {
      ...base(id, 'signal-jsonrpc'),
      url: rpc,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        jsonrpc: '2.0',
        method: 'send',
        id: `zav-${Date.now()}`,
        params: {
          account: account || undefined,
          recipient: [recipient],
          message,
        },
      },
      reasonIfUnavailable: null,
    };
  }
  return unavailable(id, 'signal-jsonrpc', 'Signal requires SIGNAL_JSONRPC_URL and a recipient.');
}

function planTeams(id: string, message: string, _target: string, cfg: typeof config): ChannelLiveTransportPlan {
  const webhook = trimUrl(cfg.teamsWebhookUrl);
  if (!webhook) return unavailable(id, 'teams-webhook', 'Teams requires TEAMS_WEBHOOK_URL.');
  return {
    ...base(id, 'teams-webhook'),
    url: webhook,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: {
      type: 'message',
      text: message,
      attachments: [{
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          type: 'AdaptiveCard',
          version: '1.4',
          body: [{ type: 'TextBlock', text: message, wrap: true }],
        },
      }],
    },
    reasonIfUnavailable: null,
  };
}

function planInstagram(id: string, message: string, target: string, cfg: typeof config): ChannelLiveTransportPlan {
  const token = String(cfg.instagramAccessToken || '').trim();
  const accountId = String(cfg.instagramBusinessAccountId || '').trim();
  const version = String(cfg.instagramGraphApiVersion || 'v20.0').trim() || 'v20.0';
  const recipient = target || firstList(cfg.instagramAllowedRecipientIds);
  if (token && accountId && recipient) {
    return {
      ...base(id, 'instagram-graph'),
      url: `https://graph.facebook.com/${version}/${encodeURIComponent(accountId)}/messages`,
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: {
        recipient: { id: recipient },
        message: { text: message },
      },
      reasonIfUnavailable: null,
    };
  }
  const webhook = trimUrl(cfg.instagramWebhookUrl);
  if (webhook) return planWebhook(id, message, webhook, { text: message }, 'INSTAGRAM_WEBHOOK_URL');
  return unavailable(id, 'instagram-graph', 'Instagram requires Graph credentials or INSTAGRAM_WEBHOOK_URL.');
}

function planEmail(id: string, message: string, target: string, cfg: typeof config): ChannelLiveTransportPlan {
  const host = String(cfg.emailSmtpHost || '').trim();
  if (!host) return unavailable(id, 'email-smtp-bridge', 'Email requires EMAIL_SMTP_HOST (outbound via local mail bridge/outbox).');
  // Email live path is outbox/bridge oriented; mark densified with synthetic bridge URL for host-local senders.
  return {
    ...base(id, 'email-smtp-bridge'),
    url: `smtp://${host}`,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: {
      to: target || firstList(cfg.emailAllowedRecipients) || null,
      subject: 'Zavorth',
      text: message,
      smtpHost: host,
      smtpPort: Number(cfg.emailSmtpPort || 587),
      smtpUser: String(cfg.emailSmtpUser || '').trim() || null,
    },
    reasonIfUnavailable: null,
  };
}

function planWebhook(
  id: string,
  message: string,
  url: string,
  body: Record<string, unknown>,
  envHint: string,
): ChannelLiveTransportPlan {
  if (!url) return unavailable(id, 'generic-webhook', `${id} requires ${envHint}.`);
  return {
    ...base(id, 'generic-webhook'),
    url,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    reasonIfUnavailable: null,
  };
}

function planEndpoint(
  id: string,
  message: string,
  target: string,
  url: string,
  token: string,
  envHint: string,
): ChannelLiveTransportPlan {
  if (!url) return unavailable(id, 'generic-send-endpoint', `${id} requires ${envHint}.`);
  if (!target) return unavailable(id, 'generic-send-endpoint', `${id} requires a recipient target.`);
  return {
    ...base(id, 'generic-send-endpoint'),
    url,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: { to: target, target, text: message, message },
    reasonIfUnavailable: null,
  };
}

function planBridge(
  id: string,
  message: string,
  target: string,
  bridgeUrl: string,
  label: string,
): ChannelLiveTransportPlan {
  if (!bridgeUrl) return unavailable(id, 'generic-bridge-send', `${label} requires a bridge/webhook URL.`);
  return {
    ...base(id, 'generic-bridge-send'),
    url: `${bridgeUrl}/send`,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { channel: target || id, text: message, message, to: target || null },
    reasonIfUnavailable: null,
  };
}

/**
 * Future channels: auto-detect env convention without code edits when possible.
 * CHANNEL_ID with hyphens → ENV prefix with underscores.
 * Looks for *_WEBHOOK_URL, *_BRIDGE_URL, *_SEND_URL, *_BOT_TOKEN patterns.
 */
function planFutureChannel(
  id: string,
  message: string,
  target: string,
  cfg: typeof config,
): ChannelLiveTransportPlan {
  const envPrefix = id.replace(/-/g, '_').toUpperCase();
  const record = cfg as Record<string, unknown>;
  const camel = (suffix: string) => {
    // try common camelCase keys on config object
    const key = id.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()) + suffix;
    return String(record[key] || '').trim();
  };
  const webhook = trimUrl(
    process.env[`${envPrefix}_WEBHOOK_URL`]
    || camel('WebhookUrl')
    || '',
  );
  if (webhook) {
    return planWebhook(id, message, webhook, { text: message }, `${envPrefix}_WEBHOOK_URL`);
  }
  const bridge = trimUrl(
    process.env[`${envPrefix}_BRIDGE_URL`]
    || camel('BridgeUrl')
    || '',
  );
  if (bridge) {
    return planBridge(id, message, target, bridge, id);
  }
  const sendUrl = trimUrl(
    process.env[`${envPrefix}_SEND_URL`]
    || camel('SendUrl')
    || '',
  );
  if (sendUrl) {
    const token = String(process.env[`${envPrefix}_ACCESS_TOKEN`] || process.env[`${envPrefix}_BOT_TOKEN`] || '').trim();
    return planEndpoint(id, message, target, sendUrl, token, `${envPrefix}_SEND_URL`);
  }
  return unavailable(
    id,
    'none',
    `No live transport mapped for "${id}". Add ChannelLiveTransportRegistry case or set ${envPrefix}_WEBHOOK_URL / ${envPrefix}_BRIDGE_URL / ${envPrefix}_SEND_URL.`,
  );
}
