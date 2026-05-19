import { config } from '../../config/index.js';
import {
  PlatformCapability,
  PlatformKey,
} from '../../contracts/PlatformContract.js';
import type {
  CapabilityDescriptor,
  PlatformCapabilityRuntime,
} from './PlatformCapabilityTypes.js';

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
        transport: 'stub',
        envKeys: [],
        notes: ['Platform not recognized by the capability service.'],
      };
  }
}

function describeInstagram(runtime: PlatformCapabilityRuntime): CapabilityDescriptor {
  const provider = String(config.instagramProvider || 'stub').trim().toLowerCase();
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
    implementationState: metaSelected ? 'full' : configured ? 'partial' : 'stub',
    readiness: runtimeReady && policyReady && (metaSelected || status?.mode === 'stub')
      ? 'ready'
      : configured
        ? 'partial'
        : 'planned',
    configured,
    transport: metaSelected ? 'webhook' : configured ? 'local' : 'stub',
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
              ? runtimeReady
                ? 'Instagram Messaging API esta configurada e o runtime ja confirmou webhook/outbound via Meta Graph.'
                : 'Instagram Messaging API foi escolhida como provider-alvo e ja tem credenciais minimas para webhook/outbound.'
              : 'Instagram Messaging API foi escolhida como provider-alvo, mas faltam business account id, access token ou verify token.'
            : 'Instagram segue em modo local supervisionado enquanto as credenciais oficiais da Meta nao sao conectadas.',
          runtimeReady
            ? 'Instagram runtime esta saudavel e aceita testes de outbound controlados nos recipients permitidos.'
            : 'Instagram ja tem hints de runtime, mas ainda depende de policy, webhook ou bootstrap final.',
          policyReady
            ? `Rollout por recipient ativo para ${allowedRecipients.length} recipient(s) do Instagram.`
            : 'Configure INSTAGRAM_ALLOWED_RECIPIENT_IDS antes de prometer broadcast operacional no mesh.',
          metaSelected
            ? 'Use a Meta Instagram Messaging API apenas com conta profissional/Business autorizada e app aprovado.'
            : 'O stub local explicita que Instagram ainda nao esta mandando DM real sem provider oficial.',
          status?.lastError
            ? `Ultimo erro do runtime do Instagram: ${status.lastError}`
            : 'O runtime do Instagram fica governado por webhook, allowlist e receipts antes de envio real.',
        ]
      : [
          'Instagram agora possui trilha de runtime no Zavorth, mas permanece desativado ate receber provider e credenciais validas.',
          'Defina INSTAGRAM_PROVIDER=meta-messaging e credenciais da Meta para ativar webhook, outbound e doctor oficial.',
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
    implementationState: nativeConfigured ? 'full' : configured ? 'partial' : 'stub',
    readiness: policyReady && runtimeReady ? 'ready' : configured ? 'partial' : 'planned',
    configured,
    transport: nativeConfigured ? 'native' : configured ? 'local' : 'stub',
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
              ? nativeConfigured
                ? 'Discord native gateway is configured and the runtime is healthy.'
                : 'Discord bridge-first adapter is enabled and the local relay runtime is healthy.'
              : nativeConfigured
                ? 'Discord native gateway is configured, but the runtime is not healthy yet.'
                : 'Discord bridge-first adapter is configured, but the local relay runtime is not healthy yet.'
            : nativeConfigured
              ? 'Discord native gateway is present, mas a policy de guild/DM ainda nao esta completa.'
              : 'Discord bridge-first adapter is present, mas a policy de guild/DM ainda nao esta completa.',
          runtimeStatus?.lastError
            ? `Ultimo erro do runtime do Discord: ${runtimeStatus.lastError}`
            : 'Runtime readiness depends on the Discord status snapshot on disk.',
          config.discordAllowedChannelIds.length > 0
            ? `Rollout por canal ativo para ${config.discordAllowedChannelIds.length} canal(is) do Discord.`
            : config.discordPublicServerMode
              ? 'Modo de servidor publico ativo: configure DISCORD_ALLOWED_CHANNEL_IDS antes de liberar o Discord.'
              : 'Sem allowlist por canal; prefira DISCORD_ALLOWED_CHANNEL_IDS em servidores movimentados.',
          `Exposicao atual de slash commands: ${config.discordCommandExposure}.`,
          config.discordRequireOwnerForOperational
            ? config.discordOwnerUserIds.length > 0
              ? `Operacao sensivel do Discord esta owner-only para ${config.discordOwnerUserIds.length} owner(s).`
              : 'Operacao sensivel do Discord esta owner-only, mas DISCORD_OWNER_USER_IDS ainda nao foi configurado.'
            : `Operacao sensivel pode usar operator IDs (${config.discordOperatorUserIds.length} configurado(s)).`,
          config.discordPublicServerMode
            ? config.discordAllowAttachmentsInPublicServerMode
              ? 'Servidor publico do Discord permite anexos por policy; revise isso com cuidado.'
              : 'Servidor publico do Discord bloqueia anexos por padrao para reduzir abuso e prompt injection.'
            : 'Guardrails de servidor publico do Discord ficam disponiveis para rollout seguro.',
          nativeConfigured
            ? 'Native Discord client is preferred when DISCORD_BOT_TOKEN is configured.'
            : 'Transport remains local relay for now; a native Discord client is still pending.',
        ]
      : [
          'Discord ja possui trilha de runtime no Zavorth, mas permanece desativado ate receber credenciais e policy validas.',
          'Defina DISCORD_BOT_TOKEN ou habilite a bridge local com as allowlists adequadas para ativar inbound, outbound e doctor oficial.',
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
    provider !== 'stub' ||
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
      : configured
        ? 'partial'
        : 'stub';

  return {
    platform: 'whatsapp',
    implementationState,
    readiness:
      runtimeReady && policyReady && (provider === 'stub' || runtimeStatus?.provider === provider)
        ? 'ready'
        : configured
          ? 'partial'
          : 'planned',
    configured,
    transport: provider === 'cloud-api' ? 'webhook' : configured ? 'local' : 'stub',
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
                ? 'WhatsApp Cloud API esta configurada e o runtime ja confirmou inbound/outbound oficial pelo webhook da Meta.'
                : 'WhatsApp Cloud API foi escolhida como provider-alvo e ja tem credenciais minimas para plugar webhook/outbound.'
              : 'WhatsApp Cloud API foi escolhida como provider-alvo, mas ainda faltam phone number id, access token ou webhook verify token.'
            : provider === 'baileys'
              ? providerConfigured
                ? 'WhatsApp Baileys foi escolhido como provider-alvo e ja tem session dir para a proximo passo do adapter.'
                : 'WhatsApp Baileys foi escolhido como provider-alvo, mas WHATSAPP_SESSION_DIR ainda nao foi definido.'
              : 'WhatsApp segue em modo local supervisionado enquanto o provider oficial nao e conectado.',
          runtimeReady
            ? runtimeStatus?.mode === 'cloud-api'
              ? 'WhatsApp Cloud API esta saudavel e ja pode receber webhook e enviar mensagens reais nos chats permitidos.'
              : 'WhatsApp runtime local supervisionado esta saudavel e aceita testes de outbound controlados.'
            : 'WhatsApp ja tem hints de runtime, mas ainda depende de policy ou bootstrap final.',
          policyReady
            ? `Rollout por chat ativo para ${config.whatsappAllowedChatIds.length} chat(s) do WhatsApp.`
            : 'Configure WHATSAPP_ALLOWED_CHAT_IDS antes de prometer broadcast operacional no mesh.',
          runtimeStatus?.providerDecision
            ? runtimeStatus.providerDecision
            : 'Escolha explicita de provider evita prender o rollout em um unico caminho tecnico.',
          runtimeStatus?.sessionDirConfigured
            ? `Session dir configurado em ${config.whatsappSessionDir || 'modo padrao'}.`
            : provider === 'baileys'
              ? 'WHATSAPP_SESSION_DIR ainda nao foi definido; o provider Baileys ainda nao consegue subir sessao persistente.'
              : 'WHATSAPP_SESSION_DIR ainda nao foi definido; o runtime local supervisionado segue usando fila local controlada.',
          runtimeStatus?.lastError
            ? `Ultimo erro do runtime do WhatsApp: ${runtimeStatus.lastError}`
            : runtimeStatus?.mode === 'cloud-api'
              ? 'O runtime do WhatsApp usa a Meta Cloud API para webhook, reply e broadcast reais.'
              : 'O runtime do WhatsApp registra entregas controladas na fila local supervisionada antes de um provider real.',
        ]
      : [
          'WhatsApp ja possui trilha de runtime no Zavorth, mas permanece desativado ate receber provider e credenciais validas.',
          'Defina WHATSAPP_PROVIDER e as credenciais do provider escolhido para ativar webhook, outbound e doctor oficial.',
        ],
  };
}

function describeSlack(runtime: PlatformCapabilityRuntime): CapabilityDescriptor {
  const nativeConfigured = Boolean(String(config.slackBotToken || '').trim());
  const nativeSelected = nativeConfigured && config.slackTransport !== 'stub';
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
    implementationState: nativeConfigured ? 'full' : configured ? 'partial' : 'stub',
    readiness: runtimeReady && policyReady ? 'ready' : configured ? 'partial' : 'planned',
    configured,
    transport:
      runtimeStatus?.transport === 'native'
        ? 'native'
        : nativeSelected
          ? 'native'
          : configured
            ? 'local'
            : 'stub',
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
              ? 'Slack nativo esta configurado e o runtime ja confirmou outbound real pela Web API.'
              : 'Slack nativo foi habilitado, mas ainda falta confirmar a saude do runtime ou completar o bootstrap final.'
            : nativeConfigured
              ? 'Slack tem bot token disponivel, mas segue em modo local supervisionado por escolha explicita de transporte.'
              : 'Slack segue com runtime local supervisionado enquanto o modo nativo nao e forcado pelo token.',
          runtimeReady
            ? runtimeStatus?.mode === 'native'
              ? 'Slack native outbound esta saudavel e ja pode emitir mensagens reais nos canais permitidos.'
              : 'Slack runtime local supervisionado esta saudavel e aceita testes de outbound controlados.'
            : 'Slack ja tem hints de runtime, mas ainda depende de policy ou bootstrap final.',
          policyReady
            ? `Rollout por canal ativo para ${config.slackAllowedChannelIds.length} canal(is) do Slack.`
            : 'Configure SLACK_ALLOWED_CHANNEL_IDS antes de prometer broadcast operacional no mesh.',
          runtimeStatus?.workspaceConfigured
            ? `Workspace do Slack configurado em ${config.slackWorkspaceId || 'modo padrao'}.`
            : 'SLACK_WORKSPACE_ID ainda nao foi definido; o runtime local supervisionado segue usando fila local controlada.',
          runtimeStatus?.apiBaseUrl
            ? `Slack Web API apontando para ${runtimeStatus.apiBaseUrl}.`
            : nativeSelected
              ? `Slack Web API apontando para ${config.slackApiBaseUrl}.`
              : 'Sem endpoint Web API configurado para o modo nativo do Slack.',
          runtimeStatus?.lastError
            ? `Ultimo erro do runtime do Slack: ${runtimeStatus.lastError}`
            : runtimeStatus?.mode === 'native'
              ? 'O runtime do Slack usa chat.postMessage para entrega real quando o bot token esta presente.'
              : 'O runtime do Slack registra entregas controladas na fila local supervisionada antes de um provider real.',
        ]
      : [
          'Slack ja possui trilha de runtime no Zavorth, mas permanece desativado ate receber token ou transporte configurado.',
          'Defina SLACK_TRANSPORT e SLACK_BOT_TOKEN para ativar outbound nativo e o doctor oficial do Slack.',
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
    transport: configured ? 'bridge' : 'stub',
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
          'Signal e tratado como bridge local via signal-cli/JSON-RPC, com dependencia externa nao oficial.',
          accountConfigured
            ? 'Conta dedicada do Signal foi configurada ou confirmada pelo snapshot.'
            : 'Configure SIGNAL_ACCOUNT_NUMBER antes de aceitar mensagens reais.',
          bridgeConfigured
            ? 'Bridge signal-cli/JSON-RPC tem hints suficientes para doctor local.'
            : 'Configure SIGNAL_CLI_PATH ou SIGNAL_JSONRPC_URL para ativar a bridge.',
          allowedRecipients.length > 0
            ? `Rollout por recipient ativo para ${allowedRecipients.length} recipient(s) do Signal.`
            : 'Configure SIGNAL_ALLOWED_RECIPIENTS antes de habilitar envio ou inbound.',
          status?.lastError
            ? `Ultimo erro do runtime do Signal: ${status.lastError}`
            : 'Use doctor local antes de ampliar o rollout porque Signal nao expoe Bot API oficial.',
        ]
      : [
          'Signal esta no roadmap executavel do Channel Mesh como bridge local via signal-cli.',
          'Prepare conta dedicada, signal-cli daemon/JSON-RPC e allowlist antes de habilitar.',
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
    transport: configured ? 'bridge' : 'stub',
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
          'iMessage e tratado como Mac bridge experimental via Node Mesh/macOS, nao como API server-side publica.',
          macHostReady
            ? 'Host macOS confirmado pelo snapshot ou pelo runtime local.'
            : 'Ainda falta confirmar um Node Host macOS antes de enviar mensagens.',
          allowedRecipients.length > 0
            ? `Rollout por recipient ativo para ${allowedRecipients.length} contato(s) do iMessage.`
            : 'Configure IMESSAGE_ALLOWED_RECIPIENTS antes de sair do modo read-only.',
          runtime.envBoolean('IMESSAGE_READ_ONLY', true)
            ? 'Modo read-only continua como padrao seguro para a bridge.'
            : 'Envio foi habilitado por env; mantenha approval/trust por recipient.',
          status?.lastError
            ? `Ultimo erro do runtime do iMessage: ${status.lastError}`
            : 'Use approval explicito antes de qualquer envio pela bridge.',
        ]
      : [
          'iMessage esta no roadmap executavel como Mac bridge experimental via Node Mesh.',
          'Suba um Node Host macOS, mantenha read-only inicialmente e configure allowlist de recipients.',
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
    transport: configured ? 'webhook' : 'stub',
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
          'Teams esta preparado como proximo canal corporativo via Microsoft Graph/Bot Framework.',
          credentialsConfigured
            ? 'Credenciais de app/tenant do Teams estao presentes ou confirmadas pelo snapshot.'
            : 'Configure TEAMS_APP_ID, TEAMS_TENANT_ID e secret antes de habilitar webhooks reais.',
          allowedConversations.length > 0
            ? `Rollout por conversa ativo para ${allowedConversations.length} conversa(s) do Teams.`
            : 'Configure TEAMS_ALLOWED_CONVERSATION_IDS antes de abrir o rollout.',
          status?.lastError
            ? `Ultimo erro do runtime do Teams: ${status.lastError}`
            : 'Use doctor local/Graph antes de publicar para um tenant real.',
        ]
      : [
          'Teams esta mapeado como canal corporativo planejado depois do Slack.',
          'O modo alvo e Microsoft Graph/Bot Framework com tenant, app id e conversas permitidas.',
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
    transport: smtpConfigured ? 'native' : configured ? 'local' : 'stub',
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
          'Email funciona como fallback universal para notificacoes e aprovacoes quando chat real nao esta pronto.',
          smtpConfigured
            ? 'SMTP tem host configurado para outbound.'
            : 'SMTP ainda nao esta configurado; o canal pode operar em local-outbox supervisionado.',
          imapConfigured
            ? 'IMAP tem host configurado para inbound/approval polling.'
            : 'IMAP e opcional no primeiro rollout; inbound por resposta pode entrar depois.',
          allowedRecipients.length > 0
            ? `Rollout por recipient ativo para ${allowedRecipients.length} email(s).`
            : 'Configure EMAIL_ALLOWED_RECIPIENTS antes de permitir envio.',
          status?.lastError
            ? `Ultimo erro do runtime de Email: ${status.lastError}`
            : 'Use doctor local antes de habilitar aprovacoes por email.',
        ]
      : [
          'Email esta mapeado como fallback planejado para notificacao e approval.',
          'Configure allowlist de recipients; SMTP continua opcional para sair de local-outbox para outbound real.',
        ],
  };
}
