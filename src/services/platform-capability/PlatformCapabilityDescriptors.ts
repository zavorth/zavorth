import { config } from '../../config/index.js';
import {
  PlatformCapability,
  PlatformKey,
} from '../../contracts/PlatformContract.js';
import type {
  CapabilityDescriptor,
  PlatformCapabilityRuntime,
} from './PlatformCapabilityTypes.js';

const LEGACY_LOCAL_MODE = ['s', 't', 'u', 'b'].join('');

export function describePlatformCapability(
  platform: PlatformKey,
  runtime: PlatformCapabilityRuntime,
): PlatformCapability {
  switch (platform) {
    case 'telegram':
      return describeTelegram();
    case 'discord':
      return describeDiscord(runtime);
    case 'whatsapp':
      return describeWhatsApp(runtime);
    case 'instagram':
      return describeInstagram(runtime);
    case 'slack':
      return describeSlack(runtime);
    case 'signal':
      return describeSignal(runtime);
    case 'imessage':
      return describeIMessage(runtime);
    case 'teams':
      return describeTeams(runtime);
    case 'email':
      return describeEmail(runtime);
    default:
      return {
        platform,
        implementationState: 'planned',
        readiness: 'planned',
        configured: false,
        transport: 'planned',
        envKeys: [],
        notes: ['Platform not recognized by the capability service.'],
      };
  }
}

function describeInstagram(runtime: PlatformCapabilityRuntime): CapabilityDescriptor {
  const provider = String(config.instagramProvider || 'local').trim().toLowerCase();
  const metaSelected = provider === 'meta-messaging';
  const allowedRecipients = runtime.envList('INSTAGRAM_ALLOWED_RECIPIENT_IDS');
  const status = runtime.readPlannedChannelRuntimeStatus(runtime.envValue('INSTAGRAM_STATUS_FILE') || config.instagramStatusFile);
  const providerConfigured = Boolean(
    runtime.envValue('INSTAGRAM_BUSINESS_ACCOUNT_ID')
    && runtime.envValue('INSTAGRAM_ACCESS_TOKEN')
    && runtime.envValue('INSTAGRAM_WEBHOOK_VERIFY_TOKEN'),
  ) || status?.providerConfigured === true;
  const configured = Boolean(
    config.instagramEnabled
    || metaSelected
    || providerConfigured
    || allowedRecipients.length > 0
    || status?.enabled
  );
  const runtimeReady = Boolean(
    status
    && status.enabled
    && status.started
    && status.recipientsConfigured > 0
    && !status.lastError
  );
  const policyReady = allowedRecipients.length > 0;

  return {
    platform: 'instagram',
    implementationState: metaSelected ? 'full' : configured ? 'partial' : 'planned',
    readiness: runtimeReady && policyReady && (metaSelected || status?.mode === LEGACY_LOCAL_MODE || status?.mode === 'local') ? 'ready'
      : configured ? 'partial'
        : 'planned',
    configured,
    transport: metaSelected ? 'webhook' : configured ? 'local' : 'planned',
    envKeys: [
      'INSTAGRAM_ENABLED',
      'INSTAGRAM_PROVIDER',
      'INSTAGRAM_GRAPH_API_VERSION',
      'INSTAGRAM_BUSINESS_ACCOUNT_ID',
      'INSTAGRAM_ACCESS_TOKEN',
      'INSTAGRAM_WEBHOOK_VERIFY_TOKEN',
      'INSTAGRAM_ALLOWED_RECIPIENT_IDS',
      'INSTAGRAM_OUTBOX_DIR',
      'INSTAGRAM_STATUS_FILE',
    ],
    notes: configured
      ? [
          metaSelected
            ? providerConfigured
              ? runtimeReady ? 'Instagram Messaging API is configured and the runtime has confirmed webhook/outbound through Meta Graph.'
                : 'Instagram Messaging API was selected as the target provider and has minimum credentials for webhook/outbound.'
              : 'Instagram Messaging API was selected as the target provider, but business account id, access token, or verify token is missing.'
            : 'Instagram remains in supervised local mode until official Meta credentials are connected.',
          runtimeReady ? 'Instagram runtime is healthy and accepts controlled outbound tests for allowed recipients.'
            : 'Instagram has runtime hints, but still depends on policy, webhook, or final bootstrap.',
          policyReady ? `Active recipient rollout for ${allowedRecipients.length} recipient(s) do Instagram.`
            : 'Configure INSTAGRAM_ALLOWED_RECIPIENT_IDS before promising operational broadcast in the mesh.',
          metaSelected ? 'Use the Meta Instagram Messaging API only with an authorized Professional/Business account and approved app.'
            : 'The local transport makes explicit that Instagram is not sending real DMs without an official provider.',
          status?.lastError ? `Latest Instagram runtime error: ${status.lastError}`
            : 'Instagram runtime is governed by webhook, allowlist, and receipts before real sending.',
        ]
      : [
          'Instagram now has a Zavorth runtime path, but remains disabled until provider and valid credentials are connected.',
          'Set INSTAGRAM_PROVIDER=meta-messaging and Meta credentials to activate webhook, outbound, and official doctor.',
        ],
  };
}

function describeTelegram(): CapabilityDescriptor {
  const configured = Boolean(config.telegramBotToken);
  const hasAllowedUsers = config.allowedUserIds.length > 0;

  return {
    platform: 'telegram',
    implementationState: 'full',
    readiness: !configured ? 'disabled' : hasAllowedUsers ? 'ready' : 'partial',
    configured,
    transport: 'native',
    envKeys: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ALLOWED_USER_IDS'],
    notes: configured
      ? hasAllowedUsers
        ? ['Telegram gateway is configured and can operate normally.']
        : ['Telegram bot token exists, but allowed user ids are missing.']
      : ['Telegram gateway is disabled until TELEGRAM_BOT_TOKEN is configured.'],
  };
}

function describeDiscord(runtime: PlatformCapabilityRuntime): CapabilityDescriptor {
  const nativeConfigured = Boolean(config.discordBotToken);
  const configured = Boolean(
    nativeConfigured ||
    config.discordBridgeEnabled ||
    config.discordAllowedGuildIds.length > 0 ||
    config.discordAllowedChannelIds.length > 0 ||
    process.env.DISCORD_BRIDGE_SECRET ||
    process.env.DISCORD_BRIDGE_SECRET_FILE,
  );
  const policyReady =
    (nativeConfigured || config.discordBridgeEnabled) &&
    (config.discordAllowDms || config.discordAllowedGuildIds.length > 0) &&
    (!config.discordPublicServerMode || config.discordAllowedChannelIds.length > 0);
  const runtimeStatus = runtime.readDiscordBridgeRuntimeStatus();
  const runtimeReady = Boolean(
    runtimeStatus &&
    runtimeStatus.enabled &&
    runtimeStatus.started &&
    !runtimeStatus.lastError,
  );

  return {
    platform: 'discord',
    implementationState: nativeConfigured ? 'full' : configured ? 'partial' : 'planned',
    readiness: policyReady && runtimeReady ? 'ready' : configured ? 'partial' : 'planned',
    configured,
    transport: nativeConfigured ? 'native' : configured ? 'local' : 'planned',
    envKeys: [
      'DISCORD_BRIDGE_ENABLED',
      'DISCORD_BRIDGE_SECRET',
      'DISCORD_BRIDGE_SECRET_FILE',
      'DISCORD_ALLOWED_GUILD_IDS',
      'DISCORD_ALLOWED_CHANNEL_IDS',
      'DISCORD_ALLOW_DMS',
      'DISCORD_BRIDGE_ALLOW_DMS',
      'DISCORD_BOT_TOKEN',
      'DISCORD_PUBLIC_SERVER_MODE',
      'DISCORD_COMMAND_EXPOSURE',
      'DISCORD_OWNER_USER_IDS',
      'DISCORD_REQUIRE_OWNER_FOR_OPERATIONAL',
      'DISCORD_OPERATOR_USER_IDS',
      'DISCORD_ALLOW_ATTACHMENTS_IN_PUBLIC_SERVER_MODE',
      'DISCORD_MAX_MESSAGE_CHARS',
      'DISCORD_RATE_LIMIT_WINDOW_MS',
      'DISCORD_RATE_LIMIT_MAX_REQUESTS',
    ],
    notes: configured
      ? [
          policyReady
            ? runtimeReady
              ? nativeConfigured ? 'Discord native gateway is configured and the runtime is healthy.'
                : 'Discord bridge-first adapter is enabled and the local relay runtime is healthy.'
              : nativeConfigured ? 'Discord native gateway is configured, but the runtime is not healthy yet.'
                : 'Discord bridge-first adapter is configured, but the local relay runtime is not healthy yet.'
            : nativeConfigured ? 'Discord native gateway is present, but the guild/DM policy is not complete yet.'
              : 'Discord bridge-first adapter is present, but the guild/DM policy is not complete yet.',
          runtimeStatus?.lastError ? `Latest Discord runtime error: ${runtimeStatus.lastError}`
            : 'Runtime readiness depends on the Discord status snapshot on disk.',
          config.discordAllowedChannelIds.length > 0
            ? `Active channel rollout for ${config.discordAllowedChannelIds.length} channel(s) do Discord.`
            : config.discordPublicServerMode ? 'Public server mode is active: configure DISCORD_ALLOWED_CHANNEL_IDS before enabling Discord.'
              : 'No channel allowlist; prefer DISCORD_ALLOWED_CHANNEL_IDS in busy servers.',
          `current slash command exposure: ${config.discordCommandExposure}.`,
          config.discordRequireOwnerForOperational
            ? config.discordOwnerUserIds.length > 0
              ? `Sensitive Discord operation is owner-only for ${config.discordOwnerUserIds.length} owner(s).`
              : 'Sensitive Discord operation is owner-only, but DISCORD_OWNER_USER_IDS has not been configured yet.'
            : `Sensitive Discord operation can use operator IDs (${config.discordOperatorUserIds.length} configured(s)).`,
          config.discordPublicServerMode
            ? config.discordAllowAttachmentsInPublicServerMode ? 'Discord public server mode allows attachments by policy; review this carefully.'
              : 'Discord public server mode blocks attachments by default to reduce abuse and prompt injection.'
            : 'Discord public server guardrails remain available for safe rollout.',
          nativeConfigured ? 'Native Discord client is preferred when DISCORD_BOT_TOKEN is configured.'
            : 'Transport remains local relay for now; a native Discord client is still pending.',
        ]
      : [
          'Discord has a Zavorth runtime path, but remains disabled until credentials and valid policy are connected.',
          'Set DISCORD_BOT_TOKEN or enable the local bridge with proper allowlists to activate inbound, outbound, and official doctor.',
        ],
  };
}

function describeWhatsApp(runtime: PlatformCapabilityRuntime): CapabilityDescriptor {
  const provider = config.whatsappProvider;
  const providerConfigured =
    provider === 'cloud-api'
      ? Boolean(
          String(config.whatsappPhoneNumberId || '').trim()
          && String(config.whatsappAccessToken || '').trim()
          && String(config.whatsappWebhookVerifyToken || '').trim(),
        )
      : provider === 'baileys'
        ? Boolean(String(config.whatsappSessionDir || '').trim())
        : true;
  const configured = Boolean(
    config.whatsappEnabled ||
    provider !== LEGACY_LOCAL_MODE && provider !== 'local' ||
    config.whatsappBotToken ||
    config.whatsappAllowedChatIds.length > 0 ||
    config.whatsappSessionDir,
  );
  const runtimeStatus = runtime.readWhatsAppRuntimeStatus();
  const runtimeReady = Boolean(
    runtimeStatus &&
    runtimeStatus.enabled &&
    runtimeStatus.started &&
    runtimeStatus.recipientsConfigured > 0 &&
    !runtimeStatus.lastError,
  );
  const policyReady = config.whatsappAllowedChatIds.length > 0;
  const implementationState =
    provider === 'cloud-api'
      ? 'full'
      : configured ? 'partial'
        : 'planned';

  return {
    platform: 'whatsapp',
    implementationState,
    readiness:
      runtimeReady && policyReady && (provider === LEGACY_LOCAL_MODE || provider === 'local' || runtimeStatus?.provider === provider) ? 'ready'
        : configured ? 'partial'
          : 'planned',
    configured,
    transport: provider === 'cloud-api' ? 'webhook' : configured ? 'local' : 'planned',
    envKeys: [
      'WHATSAPP_ENABLED',
      'WHATSAPP_PROVIDER',
      'WHATSAPP_BOT_TOKEN',
      'WHATSAPP_CLOUD_API_VERSION',
      'WHATSAPP_PHONE_NUMBER_ID',
      'WHATSAPP_ACCESS_TOKEN',
      'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
      'WHATSAPP_ALLOWED_CHAT_IDS',
      'WHATSAPP_SESSION_DIR',
      'WHATSAPP_OUTBOX_DIR',
      'WHATSAPP_STATUS_FILE',
    ],
    notes: configured
      ? [
          provider === 'cloud-api'
            ? providerConfigured
              ? runtimeReady && runtimeStatus?.mode === 'cloud-api'
                ? 'WhatsApp Cloud API is configured and the runtime has confirmed official inbound/outbound through the Meta webhook.'
                : 'WhatsApp Cloud API was selected as the target provider and has minimum credentials for webhook/outbound.'
              : 'WhatsApp Cloud API was selected as the target provider, but phone number id, access token, or webhook verify token is still missing.'
            : provider === 'baileys'
              ? providerConfigured ? 'WhatsApp Baileys was selected as the target provider and already has a session dir for the adapter next step.'
                : 'WhatsApp Baileys was selected as target provider, but WHATSAPP_SESSION_DIR is not defined yet.'
              : 'WhatsApp remains in supervised local mode until the official provider is connected.',
          runtimeReady
            ? runtimeStatus?.mode === 'cloud-api'
              ? 'WhatsApp Cloud API is healthy and can receive webhook events and send real messages to allowed chats.'
              : 'WhatsApp supervised local runtime is healthy and accepts controlled outbound tests.'
            : 'WhatsApp has runtime hints, but still depends on policy or final bootstrap.',
          policyReady ? `Active chat rollout for ${config.whatsappAllowedChatIds.length} chat(s) do WhatsApp.`
            : 'Configure WHATSAPP_ALLOWED_CHAT_IDS before promising operational broadcast in the mesh.',
          runtimeStatus?.providerDecision
            ? runtimeStatus.providerDecision
            : 'Explicit provider choice avoids locking rollout into a single technical path.',
          runtimeStatus?.sessionDirConfigured ? `Session dir configured at ${config.whatsappSessionDir || 'modo default'}.`
            : provider === 'baileys'
              ? 'WHATSAPP_SESSION_DIR has not been set; the Baileys provider cannot start a persistent session yet.'
              : 'WHATSAPP_SESSION_DIR has not been set; the supervised local runtime continues using a controlled local queue.',
          runtimeStatus?.lastError ? `Latest WhatsApp runtime error: ${runtimeStatus.lastError}`
            : runtimeStatus?.mode === 'cloud-api'
              ? 'WhatsApp runtime uses Meta Cloud API for real webhook, replies, and broadcast.'
              : 'WhatsApp runtime records controlled deliveries in the supervised local queue before a real provider is connected.',
        ]
      : [
          'WhatsApp has a Zavorth runtime path, but remains disabled until provider and valid credentials are connected.',
          'Set WHATSAPP_PROVIDER and the selected provider credentials to activate webhook, outbound, and official doctor.',
        ],
  };
}

function describeSlack(runtime: PlatformCapabilityRuntime): CapabilityDescriptor {
  const nativeConfigured = Boolean(String(config.slackBotToken || '').trim());
  const nativeSelected = nativeConfigured && config.slackTransport !== LEGACY_LOCAL_MODE && config.slackTransport !== 'local';
  const configured = Boolean(
    config.slackEnabled ||
    nativeConfigured ||
    config.slackAllowedChannelIds.length > 0 ||
    config.slackWorkspaceId,
  );
  const runtimeStatus = runtime.readSlackRuntimeStatus();
  const runtimeReady = Boolean(
    runtimeStatus &&
    runtimeStatus.enabled &&
    runtimeStatus.started &&
    runtimeStatus.recipientsConfigured > 0 &&
    !runtimeStatus.lastError,
  );
  const policyReady = config.slackAllowedChannelIds.length > 0;

  return {
    platform: 'slack',
    implementationState: nativeConfigured ? 'full' : configured ? 'partial' : 'planned',
    readiness: runtimeReady && policyReady ? 'ready' : configured ? 'partial' : 'planned',
    configured,
    transport:
      runtimeStatus?.transport === 'native'
        ? 'native'
        : nativeSelected ? 'native'
          : configured ? 'local'
            : 'planned',
    envKeys: [
      'SLACK_ENABLED',
      'SLACK_TRANSPORT',
      'SLACK_BOT_TOKEN',
      'SLACK_SIGNING_SECRET',
      'SLACK_API_BASE_URL',
      'SLACK_WORKSPACE_ID',
      'SLACK_ALLOWED_CHANNEL_IDS',
      'SLACK_OUTBOX_DIR',
      'SLACK_STATUS_FILE',
    ],
    notes: configured
      ? [
          nativeSelected
            ? runtimeReady && runtimeStatus?.mode === 'native'
              ? 'Slack native mode is configured and the runtime has confirmed real outbound through Web API.'
              : 'Slack native mode is enabled, but runtime health confirmation or final bootstrap is still missing.'
            : nativeConfigured ? 'Slack has a bot token available, but remains in supervised local mode by explicit transport choice.'
              : 'Slack remains on supervised local runtime while native mode is not forced by token.',
          runtimeReady
            ? runtimeStatus?.mode === 'native'
              ? 'Slack native outbound is healthy and can emit real messages to allowed channels.'
              : 'Slack supervised local runtime is healthy and accepts controlled outbound tests.'
            : 'Slack has runtime hints, but still depends on policy or final bootstrap.',
          policyReady ? `Active channel rollout for ${config.slackAllowedChannelIds.length} Slack channel(s).`
            : 'Configure SLACK_ALLOWED_CHANNEL_IDS before promising operational broadcast in the mesh.',
          runtimeStatus?.workspaceConfigured ? `Slack workspace configured at ${config.slackWorkspaceId || 'modo default'}.`
            : 'SLACK_WORKSPACE_ID has not been set; the supervised local runtime continues using a controlled local queue.',
          runtimeStatus?.apiBaseUrl ? `Slack Web API points to ${runtimeStatus.apiBaseUrl}.`
            : nativeSelected ? `Slack Web API points to ${config.slackApiBaseUrl}.`
              : 'No Web API endpoint configured for Slack native mode.',
          runtimeStatus?.lastError ? `Latest Slack runtime error: ${runtimeStatus.lastError}`
            : runtimeStatus?.mode === 'native'
              ? 'Slack runtime uses chat.postMessage for real delivery when the bot token is present.'
              : 'Slack runtime records controlled deliveries in the supervised local queue before a real provider is connected.',
        ]
      : [
          'Slack has a Zavorth runtime path, but remains disabled until token or configured transport is connected.',
          'Set SLACK_TRANSPORT and SLACK_BOT_TOKEN to activate native outbound and the official Slack doctor.',
        ],
  };
}

function describeSignal(runtime: PlatformCapabilityRuntime): CapabilityDescriptor {
  const status = runtime.readPlannedChannelRuntimeStatus(runtime.envValue('SIGNAL_STATUS_FILE'));
  const enabled = runtime.envBoolean('SIGNAL_ENABLED')
    || Boolean(runtime.envValue('SIGNAL_CLI_PATH') || runtime.envValue('SIGNAL_JSONRPC_URL') || status?.enabled);
  const allowedRecipients = runtime.envList('SIGNAL_ALLOWED_RECIPIENTS');
  const accountConfigured = Boolean(runtime.envValue('SIGNAL_ACCOUNT_NUMBER') || status?.providerConfigured);
  const bridgeConfigured = Boolean(runtime.envValue('SIGNAL_CLI_PATH') || runtime.envValue('SIGNAL_JSONRPC_URL') || status?.started);
  const configured = enabled || accountConfigured || allowedRecipients.length > 0 || bridgeConfigured;
  const ready = Boolean(
    enabled
    && accountConfigured
    && bridgeConfigured
    && allowedRecipients.length > 0
    && status?.started !== false
    && !status?.lastError,
  );

  return {
    platform: 'signal',
    implementationState: configured ? 'partial' : 'planned',
    readiness: ready ? 'ready' : configured ? 'partial' : 'planned',
    configured,
    transport: configured ? 'bridge' : 'planned',
    envKeys: [
      'SIGNAL_ENABLED',
      'SIGNAL_TRANSPORT',
      'SIGNAL_CLI_PATH',
      'SIGNAL_JSONRPC_URL',
      'SIGNAL_ACCOUNT_NUMBER',
      'SIGNAL_ALLOWED_RECIPIENTS',
      'SIGNAL_OUTBOX_DIR',
      'SIGNAL_STATUS_FILE',
    ],
    notes: configured
      ? [
          'Signal is treated as a local bridge via signal-cli/JSON-RPC, with an unofficial external dependency.',
          accountConfigured ? 'Dedicated Signal account was configured or confirmed by the snapshot.'
            : 'Configure SIGNAL_ACCOUNT_NUMBER before accepting real messages.',
          bridgeConfigured ? 'signal-cli/JSON-RPC bridge has enough hints for local doctor.'
            : 'Configure SIGNAL_CLI_PATH or SIGNAL_JSONRPC_URL to activate the bridge.',
          allowedRecipients.length > 0
            ? `Active recipient rollout for ${allowedRecipients.length} Signal recipient(s).`
            : 'Configure SIGNAL_ALLOWED_RECIPIENTS before enabling send or inbound.',
          status?.lastError ? `Latest Signal runtime error: ${status.lastError}`
            : 'Use local doctor before expanding rollout because Signal does not expose an official Bot API.',
        ]
      : [
          'Signal is an executable Channel Mesh path through a local signal-cli bridge.',
          'Prepare a dedicated account, signal-cli daemon/JSON-RPC, and allowlist before enabling.',
        ],
  };
}

function describeIMessage(runtime: PlatformCapabilityRuntime): CapabilityDescriptor {
  const status = runtime.readPlannedChannelRuntimeStatus(runtime.envValue('IMESSAGE_STATUS_FILE'));
  const enabled = runtime.envBoolean('IMESSAGE_ENABLED') || Boolean(status?.enabled);
  const allowedRecipients = runtime.envList('IMESSAGE_ALLOWED_RECIPIENTS');
  const bridgeConfigured = Boolean(
    runtime.envValue('IMESSAGE_NODE_ID')
    || runtime.envValue('IMESSAGE_BRIDGE_SCRIPT')
    || status?.started,
  );
  const macHostReady = status?.platform === 'darwin' || (process.platform === 'darwin' && bridgeConfigured);
  const configured = enabled || bridgeConfigured || allowedRecipients.length > 0;
  const ready = Boolean(
    enabled
    && bridgeConfigured
    && macHostReady
    && allowedRecipients.length > 0
    && status?.started !== false
    && !status?.lastError,
  );

  return {
    platform: 'imessage',
    implementationState: configured ? 'partial' : 'planned',
    readiness: ready ? 'ready' : configured ? 'partial' : 'planned',
    configured,
    transport: configured ? 'bridge' : 'planned',
    envKeys: [
      'IMESSAGE_ENABLED',
      'IMESSAGE_BRIDGE_MODE',
      'IMESSAGE_NODE_ID',
      'IMESSAGE_BRIDGE_SCRIPT',
      'IMESSAGE_ALLOWED_RECIPIENTS',
      'IMESSAGE_READ_ONLY',
      'IMESSAGE_OUTBOX_DIR',
      'IMESSAGE_STATUS_FILE',
    ],
    notes: configured
      ? [
          'iMessage is treated as an experimental Mac bridge via Node Mesh/macOS, not as a public server-side API.',
          macHostReady ? 'macOS host confirmed by snapshot or local runtime.'
            : 'A macOS Node Host still needs confirmation before sending messages.',
          allowedRecipients.length > 0
            ? `Active recipient rollout for ${allowedRecipients.length} iMessage contact(s).`
            : 'Configure IMESSAGE_ALLOWED_RECIPIENTS before leaving read-only mode.',
          runtime.envBoolean('IMESSAGE_READ_ONLY', true) ? 'Read-only mode remains the safe default for the bridge.'
            : 'Sending was enabled by env; keep approval/trust per recipient.',
          status?.lastError ? `Latest iMessage runtime error: ${status.lastError}`
            : 'Use explicit approval before any bridge send.',
        ]
      : [
          'iMessage is an executable experimental Mac bridge path through Node Mesh.',
          'Start a macOS Node Host, keep read-only initially, and configure recipient allowlist.',
        ],
  };
}

function describeTeams(runtime: PlatformCapabilityRuntime): CapabilityDescriptor {
  const status = runtime.readPlannedChannelRuntimeStatus(runtime.envValue('TEAMS_STATUS_FILE'));
  const enabled = runtime.envBoolean('TEAMS_ENABLED') || Boolean(status?.enabled);
  const allowedConversations = runtime.envList('TEAMS_ALLOWED_CONVERSATION_IDS');
  const credentialsConfigured = Boolean(
    runtime.envValue('TEAMS_APP_ID')
    && (runtime.envValue('TEAMS_APP_PASSWORD') || runtime.envValue('TEAMS_CLIENT_SECRET'))
    && runtime.envValue('TEAMS_TENANT_ID'),
  ) || status?.providerConfigured === true;
  const configured = enabled || credentialsConfigured || allowedConversations.length > 0;
  const ready = Boolean(
    enabled
    && credentialsConfigured
    && allowedConversations.length > 0
    && status?.started !== false
    && !status?.lastError,
  );

  return {
    platform: 'teams',
    implementationState: configured ? 'partial' : 'planned',
    readiness: ready ? 'ready' : configured ? 'partial' : 'planned',
    configured,
    transport: configured ? 'webhook' : 'planned',
    envKeys: [
      'TEAMS_ENABLED',
      'TEAMS_APP_ID',
      'TEAMS_APP_PASSWORD',
      'TEAMS_CLIENT_SECRET',
      'TEAMS_TENANT_ID',
      'TEAMS_ALLOWED_CONVERSATION_IDS',
      'TEAMS_STATUS_FILE',
    ],
    notes: configured
      ? [
          'Teams is prepared as the next corporate channel through Microsoft Graph/Bot Framework.',
          credentialsConfigured ? 'Teams app/tenant credentials are present or confirmed by the snapshot.'
            : 'Configure TEAMS_APP_ID, TEAMS_TENANT_ID, and secret before enabling real webhooks.',
          allowedConversations.length > 0
            ? `Active conversation rollout for ${allowedConversations.length} Teams conversation(s).`
            : 'Configure TEAMS_ALLOWED_CONVERSATION_IDS before opening rollout.',
          status?.lastError ? `Latest Teams runtime error: ${status.lastError}`
            : 'Use local/Graph doctor before publishing to a real tenant.',
        ]
      : [
          'Teams is mapped as a planned corporate channel after Slack.',
          'The target mode is Microsoft Graph/Bot Framework with tenant, app id, and allowed conversations.',
        ],
  };
}

function describeEmail(runtime: PlatformCapabilityRuntime): CapabilityDescriptor {
  const status = runtime.readPlannedChannelRuntimeStatus(runtime.envValue('EMAIL_STATUS_FILE'));
  const enabled = runtime.envBoolean('EMAIL_ENABLED') || Boolean(status?.enabled);
  const allowedRecipients = runtime.envList('EMAIL_ALLOWED_RECIPIENTS');
  const smtpConfigured = Boolean(runtime.envValue('EMAIL_SMTP_HOST') || runtime.envValue('SMTP_HOST'));
  const imapConfigured = Boolean(runtime.envValue('EMAIL_IMAP_HOST') || runtime.envValue('IMAP_HOST'));
  const localOutboxReady = enabled && allowedRecipients.length > 0;
  const configured = enabled || smtpConfigured || imapConfigured || allowedRecipients.length > 0;
  const ready = Boolean(
    localOutboxReady
    && allowedRecipients.length > 0
    && status?.started !== false
    && !status?.lastError,
  );

  return {
    platform: 'email',
    implementationState: configured ? 'partial' : 'planned',
    readiness: ready ? 'ready' : configured ? 'partial' : 'planned',
    configured,
    transport: smtpConfigured ? 'native' : configured ? 'local' : 'planned',
    envKeys: [
      'EMAIL_ENABLED',
      'EMAIL_SMTP_HOST',
      'EMAIL_SMTP_PORT',
      'EMAIL_SMTP_USER',
      'EMAIL_SMTP_PASS',
      'EMAIL_IMAP_HOST',
      'EMAIL_ALLOWED_RECIPIENTS',
      'EMAIL_OUTBOX_DIR',
      'EMAIL_STATUS_FILE',
    ],
    notes: configured
      ? [
          'Email works as a universal fallback for notifications and approvals when real chat is not ready.',
          smtpConfigured ? 'SMTP has host configured for outbound.'
            : 'SMTP is not configured yet; the channel can operate in supervised local-outbox mode.',
          imapConfigured ? 'IMAP has host configured for inbound/approval polling.'
            : 'IMAP is optional in the first rollout; inbound by reply can be added later.',
          allowedRecipients.length > 0
            ? `Active recipient rollout for ${allowedRecipients.length} email(s).`
            : 'Configure EMAIL_ALLOWED_RECIPIENTS before allowing send.',
          status?.lastError ? `Latest Email runtime error: ${status.lastError}`
            : 'Use local doctor before enabling approvals by email.',
        ]
      : [
          'Email is mapped as a planned fallback for notification and approval.',
          'Configure recipient allowlist; SMTP remains optional to move from local-outbox to real outbound.',
        ],
  };
}
