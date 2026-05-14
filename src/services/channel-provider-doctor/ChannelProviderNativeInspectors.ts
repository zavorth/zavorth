import { config } from '../../config/index.js';
import type { ChannelProviderDoctorItem } from '../ChannelProviderDoctorService.js';

type ChannelCapabilityLifecycleHint = {
  dormant: boolean;
  notes: string | null;
};

type NativeInspectorDeps = {
  localOnly: boolean;
  fetchImpl: typeof fetch | null;
  readStatusFile: (filePath: string) => Record<string, any> | null;
  safeReadJson: (response: Response) => Promise<Record<string, any> | null>;
  readCapabilityLifecycleHint: (capabilityId: string) => ChannelCapabilityLifecycleHint;
};

export async function inspectTelegramChannel(
  deps: Pick<NativeInspectorDeps, 'localOnly' | 'fetchImpl' | 'safeReadJson'>,
): Promise<ChannelProviderDoctorItem> {
  const enabled = Boolean(String(config.telegramBotToken || '').trim());
  if (!enabled) {
    return {
      channelId: 'telegram',
      mode: 'unknown',
      enabled: false,
      configured: false,
      status: 'skipped',
      summary: 'Telegram nativo nao esta habilitado neste runtime.',
      error: null,
      recommendedAction: null,
      details: ['Defina TELEGRAM_BOT_TOKEN para ativar o doctor oficial do Telegram.'],
    };
  }

  if ((config.allowedUserIds || []).length < 1) {
    return {
      channelId: 'telegram',
      mode: 'native',
      enabled: true,
      configured: false,
      status: 'failed',
      summary: 'Telegram nativo esta habilitado, mas ainda faltam prerequisitos operacionais.',
      error: 'Campos ausentes: TELEGRAM_ALLOWED_USER_IDS.',
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Telegram exige bot token e ao menos um operador permitido.'],
    };
  }

  if (deps.localOnly || !deps.fetchImpl) {
    return {
      channelId: 'telegram',
      mode: 'native',
      enabled: true,
      configured: true,
      status: 'passed',
      summary: 'Telegram nativo validado localmente pela configuracao do operador.',
      error: null,
      recommendedAction: null,
      details: [`Operadores permitidos: ${config.allowedUserIds.length}.`],
    };
  }

  try {
    const response = await deps.fetchImpl(
      `https://api.telegram.org/bot${String(config.telegramBotToken || '').trim()}/getMe`,
      {
        method: 'GET',
      },
    );
    const payload = await deps.safeReadJson(response);
    if (!response.ok || payload?.ok !== true || !payload?.result?.id) {
      throw new Error(typeof payload?.description === 'string' ? payload.description : `HTTP ${response.status}`);
    }

    return {
      channelId: 'telegram',
      mode: 'native',
      enabled: true,
      configured: true,
      status: 'passed',
      summary: 'Telegram nativo validado por getMe e pela policy de operadores.',
      error: null,
      recommendedAction: null,
      details: [
        `Bot id: ${String(payload.result.id)}.`,
        `Operadores permitidos: ${config.allowedUserIds.length}.`,
      ],
    };
  } catch (error: any) {
    return {
      channelId: 'telegram',
      mode: 'native',
      enabled: true,
      configured: true,
      status: 'failed',
      summary: 'Telegram nativo falhou no probe remoto do Bot API.',
      error: error?.message || String(error),
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Revise o bot token e a reachability da Telegram Bot API.'],
    };
  }
}

export async function inspectDiscordChannel(deps: NativeInspectorDeps): Promise<ChannelProviderDoctorItem> {
  const status = deps.readStatusFile(config.discordBridgeStatusFile);
  const lifecycle = deps.readCapabilityLifecycleHint('discord');
  const mode: ChannelProviderDoctorItem['mode'] = String(config.discordBotToken || '').trim()
    ? 'native'
    : (config.discordBridgeEnabled ? 'bridge' : 'unknown');
  const enabled = Boolean(String(config.discordBotToken || '').trim() || config.discordBridgeEnabled);

  if (mode !== 'native') {
    return {
      channelId: 'discord',
      mode,
      enabled,
      configured: false,
      status: 'skipped',
      summary: 'Discord nativo nao esta habilitado neste runtime.',
      error: null,
      recommendedAction: null,
      details: ['Defina DISCORD_BOT_TOKEN para ativar o doctor oficial do Discord nativo.'],
    };
  }

  const missing: string[] = [];
  if ((config.discordAllowedGuildIds || []).length < 1 && !config.discordPublicServerMode) {
    missing.push('DISCORD_ALLOWED_GUILD_IDS');
  }
  if ((config.discordOwnerUserIds || []).length < 1 && !config.discordPublicServerMode) {
    missing.push('DISCORD_OWNER_USER_IDS');
  }

  if (missing.length > 0) {
    return {
      channelId: 'discord',
      mode,
      enabled,
      configured: false,
      status: 'failed',
      summary: 'Discord nativo esta habilitado, mas ainda faltam prerequisitos operacionais.',
      error: `Campos ausentes: ${missing.join(', ')}.`,
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Discord native exige bot token e escopo de operacao explicito.'],
    };
  }

  if (status?.enabled === true && status?.started === false) {
    if (!config.discordRequiredOnBoot) {
      return {
        channelId: 'discord',
        mode,
        enabled,
        configured: true,
        status: 'skipped',
        summary: lifecycle.dormant
          ? 'Discord nativo esta configurado, mas dormente no perfil atual.'
          : 'Discord nativo esta configurado, mas continua opcional no perfil atual.',
        error: null,
        recommendedAction: null,
        details: [
          lifecycle.notes || 'Discord nao e obrigatorio no boot deste perfil e pode ficar desligado ate o usuario precisar dele.',
          'Ligue o gateway do Discord apenas quando houver uso real desse canal ou quando o rollout exigir prewarm explicito.',
        ],
      };
    }

    return {
      channelId: 'discord',
      mode,
      enabled,
      configured: true,
      status: 'failed',
      summary: 'Discord nativo ainda nao confirmou runtime pronto.',
      error: 'O snapshot do Discord indica started=false.',
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Suba o gateway do Discord e confirme o status do bridge/runtime.'],
    };
  }

  if (typeof status?.lastError === 'string' && status.lastError.trim()) {
    return {
      channelId: 'discord',
      mode,
      enabled,
      configured: true,
      status: 'failed',
      summary: 'Discord nativo registrou erro recente.',
      error: status.lastError,
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Revise o ultimo erro do snapshot antes de ampliar o rollout.'],
    };
  }

  if (deps.localOnly || !deps.fetchImpl) {
    return {
      channelId: 'discord',
      mode,
      enabled,
      configured: true,
      status: 'passed',
      summary: 'Discord nativo validado localmente pela configuracao e pelo snapshot do runtime.',
      error: null,
      recommendedAction: null,
      details: [
        `Guilds permitidas: ${config.discordAllowedGuildIds.length}.`,
        `Owners permitidos: ${config.discordOwnerUserIds.length}.`,
      ],
    };
  }

  try {
    const response = await deps.fetchImpl('https://discord.com/api/v10/users/@me', {
      method: 'GET',
      headers: {
        Authorization: `Bot ${String(config.discordBotToken || '').trim()}`,
      },
    });
    const payload = await deps.safeReadJson(response);
    if (!response.ok || !payload?.id) {
      throw new Error(typeof payload?.message === 'string' ? payload.message : `HTTP ${response.status}`);
    }

    return {
      channelId: 'discord',
      mode,
      enabled,
      configured: true,
      status: 'passed',
      summary: 'Discord nativo validado pela Discord API e pelo snapshot do runtime.',
      error: null,
      recommendedAction: null,
      details: [
        `Bot user id: ${String(payload.id)}.`,
        `Guilds permitidas: ${config.discordAllowedGuildIds.length}.`,
      ],
    };
  } catch (error: any) {
    return {
      channelId: 'discord',
      mode,
      enabled,
      configured: true,
      status: 'failed',
      summary: 'Discord nativo falhou no probe remoto da Discord API.',
      error: error?.message || String(error),
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Revise token, guild allowlist e reachability da Discord API.'],
    };
  }
}

export async function inspectSlackChannel(deps: NativeInspectorDeps): Promise<ChannelProviderDoctorItem> {
  const status = deps.readStatusFile(config.slackStatusFile);
  const mode: ChannelProviderDoctorItem['mode'] =
    status?.mode === 'native'
      ? 'native'
      : config.slackTransport === 'native'
        ? 'native'
        : String(config.slackBotToken || '').trim() && config.slackTransport !== 'stub'
        ? 'native'
        : status?.mode === 'stub' || config.slackTransport === 'stub'
          ? 'stub'
          : 'unknown';
  const enabled = Boolean(status?.enabled === true || config.slackEnabled || String(config.slackBotToken || '').trim());

  if (mode === 'stub') {
    if (status?.started === false) {
      return {
        channelId: 'slack',
        mode,
        enabled,
        configured: true,
        status: 'failed',
        summary: 'Slack stub ainda nao confirmou runtime pronto.',
        error: 'O snapshot do Slack indica started=false.',
        recommendedAction: 'npm run test:channels:smoke',
        details: ['Suba o runtime do host para validar o outbox local e o snapshot do Slack stub.'],
      };
    }

    if (typeof status?.lastError === 'string' && status.lastError.trim()) {
      return {
        channelId: 'slack',
        mode,
        enabled,
        configured: true,
        status: 'failed',
        summary: 'Slack stub registrou erro recente.',
        error: status.lastError,
        recommendedAction: 'npm run test:channels:smoke',
        details: ['Revise o ultimo erro do snapshot antes de ampliar o uso do Slack local.'],
      };
    }

    return {
      channelId: 'slack',
      mode,
      enabled,
      configured: true,
      status: 'passed',
      summary: 'Slack stub validado localmente pelo snapshot do runtime.',
      error: null,
      recommendedAction: null,
      details: [
        `Canais permitidos: ${Number(status?.recipientsConfigured || config.slackAllowedChannelIds.length || 0)}.`,
        status?.workspaceId
          ? `Workspace alvo: ${String(status.workspaceId)}.`
          : 'Workspace nao configurado; o stub local continua valido para smoke e Channel Mesh.',
      ],
    };
  }

  if (mode !== 'native') {
    return {
      channelId: 'slack',
      mode,
      enabled,
      configured: false,
      status: 'skipped',
      summary: 'Slack nativo nao esta habilitado neste runtime.',
      error: null,
      recommendedAction: null,
      details: ['Defina SLACK_TRANSPORT=native e SLACK_BOT_TOKEN para ativar o doctor do Slack.'],
    };
  }

  const missing: string[] = [];
  if (!String(config.slackBotToken || '').trim()) {
    missing.push('SLACK_BOT_TOKEN');
  }
  if (!String(config.slackSigningSecret || '').trim()) {
    missing.push('SLACK_SIGNING_SECRET');
  }
  if (config.slackAllowedChannelIds.length < 1) {
    missing.push('SLACK_ALLOWED_CHANNEL_IDS');
  }

  if (missing.length > 0) {
    return {
      channelId: 'slack',
      mode,
      enabled,
      configured: false,
      status: 'failed',
      summary: 'Slack nativo esta habilitado, mas ainda faltam prerequisitos operacionais.',
      error: `Campos ausentes: ${missing.join(', ')}.`,
      recommendedAction: 'npm run test:channels:smoke',
      details: [
        'Slack native exige bot token, signing secret e ao menos um canal permitido.',
      ],
    };
  }

  if (status?.started === false) {
    return {
      channelId: 'slack',
      mode,
      enabled,
      configured: true,
      status: 'failed',
      summary: 'Slack nativo ainda nao confirmou runtime pronto.',
      error: 'O snapshot do Slack indica started=false.',
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Suba o runtime do host e confirme o webhook /api/webhooks/slack.'],
    };
  }

  if (typeof status?.lastError === 'string' && status.lastError.trim()) {
    return {
      channelId: 'slack',
      mode,
      enabled,
      configured: true,
      status: 'failed',
      summary: 'Slack nativo registrou erro recente.',
      error: status.lastError,
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Revise o ultimo erro do snapshot antes de ampliar o rollout.'],
    };
  }

  if (deps.localOnly || !deps.fetchImpl) {
    return {
      channelId: 'slack',
      mode,
      enabled,
      configured: true,
      status: 'passed',
      summary: 'Slack nativo validado localmente pelo snapshot e pela configuracao.',
      error: null,
      recommendedAction: null,
      details: ['Probe remoto pulado; o doctor usou apenas config e snapshot local.'],
    };
  }

  try {
    const baseUrl = String(config.slackApiBaseUrl || 'https://slack.com/api').trim().replace(/\/+$/, '');
    const response = await deps.fetchImpl(`${baseUrl}/auth.test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${String(config.slackBotToken || '').trim()}`,
      },
      body: JSON.stringify({}),
    });
    const payload = await deps.safeReadJson(response);
    if (!response.ok || payload?.ok !== true) {
      const errorMessage =
        typeof payload?.error === 'string'
          ? payload.error
          : `HTTP ${response.status}`;
      throw new Error(errorMessage);
    }

    return {
      channelId: 'slack',
      mode,
      enabled,
      configured: true,
      status: 'passed',
      summary: 'Slack nativo validado por auth.test e pelo snapshot do runtime.',
      error: null,
      recommendedAction: null,
      details: [
        `Workspace alvo: ${String(status?.workspaceId || config.slackWorkspaceId || 'n/d')}.`,
        `Canais permitidos: ${config.slackAllowedChannelIds.length}.`,
      ],
    };
  } catch (error: any) {
    return {
      channelId: 'slack',
      mode,
      enabled,
      configured: true,
      status: 'failed',
      summary: 'Slack nativo falhou no probe remoto da Web API.',
      error: error?.message || String(error),
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Revise token, signing secret e reachability da Slack Web API.'],
    };
  }
}

export async function inspectWhatsAppChannel(deps: NativeInspectorDeps): Promise<ChannelProviderDoctorItem> {
  const status = deps.readStatusFile(config.whatsappStatusFile);
  const provider = status?.provider === 'cloud-api'
    ? 'cloud-api'
    : config.whatsappProvider === 'cloud-api'
      ? 'cloud-api'
      : status?.provider === 'baileys' || config.whatsappProvider === 'baileys'
        ? 'baileys'
        : 'stub';
  const mode: ChannelProviderDoctorItem['mode'] =
    status?.mode === 'cloud-api' || provider === 'cloud-api'
      ? 'cloud-api'
      : status?.mode === 'baileys' || provider === 'baileys'
        ? 'baileys'
        : status?.mode === 'stub' || provider === 'stub'
          ? 'stub'
          : 'unknown';
  const enabled = Boolean(
    status?.enabled === true
    || config.whatsappEnabled
    || provider === 'cloud-api'
    || provider === 'baileys'
    || provider === 'stub',
  );

  if (mode === 'stub') {
    if (status?.started === false) {
      return {
        channelId: 'whatsapp',
        mode,
        enabled,
        configured: true,
        status: 'failed',
        summary: 'WhatsApp stub ainda nao confirmou runtime pronto.',
        error: 'O snapshot do WhatsApp indica started=false.',
        recommendedAction: 'npm run test:channels:smoke',
        details: ['Suba o runtime do host para validar o outbox local do WhatsApp stub.'],
      };
    }

    if (typeof status?.lastError === 'string' && status.lastError.trim()) {
      return {
        channelId: 'whatsapp',
        mode,
        enabled,
        configured: true,
        status: 'failed',
        summary: 'WhatsApp stub registrou erro recente.',
        error: status.lastError,
        recommendedAction: 'npm run test:channels:smoke',
        details: ['Revise o ultimo erro do snapshot antes de ampliar o uso do WhatsApp local.'],
      };
    }

    return {
      channelId: 'whatsapp',
      mode,
      enabled,
      configured: true,
      status: 'passed',
      summary: 'WhatsApp stub validado localmente pelo snapshot do runtime.',
      error: null,
      recommendedAction: null,
      details: [
        `Chats permitidos: ${Number(status?.recipientsConfigured || config.whatsappAllowedChatIds.length || 0)}.`,
        typeof status?.providerDecision === 'string' && status.providerDecision.trim()
          ? status.providerDecision
          : 'Stub local mantido enquanto o provider oficial do WhatsApp nao e conectado.',
      ],
    };
  }

  if (mode === 'baileys') {
    if (!String(config.whatsappSessionDir || '').trim() && status?.providerConfigured !== true) {
      return {
        channelId: 'whatsapp',
        mode,
        enabled,
        configured: false,
        status: 'failed',
        summary: 'WhatsApp Baileys foi escolhido, mas ainda faltam prerequisitos operacionais.',
        error: 'Campos ausentes: WHATSAPP_SESSION_DIR.',
        recommendedAction: 'npm run test:channels:smoke',
        details: ['Baileys exige ao menos um diretorio de sessao persistente antes de validar o runtime local.'],
      };
    }

    if (status?.started === false) {
      return {
        channelId: 'whatsapp',
        mode,
        enabled,
        configured: true,
        status: 'failed',
        summary: 'WhatsApp Baileys ainda nao confirmou runtime pronto.',
        error: 'O snapshot do WhatsApp indica started=false.',
        recommendedAction: 'npm run test:channels:smoke',
        details: ['Suba o runtime do host e confirme a sessao persistente do provider Baileys.'],
      };
    }

    if (typeof status?.lastError === 'string' && status.lastError.trim()) {
      return {
        channelId: 'whatsapp',
        mode,
        enabled,
        configured: true,
        status: 'failed',
        summary: 'WhatsApp Baileys registrou erro recente.',
        error: status.lastError,
        recommendedAction: 'npm run test:channels:smoke',
        details: ['Revise o ultimo erro do snapshot antes de ampliar o rollout do provider Baileys.'],
      };
    }

    return {
      channelId: 'whatsapp',
      mode,
      enabled,
      configured: true,
      status: 'passed',
      summary: 'WhatsApp Baileys validado localmente pelo snapshot do runtime.',
      error: null,
      recommendedAction: null,
      details: [
        String(config.whatsappSessionDir || '').trim()
          ? `Sessao persistente: ${String(config.whatsappSessionDir).trim()}.`
          : 'Sessao persistente confirmada pelo snapshot do provider Baileys.',
        typeof status?.providerDecision === 'string' && status.providerDecision.trim()
          ? status.providerDecision
          : 'Provider Baileys ativo para validacao local do Channel Mesh.',
      ],
    };
  }

  if (mode !== 'cloud-api') {
    return {
      channelId: 'whatsapp',
      mode,
      enabled,
      configured: false,
      status: 'skipped',
      summary: 'WhatsApp Cloud API nao esta habilitada neste runtime.',
      error: null,
      recommendedAction: null,
      details: ['Defina WHATSAPP_PROVIDER=cloud-api para ativar o doctor oficial do WhatsApp.'],
    };
  }

  const missing: string[] = [];
  if (!String(config.whatsappPhoneNumberId || '').trim()) {
    missing.push('WHATSAPP_PHONE_NUMBER_ID');
  }
  if (!String(config.whatsappAccessToken || '').trim()) {
    missing.push('WHATSAPP_ACCESS_TOKEN');
  }
  if (!String(config.whatsappWebhookVerifyToken || '').trim()) {
    missing.push('WHATSAPP_WEBHOOK_VERIFY_TOKEN');
  }
  if (config.whatsappAllowedChatIds.length < 1) {
    missing.push('WHATSAPP_ALLOWED_CHAT_IDS');
  }

  if (missing.length > 0) {
    return {
      channelId: 'whatsapp',
      mode,
      enabled,
      configured: false,
      status: 'failed',
      summary: 'WhatsApp Cloud API esta habilitada, mas ainda faltam prerequisitos operacionais.',
      error: `Campos ausentes: ${missing.join(', ')}.`,
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Cloud API exige credenciais completas, verify token e ao menos um chat permitido.'],
    };
  }

  if (status?.started === false) {
    return {
      channelId: 'whatsapp',
      mode,
      enabled,
      configured: true,
      status: 'failed',
      summary: 'WhatsApp Cloud API ainda nao confirmou runtime pronto.',
      error: 'O snapshot do WhatsApp indica started=false.',
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Suba o runtime do host e confirme o callback /api/webhooks/whatsapp.'],
    };
  }

  if (status?.webhookConfigured === false) {
    return {
      channelId: 'whatsapp',
      mode,
      enabled,
      configured: true,
      status: 'failed',
      summary: 'WhatsApp Cloud API ainda nao confirmou validacao de webhook.',
      error: 'webhookConfigured=false no snapshot do WhatsApp.',
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Revise WHATSAPP_WEBHOOK_VERIFY_TOKEN e o callback da Meta.'],
    };
  }

  if (typeof status?.lastError === 'string' && status.lastError.trim()) {
    return {
      channelId: 'whatsapp',
      mode,
      enabled,
      configured: true,
      status: 'failed',
      summary: 'WhatsApp Cloud API registrou erro recente.',
      error: status.lastError,
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Revise o ultimo erro do snapshot antes de ampliar o rollout.'],
    };
  }

  if (deps.localOnly || !deps.fetchImpl) {
    return {
      channelId: 'whatsapp',
      mode,
      enabled,
      configured: true,
      status: 'passed',
      summary: 'WhatsApp Cloud API validada localmente pelo snapshot e pela configuracao.',
      error: null,
      recommendedAction: null,
      details: ['Probe remoto pulado; o doctor usou apenas config e snapshot local.'],
    };
  }

  try {
    const apiVersion = String(config.whatsappCloudApiVersion || 'v20.0').trim() || 'v20.0';
    const phoneNumberId = String(config.whatsappPhoneNumberId || '').trim();
    const response = await deps.fetchImpl(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}?fields=id`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${String(config.whatsappAccessToken || '').trim()}`,
        },
      },
    );
    const payload = await deps.safeReadJson(response);
    if (!response.ok || String(payload?.id || '').trim() !== phoneNumberId) {
      const errorMessage =
        typeof payload?.error?.message === 'string'
          ? payload.error.message
          : `HTTP ${response.status}`;
      throw new Error(errorMessage);
    }

    return {
      channelId: 'whatsapp',
      mode,
      enabled,
      configured: true,
      status: 'passed',
      summary: 'WhatsApp Cloud API validada pelo Graph API e pelo snapshot do runtime.',
      error: null,
      recommendedAction: null,
      details: [
        `Phone number id: ${phoneNumberId}.`,
        `Chats permitidos: ${config.whatsappAllowedChatIds.length}.`,
      ],
    };
  } catch (error: any) {
    return {
      channelId: 'whatsapp',
      mode,
      enabled,
      configured: true,
      status: 'failed',
      summary: 'WhatsApp Cloud API falhou no probe remoto do Graph API.',
      error: error?.message || String(error),
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Revise token, phone number id e reachability do Graph API.'],
    };
  }
}
