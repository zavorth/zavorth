import path from 'path';

import { normalizeUrl, parseList } from '../configHelpers';

export function buildChannelConfig(projectRoot: string) {
  return {
    // Prepared multi-platform channels
    discordBotToken: process.env.DISCORD_BOT_TOKEN || '',
    discordAllowedGuildIds: parseList(process.env.DISCORD_ALLOWED_GUILD_IDS || process.env.DISCORD_GUILD_ID || ''),
    discordAllowedChannelIds: parseList(process.env.DISCORD_ALLOWED_CHANNEL_IDS || ''),
    discordAllowDms:
      (process.env.DISCORD_ALLOW_DMS || process.env.DISCORD_BRIDGE_ALLOW_DMS || 'false').toLowerCase() === 'true',
    discordRequiredOnBoot: (process.env.DISCORD_REQUIRED_ON_BOOT || 'false').toLowerCase() === 'true',
    discordPublicServerMode: (process.env.DISCORD_PUBLIC_SERVER_MODE || 'false').toLowerCase() === 'true',
    discordOwnerUserIds: parseList(process.env.DISCORD_OWNER_USER_IDS || ''),
    discordRequireOwnerForOperational:
      (process.env.DISCORD_REQUIRE_OWNER_FOR_OPERATIONAL || 'true').toLowerCase() !== 'false',
    discordCommandExposure: ((): 'none' | 'minimal' | 'operator' => {
      const defaultExposure =
        (process.env.DISCORD_PUBLIC_SERVER_MODE || 'false').toLowerCase() === 'true' ? 'minimal' : 'none';
      const normalized = String(process.env.DISCORD_COMMAND_EXPOSURE || defaultExposure).trim().toLowerCase();
      if (normalized === 'minimal' || normalized === 'operator') {
        return normalized;
      }
      return 'none';
    })(),
    discordOperatorUserIds: parseList(process.env.DISCORD_OPERATOR_USER_IDS || ''),
    discordBlockMassMentions:
      (process.env.DISCORD_BLOCK_MASS_MENTIONS || 'true').toLowerCase() !== 'false',
    discordMaxLinksPerMessage: parseInt(process.env.DISCORD_MAX_LINKS_PER_MESSAGE || '3', 10),
    discordAllowAttachmentsInPublicServerMode:
      (process.env.DISCORD_ALLOW_ATTACHMENTS_IN_PUBLIC_SERVER_MODE || 'false').toLowerCase() === 'true',
    discordMaxMessageChars: parseInt(process.env.DISCORD_MAX_MESSAGE_CHARS || '1800', 10),
    discordRateLimitWindowMs: parseInt(process.env.DISCORD_RATE_LIMIT_WINDOW_MS || '60000', 10),
    discordRateLimitMaxRequests: parseInt(process.env.DISCORD_RATE_LIMIT_MAX_REQUESTS || '6', 10),
    discordBridgeEnabled:
      (
        process.env.DISCORD_BRIDGE_ENABLED ||
        (process.env.DISCORD_BRIDGE_SECRET || process.env.DISCORD_BRIDGE_SECRET_FILE ? 'true' : 'false')
      ).toLowerCase() === 'true',
    discordBridgeAllowDms: (process.env.DISCORD_BRIDGE_ALLOW_DMS || 'false').toLowerCase() === 'true',
    whatsappEnabled: (process.env.WHATSAPP_ENABLED || 'false').toLowerCase() === 'true',
    whatsappBotToken: process.env.WHATSAPP_BOT_TOKEN || '',
    whatsappProvider: (() => {
      const normalized = String(process.env.WHATSAPP_PROVIDER || '').trim().toLowerCase();
      if (normalized === 'cloud-api' || normalized === 'baileys') {
        return normalized;
      }
      return 'stub';
    })(),
    whatsappCloudApiVersion: String(process.env.WHATSAPP_CLOUD_API_VERSION || 'v20.0').trim() || 'v20.0',
    whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    whatsappWebhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
    whatsappAllowedChatIds: parseList(process.env.WHATSAPP_ALLOWED_CHAT_IDS || ''),
    whatsappSessionDir: process.env.WHATSAPP_SESSION_DIR || '',
    whatsappOutboxDir:
      process.env.WHATSAPP_OUTBOX_DIR ||
      path.resolve(projectRoot, 'data', 'whatsapp-bridge', 'outbox'),
    whatsappStatusFile:
      process.env.WHATSAPP_STATUS_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'whatsapp-bridge-status.json'),
    instagramEnabled: (process.env.INSTAGRAM_ENABLED || 'false').toLowerCase() === 'true',
    instagramProvider: (() => {
      const normalized = String(process.env.INSTAGRAM_PROVIDER || '').trim().toLowerCase();
      if (normalized === 'meta-messaging') {
        return normalized;
      }
      return 'stub';
    })(),
    instagramGraphApiVersion: String(process.env.INSTAGRAM_GRAPH_API_VERSION || 'v20.0').trim() || 'v20.0',
    instagramBusinessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '',
    instagramAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN || '',
    instagramWebhookVerifyToken: process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || '',
    instagramAllowedRecipientIds: parseList(process.env.INSTAGRAM_ALLOWED_RECIPIENT_IDS || ''),
    instagramOutboxDir:
      process.env.INSTAGRAM_OUTBOX_DIR ||
      path.resolve(projectRoot, 'data', 'instagram-bridge', 'outbox'),
    instagramStatusFile:
      process.env.INSTAGRAM_STATUS_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'instagram-bridge-status.json'),
    slackEnabled: (process.env.SLACK_ENABLED || 'false').toLowerCase() === 'true',
    slackBotToken: process.env.SLACK_BOT_TOKEN || '',
    slackSigningSecret: process.env.SLACK_SIGNING_SECRET || '',
    slackTransport: (() => {
      const normalized = String(process.env.SLACK_TRANSPORT || 'auto').trim().toLowerCase();
      if (normalized === 'native' || normalized === 'stub') {
        return normalized;
      }
      return 'auto';
    })(),
    slackApiBaseUrl:
      normalizeUrl(process.env.SLACK_API_BASE_URL || '') ||
      'https://slack.com/api',
    slackWorkspaceId: process.env.SLACK_WORKSPACE_ID || '',
    slackAllowedChannelIds: parseList(process.env.SLACK_ALLOWED_CHANNEL_IDS || ''),
    slackOutboxDir:
      process.env.SLACK_OUTBOX_DIR ||
      path.resolve(projectRoot, 'data', 'slack-bridge', 'outbox'),
    slackStatusFile:
      process.env.SLACK_STATUS_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'slack-bridge-status.json'),
    signalEnabled: (process.env.SIGNAL_ENABLED || 'false').toLowerCase() === 'true',
    signalTransport: (() => {
      const normalized = String(process.env.SIGNAL_TRANSPORT || '').trim().toLowerCase();
      if (normalized === 'signal-cli' || normalized === 'bridge' || normalized === 'stub') {
        return normalized;
      }
      return 'signal-cli';
    })(),
    signalCliPath: process.env.SIGNAL_CLI_PATH || '',
    signalJsonRpcUrl: process.env.SIGNAL_JSONRPC_URL || '',
    signalAccountNumber: process.env.SIGNAL_ACCOUNT_NUMBER || '',
    signalAllowedRecipients: parseList(process.env.SIGNAL_ALLOWED_RECIPIENTS || ''),
    signalOutboxDir:
      process.env.SIGNAL_OUTBOX_DIR ||
      path.resolve(projectRoot, 'data', 'signal-bridge', 'outbox'),
    signalStatusFile:
      process.env.SIGNAL_STATUS_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'signal-bridge-status.json'),
    imessageEnabled: (process.env.IMESSAGE_ENABLED || 'false').toLowerCase() === 'true',
    imessageBridgeMode: String(process.env.IMESSAGE_BRIDGE_MODE || 'mac-bridge').trim().toLowerCase() || 'mac-bridge',
    imessageNodeId: process.env.IMESSAGE_NODE_ID || '',
    imessageBridgeScript: process.env.IMESSAGE_BRIDGE_SCRIPT || '',
    imessageAllowedRecipients: parseList(process.env.IMESSAGE_ALLOWED_RECIPIENTS || ''),
    imessageReadOnly: (process.env.IMESSAGE_READ_ONLY || 'true').toLowerCase() !== 'false',
    imessageOutboxDir:
      process.env.IMESSAGE_OUTBOX_DIR ||
      path.resolve(projectRoot, 'data', 'imessage-bridge', 'outbox'),
    imessageStatusFile:
      process.env.IMESSAGE_STATUS_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'imessage-bridge-status.json'),
    teamsEnabled: (process.env.TEAMS_ENABLED || 'false').toLowerCase() === 'true',
    teamsAppId: process.env.TEAMS_APP_ID || '',
    teamsAppPassword: process.env.TEAMS_APP_PASSWORD || '',
    teamsClientSecret: process.env.TEAMS_CLIENT_SECRET || '',
    teamsTenantId: process.env.TEAMS_TENANT_ID || '',
    teamsWebhookSecret: process.env.TEAMS_WEBHOOK_SECRET || '',
    teamsAllowedConversationIds: parseList(process.env.TEAMS_ALLOWED_CONVERSATION_IDS || ''),
    teamsOutboxDir:
      process.env.TEAMS_OUTBOX_DIR ||
      path.resolve(projectRoot, 'data', 'teams-bridge', 'outbox'),
    teamsStatusFile:
      process.env.TEAMS_STATUS_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'teams-bridge-status.json'),
    emailEnabled: (process.env.EMAIL_ENABLED || 'false').toLowerCase() === 'true',
    emailSmtpHost: process.env.EMAIL_SMTP_HOST || process.env.SMTP_HOST || '',
    emailSmtpPort: parseInt(process.env.EMAIL_SMTP_PORT || process.env.SMTP_PORT || '587', 10),
    emailSmtpUser: process.env.EMAIL_SMTP_USER || process.env.SMTP_USER || '',
    emailSmtpPass: process.env.EMAIL_SMTP_PASS || process.env.SMTP_PASS || '',
    emailImapHost: process.env.EMAIL_IMAP_HOST || process.env.IMAP_HOST || '',
    emailAllowedRecipients: parseList(process.env.EMAIL_ALLOWED_RECIPIENTS || ''),
    emailOutboxDir:
      process.env.EMAIL_OUTBOX_DIR ||
      path.resolve(projectRoot, 'data', 'email-bridge', 'outbox'),
    emailStatusFile:
      process.env.EMAIL_STATUS_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'email-bridge-status.json'),
  };
}

export function buildDiscordBridgeConfig(projectRoot: string) {
  return {
    discordBridgeSecretFile:
      process.env.DISCORD_BRIDGE_SECRET_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'discord-bridge-secret.key'),
    discordBridgeInboxDir:
      process.env.DISCORD_BRIDGE_INBOX_DIR ||
      path.resolve(projectRoot, 'data', 'discord-bridge', 'inbox'),
    discordBridgeProcessedDir:
      process.env.DISCORD_BRIDGE_PROCESSED_DIR ||
      path.resolve(projectRoot, 'data', 'discord-bridge', 'processed'),
    discordBridgeRejectedDir:
      process.env.DISCORD_BRIDGE_REJECTED_DIR ||
      path.resolve(projectRoot, 'data', 'discord-bridge', 'rejected'),
    discordBridgeOutboxDir:
      process.env.DISCORD_BRIDGE_OUTBOX_DIR ||
      path.resolve(projectRoot, 'data', 'discord-bridge', 'outbox'),
    discordBridgeStateFile:
      process.env.DISCORD_BRIDGE_STATE_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'discord-bridge-state.json'),
    discordBridgeStatusFile:
      process.env.DISCORD_BRIDGE_STATUS_FILE ||
      path.resolve(projectRoot, 'data', 'runtime', 'discord-bridge-status.json'),
    discordBridgePollIntervalMs: parseInt(process.env.DISCORD_BRIDGE_POLL_INTERVAL_MS || '2500', 10),
    discordBridgeMaxAgeMs: parseInt(process.env.DISCORD_BRIDGE_MAX_AGE_MS || '600000', 10),
    discordBridgeMaxTextLength: parseInt(process.env.DISCORD_BRIDGE_MAX_TEXT_LENGTH || '4000', 10),
  };
}
