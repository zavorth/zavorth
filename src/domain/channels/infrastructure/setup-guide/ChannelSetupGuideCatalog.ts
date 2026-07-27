import { config } from '../../../../config/index.js';
import type { PlatformCapability } from '../../../../contracts/PlatformContract.js';
import type {
  ChannelSetupCatalogEntry,
  ChannelSetupCatalogReport,
  ChannelSetupChannelId,
  ChannelSetupMode,
} from '../../domain/ChannelSetupGuideTypes.js';

type BuildChannelSetupCatalogInput = {
  capabilityService: {
    describe: (channelId: ChannelSetupChannelId) => PlatformCapability;
  };
  now: () => Date;
};

export function buildChannelSetupCatalog({
  capabilityService,
  now,
}: BuildChannelSetupCatalogInput): ChannelSetupCatalogReport {
  const entries: ChannelSetupCatalogEntry[] = [
    buildTelegramEntry(capabilityService.describe('telegram')),
    buildDiscordEntry(capabilityService.describe('discord')),
    buildSlackEntry(capabilityService.describe('slack')),
    buildWhatsAppEntry(capabilityService.describe('whatsapp')),
    buildInstagramEntry(capabilityService.describe('instagram')),
    buildGenericEntry(
      capabilityService.describe('signal'),
      'signal',
      'Signal',
      'signal-cli',
      'Signal connects via local signal-cli/JSON-RPC bridge with a dedicated account and allowlist.',
      ['SIGNAL_ENABLED', 'SIGNAL_CLI_PATH', 'SIGNAL_ACCOUNT_NUMBER', 'SIGNAL_ALLOWED_RECIPIENTS'],
      ['SIGNAL_JSONRPC_URL', 'SIGNAL_OUTBOX_DIR', 'SIGNAL_STATUS_FILE'],
    ),
    buildGenericEntry(
      capabilityService.describe('imessage'),
      'imessage',
      'iMessage',
      'mac-bridge',
      'iMessage connects as an experimental Mac bridge via Node Mesh, starting in read-only mode.',
      ['IMESSAGE_ENABLED', 'IMESSAGE_NODE_ID', 'IMESSAGE_ALLOWED_RECIPIENTS'],
      ['IMESSAGE_BRIDGE_SCRIPT', 'IMESSAGE_READ_ONLY', 'IMESSAGE_OUTBOX_DIR', 'IMESSAGE_STATUS_FILE'],
    ),
    buildGenericEntry(
      capabilityService.describe('teams'),
      'teams',
      'Microsoft Teams',
      'graph-bot',
      'Teams is prepared for Microsoft Graph/Bot Framework with tenant and allowed conversations.',
      ['TEAMS_ENABLED', 'TEAMS_APP_ID', 'TEAMS_TENANT_ID', 'TEAMS_ALLOWED_CONVERSATION_IDS'],
      ['TEAMS_APP_PASSWORD', 'TEAMS_CLIENT_SECRET', 'TEAMS_STATUS_FILE'],
    ),
    buildGenericEntry(
      capabilityService.describe('email'),
      'email',
      'Email',
      'local-outbox',
      'Email serves as a universal fallback for notifications and approvals with supervised local-outbox and optional SMTP/IMAP later.',
      ['EMAIL_ENABLED', 'EMAIL_ALLOWED_RECIPIENTS'],
      ['EMAIL_SMTP_PORT', 'EMAIL_SMTP_USER', 'EMAIL_SMTP_PASS', 'EMAIL_IMAP_HOST', 'EMAIL_OUTBOX_DIR', 'EMAIL_STATUS_FILE'],
    ),
  ];
  const readyCount = entries.filter((entry) => entry.status === 'ready').length;
  const preparedCount = entries.filter((entry) => entry.status === 'prepared').length;

  return {
    generatedAt: now().toISOString(),
    command: 'npm run setup:channels',
    summary:
      readyCount > 0
        ? `Channels ready now: ${readyCount}. Channels prepared but still incomplete: ${preparedCount}.`
        : preparedCount > 0
          ? `No channel is ready yet, but ${preparedCount} channel(s) have been prepared for final configuration.`
          : 'No optional channels have been prepared yet; use the setup or setup:channels command to enable Telegram, Discord, Slack, WhatsApp, Instagram, Signal, iMessage, Teams, or Email.',
    entries,
  };
}

function buildTelegramEntry(capability: PlatformCapability): ChannelSetupCatalogEntry {
  return {
    channelId: 'telegram',
    label: 'Telegram',
    status: resolveStatus(capability),
    configured: capability.configured,
    currentMode: resolveCurrentMode(capability),
    recommendedMode: 'native',
    summary:
      capability.readiness === 'ready'
        ? 'Telegram is ready to operate as a lightweight entry point.'
        : capability.configured ? 'Telegram has part of the configuration, but the token or allowlist still needs to be finalized.'
          : 'Telegram remains the best lightweight entry point for resuming, approving, and triggering flows whenever you want to enable an external channel.',
    setupCommand: 'npm run setup:channels',
    doctorCommand: 'npm run ops:ready',
    docsPath: 'docs/telegram.md',
    webhookPath: null,
    envKeys: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ALLOWED_USER_IDS'],
    requiredEnvKeys: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ALLOWED_USER_IDS'],
    optionalEnvKeys: ['TELEGRAM_USER_ROLES'],
    notes: capability.notes,
  };
}

function buildDiscordEntry(capability: PlatformCapability): ChannelSetupCatalogEntry {
  return {
    channelId: 'discord',
    label: 'Discord',
    status: resolveStatus(capability),
    configured: capability.configured,
    currentMode: resolveCurrentMode(capability),
    recommendedMode: 'native',
    summary:
      capability.readiness === 'ready'
        ? 'Discord is ready to operate under the official Channel Mesh contract.'
        : capability.configured ? 'Discord is partially prepared; finalize token, policy, or runtime health before rollout.'
          : 'Discord can be prepared now in native or bridge-first mode, leaving the runtime ready for final configuration later.',
    setupCommand: 'npm run setup:channels',
    doctorCommand: 'npm run test:channels:smoke',
    docsPath: 'docs/channel-mesh.md',
    webhookPath: null,
    envKeys: capability.envKeys,
    requiredEnvKeys: ['DISCORD_BOT_TOKEN', 'DISCORD_ALLOWED_GUILD_IDS'],
    optionalEnvKeys: ['DISCORD_ALLOWED_CHANNEL_IDS', 'DISCORD_OWNER_USER_IDS', 'DISCORD_BRIDGE_SECRET_FILE'],
    notes: capability.notes,
  };
}

function buildSlackEntry(capability: PlatformCapability): ChannelSetupCatalogEntry {
  return {
    channelId: 'slack',
    label: 'Slack',
    status: resolveStatus(capability),
    configured: capability.configured,
    currentMode: resolveCurrentMode(capability),
    recommendedMode: config.slackBotToken ? 'native' : 'local',
    summary:
      capability.readiness === 'ready'
        ? 'Slack is ready in the current runtime.'
        : capability.configured ? 'Slack has been prepared; allowlists, final credentials, or rollout still needed.'
          : 'Slack can be started today in local local mode or prepared to promote to native Web API later.',
    setupCommand: 'npm run setup:channels',
    doctorCommand: 'npm run test:channels:smoke',
    docsPath: 'docs/channel-mesh.md',
    webhookPath: '/api/webhooks/slack',
    envKeys: capability.envKeys,
    requiredEnvKeys: ['SLACK_ALLOWED_CHANNEL_IDS'],
    optionalEnvKeys: ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'SLACK_WORKSPACE_ID'],
    notes: capability.notes,
  };
}

function buildWhatsAppEntry(capability: PlatformCapability): ChannelSetupCatalogEntry {
  return {
    channelId: 'whatsapp',
    label: 'WhatsApp',
    status: resolveStatus(capability),
    configured: capability.configured,
    currentMode: resolveCurrentMode(capability),
    recommendedMode: config.whatsappProvider === 'cloud-api' ? 'cloud-api' : 'local',
    summary:
      capability.readiness === 'ready'
        ? 'WhatsApp is ready in the current runtime.'
        : capability.configured ? 'WhatsApp has been prepared; allowed chats, final provider, or rollout still needed.'
          : 'WhatsApp can be started today in local local mode or prepared for Cloud API or Baileys.',
    setupCommand: 'npm run setup:channels',
    doctorCommand: 'npm run test:channels:smoke',
    docsPath: 'docs/channel-mesh.md',
    webhookPath: '/api/webhooks/whatsapp',
    envKeys: capability.envKeys,
    requiredEnvKeys: ['WHATSAPP_ALLOWED_CHAT_IDS'],
    optionalEnvKeys: ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_WEBHOOK_VERIFY_TOKEN', 'WHATSAPP_SESSION_DIR'],
    notes: capability.notes,
  };
}

function buildInstagramEntry(capability: PlatformCapability): ChannelSetupCatalogEntry {
  return {
    channelId: 'instagram',
    label: 'Instagram',
    status: resolveStatus(capability),
    configured: capability.configured,
    currentMode: resolveCurrentMode(capability),
    recommendedMode: config.instagramProvider === 'meta-messaging' ? 'meta-messaging' : 'local',
    summary:
      capability.readiness === 'ready'
        ? 'Instagram is ready in the current runtime via Channel Mesh.'
        : capability.configured ? 'Instagram has been prepared; recipients, webhook, or final Meta credentials still needed before rollout.'
          : 'Instagram can be started today as a governed local outbox or promoted to Meta Instagram Messaging API.',
    setupCommand: 'npm run setup:channels',
    doctorCommand: 'npm run test:channels:smoke',
    docsPath: 'docs/channel-mesh.md',
    webhookPath: '/api/webhooks/instagram',
    envKeys: capability.envKeys,
    requiredEnvKeys: ['INSTAGRAM_ALLOWED_RECIPIENT_IDS'],
    optionalEnvKeys: [
      'INSTAGRAM_PROVIDER',
      'INSTAGRAM_BUSINESS_ACCOUNT_ID',
      'INSTAGRAM_ACCESS_TOKEN',
      'INSTAGRAM_WEBHOOK_VERIFY_TOKEN',
      'INSTAGRAM_OUTBOX_DIR',
      'INSTAGRAM_STATUS_FILE',
    ],
    notes: capability.notes,
  };
}

function buildGenericEntry(
  capability: PlatformCapability,
  channelId: Extract<ChannelSetupChannelId, 'signal' | 'imessage' | 'teams' | 'email'>,
  label: string,
  recommendedMode: ChannelSetupMode,
  fallbackSummary: string,
  requiredEnvKeys: string[],
  optionalEnvKeys: string[],
): ChannelSetupCatalogEntry {
  return {
    channelId,
    label,
    status: resolveStatus(capability),
    configured: capability.configured,
    currentMode: resolveCurrentMode(capability),
    recommendedMode,
    summary:
      capability.readiness === 'ready'
        ? `${label} is ready in the current runtime.`
        : capability.configured ? `${label} has been prepared; finalize allowlist, host, or provider before rollout.`
          : fallbackSummary,
    setupCommand: 'npm run setup:channels',
    doctorCommand: 'npm run test:channels:smoke',
    docsPath: 'docs/channel-mesh.md',
    webhookPath: channelId === 'teams' ? '/api/webhooks/teams' : null,
    envKeys: capability.envKeys,
    requiredEnvKeys,
    optionalEnvKeys,
    notes: capability.notes,
  };
}

function resolveStatus(capability: PlatformCapability): ChannelSetupCatalogEntry['status'] {
  if (capability.readiness === 'ready') {
    return 'ready';
  }
  if (capability.configured) {
    return 'prepared';
  }
  return 'needs-config';
}

function resolveCurrentMode(capability: PlatformCapability): string {
  return capability.configured ? capability.transport : 'none';
}
