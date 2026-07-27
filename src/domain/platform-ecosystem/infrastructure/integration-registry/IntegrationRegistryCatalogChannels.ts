import type { IntegrationManifest } from '../../../../contracts/IntegrationHubContract.js';
import { choice, mode, question, req, step } from './IntegrationRegistryCatalogShared.js';

export const INTEGRATION_CHANNEL_MANIFESTS: IntegrationManifest[] = [
  {
    id: 'telegram',
    label: 'Telegram',
    aliases: ['telegram-bot', 'botfather'],
    summary: 'Lightweight native channel for chatting, resuming flows, and approving operations through the Bot API.',
    description: 'Uses the native Zavorth Telegram gateway with a bot token and an operator allowlist.',
    supportLevel: 'native',
    category: 'remote',
    tags: ['channel', 'telegram', 'bot', 'operator'],
    modes: [mode('api', 'Bot API', 'Uses a @BotFather token and allowlisted operators.')],
    defaultMode: 'api',
    capabilities: ['chat', 'agents', 'automation'],
    binding: {
      kind: 'service',
      key: 'telegram',
      status: 'ready',
      summary: 'Native gateway is ready when TELEGRAM_BOT_TOKEN and operators are configured.',
    },
    requirements: [
      req('telegram_bot_token', 'Telegram bot token', 'Token created through @BotFather.', {
        type: 'env',
        secret: true,
        envKey: 'TELEGRAM_BOT_TOKEN',
      }),
      req('telegram_allowed_user_ids', 'Allowed operators', 'User ids authorized to operate Zavorth through Telegram.', {
        type: 'env',
        envKey: 'TELEGRAM_ALLOWED_USER_IDS',
      }),
      req('telegram_user_roles', 'Operator roles', 'Optional role map by user id.', {
        type: 'env',
        envKey: 'TELEGRAM_USER_ROLES',
        required: false,
      }),
    ],
    onboardingQuestions: [
      question('telegram_bot_token', 'What is the Telegram bot token...', 'secret', 'Create the bot through @BotFather and paste the token here.'),
      question(
        'telegram_allowed_user_ids',
        'Which user ids can operate this bot...',
        'text',
        'Separate values with commas. Example: 123456789,987654321.',
        {
          placeholder: '123456789,987654321',
        },
      ),
      question(
        'telegram_user_roles',
        'Do you want to register operator roles...',
        'text',
        'Optional. Example: 123:admin|operator;456:viewer',
        {
          required: false,
          placeholder: '123:admin|operator;456:viewer',
        },
      ),
    ],
    installSteps: [
      step('botfather', 'Create or review the bot', 'Confirm the bot in @BotFather and copy the correct token.', 'manual'),
      step('operators', 'Define operators', 'Choose who can operate Zavorth through Telegram.', 'guided'),
      step('doctor', 'Run channel doctor', 'Validate the native Telegram channel.', 'verification', 'npm run test:channels:smoke'),
    ],
    safetyNotes: [
      'Always restrict TELEGRAM_ALLOWED_USER_IDS before exposing the bot.',
      'Do not share the bot token outside the local .env file or secret manager.',
    ],
    goodFor: ['Fast resume flows', 'Approvals', 'Light mobile operations'],
  },
  {
    id: 'discord',
    label: 'Discord',
    aliases: ['discord-bot', 'discord-gateway'],
    summary: 'Native channel for operating Zavorth in private guilds or controlled public rollouts.',
    description: 'Uses the native Zavorth Discord gateway with conservative policy, owners, and controlled command exposure.',
    supportLevel: 'native',
    category: 'remote',
    tags: ['channel', 'discord', 'guild', 'operator'],
    modes: [mode('api', 'Discord API', 'Uses a bot token and explicit policy by guild or owner.')],
    defaultMode: 'api',
    capabilities: ['chat', 'agents', 'automation'],
    binding: {
      kind: 'service',
      key: 'discord',
      status: 'ready',
      summary: 'Native gateway is ready when the bot token and basic policy are configured.',
    },
    requirements: [
      req('discord_bot_token', 'Discord bot token', 'Bot token for the native gateway.', {
        type: 'env',
        secret: true,
        envKey: 'DISCORD_BOT_TOKEN',
      }),
      req('discord_allowed_guild_ids', 'Allowed guilds', 'Guilds authorized for private rollout.', {
        type: 'env',
        envKey: 'DISCORD_ALLOWED_GUILD_IDS',
        required: false,
      }),
      req('discord_owner_user_ids', 'Allowed owners', 'Owners for the official Discord channel.', {
        type: 'env',
        envKey: 'DISCORD_OWNER_USER_IDS',
        required: false,
      }),
      req('discord_public_server_mode', 'Public mode', 'Enables controlled public rollout in Discord.', {
        type: 'env',
        envKey: 'DISCORD_PUBLIC_SERVER_MODE',
        required: false,
      }),
      req('discord_command_exposure', 'Command exposure', 'Defines the command exposure level in Discord.', {
        type: 'env',
        envKey: 'DISCORD_COMMAND_EXPOSURE',
        required: false,
      }),
    ],
    onboardingQuestions: [
      question('discord_bot_token', 'What is the Discord bot token...', 'secret', 'Paste the bot token for the official Discord channel.'),
      question(
        'discord_allowed_guild_ids',
        'Which guild ids should be enabled first...',
        'text',
        'Optional, but recommended for a private rollout. Separate values with commas.',
        {
          required: false,
          placeholder: '123456789012345678,987654321098765432',
        },
      ),
      question(
        'discord_owner_user_ids',
        'Which owners can run sensitive commands...',
        'text',
        'Optional, but recommended outside public mode. Separate values with commas.',
        {
          required: false,
          placeholder: '123456789012345678',
        },
      ),
      question(
        'discord_public_server_mode',
        'Will this bot start in a public server...',
        'boolean',
        'When true, Zavorth applies more conservative guardrails by default.',
        {
          required: false,
        },
      ),
      question(
        'discord_command_exposure',
        'Which command exposure should Discord use...',
        'single_choice',
        'Minimal is the safest choice for the initial rollout.',
        {
          required: false,
          choices: [
            choice('none', 'None', 'Do not expose slash commands yet.'),
            choice('minimal', 'Minimal', 'Expose only basic and safe commands.'),
            choice('operator', 'Operator', 'Expand operational commands for operators.'),
          ],
        },
      ),
    ],
    installSteps: [
      step('bot', 'Prepare the Discord bot', 'Create the bot, review intents, and copy the token.', 'manual'),
      step('policy', 'Define the initial policy', 'Choose guilds, owners, and command exposure.', 'guided'),
      step('doctor', 'Run channel doctor', 'Validate the native Discord channel.', 'verification', 'npm run test:channels:smoke'),
    ],
    safetyNotes: [
      'Avoid rollout without an allowlist or with operator exposure too early.',
      'Use minimal exposure first in shared servers.',
    ],
    goodFor: ['Internal teams', 'Private servers', 'Controlled public rollout'],
  },
  {
    id: 'slack',
    label: 'Slack',
    aliases: ['slack-native', 'slack-channel'],
    summary: 'Channel for local transport rollout or native mode with the Slack Web API and official webhook.',
    description: 'Zavorth supports Slack in local transport mode for local tests and native mode for real outbound and webhook flows.',
    supportLevel: 'native',
    category: 'remote',
    tags: ['channel', 'slack', 'workspace', 'local'],
    modes: [mode('api', 'Slack Web API', 'Uses native Slack or local transport according to the selected mode.')],
    defaultMode: 'api',
    capabilities: ['chat', 'automation'],
    binding: {
      kind: 'service',
      key: 'slack',
      status: 'ready',
      summary: 'Slack enters the runtime through local or native transport, with honest doctor checks for both paths.',
    },
    requirements: [
      req('slack_enabled', 'Slack enabled', 'Enables the Slack channel in the runtime.', {
        type: 'env',
        envKey: 'SLACK_ENABLED',
      }),
      req('slack_transport', 'Slack transport', 'Defines whether the channel uses local local or native mode.', {
        type: 'env',
        envKey: 'SLACK_TRANSPORT',
      }),
      req('slack_bot_token', 'Slack bot token', 'Required when the transport is native.', {
        type: 'env',
        secret: true,
        envKey: 'SLACK_BOT_TOKEN',
        required: false,
      }),
      req('slack_signing_secret', 'Slack signing secret', 'Required when the transport is native.', {
        type: 'env',
        secret: true,
        envKey: 'SLACK_SIGNING_SECRET',
        required: false,
      }),
      req('slack_workspace_id', 'Target workspace', 'Workspace used by the local local or native rollout.', {
        type: 'env',
        envKey: 'SLACK_WORKSPACE_ID',
        required: false,
      }),
      req('slack_allowed_channel_ids', 'Allowed channels', 'Channel or channels allowed for the Slack rollout.', {
        type: 'env',
        envKey: 'SLACK_ALLOWED_CHANNEL_IDS',
        required: false,
      }),
    ],
    onboardingQuestions: [
      question('slack_enabled', 'Enable the Slack channel on this host...', 'boolean', 'The wizard sets this to true when you choose to configure Slack.', {
        required: false,
      }),
      question(
        'slack_transport',
        'Which Slack transport should be used first...',
        'single_choice',
        'Local is ideal for preparing the host before depending on the Slack Web API.',
        {
          choices: [
            choice('local', 'local transport', 'Prepares a local outbox and honest doctor without a real webhook.'),
            choice('native', 'Native', 'Uses Slack Web API and a real webhook when tokens exist.'),
          ],
        },
      ),
      question('slack_workspace_id', 'Which Slack workspace is the target...', 'text', 'Optional in local transport mode; useful to identify the rollout target.', {
        required: false,
        placeholder: 'T12345678',
      }),
      question('slack_allowed_channel_ids', 'Which channels should be enabled first...', 'text', 'Optional in local transport mode; recommended in native mode. Separate values with commas.', {
        required: false,
        placeholder: 'C12345678,C98765432',
      }),
      question('slack_bot_token', 'What is the Slack bot token...', 'secret', 'Fill this when you want to use native transport.', {
        required: false,
      }),
      question('slack_signing_secret', 'What is the Slack signing secret...', 'secret', 'Fill this when you want to validate the native webhook.', {
        required: false,
      }),
    ],
    installSteps: [
      step('transport', 'Choose transport', 'Decide between local transport and native rollout.', 'guided'),
      step('credentials', 'Add Slack credentials', 'Fill bot token and signing secret when transport is native.', 'manual'),
      step('doctor', 'Run channel doctor', 'Validate Slack local or native mode on the current host.', 'verification', 'npm run test:channels:smoke'),
    ],
    safetyNotes: [
      'Use local transport mode to prepare the host before opening a real webhook.',
      'In native mode, keep an allowlist of channels from the first rollout.',
    ],
    goodFor: ['Internal teams', 'local smoke tests', 'Progressive channel rollout'],
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    aliases: ['whatsapp-cloud-api', 'whatsapp-baileys'],
    summary: 'Channel rollout through local transport, official Cloud API, or Baileys provider.',
    description: 'Zavorth can prepare WhatsApp in local transport, Cloud API, or Baileys mode, with honest doctor checks for each provider.',
    supportLevel: 'native',
    category: 'remote',
    tags: ['channel', 'whatsapp', 'cloud-api', 'baileys', 'local'],
    modes: [mode('api', 'WhatsApp provider', 'Uses local transport, Cloud API, or Baileys according to the selected provider.')],
    defaultMode: 'api',
    capabilities: ['chat', 'automation'],
    binding: {
      kind: 'service',
      key: 'whatsapp',
      status: 'ready',
      summary: 'WhatsApp enters the runtime through local transport, Cloud API, or Baileys, with honest doctor checks for each path.',
    },
    requirements: [
      req('whatsapp_enabled', 'WhatsApp enabled', 'Enables the WhatsApp channel in the runtime.', {
        type: 'env',
        envKey: 'WHATSAPP_ENABLED',
      }),
      req('whatsapp_provider', 'WhatsApp provider', 'Defines the active provider: local, cloud-api, or baileys.', {
        type: 'env',
        envKey: 'WHATSAPP_PROVIDER',
      }),
      req('whatsapp_allowed_chat_ids', 'Allowed chats', 'Chats or groups allowed for operational rollout.', {
        type: 'env',
        envKey: 'WHATSAPP_ALLOWED_CHAT_IDS',
        required: false,
      }),
      req('whatsapp_phone_number_id', 'Phone number id', 'Required when the provider is Cloud API.', {
        type: 'env',
        envKey: 'WHATSAPP_PHONE_NUMBER_ID',
        required: false,
      }),
      req('whatsapp_access_token', 'Access token', 'Required when the provider is Cloud API.', {
        type: 'env',
        secret: true,
        envKey: 'WHATSAPP_ACCESS_TOKEN',
        required: false,
      }),
      req('whatsapp_webhook_verify_token', 'Webhook verify token', 'Required when the provider is Cloud API.', {
        type: 'env',
        secret: true,
        envKey: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
        required: false,
      }),
      req('whatsapp_session_dir', 'Persistent session', 'Required when the provider is Baileys.', {
        type: 'env',
        envKey: 'WHATSAPP_SESSION_DIR',
        required: false,
      }),
    ],
    onboardingQuestions: [
      question('whatsapp_enabled', 'Enable the WhatsApp channel on this host...', 'boolean', 'The wizard sets this to true when you choose to configure WhatsApp.', {
        required: false,
      }),
      question(
        'whatsapp_provider',
        'Which WhatsApp provider should be used first...',
        'single_choice',
        'Local is fastest for preparing the host; Cloud API is the official path; Baileys stays local.',
        {
          choices: [
            choice('local', 'local transport', 'Prepares the host without external credentials first.'),
            choice('cloud-api', 'Cloud API', 'Uses real Meta/WhatsApp Cloud API webhooks and outbound messages.'),
            choice('baileys', 'Baileys', 'Uses a local provider with a persistent session.'),
          ],
        },
      ),
      question('whatsapp_allowed_chat_ids', 'Which chats should be enabled first...', 'text', 'Optional in local transport mode; recommended for real rollout. Separate values with commas.', {
        required: false,
        placeholder: '5511999999999,operations-group',
      }),
      question('whatsapp_phone_number_id', 'What is the Cloud API phone number id...', 'text', 'Fill this when the selected provider is cloud-api.', {
        required: false,
      }),
      question('whatsapp_access_token', 'What is the Cloud API access token...', 'secret', 'Fill this when the selected provider is cloud-api.', {
        required: false,
      }),
      question('whatsapp_webhook_verify_token', 'What is the webhook verify token...', 'secret', 'Fill this when the selected provider is cloud-api.', {
        required: false,
      }),
      question('whatsapp_session_dir', 'Which session directory should Baileys use...', 'text', 'Fill this when the selected provider is Baileys.', {
        required: false,
        placeholder: 'data/whatsapp-baileys/session',
      }),
    ],
    installSteps: [
      step('provider', 'Choose provider', 'Decide between local transport, Cloud API, or Baileys.', 'guided'),
      step('credentials', 'Add provider credentials', 'Fill credentials or persistent session settings when required.', 'manual'),
      step('doctor', 'Run channel doctor', 'Validate the selected provider on the current host.', 'verification', 'npm run test:channels:smoke'),
    ],
    safetyNotes: [
      'Use local transport mode to prepare the host before opening a real Cloud API webhook.',
      'For Baileys, keep the persistent session outside ephemeral directories.',
    ],
    goodFor: ['Progressive rollout', 'Operational chat', 'local validation before an official provider'],
  },
];
