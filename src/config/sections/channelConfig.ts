import path from 'path';

import { normalizeUrl, parseList } from '../configHelpers';

function getEnv(key: string, fallback = ''): string {
  return process.env[key] || fallback;
}

function getEnvBool(key: string, fallback = false): boolean {
  const val = process.env[key];
  if (val === undefined) return fallback;
  return val.toLowerCase() === 'true';
}

function getEnvInt(key: string, fallback: number): number {
  const val = process.env[key];
  if (val === undefined) return fallback;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
}

function getEnvUrl(key: string, fallback = ''): string {
  return normalizeUrl(process.env[key] || fallback);
}

export function buildChannelConfig(projectRoot: string) {
  return {
    // Prepared multi-platform channels
    discordBotToken: getEnv('DISCORD_BOT_TOKEN'),
    discordAllowedGuildIds: parseList(getEnv('DISCORD_ALLOWED_GUILD_IDS', getEnv('DISCORD_GUILD_ID'))),
    discordAllowedChannelIds: parseList(getEnv('DISCORD_ALLOWED_CHANNEL_IDS')),
    discordAllowDms: getEnvBool('DISCORD_ALLOW_DMS') || getEnvBool('DISCORD_BRIDGE_ALLOW_DMS'),
    discordRequiredOnBoot: getEnvBool('DISCORD_REQUIRED_ON_BOOT'),
    discordPublicServerMode: getEnvBool('DISCORD_PUBLIC_SERVER_MODE'),
    discordOwnerUserIds: parseList(getEnv('DISCORD_OWNER_USER_IDS')),
    discordRequireOwnerForOperational: getEnv('DISCORD_REQUIRE_OWNER_FOR_OPERATIONAL', 'true').toLowerCase() !== 'false',
    discordCommandExposure: ((): 'none' | 'minimal' | 'operator' => {
      const defaultExposure = getEnvBool('DISCORD_PUBLIC_SERVER_MODE') ? 'minimal' : 'none';
      const normalized = getEnv('DISCORD_COMMAND_EXPOSURE', defaultExposure).trim().toLowerCase();
      if (normalized === 'minimal' || normalized === 'operator') {
        return normalized;
      }
      return 'none';
    })(),
    discordOperatorUserIds: parseList(getEnv('DISCORD_OPERATOR_USER_IDS')),
    discordBlockMassMentions: getEnv('DISCORD_BLOCK_MASS_MENTIONS', 'true').toLowerCase() !== 'false',
    discordMaxLinksPerMessage: getEnvInt('DISCORD_MAX_LINKS_PER_MESSAGE', 3),
    discordAllowAttachmentsInPublicServerMode: getEnvBool('DISCORD_ALLOW_ATTACHMENTS_IN_PUBLIC_SERVER_MODE'),
    discordMaxMessageChars: getEnvInt('DISCORD_MAX_MESSAGE_CHARS', 1800),
    discordRateLimitWindowMs: getEnvInt('DISCORD_RATE_LIMIT_WINDOW_MS', 60000),
    discordRateLimitMaxRequests: getEnvInt('DISCORD_RATE_LIMIT_MAX_REQUESTS', 6),
    discordBridgeEnabled: getEnvBool('DISCORD_BRIDGE_ENABLED') || (process.env.DISCORD_BRIDGE_SECRET || process.env.DISCORD_BRIDGE_SECRET_FILE ? true : false),
    discordBridgeAllowDms: getEnvBool('DISCORD_BRIDGE_ALLOW_DMS'),

    whatsappEnabled: getEnvBool('WHATSAPP_ENABLED'),
    whatsappBotToken: getEnv('WHATSAPP_BOT_TOKEN'),
    whatsappProvider: (() => {
      const normalized = getEnv('WHATSAPP_PROVIDER').trim().toLowerCase();
      if (normalized === 'cloud-api' || normalized === 'baileys') {
        return normalized;
      }
      return 'local';
    })(),
    whatsappCloudApiVersion: getEnv('WHATSAPP_CLOUD_API_VERSION', 'v20.0').trim() || 'v20.0',
    whatsappPhoneNumberId: getEnv('WHATSAPP_PHONE_NUMBER_ID'),
    whatsappAccessToken: getEnv('WHATSAPP_ACCESS_TOKEN'),
    whatsappWebhookVerifyToken: getEnv('WHATSAPP_WEBHOOK_VERIFY_TOKEN'),
    whatsappAllowedChatIds: parseList(getEnv('WHATSAPP_ALLOWED_CHAT_IDS')),
    whatsappSessionDir: getEnv('WHATSAPP_SESSION_DIR'),
    whatsappOutboxDir: getEnv('WHATSAPP_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'whatsapp-bridge', 'outbox')),
    whatsappStatusFile: getEnv('WHATSAPP_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'whatsapp-bridge-status.json')),

    instagramEnabled: getEnvBool('INSTAGRAM_ENABLED'),
    instagramProvider: (() => {
      const normalized = getEnv('INSTAGRAM_PROVIDER').trim().toLowerCase();
      if (normalized === 'meta-messaging') {
        return normalized;
      }
      return 'local';
    })(),
    instagramGraphApiVersion: getEnv('INSTAGRAM_GRAPH_API_VERSION', 'v20.0').trim() || 'v20.0',
    instagramBusinessAccountId: getEnv('INSTAGRAM_BUSINESS_ACCOUNT_ID'),
    instagramAccessToken: getEnv('INSTAGRAM_ACCESS_TOKEN'),
    instagramWebhookUrl: getEnvUrl('INSTAGRAM_WEBHOOK_URL'),
    instagramWebhookVerifyToken: getEnv('INSTAGRAM_WEBHOOK_VERIFY_TOKEN'),
    instagramAllowedRecipientIds: parseList(getEnv('INSTAGRAM_ALLOWED_RECIPIENT_IDS')),
    instagramOutboxDir: getEnv('INSTAGRAM_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'instagram-bridge', 'outbox')),
    instagramStatusFile: getEnv('INSTAGRAM_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'instagram-bridge-status.json')),

    slackEnabled: getEnvBool('SLACK_ENABLED'),
    slackBotToken: getEnv('SLACK_BOT_TOKEN'),
    slackSigningSecret: getEnv('SLACK_SIGNING_SECRET'),
    slackTransport: (() => {
      const normalized = getEnv('SLACK_TRANSPORT', 'auto').trim().toLowerCase();
      if (normalized === 'native' || normalized === 'local') {
        return normalized;
      }
      return 'auto';
    })(),
    slackApiBaseUrl: getEnvUrl('SLACK_API_BASE_URL', 'https://slack.com/api'),
    slackWorkspaceId: getEnv('SLACK_WORKSPACE_ID'),
    slackAllowedChannelIds: parseList(getEnv('SLACK_ALLOWED_CHANNEL_IDS')),
    slackOutboxDir: getEnv('SLACK_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'slack-bridge', 'outbox')),
    slackStatusFile: getEnv('SLACK_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'slack-bridge-status.json')),

    signalEnabled: getEnvBool('SIGNAL_ENABLED'),
    signalTransport: (() => {
      const normalized = getEnv('SIGNAL_TRANSPORT', 'signal-cli').trim().toLowerCase();
      if (normalized === 'signal-cli' || normalized === 'bridge' || normalized === 'local') {
        return normalized;
      }
      return 'signal-cli';
    })(),
    signalCliPath: getEnv('SIGNAL_CLI_PATH'),
    signalJsonRpcUrl: getEnv('SIGNAL_JSONRPC_URL'),
    signalAccountNumber: getEnv('SIGNAL_ACCOUNT_NUMBER'),
    signalAllowedRecipients: parseList(getEnv('SIGNAL_ALLOWED_RECIPIENTS')),
    signalOutboxDir: getEnv('SIGNAL_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'signal-bridge', 'outbox')),
    signalStatusFile: getEnv('SIGNAL_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'signal-bridge-status.json')),

    imessageEnabled: getEnvBool('IMESSAGE_ENABLED'),
    imessageBridgeMode: getEnv('IMESSAGE_BRIDGE_MODE', 'mac-bridge').trim().toLowerCase(),
    imessageNodeId: getEnv('IMESSAGE_NODE_ID'),
    imessageBridgeScript: getEnv('IMESSAGE_BRIDGE_SCRIPT'),
    imessageAllowedRecipients: parseList(getEnv('IMESSAGE_ALLOWED_RECIPIENTS')),
    imessageReadOnly: getEnv('IMESSAGE_READ_ONLY', 'true').toLowerCase() !== 'false',
    imessageOutboxDir: getEnv('IMESSAGE_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'imessage-bridge', 'outbox')),
    imessageStatusFile: getEnv('IMESSAGE_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'imessage-bridge-status.json')),

    teamsEnabled: getEnvBool('TEAMS_ENABLED'),
    teamsAppId: getEnv('TEAMS_APP_ID'),
    teamsAppPassword: getEnv('TEAMS_APP_PASSWORD'),
    teamsClientSecret: getEnv('TEAMS_CLIENT_SECRET'),
    teamsTenantId: getEnv('TEAMS_TENANT_ID'),
    teamsWebhookSecret: getEnv('TEAMS_WEBHOOK_SECRET'),
    teamsAllowedConversationIds: parseList(getEnv('TEAMS_ALLOWED_CONVERSATION_IDS')),
    teamsOutboxDir: getEnv('TEAMS_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'teams-bridge', 'outbox')),
    teamsStatusFile: getEnv('TEAMS_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'teams-bridge-status.json')),

    emailEnabled: getEnvBool('EMAIL_ENABLED'),
    emailSmtpHost: getEnv('EMAIL_SMTP_HOST', getEnv('SMTP_HOST')),
    emailSmtpPort: getEnvInt('EMAIL_SMTP_PORT', getEnvInt('SMTP_PORT', 587)),
    emailSmtpUser: getEnv('EMAIL_SMTP_USER', getEnv('SMTP_USER')),
    emailSmtpPass: getEnv('EMAIL_SMTP_PASS', getEnv('SMTP_PASS')),
    emailImapHost: getEnv('EMAIL_IMAP_HOST', getEnv('IMAP_HOST')),
    emailAllowedRecipients: parseList(getEnv('EMAIL_ALLOWED_RECIPIENTS')),
    emailOutboxDir: getEnv('EMAIL_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'email-bridge', 'outbox')),
    emailStatusFile: getEnv('EMAIL_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'email-bridge-status.json')),

    matrixBaseUrl: getEnvUrl('MATRIX_BASE_URL'),
    matrixAccessToken: getEnv('MATRIX_ACCESS_TOKEN'),
    matrixDefaultRoomId: getEnv('MATRIX_DEFAULT_ROOM_ID'),
    matrixOutboxDir: getEnv('MATRIX_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'matrix-bridge', 'outbox')),
    matrixStatusFile: getEnv('MATRIX_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'matrix-bridge-status.json')),

    lineChannelAccessToken: getEnv('LINE_CHANNEL_ACCESS_TOKEN'),
    lineDefaultTargetId: getEnv('LINE_DEFAULT_TARGET_ID'),
    lineOutboxDir: getEnv('LINE_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'line-bridge', 'outbox')),
    lineStatusFile: getEnv('LINE_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'line-bridge-status.json')),

    googleChatWebhookUrl: getEnvUrl('GOOGLE_CHAT_WEBHOOK_URL'),
    googleChatOutboxDir: getEnv('GOOGLE_CHAT_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'google-chat-bridge', 'outbox')),
    googleChatStatusFile: getEnv('GOOGLE_CHAT_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'google-chat-bridge-status.json')),

    feishuWebhookUrl: getEnvUrl('FEISHU_WEBHOOK_URL', getEnvUrl('LARK_WEBHOOK_URL')),
    feishuOutboxDir: getEnv('FEISHU_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'feishu-bridge', 'outbox')),
    feishuStatusFile: getEnv('FEISHU_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'feishu-bridge-status.json')),

    ircBridgeUrl: getEnvUrl('IRC_BRIDGE_URL'),
    ircWebhookUrl: getEnvUrl('IRC_WEBHOOK_URL'),
    ircOutboxDir: getEnv('IRC_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'irc-bridge', 'outbox')),
    ircScriptPath: getEnv('IRC_SCRIPT_PATH'),
    ircStatusFile: getEnv('IRC_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'irc-bridge-status.json')),

    qqBotWebhookUrl: getEnvUrl('QQ_BOT_WEBHOOK_URL'),
    qqSendUrl: getEnvUrl('QQ_SEND_URL'),
    qqOutboxDir: getEnv('QQ_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'qq-bridge', 'outbox')),
    qqStatusFile: getEnv('QQ_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'qq-bridge-status.json')),

    zaloSendUrl: getEnvUrl('ZALO_SEND_URL'),
    zaloAccessToken: getEnv('ZALO_ACCESS_TOKEN'),
    zaloOutboxDir: getEnv('ZALO_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'zalo-bridge', 'outbox')),
    zaloStatusFile: getEnv('ZALO_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'zalo-bridge-status.json')),

    wecomWebhookUrl: getEnvUrl('WECOM_WEBHOOK_URL'),
    wecomOutboxDir: getEnv('WECOM_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'wecom-bridge', 'outbox')),
    wecomStatusFile: getEnv('WECOM_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'wecom-bridge-status.json')),

    weixinBridgeUrl: getEnvUrl('WEIXIN_BRIDGE_URL'),
    weixinBridgeScript: getEnv('WEIXIN_BRIDGE_SCRIPT'),
    weixinOutboxDir: getEnv('WEIXIN_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'weixin-bridge', 'outbox')),
    weixinStatusFile: getEnv('WEIXIN_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'weixin-bridge-status.json')),

    yuanbaoBridgeUrl: getEnvUrl('YUANBAO_BRIDGE_URL'),
    yuanbaoBridgeScript: getEnv('YUANBAO_BRIDGE_SCRIPT'),
    yuanbaoOutboxDir: getEnv('YUANBAO_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'yuanbao-bridge', 'outbox')),
    yuanbaoStatusFile: getEnv('YUANBAO_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'yuanbao-bridge-status.json')),

    smsSendUrl: getEnvUrl('SMS_SEND_URL'),
    smsApiBaseUrl: getEnvUrl('SMS_API_BASE_URL'),
    smsProviderToken: getEnv('SMS_PROVIDER_TOKEN'),
    smsOutboxDir: getEnv('SMS_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'sms-bridge', 'outbox')),
    smsStatusFile: getEnv('SMS_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'sms-bridge-status.json')),

    homeAssistantWebhookUrl: getEnvUrl('HOME_ASSISTANT_WEBHOOK_URL'),
    homeAssistantUrl: getEnvUrl('HOME_ASSISTANT_URL'),
    homeAssistantToken: getEnv('HOME_ASSISTANT_TOKEN'),
    homeAssistantOutboxDir: getEnv('HOME_ASSISTANT_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'home-assistant-bridge', 'outbox')),
    homeAssistantStatusFile: getEnv('HOME_ASSISTANT_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'home-assistant-bridge-status.json')),

    voiceCallBridgeUrl: getEnvUrl('VOICE_CALL_BRIDGE_URL'),
    voiceCallBridgeScript: getEnv('VOICE_CALL_BRIDGE_SCRIPT'),
    voiceCallOutboxDir: getEnv('VOICE_CALL_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'voice-call-bridge', 'outbox')),
    voiceCallStatusFile: getEnv('VOICE_CALL_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'voice-call-bridge-status.json')),

    googleMeetBridgeUrl: getEnvUrl('GOOGLE_MEET_BRIDGE_URL'),
    googleMeetBridgeScript: getEnv('GOOGLE_MEET_BRIDGE_SCRIPT'),
    googleMeetOutboxDir: getEnv('GOOGLE_MEET_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'google-meet-bridge', 'outbox')),
    googleMeetStatusFile: getEnv('GOOGLE_MEET_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'google-meet-bridge-status.json')),

    twitchBridgeUrl: getEnvUrl('TWITCH_BRIDGE_URL'),
    twitchWebhookUrl: getEnvUrl('TWITCH_WEBHOOK_URL'),
    twitchScriptPath: getEnv('TWITCH_SCRIPT_PATH'),
    twitchOutboxDir: getEnv('TWITCH_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'twitch-bridge', 'outbox')),
    twitchStatusFile: getEnv('TWITCH_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'twitch-bridge-status.json')),

    nextcloudTalkWebhookUrl: getEnvUrl('NEXTCLOUD_TALK_WEBHOOK_URL'),
    nextcloudTalkOutboxDir: getEnv('NEXTCLOUD_TALK_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'nextcloud-talk-bridge', 'outbox')),
    nextcloudTalkStatusFile: getEnv('NEXTCLOUD_TALK_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'nextcloud-talk-bridge-status.json')),

    mattermostWebhookUrl: getEnvUrl('MATTERMOST_WEBHOOK_URL'),
    mattermostOutboxDir: getEnv('MATTERMOST_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'mattermost-bridge', 'outbox')),
    mattermostStatusFile: getEnv('MATTERMOST_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'mattermost-bridge-status.json')),

    synologyChatWebhookUrl: getEnvUrl('SYNOLOGY_CHAT_WEBHOOK_URL'),
    synologyChatOutboxDir: getEnv('SYNOLOGY_CHAT_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'synology-chat-bridge', 'outbox')),
    synologyChatStatusFile: getEnv('SYNOLOGY_CHAT_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'synology-chat-bridge-status.json')),

    clickclackWebhookUrl: getEnvUrl('CLICKCLACK_WEBHOOK_URL'),
    clickclackOutboxDir: getEnv('CLICKCLACK_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'clickclack-bridge', 'outbox')),
    clickclackStatusFile: getEnv('CLICKCLACK_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'clickclack-bridge-status.json')),

    nostrBridgeUrl: getEnvUrl('NOSTR_BRIDGE_URL'),
    nostrOutboxDir: getEnv('NOSTR_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'nostr-bridge', 'outbox')),
    nostrStatusFile: getEnv('NOSTR_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'nostr-bridge-status.json')),

    telegramBotToken: getEnv('TELEGRAM_BOT_TOKEN'),
    telegramDefaultChatId: getEnv('TELEGRAM_DEFAULT_CHAT_ID'),
    telegramOutboxDir: getEnv('TELEGRAM_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'telegram-bridge', 'outbox')),
    telegramStatusFile: getEnv('TELEGRAM_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'telegram-bridge-status.json')),

    discordWebhookUrl: getEnvUrl('DISCORD_WEBHOOK_URL'),
    discordOutboxDir: getEnv('DISCORD_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'discord-bridge', 'outbox')),
    discordStatusFile: getEnv('DISCORD_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'discord-bridge-status.json')),

    slackWebhookUrl: getEnvUrl('SLACK_WEBHOOK_URL'),
    whatsappBridgeUrl: getEnvUrl('WHATSAPP_BRIDGE_URL'),
    whatsappWebhookUrl: getEnvUrl('WHATSAPP_WEBHOOK_URL'),
    imessageBridgeUrl: getEnvUrl('IMESSAGE_BRIDGE_URL'),
    teamsWebhookUrl: getEnvUrl('TEAMS_WEBHOOK_URL', getEnvUrl('MSTEAMS_WEBHOOK_URL')),
  };
}

export function buildDiscordBridgeConfig(projectRoot: string) {
  return {
    discordBridgeSecretFile: getEnv('DISCORD_BRIDGE_SECRET_FILE', path.resolve(projectRoot, 'data', 'runtime', 'discord-bridge-secret.key')),
    discordBridgeInboxDir: getEnv('DISCORD_BRIDGE_INBOX_DIR', path.resolve(projectRoot, 'data', 'discord-bridge', 'inbox')),
    discordBridgeProcessedDir: getEnv('DISCORD_BRIDGE_PROCESSED_DIR', path.resolve(projectRoot, 'data', 'discord-bridge', 'processed')),
    discordBridgeRejectedDir: getEnv('DISCORD_BRIDGE_REJECTED_DIR', path.resolve(projectRoot, 'data', 'discord-bridge', 'rejected')),
    discordBridgeOutboxDir: getEnv('DISCORD_BRIDGE_OUTBOX_DIR', path.resolve(projectRoot, 'data', 'discord-bridge', 'outbox')),
    discordBridgeStateFile: getEnv('DISCORD_BRIDGE_STATE_FILE', path.resolve(projectRoot, 'data', 'runtime', 'discord-bridge-state.json')),
    discordBridgeStatusFile: getEnv('DISCORD_BRIDGE_STATUS_FILE', path.resolve(projectRoot, 'data', 'runtime', 'discord-bridge-status.json')),
    discordBridgePollIntervalMs: getEnvInt('DISCORD_BRIDGE_POLL_INTERVAL_MS', 2500),
    discordBridgeMaxAgeMs: getEnvInt('DISCORD_BRIDGE_MAX_AGE_MS', 600000),
    discordBridgeMaxTextLength: getEnvInt('DISCORD_BRIDGE_MAX_TEXT_LENGTH', 4000),
  };
}
