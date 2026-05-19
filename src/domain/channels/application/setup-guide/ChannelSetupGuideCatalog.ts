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
      'Signal entra via bridge local signal-cli/JSON-RPC com conta dedicada e allowlist.',
      ['SIGNAL_ENABLED', 'SIGNAL_CLI_PATH', 'SIGNAL_ACCOUNT_NUMBER', 'SIGNAL_ALLOWED_RECIPIENTS'],
      ['SIGNAL_JSONRPC_URL', 'SIGNAL_OUTBOX_DIR', 'SIGNAL_STATUS_FILE'],
    ),
    buildGenericEntry(
      capabilityService.describe('imessage'),
      'imessage',
      'iMessage',
      'mac-bridge',
      'iMessage entra como Mac bridge experimental via Node Mesh, iniciando em read-only.',
      ['IMESSAGE_ENABLED', 'IMESSAGE_NODE_ID', 'IMESSAGE_ALLOWED_RECIPIENTS'],
      ['IMESSAGE_BRIDGE_SCRIPT', 'IMESSAGE_READ_ONLY', 'IMESSAGE_OUTBOX_DIR', 'IMESSAGE_STATUS_FILE'],
    ),
    buildGenericEntry(
      capabilityService.describe('teams'),
      'teams',
      'Microsoft Teams',
      'graph-bot',
      'Teams fica preparado para Microsoft Graph/Bot Framework com tenant e conversas permitidas.',
      ['TEAMS_ENABLED', 'TEAMS_APP_ID', 'TEAMS_TENANT_ID', 'TEAMS_ALLOWED_CONVERSATION_IDS'],
      ['TEAMS_APP_PASSWORD', 'TEAMS_CLIENT_SECRET', 'TEAMS_STATUS_FILE'],
    ),
    buildGenericEntry(
      capabilityService.describe('email'),
      'email',
      'Email',
      'local-outbox',
      'Email vira fallback universal para notificacoes e approvals com local-outbox supervisionado e SMTP/IMAP opcional depois.',
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
        ? `Canais prontos agora: ${readyCount}. Canais preparados mas ainda incompletos: ${preparedCount}.`
        : preparedCount > 0
          ? `Nenhum canal esta pronto ainda, mas ${preparedCount} canal(is) ja ficaram preparados para configuracao final.`
          : 'Nenhum canal opcional foi preparado ainda; use o setup ou o setup:channels para ligar Telegram, Discord, Slack, WhatsApp, Instagram, Signal, iMessage, Teams ou Email.',
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
        ? 'Telegram ja pode operar como entrada leve de bolso.'
        : capability.configured
          ? 'Telegram ja tem parte da configuracao, mas ainda falta fechar o token ou a allowlist.'
          : 'Telegram continua sendo a melhor entrada leve para retomar, aprovar e disparar fluxos quando voce quiser ligar um canal externo.',
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
        ? 'Discord ja esta pronto para operar no contrato oficial do Channel Mesh.'
        : capability.configured
          ? 'Discord ja esta parcialmente preparado; feche token, policy ou saude do runtime antes do rollout.'
          : 'Discord pode ser preparado agora em modo native ou bridge-first, deixando o runtime pronto para configuracao final depois.',
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
    recommendedMode: config.slackBotToken ? 'native' : 'stub',
    summary:
      capability.readiness === 'ready'
        ? 'Slack ja esta pronto no runtime atual.'
        : capability.configured
          ? 'Slack ja foi preparado; faltam allowlist, credenciais finais ou rollout.'
          : 'Slack pode subir hoje em modo stub local ou ja ficar pronto para promover a Web API nativa depois.',
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
    recommendedMode: config.whatsappProvider === 'cloud-api' ? 'cloud-api' : 'stub',
    summary:
      capability.readiness === 'ready'
        ? 'WhatsApp ja esta pronto no runtime atual.'
        : capability.configured
          ? 'WhatsApp ja foi preparado; faltam chats permitidos, provider final ou rollout.'
          : 'WhatsApp pode subir hoje em modo stub local ou ja ficar pronto para Cloud API ou Baileys.',
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
    recommendedMode: config.instagramProvider === 'meta-messaging' ? 'meta-messaging' : 'stub',
    summary:
      capability.readiness === 'ready'
        ? 'Instagram ja esta pronto no runtime atual via Channel Mesh.'
        : capability.configured
          ? 'Instagram ja foi preparado; faltam recipients, webhook ou credenciais finais da Meta antes do rollout.'
          : 'Instagram pode subir hoje como outbox local governado ou ser promovido para Meta Instagram Messaging API.',
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
        ? `${label} ja esta pronto no runtime atual.`
        : capability.configured
          ? `${label} ja foi preparado; falta fechar allowlist, host ou provider antes do rollout.`
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
