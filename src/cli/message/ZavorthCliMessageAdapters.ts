export type ChannelAdapterMode = 'telegram-bot' | 'webhook' | 'local-bridge' | 'signal-bridge' | 'apple-bridge' | 'matrix' | 'bot-http' | 'line' | 'outbox';

export type ChannelAdapter = {
  id: string;
  aliases?: string[];
  mode: ChannelAdapterMode;
  env: string[];
  webhookEnv?: string[];
  endpointEnv?: string[];
  scriptEnv?: string[];
  tokenEnv?: string[];
  targetEnv?: string[];
  outboxEnv?: string;
};

export type MessageCompose = {
  channel: string;
  targets: string[];
  message: string;
  attachments: string[];
  threadId: string;
  replyTo: string;
  reaction: string;
  mentions: string[];
};

export const CHANNEL_ADAPTERS: ChannelAdapter[] = [
  { id: 'telegram', mode: 'telegram-bot', env: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_DEFAULT_CHAT_ID'], targetEnv: ['TELEGRAM_DEFAULT_CHAT_ID'] },
  { id: 'discord', mode: 'webhook', env: ['DISCORD_WEBHOOK_URL'], webhookEnv: ['DISCORD_WEBHOOK_URL'] },
  { id: 'slack', mode: 'webhook', env: ['SLACK_WEBHOOK_URL'], webhookEnv: ['SLACK_WEBHOOK_URL'] },
  { id: 'whatsapp', mode: 'local-bridge', env: ['WHATSAPP_BRIDGE_URL or WHATSAPP_WEBHOOK_URL or WHATSAPP_OUTBOX_DIR'], endpointEnv: ['WHATSAPP_BRIDGE_URL'], webhookEnv: ['WHATSAPP_WEBHOOK_URL'], outboxEnv: 'WHATSAPP_OUTBOX_DIR' },
  { id: 'signal', mode: 'signal-bridge', env: ['SIGNAL_JSONRPC_URL or SIGNAL_CLI_PATH', 'SIGNAL_ACCOUNT_NUMBER', 'SIGNAL_ALLOWED_RECIPIENTS'], endpointEnv: ['SIGNAL_JSONRPC_URL'], scriptEnv: ['SIGNAL_CLI_PATH'], outboxEnv: 'SIGNAL_OUTBOX_DIR' },
  { id: 'imessage', mode: 'apple-bridge', env: ['IMESSAGE_BRIDGE_URL or IMESSAGE_SCRIPT_PATH or IMESSAGE_OUTBOX_DIR'], endpointEnv: ['IMESSAGE_BRIDGE_URL'], scriptEnv: ['IMESSAGE_SCRIPT_PATH'], outboxEnv: 'IMESSAGE_OUTBOX_DIR' },
  { id: 'matrix', mode: 'matrix', env: ['MATRIX_BASE_URL', 'MATRIX_ACCESS_TOKEN'], targetEnv: ['MATRIX_DEFAULT_ROOM_ID'] },
  { id: 'microsoft-teams', aliases: ['teams', 'msteams'], mode: 'webhook', env: ['TEAMS_WEBHOOK_URL or MSTEAMS_WEBHOOK_URL'], webhookEnv: ['TEAMS_WEBHOOK_URL', 'MSTEAMS_WEBHOOK_URL'] },
  { id: 'feishu', aliases: ['lark'], mode: 'webhook', env: ['FEISHU_WEBHOOK_URL or LARK_WEBHOOK_URL'], webhookEnv: ['FEISHU_WEBHOOK_URL', 'LARK_WEBHOOK_URL'] },
  { id: 'google-chat', aliases: ['gchat'], mode: 'webhook', env: ['GOOGLE_CHAT_WEBHOOK_URL'], webhookEnv: ['GOOGLE_CHAT_WEBHOOK_URL'] },
  { id: 'irc', mode: 'local-bridge', env: ['IRC_BRIDGE_URL or IRC_WEBHOOK_URL or IRC_OUTBOX_DIR'], endpointEnv: ['IRC_BRIDGE_URL'], webhookEnv: ['IRC_WEBHOOK_URL'], scriptEnv: ['IRC_SCRIPT_PATH'], outboxEnv: 'IRC_OUTBOX_DIR' },
  { id: 'zalo', mode: 'bot-http', env: ['ZALO_SEND_URL', 'ZALO_ACCESS_TOKEN'], endpointEnv: ['ZALO_SEND_URL'], tokenEnv: ['ZALO_ACCESS_TOKEN'] },
  { id: 'wecom', mode: 'webhook', env: ['WECOM_WEBHOOK_URL'], webhookEnv: ['WECOM_WEBHOOK_URL'] },
  { id: 'weixin', aliases: ['wechat'], mode: 'local-bridge', env: ['WEIXIN_BRIDGE_URL or WEIXIN_BRIDGE_SCRIPT or WEIXIN_OUTBOX_DIR'], endpointEnv: ['WEIXIN_BRIDGE_URL'], scriptEnv: ['WEIXIN_BRIDGE_SCRIPT'], outboxEnv: 'WEIXIN_OUTBOX_DIR' },
  { id: 'yuanbao', mode: 'local-bridge', env: ['YUANBAO_BRIDGE_URL or YUANBAO_BRIDGE_SCRIPT or YUANBAO_OUTBOX_DIR'], endpointEnv: ['YUANBAO_BRIDGE_URL'], scriptEnv: ['YUANBAO_BRIDGE_SCRIPT'], outboxEnv: 'YUANBAO_OUTBOX_DIR' },
  { id: 'sms', mode: 'bot-http', env: ['SMS_SEND_URL or SMS_API_BASE_URL', 'SMS_PROVIDER_TOKEN'], endpointEnv: ['SMS_SEND_URL', 'SMS_API_BASE_URL'], tokenEnv: ['SMS_PROVIDER_TOKEN'] },
  { id: 'home-assistant', mode: 'webhook', env: ['HOME_ASSISTANT_WEBHOOK_URL or HOME_ASSISTANT_URL'], webhookEnv: ['HOME_ASSISTANT_WEBHOOK_URL'], endpointEnv: ['HOME_ASSISTANT_URL'], tokenEnv: ['HOME_ASSISTANT_TOKEN'] },
  { id: 'voice-call', mode: 'local-bridge', env: ['VOICE_CALL_BRIDGE_URL or VOICE_CALL_BRIDGE_SCRIPT or VOICE_CALL_OUTBOX_DIR'], endpointEnv: ['VOICE_CALL_BRIDGE_URL'], scriptEnv: ['VOICE_CALL_BRIDGE_SCRIPT'], outboxEnv: 'VOICE_CALL_OUTBOX_DIR' },
  { id: 'google-meet', mode: 'local-bridge', env: ['GOOGLE_MEET_BRIDGE_URL or GOOGLE_MEET_BRIDGE_SCRIPT or GOOGLE_MEET_OUTBOX_DIR'], endpointEnv: ['GOOGLE_MEET_BRIDGE_URL'], scriptEnv: ['GOOGLE_MEET_BRIDGE_SCRIPT'], outboxEnv: 'GOOGLE_MEET_OUTBOX_DIR' },
  { id: 'line', mode: 'line', env: ['LINE_CHANNEL_ACCESS_TOKEN'], targetEnv: ['LINE_DEFAULT_TARGET_ID'] },
  { id: 'twitch', mode: 'local-bridge', env: ['TWITCH_BRIDGE_URL or TWITCH_WEBHOOK_URL or TWITCH_OUTBOX_DIR'], endpointEnv: ['TWITCH_BRIDGE_URL'], webhookEnv: ['TWITCH_WEBHOOK_URL'], scriptEnv: ['TWITCH_SCRIPT_PATH'], outboxEnv: 'TWITCH_OUTBOX_DIR' },
  { id: 'qq', mode: 'bot-http', env: ['QQ_BOT_WEBHOOK_URL or QQ_SEND_URL'], endpointEnv: ['QQ_SEND_URL'], webhookEnv: ['QQ_BOT_WEBHOOK_URL'] },
  { id: 'nextcloud-talk', aliases: ['nextcloud'], mode: 'webhook', env: ['NEXTCLOUD_TALK_WEBHOOK_URL'], webhookEnv: ['NEXTCLOUD_TALK_WEBHOOK_URL'] },
  { id: 'mattermost', mode: 'webhook', env: ['MATTERMOST_WEBHOOK_URL'], webhookEnv: ['MATTERMOST_WEBHOOK_URL'] },
  { id: 'synology-chat', aliases: ['synology'], mode: 'webhook', env: ['SYNOLOGY_CHAT_WEBHOOK_URL'], webhookEnv: ['SYNOLOGY_CHAT_WEBHOOK_URL'] },
  { id: 'clickclack', mode: 'webhook', env: ['CLICKCLACK_WEBHOOK_URL'], webhookEnv: ['CLICKCLACK_WEBHOOK_URL'] },
  { id: 'nostr', aliases: ['nost'], mode: 'local-bridge', env: ['NOSTR_BRIDGE_URL or NOSTR_OUTBOX_DIR'], endpointEnv: ['NOSTR_BRIDGE_URL'], outboxEnv: 'NOSTR_OUTBOX_DIR' },
];

export function envPrefix(value: string): string {
  return value.replace(/[^a-z0-9]+/giu, '_').replace(/^_+|_+$/gu, '').toUpperCase() || 'CHANNEL';
}

export function resolveChannelAdapter(channel: string): ChannelAdapter {
  const normalized = String(channel || 'unknown').trim().toLowerCase();
  return CHANNEL_ADAPTERS.find((adapter) => {
    return adapter.id === normalized || (adapter.aliases || []).includes(normalized);
  }) || {
    id: normalized,
    mode: 'outbox',
    env: [`${envPrefix(normalized)}_WEBHOOK_URL or ${envPrefix(normalized)}_OUTBOX_DIR`],
    webhookEnv: [`${envPrefix(normalized)}_WEBHOOK_URL`],
    outboxEnv: `${envPrefix(normalized)}_OUTBOX_DIR`,
  };
}

export type JsonObject = Record<string, unknown>;

export function mergeDirectoryEntries(existing: unknown[], incoming: JsonObject[]): JsonObject[] {
  const map = new Map<string, JsonObject>();
  for (const entry of existing) {
    const item = entry as JsonObject;
    map.set(`${String(item.channel)}:${String(item.externalId || item.id)}`, item);
  }
  for (const item of incoming) {
    map.set(`${String(item.channel)}:${String(item.externalId || item.id)}`, item);
  }
  return Array.from(map.values());
}
