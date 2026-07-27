import crypto from 'crypto';
import path from 'path';
import { config } from '../../../../config/index.js';
import {
  upsertEnvFileValues,
} from './ChannelSetupGuideEnvSupport.js';
import type {
  ChannelSetupApplyInput,
  ChannelSetupApplyResult,
  ChannelSetupChannelId,
  ChannelSetupMode,
} from '../../domain/ChannelSetupGuideTypes.js';

type ApplyChannelSetupInput = {
  envFilePath: string;
  projectRoot: string;
  input: ChannelSetupApplyInput;
  existsSync: typeof import('fs').existsSync;
  readFileSync: typeof import('fs').readFileSync;
  writeFileSync: typeof import('fs').writeFileSync;
  mkdirSync: typeof import('fs').mkdirSync;
};

export function applyChannelSetup({
  envFilePath,
  projectRoot,
  input,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
}: ApplyChannelSetupInput): ChannelSetupApplyResult {
  const channelId = normalizeChannelId(input.channelId);
  const mode = normalizeMode(input.mode);
  const values = input.values || {};

  const envValues = buildEnvValues(projectRoot, channelId, mode, values);
  const envKeysWritten = upsertEnvFileValues(envFilePath, envValues, {
    existsSync,
    readFileSync,
    writeFileSync,
    mkdirSync,
  });
  const filesTouched = [envFilePath];
  filesTouched.push(...ensureFilesystemScaffolding({
    channelId,
    mode,
    values,
    projectRoot,
    existsSync,
    writeFileSync,
    mkdirSync,
  }));

  return {
    channelId,
    mode,
    summary: buildApplySummary(channelId, mode),
    envKeysWritten,
    filesTouched: Array.from(new Set(filesTouched)),
    nextSteps: buildNextSteps(channelId, mode),
  };
}

function buildEnvValues(
  projectRoot: string,
  channelId: ChannelSetupChannelId,
  mode: ChannelSetupMode,
  values: Record<string, string | undefined>,
): Record<string, string | undefined> {
  switch (channelId) {
    case 'telegram':
      return {
        TELEGRAM_BOT_TOKEN: pickValue(values.botToken, process.env.TELEGRAM_BOT_TOKEN, ''),
        TELEGRAM_ALLOWED_USER_IDS: pickValue(values.allowedUserIds, process.env.TELEGRAM_ALLOWED_USER_IDS, ''),
        TELEGRAM_USER_ROLES: pickValue(values.userRoles, process.env.TELEGRAM_USER_ROLES, ''),
      };
    case 'discord':
      if (mode === 'bridge') {
        return {
          DISCORD_BRIDGE_ENABLED: 'true',
          DISCORD_BRIDGE_SECRET_FILE: resolveDiscordBridgeSecretFile(projectRoot, values.bridgeSecretFile),
          DISCORD_ALLOWED_GUILD_IDS: pickValue(values.allowedGuildIds, process.env.DISCORD_ALLOWED_GUILD_IDS, ''),
          DISCORD_ALLOWED_CHANNEL_IDS: pickValue(values.allowedChannelIds, process.env.DISCORD_ALLOWED_CHANNEL_IDS, ''),
          DISCORD_ALLOW_DMS: pickValue(values.allowDms, process.env.DISCORD_ALLOW_DMS, 'false'),
          DISCORD_BRIDGE_ALLOW_DMS: pickValue(values.allowDms, process.env.DISCORD_BRIDGE_ALLOW_DMS, 'false'),
          DISCORD_OWNER_USER_IDS: pickValue(values.ownerUserIds, process.env.DISCORD_OWNER_USER_IDS, ''),
        };
      }
      return {
        DISCORD_BOT_TOKEN: pickValue(values.botToken, process.env.DISCORD_BOT_TOKEN, ''),
        DISCORD_ALLOWED_GUILD_IDS: pickValue(values.allowedGuildIds, process.env.DISCORD_ALLOWED_GUILD_IDS, ''),
        DISCORD_ALLOWED_CHANNEL_IDS: pickValue(values.allowedChannelIds, process.env.DISCORD_ALLOWED_CHANNEL_IDS, ''),
        DISCORD_OWNER_USER_IDS: pickValue(values.ownerUserIds, process.env.DISCORD_OWNER_USER_IDS, ''),
        DISCORD_ALLOW_DMS: pickValue(values.allowDms, process.env.DISCORD_ALLOW_DMS, 'false'),
        DISCORD_PUBLIC_SERVER_MODE: pickValue(values.publicServerMode, process.env.DISCORD_PUBLIC_SERVER_MODE, 'false'),
        DISCORD_COMMAND_EXPOSURE: pickValue(values.commandExposure, process.env.DISCORD_COMMAND_EXPOSURE, 'minimal'),
      };
    case 'slack':
      return {
        SLACK_ENABLED: 'true',
        SLACK_TRANSPORT: mode === 'native' ? 'native' : 'local',
        SLACK_ALLOWED_CHANNEL_IDS: pickValue(values.allowedChannelIds, process.env.SLACK_ALLOWED_CHANNEL_IDS, ''),
        SLACK_WORKSPACE_ID: pickValue(values.workspaceId, process.env.SLACK_WORKSPACE_ID, ''),
        SLACK_BOT_TOKEN: mode === 'native'
          ? pickValue(values.botToken, process.env.SLACK_BOT_TOKEN, '')
          : pickValue(undefined, process.env.SLACK_BOT_TOKEN, ''),
        SLACK_SIGNING_SECRET: mode === 'native'
          ? pickValue(values.signingSecret, process.env.SLACK_SIGNING_SECRET, '')
          : pickValue(undefined, process.env.SLACK_SIGNING_SECRET, ''),
      };
    case 'whatsapp':
      return {
        WHATSAPP_ENABLED: 'true',
        WHATSAPP_PROVIDER: mode,
        WHATSAPP_ALLOWED_CHAT_IDS: pickValue(values.allowedChatIds, process.env.WHATSAPP_ALLOWED_CHAT_IDS, ''),
        WHATSAPP_PHONE_NUMBER_ID: mode === 'cloud-api'
          ? pickValue(values.phoneNumberId, process.env.WHATSAPP_PHONE_NUMBER_ID, '')
          : pickValue(undefined, process.env.WHATSAPP_PHONE_NUMBER_ID, ''),
        WHATSAPP_ACCESS_TOKEN: mode === 'cloud-api'
          ? pickValue(values.accessToken, process.env.WHATSAPP_ACCESS_TOKEN, '')
          : pickValue(undefined, process.env.WHATSAPP_ACCESS_TOKEN, ''),
        WHATSAPP_WEBHOOK_VERIFY_TOKEN: mode === 'cloud-api'
          ? pickValue(values.webhookVerifyToken, process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN, '')
          : pickValue(undefined, process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN, ''),
        WHATSAPP_SESSION_DIR: mode === 'baileys'
          ? pickValue(values.sessionDir, process.env.WHATSAPP_SESSION_DIR, path.resolve(projectRoot, 'data', 'whatsapp-session'))
          : pickValue(undefined, process.env.WHATSAPP_SESSION_DIR, ''),
        WHATSAPP_CLOUD_API_VERSION: pickValue(values.cloudApiVersion, process.env.WHATSAPP_CLOUD_API_VERSION, 'v20.0'),
      };
    case 'instagram':
      return {
        INSTAGRAM_ENABLED: 'true',
        INSTAGRAM_PROVIDER: mode === 'meta-messaging' ? 'meta-messaging' : 'local',
        INSTAGRAM_GRAPH_API_VERSION: pickValue(values.graphApiVersion, process.env.INSTAGRAM_GRAPH_API_VERSION, 'v20.0'),
        INSTAGRAM_BUSINESS_ACCOUNT_ID: mode === 'meta-messaging'
          ? pickValue(values.businessAccountId, process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID, '')
          : pickValue(undefined, process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID, ''),
        INSTAGRAM_ACCESS_TOKEN: mode === 'meta-messaging'
          ? pickValue(values.accessToken, process.env.INSTAGRAM_ACCESS_TOKEN, '')
          : pickValue(undefined, process.env.INSTAGRAM_ACCESS_TOKEN, ''),
        INSTAGRAM_WEBHOOK_VERIFY_TOKEN: mode === 'meta-messaging'
          ? pickValue(values.webhookVerifyToken, process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN, '')
          : pickValue(undefined, process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN, ''),
        INSTAGRAM_ALLOWED_RECIPIENT_IDS: pickValue(values.allowedRecipientIds, process.env.INSTAGRAM_ALLOWED_RECIPIENT_IDS, ''),
        INSTAGRAM_OUTBOX_DIR: pickValue(values.outboxDir, process.env.INSTAGRAM_OUTBOX_DIR, path.resolve(projectRoot, 'data', 'instagram-bridge', 'outbox')),
        INSTAGRAM_STATUS_FILE: pickValue(values.statusFile, process.env.INSTAGRAM_STATUS_FILE, path.resolve(projectRoot, 'data', 'runtime', 'instagram-status.json')),
        ZAVORTH_CHANNEL_POLICY_INSTAGRAM_OPEN: 'false',
        ZAVORTH_CHANNEL_POLICY_INSTAGRAM_ALLOWED: pickValue(values.allowedRecipientIds, process.env.ZAVORTH_CHANNEL_POLICY_INSTAGRAM_ALLOWED, ''),
      };
    case 'signal':
      return {
        SIGNAL_ENABLED: 'true',
        SIGNAL_TRANSPORT: 'signal-cli',
        SIGNAL_CLI_PATH: pickValue(values.cliPath, process.env.SIGNAL_CLI_PATH, 'signal-cli'),
        SIGNAL_JSONRPC_URL: pickValue(values.jsonRpcUrl, process.env.SIGNAL_JSONRPC_URL, ''),
        SIGNAL_ACCOUNT_NUMBER: pickValue(values.accountNumber, process.env.SIGNAL_ACCOUNT_NUMBER, ''),
        SIGNAL_ALLOWED_RECIPIENTS: pickValue(values.allowedRecipients, process.env.SIGNAL_ALLOWED_RECIPIENTS, ''),
        SIGNAL_OUTBOX_DIR: pickValue(values.outboxDir, process.env.SIGNAL_OUTBOX_DIR, path.resolve(projectRoot, 'data', 'signal-bridge', 'outbox')),
        SIGNAL_STATUS_FILE: pickValue(values.statusFile, process.env.SIGNAL_STATUS_FILE, path.resolve(projectRoot, 'data', 'runtime', 'signal-bridge-status.json')),
        ZAVORTH_CHANNEL_POLICY_SIGNAL_OPEN: 'false',
        ZAVORTH_CHANNEL_POLICY_SIGNAL_ALLOWED: pickValue(values.allowedRecipients, process.env.ZAVORTH_CHANNEL_POLICY_SIGNAL_ALLOWED, ''),
      };
    case 'imessage':
      return {
        IMESSAGE_ENABLED: 'true',
        IMESSAGE_BRIDGE_MODE: 'mac-bridge',
        IMESSAGE_NODE_ID: pickValue(values.nodeId, process.env.IMESSAGE_NODE_ID, ''),
        IMESSAGE_BRIDGE_SCRIPT: pickValue(values.bridgeScript, process.env.IMESSAGE_BRIDGE_SCRIPT, ''),
        IMESSAGE_ALLOWED_RECIPIENTS: pickValue(values.allowedRecipients, process.env.IMESSAGE_ALLOWED_RECIPIENTS, ''),
        IMESSAGE_READ_ONLY: pickValue(values.readOnly, process.env.IMESSAGE_READ_ONLY, 'true'),
        IMESSAGE_OUTBOX_DIR: pickValue(values.outboxDir, process.env.IMESSAGE_OUTBOX_DIR, path.resolve(projectRoot, 'data', 'imessage-bridge', 'outbox')),
        IMESSAGE_STATUS_FILE: pickValue(values.statusFile, process.env.IMESSAGE_STATUS_FILE, path.resolve(projectRoot, 'data', 'runtime', 'imessage-bridge-status.json')),
        ZAVORTH_CHANNEL_POLICY_IMESSAGE_OPEN: 'false',
        ZAVORTH_CHANNEL_POLICY_IMESSAGE_ALLOWED: pickValue(values.allowedRecipients, process.env.ZAVORTH_CHANNEL_POLICY_IMESSAGE_ALLOWED, ''),
      };
    case 'teams':
      return {
        TEAMS_ENABLED: 'true',
        TEAMS_TRANSPORT: 'graph-bot',
        TEAMS_APP_ID: pickValue(values.appId, process.env.TEAMS_APP_ID, ''),
        TEAMS_APP_PASSWORD: pickValue(values.appPassword, process.env.TEAMS_APP_PASSWORD, ''),
        TEAMS_CLIENT_SECRET: pickValue(values.clientSecret, process.env.TEAMS_CLIENT_SECRET, ''),
        TEAMS_TENANT_ID: pickValue(values.tenantId, process.env.TEAMS_TENANT_ID, ''),
        TEAMS_ALLOWED_CONVERSATION_IDS: pickValue(values.allowedConversationIds, process.env.TEAMS_ALLOWED_CONVERSATION_IDS, ''),
        TEAMS_STATUS_FILE: pickValue(values.statusFile, process.env.TEAMS_STATUS_FILE, path.resolve(projectRoot, 'data', 'runtime', 'teams-status.json')),
        ZAVORTH_CHANNEL_POLICY_TEAMS_OPEN: 'false',
        ZAVORTH_CHANNEL_POLICY_TEAMS_ALLOWED: pickValue(values.allowedConversationIds, process.env.ZAVORTH_CHANNEL_POLICY_TEAMS_ALLOWED, ''),
      };
    case 'email':
      return {
        EMAIL_ENABLED: 'true',
        EMAIL_TRANSPORT: mode === 'smtp-imap' ? 'smtp-imap' : 'local-outbox',
        EMAIL_SMTP_HOST: pickValue(values.smtpHost, process.env.EMAIL_SMTP_HOST, process.env.SMTP_HOST, ''),
        EMAIL_SMTP_PORT: pickValue(values.smtpPort, process.env.EMAIL_SMTP_PORT, '587'),
        EMAIL_SMTP_USER: pickValue(values.smtpUser, process.env.EMAIL_SMTP_USER, ''),
        EMAIL_SMTP_PASS: pickValue(values.smtpPass, process.env.EMAIL_SMTP_PASS, ''),
        EMAIL_IMAP_HOST: pickValue(values.imapHost, process.env.EMAIL_IMAP_HOST, process.env.IMAP_HOST, ''),
        EMAIL_ALLOWED_RECIPIENTS: pickValue(values.allowedRecipients, process.env.EMAIL_ALLOWED_RECIPIENTS, ''),
        EMAIL_OUTBOX_DIR: pickValue(values.outboxDir, process.env.EMAIL_OUTBOX_DIR, path.resolve(projectRoot, 'data', 'email-bridge', 'outbox')),
        EMAIL_STATUS_FILE: pickValue(values.statusFile, process.env.EMAIL_STATUS_FILE, path.resolve(projectRoot, 'data', 'runtime', 'email-status.json')),
        ZAVORTH_CHANNEL_POLICY_EMAIL_OPEN: 'false',
        ZAVORTH_CHANNEL_POLICY_EMAIL_ALLOWED: pickValue(values.allowedRecipients, process.env.ZAVORTH_CHANNEL_POLICY_EMAIL_ALLOWED, ''),
      };
    default:
      throw new Error(`Unsupported channel: ${channelId}.`);
  }
}

function ensureFilesystemScaffolding(input: {
  channelId: ChannelSetupChannelId;
  mode: ChannelSetupMode;
  values: Record<string, string | undefined>;
  projectRoot: string;
  existsSync: typeof import('fs').existsSync;
  writeFileSync: typeof import('fs').writeFileSync;
  mkdirSync: typeof import('fs').mkdirSync;
}): string[] {
  const {
    channelId,
    mode,
    values,
    projectRoot,
    existsSync,
    writeFileSync,
    mkdirSync,
  } = input;
  const touched: string[] = [];

  if (channelId === 'discord' && mode === 'bridge') {
    const secretFile = resolveDiscordBridgeSecretFile(projectRoot, values.bridgeSecretFile);
    mkdirSync(path.dirname(secretFile), { recursive: true });
    touched.push(path.dirname(secretFile));
    if (!existsSync(secretFile)) {
      const secret = String(values.bridgeSecret || '').trim() || crypto.randomBytes(24).toString('hex');
      writeFileSync(secretFile, `${secret}\n`, 'utf8');
      touched.push(secretFile);
    }
  }

  if (channelId === 'slack') {
    const outboxDir = String(values.outboxDir || config.slackOutboxDir || '').trim();
    const statusDir = path.dirname(String(values.statusFile || config.slackStatusFile || '').trim());
    if (outboxDir) {
      mkdirSync(outboxDir, { recursive: true });
      touched.push(outboxDir);
    }
    if (statusDir) {
      mkdirSync(statusDir, { recursive: true });
      touched.push(statusDir);
    }
  }

  if (channelId === 'whatsapp') {
    const outboxDir = String(values.outboxDir || config.whatsappOutboxDir || '').trim();
    const statusDir = path.dirname(String(values.statusFile || config.whatsappStatusFile || '').trim());
    if (outboxDir) {
      mkdirSync(outboxDir, { recursive: true });
      touched.push(outboxDir);
    }
    if (statusDir) {
      mkdirSync(statusDir, { recursive: true });
      touched.push(statusDir);
    }
    if (mode === 'baileys') {
      const sessionDir = pickValue(values.sessionDir, process.env.WHATSAPP_SESSION_DIR, path.resolve(projectRoot, 'data', 'whatsapp-session'));
      if (sessionDir) {
        mkdirSync(sessionDir, { recursive: true });
        touched.push(sessionDir);
      }
    }
  }

  if (channelId === 'instagram') {
    const outboxDir = String(values.outboxDir || config.instagramOutboxDir || '').trim();
    const statusDir = path.dirname(String(values.statusFile || config.instagramStatusFile || '').trim());
    if (outboxDir) {
      mkdirSync(outboxDir, { recursive: true });
      touched.push(outboxDir);
    }
    if (statusDir) {
      mkdirSync(statusDir, { recursive: true });
      touched.push(statusDir);
    }
  }

  if (channelId === 'signal' || channelId === 'imessage' || channelId === 'email') {
    const outboxDir = String(
      values.outboxDir
      || process.env[`${channelId.toUpperCase()}_OUTBOX_DIR`]
      || path.resolve(projectRoot, 'data', `${channelId}-bridge`, 'outbox'),
    ).trim();
    const statusFile = String(
      values.statusFile
      || process.env[`${channelId.toUpperCase()}_STATUS_FILE`]
      || path.resolve(projectRoot, 'data', 'runtime', `${channelId}-bridge-status.json`),
    ).trim();
    if (outboxDir) {
      mkdirSync(outboxDir, { recursive: true });
      touched.push(outboxDir);
    }
    if (statusFile) {
      mkdirSync(path.dirname(statusFile), { recursive: true });
      touched.push(path.dirname(statusFile));
    }
  }

  if (channelId === 'teams') {
    const statusFile = String(values.statusFile || process.env.TEAMS_STATUS_FILE || path.resolve(projectRoot, 'data', 'runtime', 'teams-status.json')).trim();
    if (statusFile) {
      mkdirSync(path.dirname(statusFile), { recursive: true });
      touched.push(path.dirname(statusFile));
    }
  }

  return touched;
}

function buildApplySummary(channelId: ChannelSetupChannelId, mode: ChannelSetupMode): string {
  switch (channelId) {
    case 'telegram':
      return 'Telegram is ready for final configuration in the .env file.';
    case 'discord':
      return mode === 'bridge'
        ? 'Discord bridge-first has been prepared with secret file and base policy.'
        : 'Discord native is ready for final configuration in the .env file.';
    case 'slack':
      return mode === 'native'
        ? 'Slack native is ready for final configuration in the .env file.'
        : 'Slack local local has been prepared for controlled runtime rollout.';
    case 'whatsapp':
      if (mode === 'cloud-api') {
        return 'WhatsApp Cloud API is ready for final configuration in the .env file.';
      }
      if (mode === 'baileys') {
        return 'WhatsApp Baileys is ready for local bootstrap with persistent session directory.';
      }
      return 'WhatsApp local local has been prepared for controlled runtime rollout.';
    case 'instagram':
      return mode === 'meta-messaging'
        ? 'Instagram Messaging API is ready for final configuration in the .env file.'
        : 'Instagram local local has been prepared for controlled runtime rollout.';
    case 'signal':
      return 'Signal bridge has been prepared for final signal-cli configuration.';
    case 'imessage':
      return 'iMessage Mac bridge has been prepared in experimental/read-only mode.';
    case 'teams':
      return 'Teams Graph/Bot Framework has been prepared for final configuration.';
    case 'email':
      return mode === 'smtp-imap'
        ? 'Email SMTP/IMAP has been prepared as an operational fallback.'
        : 'Email local-outbox has been prepared as an operational fallback.';
    default:
      return 'Channel prepared.';
  }
}

function buildNextSteps(channelId: ChannelSetupChannelId, mode: ChannelSetupMode): string[] {
  switch (channelId) {
    case 'telegram':
      return [
        'Fill in TELEGRAM_BOT_TOKEN and TELEGRAM_ALLOWED_USER_IDS if they are still empty.',
        'Start the supervised runtime and use /start to validate the connection.',
        'Run npm run ops:ready to verify the official host after bootstrap.',
      ];
    case 'discord':
      return mode === 'bridge'
        ? [
            'Distribute the bridge secret file securely before connecting an external relay.',
            'Review allowed guilds, channels, and owners before rollout.',
            'Run npm run test:channels:smoke when the Discord runtime is running.',
          ]
        : [
            'Fill in DISCORD_BOT_TOKEN and Discord allowlists before rollout.',
            'Review slash command exposure and operational owners.',
            'Run npm run test:channels:smoke to validate the native gateway.',
          ];
    case 'slack':
      return mode === 'native'
        ? [
            'Fill in SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET if they are still empty.',
            'Point Slack to /api/webhooks/slack and validate the webhook signature.',
            'Run npm run test:channels:smoke and then /channels broadcast-test slack.',
          ]
        : [
            'Set SLACK_ALLOWED_CHANNEL_IDS for the channels that will receive tests.',
            'Start the supervised runtime to materialize local outbox and status.',
            'Run npm run test:channels:smoke to validate the local mode of this runtime.',
          ];
    case 'whatsapp':
      if (mode === 'cloud-api') {
        return [
          'Fill in WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, and WHATSAPP_WEBHOOK_VERIFY_TOKEN if they are still empty.',
          'Register /api/webhooks/whatsapp as the Cloud API callback and validate hub.challenge.',
          'Run npm run test:channels:smoke and then /channels broadcast-test whatsapp.',
        ];
      }
      if (mode === 'baileys') {
        return [
          'Validate the local session directory before starting the Baileys provider.',
          'Set WHATSAPP_ALLOWED_CHAT_IDS for controlled rollout chats.',
          'Run npm run test:channels:smoke to validate Baileys mode in this runtime.',
        ];
      }
      return [
        'Set WHATSAPP_ALLOWED_CHAT_IDS for the chats that will receive tests.',
        'Start the supervised runtime to materialize local outbox and status.',
        'Run npm run test:channels:smoke to validate the local mode of this runtime.',
      ];
    case 'instagram':
      return mode === 'meta-messaging'
        ? [
            'Fill in INSTAGRAM_BUSINESS_ACCOUNT_ID, INSTAGRAM_ACCESS_TOKEN, and INSTAGRAM_WEBHOOK_VERIFY_TOKEN if they are still empty.',
            'Register /api/webhooks/instagram as the Instagram Messaging API callback and validate hub.challenge.',
            'Run npm run test:channels:smoke and then /channels broadcast-test instagram.',
          ]
        : [
            'Set INSTAGRAM_ALLOWED_RECIPIENT_IDS for the recipients that will receive tests.',
            'Start the supervised runtime to materialize local outbox and status.',
            'Promote to meta-messaging when the official Meta credentials are ready.',
          ];
    case 'signal':
      return [
        'Install/register signal-cli with a dedicated account.',
        'Fill in SIGNAL_ACCOUNT_NUMBER and SIGNAL_ALLOWED_RECIPIENTS.',
        'Run npm run test:channels:smoke to validate the local bridge.',
      ];
    case 'imessage':
      return [
        'Start a macOS Node Host and fill in IMESSAGE_NODE_ID.',
        'Keep IMESSAGE_READ_ONLY=true until inbound and policy are validated.',
        'Run npm run test:channels:smoke before enabling sending.',
      ];
    case 'teams':
      return [
        'Create the app/bot in Azure and fill in tenant, app id, and secret.',
        'Configure TEAMS_ALLOWED_CONVERSATION_IDS before publishing rollout.',
        'Run npm run test:channels:smoke to validate the local setup.',
      ];
    case 'email':
      return [
        'Configure EMAIL_ALLOWED_RECIPIENTS to enable the local-outbox fallback.',
        'Add SMTP when you want real outbound notifications.',
        'Add IMAP when you want email response approvals.',
        'Run npm run test:channels:smoke to validate the local setup.',
      ];
    default:
      return [];
  }
}

function resolveDiscordBridgeSecretFile(projectRoot: string, candidate: string | undefined): string {
  const normalized = String(candidate || process.env.DISCORD_BRIDGE_SECRET_FILE || '').trim();
  if (normalized) {
    return path.isAbsolute(normalized)
      ? normalized
      : path.resolve(projectRoot, normalized);
  }
  return path.resolve(projectRoot, '.zavorth', 'discord-bridge.secret');
}

function pickValue(...candidates: Array<string | undefined | null>): string {
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null) {
      return String(candidate);
    }
  }
  return '';
}

function normalizeChannelId(value: string | null | undefined): ChannelSetupChannelId {
  const normalized = String(value || '').trim().toLowerCase();
  switch (normalized) {
    case 'telegram':
    case 'discord':
    case 'slack':
    case 'whatsapp':
    case 'instagram':
    case 'signal':
    case 'imessage':
    case 'teams':
    case 'email':
      return normalized;
    default:
      throw new Error(`Unsupported channel: ${value}.`);
  }
}

function normalizeMode(value: string | null | undefined): ChannelSetupMode {
  const normalized = String(value || '').trim().toLowerCase();
  switch (normalized) {
    case 'native':
    case 'bridge':
    case 'local':
    case 'local-outbox':
    case 'cloud-api':
    case 'baileys':
    case 'meta-messaging':
    case 'signal-cli':
    case 'mac-bridge':
    case 'graph-bot':
    case 'smtp-imap':
      return normalized;
    default:
      throw new Error(`Unsupported channel mode: ${value}.`);
  }
}
