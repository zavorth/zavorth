
import { config } from '../../config/index.js';
import type { ChannelProviderDoctorItem } from '../ChannelProviderDoctorService.js';
import { logger } from '../../logger.js';
import { asErrorLike, errorMessage } from '../../utils/errorLike.js';
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
      summary: 'Telegram native is not enabled in this runtime.',
      error: null,
      recommendedAction: null,
      details: ['set TELEGRAM_BOT_TOKEN to enable the official Telegram doctor.'],
    };
  }

  if ((config.allowedUserIds || []).length < 1) {
    return {
      channelId: 'telegram',
      mode: 'native',
      enabled: true,
      configured: false,
      status: 'failed',
      summary: 'Telegram native is enabled, but operational prerequisites are still missing.',
      error: 'Missing fields: TELEGRAM_ALLOWED_USER_IDS.',
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Telegram requires a bot token and at least one allowed operator.'],
    };
  }

  if (deps.localOnly || !deps.fetchImpl) {
    return {
      channelId: 'telegram',
      mode: 'native',
      enabled: true,
      configured: true,
      status: 'passed',
      summary: 'Telegram native validated locally by configuration do operador.',
      error: null,
      recommendedAction: null,
      details: [`Operatores permitidos: ${config.allowedUserIds.length}.`],
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
      summary: 'Telegram native validated by getMe and the operator policy.',
      error: null,
      recommendedAction: null,
      details: [
        `Bot id: ${String(payload.result.id)}.`,
        `Operatores permitidos: ${config.allowedUserIds.length}.`,
      ],
    };
  } catch (error: unknown) {
 const err = asErrorLike(error); logger.warn('[Channel  Native Inspectors] load operation failed', error);
    return {
      channelId: 'telegram',
      mode: 'native',
      enabled: true,
      configured: true,
      status: 'failed',
      summary: 'Telegram native failed the remote Bot API probe.',
      error: errorMessage(error),
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Review the bot token and Telegram Bot API reachability.'],
    };
  }
}

export async function inspectDiscordChannel(deps: NativeInspectorDeps): Promise<ChannelProviderDoctorItem> {
  const status = deps.readStatusFile(config.discordBridgeStatusFile);
  const lifecycle = deps.readCapabilityLifecycleHint('discord');
  const mode: ChannelProviderDoctorItem['mode'] = String(config.discordBotToken || '').trim() ? 'native'
    : (config.discordBridgeEnabled ? 'bridge' : 'unknown');
  const enabled = Boolean(String(config.discordBotToken || '').trim() || config.discordBridgeEnabled);

  if (mode !== 'native') {
    return {
      channelId: 'discord',
      mode,
      enabled,
      configured: false,
      status: 'skipped',
      summary: 'Discord native is not enabled in this runtime.',
      error: null,
      recommendedAction: null,
      details: ['set DISCORD_BOT_TOKEN to enable the official Discord native doctor.'],
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
      summary: 'Discord native is enabled, but operational prerequisites are still missing.',
      error: `Missing fields: ${missing.join(', ')}.`,
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Discord native requires bot token and explicit operation scope.'],
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
        summary: lifecycle.dormant ? 'Discord native is configured, but dormant in the current profile.'
          : 'Discord native is configured, but remains optional in the current profile.',
        error: null,
        recommendedAction: null,
        details: [
          lifecycle.notes || 'Discord is not required at boot for this profile and can stay disabled until the user needs it.',
          'Enable the Discord gateway only when real channel usage exists or rollout requires explicit prewarm.',
        ],
      };
    }

    return {
      channelId: 'discord',
      mode,
      enabled,
      configured: true,
      status: 'failed',
      summary: 'Discord nactive has not confirmed runtime readiness yet.',
      error: 'O snapshot do Discord indica started=false.',
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Start the Discord gateway and confirm bridge/runtime status.'],
    };
  }

  if (typeof status?.lastError === 'string' && status.lastError.trim()) {
    return {
      channelId: 'discord',
      mode,
      enabled,
      configured: true,
      status: 'failed',
      summary: 'Native Discord recorded a recent error.',
      error: status.lastError,
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Revise o latest error do snapshot before ampliar o rollout.'],
    };
  }

  if (deps.localOnly || !deps.fetchImpl) {
    return {
      channelId: 'discord',
      mode,
      enabled,
      configured: true,
      status: 'passed',
      summary: 'Discord native validated locally by configuration and runtime snapshot.',
      error: null,
      recommendedAction: null,
      details: [
        `Allowed guilds: ${config.discordAllowedGuildIds.length}.`,
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
      summary: 'Discord native validated by the Discord API and runtime snapshot.',
      error: null,
      recommendedAction: null,
      details: [
        `Bot user id: ${String(payload.id)}.`,
        `Allowed guilds: ${config.discordAllowedGuildIds.length}.`,
      ],
    };
  } catch (error: unknown) {
 const err = asErrorLike(error); logger.warn('[Channel  Native Inspectors] load operation failed', error);
    return {
      channelId: 'discord',
      mode,
      enabled,
      configured: true,
      status: 'failed',
      summary: 'Discord native failed the remote Discord API probe.',
      error: errorMessage(error),
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Review token, guild allowlist, and Discord API reachability.'],
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
        : String(config.slackBotToken || '').trim() && config.slackTransport !== 'local'
        ? 'native'
        : status?.mode === 'local' || config.slackTransport === 'local'
          ? 'local'
          : 'unknown';
  const enabled = Boolean(status?.enabled === true || config.slackEnabled || String(config.slackBotToken || '').trim());

  if (mode === 'local') {
    if (status?.started === false) {
      return {
        channelId: 'slack',
        mode,
        enabled,
        configured: true,
        status: 'failed',
        summary: 'Slack local transport has not confirmed runtime readiness yet.',
        error: 'O snapshot do Slack indica started=false.',
        recommendedAction: 'npm run test:channels:smoke',
        details: ['Start the host runtime to validate the local outbox and Slack local transport snapshot.'],
      };
    }

    if (typeof status?.lastError === 'string' && status.lastError.trim()) {
      return {
        channelId: 'slack',
        mode,
        enabled,
        configured: true,
        status: 'failed',
        summary: 'Slack local transport recorded a recent error.',
        error: status.lastError,
        recommendedAction: 'npm run test:channels:smoke',
        details: ['Revise o latest error do snapshot before ampliar o usage do Slack local.'],
      };
    }

    return {
      channelId: 'slack',
      mode,
      enabled,
      configured: true,
      status: 'passed',
      summary: 'Slack local transport validated locally by the runtime snapshot.',
      error: null,
      recommendedAction: null,
      details: [
        `Canais permitidos: ${Number(status?.recipientsConfigured || config.slackAllowedChannelIds.length || 0)}.`,
        status?.workspaceId ? `Workspace alvo: ${String(status.workspaceId)}.`
          : 'Workspace not configured; the local transport remains valid for smoke and Channel Mesh.',
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
      summary: 'Slack native is not enabled in this runtime.',
      error: null,
      recommendedAction: null,
      details: ['set SLACK_TRANSPORT=native and SLACK_BOT_TOKEN to enable the Slack doctor.'],
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
      summary: 'Slack native is enabled, but operational prerequisites are still missing.',
      error: `Missing fields: ${missing.join(', ')}.`,
      recommendedAction: 'npm run test:channels:smoke',
      details: [
        'Slack native requires a bot token, signing secret, and at least one allowed channel.',
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
      summary: 'Slack nactive has not confirmed runtime readiness yet.',
      error: 'O snapshot do Slack indica started=false.',
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Start the host runtime and confirm webhook /api/webhooks/slack.'],
    };
  }

  if (typeof status?.lastError === 'string' && status.lastError.trim()) {
    return {
      channelId: 'slack',
      mode,
      enabled,
      configured: true,
      status: 'failed',
      summary: 'Native Slack recorded a recent error.',
      error: status.lastError,
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Revise o latest error do snapshot before ampliar o rollout.'],
    };
  }

  if (deps.localOnly || !deps.fetchImpl) {
    return {
      channelId: 'slack',
      mode,
      enabled,
      configured: true,
      status: 'passed',
      summary: 'Slack nactive validated locally by snapshot and configuration.',
      error: null,
      recommendedAction: null,
      details: ['Remote probe skipped; the doctor used only config and local snapshot.'],
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
      summary: 'Slack native validated by auth.test and runtime snapshot.',
      error: null,
      recommendedAction: null,
      details: [
        `Workspace alvo: ${String(status?.workspaceId || config.slackWorkspaceId || 'n/d')}.`,
        `Canais permitidos: ${config.slackAllowedChannelIds.length}.`,
      ],
    };
  } catch (error: unknown) {
 const err = asErrorLike(error); logger.warn('[Channel  Native Inspectors] validation failed', error);
    return {
      channelId: 'slack',
      mode,
      enabled,
      configured: true,
      status: 'failed',
      summary: 'Slack native failed the remote Web API probe.',
      error: errorMessage(error),
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Review token, signing secret, and Slack Web API reachability.'],
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
        : 'local';
  const mode: ChannelProviderDoctorItem['mode'] =
    status?.mode === 'cloud-api' || provider === 'cloud-api'
      ? 'cloud-api'
      : status?.mode === 'baileys' || provider === 'baileys'
        ? 'baileys'
        : status?.mode === 'local' || provider === 'local'
          ? 'local'
          : 'unknown';
  const enabled = Boolean(
    status?.enabled === true
    || config.whatsappEnabled
    || provider === 'cloud-api'
    || provider === 'baileys'
    || provider === 'local',
  );

  if (mode === 'local') {
    if (status?.started === false) {
      return {
        channelId: 'whatsapp',
        mode,
        enabled,
        configured: true,
        status: 'failed',
        summary: 'WhatsApp local transport has not confirmed runtime readiness yet.',
        error: 'O snapshot do WhatsApp indica started=false.',
        recommendedAction: 'npm run test:channels:smoke',
        details: ['Start the host runtime to validate the WhatsApp local outbox snapshot.'],
      };
    }

    if (typeof status?.lastError === 'string' && status.lastError.trim()) {
      return {
        channelId: 'whatsapp',
        mode,
        enabled,
        configured: true,
        status: 'failed',
        summary: 'WhatsApp local transport recorded a recent error.',
        error: status.lastError,
        recommendedAction: 'npm run test:channels:smoke',
        details: ['Revise o latest error do snapshot before ampliar o usage do WhatsApp local.'],
      };
    }

    return {
      channelId: 'whatsapp',
      mode,
      enabled,
      configured: true,
      status: 'passed',
      summary: 'WhatsApp local transport validated locally by the runtime snapshot.',
      error: null,
      recommendedAction: null,
      details: [
        `Chats permitidos: ${Number(status?.recipientsConfigured || config.whatsappAllowedChatIds.length || 0)}.`,
        typeof status?.providerDecision === 'string' && status.providerDecision.trim()
          ? status.providerDecision
          : 'local transport is kept while the official WhatsApp provider is not connected.',
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
        summary: 'WhatsApp Baileys was selected, but operational prerequisites are still missing.',
        error: 'Missing fields: WHATSAPP_SESSION_DIR.',
        recommendedAction: 'npm run test:channels:smoke',
        details: ['Baileys requires at least one persistent session directory before validating the local runtime.'],
      };
    }

    if (status?.started === false) {
      return {
        channelId: 'whatsapp',
        mode,
        enabled,
        configured: true,
        status: 'failed',
        summary: 'WhatsApp Baileys has not confirmed runtime readiness yet.',
        error: 'O snapshot do WhatsApp indica started=false.',
        recommendedAction: 'npm run test:channels:smoke',
        details: ['Start the host runtime and confirm the persistent Baileys provider session.'],
      };
    }

    if (typeof status?.lastError === 'string' && status.lastError.trim()) {
      return {
        channelId: 'whatsapp',
        mode,
        enabled,
        configured: true,
        status: 'failed',
        summary: 'WhatsApp Baileys recorded a recent error.',
        error: status.lastError,
        recommendedAction: 'npm run test:channels:smoke',
        details: ['Revise o latest error do snapshot before ampliar o rollout do provider Baileys.'],
      };
    }

    return {
      channelId: 'whatsapp',
      mode,
      enabled,
      configured: true,
      status: 'passed',
      summary: 'WhatsApp Baileys validated locally by the runtime snapshot.',
      error: null,
      recommendedAction: null,
      details: [
        String(config.whatsappSessionDir || '').trim() ? `Session persistent session: ${String(config.whatsappSessionDir).trim()}.`
          : 'Session persistent session confirmed by the Baileys provider snapshot.',
        typeof status?.providerDecision === 'string' && status.providerDecision.trim()
          ? status.providerDecision
          : 'Provider Baileys active para validation local do Channel Mesh.',
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
      summary: 'WhatsApp Cloud API is not enabled in this runtime.',
      error: null,
      recommendedAction: null,
      details: ['set WHATSAPP_PROVIDER=cloud-api to enable the official WhatsApp doctor.'],
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
      summary: 'WhatsApp Cloud API is enabled, but operational prerequisites are still missing.',
      error: `Missing fields: ${missing.join(', ')}.`,
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Cloud API requires complete credentials, verify token, and at least one allowed chat.'],
    };
  }

  if (status?.started === false) {
    return {
      channelId: 'whatsapp',
      mode,
      enabled,
      configured: true,
      status: 'failed',
      summary: 'WhatsApp Cloud API has not confirmed runtime readiness yet.',
      error: 'O snapshot do WhatsApp indica started=false.',
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Start the host runtime and confirm callback /api/webhooks/whatsapp.'],
    };
  }

  if (status?.webhookConfigured === false) {
    return {
      channelId: 'whatsapp',
      mode,
      enabled,
      configured: true,
      status: 'failed',
      summary: 'WhatsApp Cloud API has not confirmed webhook validation yet.',
      error: 'webhookConfigured=false no snapshot do WhatsApp.',
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Review WHATSAPP_WEBHOOK_VERIFY_TOKEN and the Meta callback.'],
    };
  }

  if (typeof status?.lastError === 'string' && status.lastError.trim()) {
    return {
      channelId: 'whatsapp',
      mode,
      enabled,
      configured: true,
      status: 'failed',
      summary: 'WhatsApp Cloud API recorded a recent error.',
      error: status.lastError,
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Revise o latest error do snapshot before ampliar o rollout.'],
    };
  }

  if (deps.localOnly || !deps.fetchImpl) {
    return {
      channelId: 'whatsapp',
      mode,
      enabled,
      configured: true,
      status: 'passed',
      summary: 'WhatsApp Cloud API validated locally by snapshot and configuration.',
      error: null,
      recommendedAction: null,
      details: ['Remote probe skipped; the doctor used only config and local snapshot.'],
    };
  }

  try {
    const apiVersion = String(config.whatsappCloudApiVersion || 'v20.0').trim() || 'v20.0';
    const phoneNumberId = String(config.whatsappPhoneNumberId || '').trim();
    const response = await deps.fetchImpl(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}...fields=id`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${String(config.whatsappAccessToken || '').trim()}`,
        },
      },
    );
    const payload = await deps.safeReadJson(response);
    if (!response.ok || String(payload?.id || '').trim() !== phoneNumberId) {
      const message =
        typeof payload?.error?.message === 'string'
          ? payload.error.message
          : `HTTP ${response.status}`;
      throw new Error(message);
    }

    return {
      channelId: 'whatsapp',
      mode,
      enabled,
      configured: true,
      status: 'passed',
      summary: 'WhatsApp Cloud API validated by Graph API and the runtime snapshot.',
      error: null,
      recommendedAction: null,
      details: [
        `Phone number id: ${phoneNumberId}.`,
        `Chats permitidos: ${config.whatsappAllowedChatIds.length}.`,
      ],
    };
  } catch (error: unknown) {
 const err = asErrorLike(error); logger.warn('[Channel  Native Inspectors] validation failed', error);
    return {
      channelId: 'whatsapp',
      mode,
      enabled,
      configured: true,
      status: 'failed',
      summary: 'WhatsApp Cloud API failed no probe remote do Graph API.',
      error: errorMessage(error),
      recommendedAction: 'npm run test:channels:smoke',
      details: ['Review token, phone number id, and Graph API reachability.'],
    };
  }
}
