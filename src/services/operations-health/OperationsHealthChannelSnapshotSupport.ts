import { config } from '../../config/index.js';
import { ZavorthBridgeAccessLeaseService } from '../ZavorthBridgeAccessLeaseService.js';
import { logger } from '../../logger.js';
import type {
ChannelsSnapshot,
  DiscordBridgeSnapshot,
  WhatsAppChannelSnapshot,
  SlackChannelSnapshot,
  PlannedChannelSnapshot,
  ZavorthBridgeMobileAccessSnapshot,
  ChannelMode,
  TransportMode,
  LeaseStatus,
} from './OperationsHealthSnapshotTypes.js';

type OperationsHealthChannelSnapshotSupportOptions = {
  now: () => Date;
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding: BufferEncoding) => string;
  discordBridgeStatusFile: string;
  whatsappStatusFile: string;
  slackStatusFile: string;
};

export class OperationsHealthChannelSnapshotSupport {
  private readonly existsSync: (path: string) => boolean;
  private readonly readFileSync: (path: string, encoding: BufferEncoding) => string;
  private readonly discordBridgeStatusFile: string;
  private readonly whatsappStatusFile: string;
  private readonly slackStatusFile: string;
  private readonly zavorthBridgeAccessLease: ZavorthBridgeAccessLeaseService;

  constructor(options: OperationsHealthChannelSnapshotSupportOptions) {
    this.existsSync = options.existsSync;
    this.readFileSync = options.readFileSync;
    this.discordBridgeStatusFile = options.discordBridgeStatusFile;
    this.whatsappStatusFile = options.whatsappStatusFile;
    this.slackStatusFile = options.slackStatusFile;
    this.zavorthBridgeAccessLease = new ZavorthBridgeAccessLeaseService({
      now: options.now,
      leaseFile: config.zavorthBridgeMobileLeaseFile,
      historyFile: config.zavorthBridgeMobileLeaseHistoryFile,
    });
  }

  public readChannelsSnapshot(): ChannelsSnapshot {
    return {
      discordBridge: this.readDiscordBridgeSnapshot(),
      whatsapp: this.readWhatsAppChannelSnapshot(),
      slack: this.readSlackChannelSnapshot(),
      signal: this.readSignalChannelSnapshot(),
      imessage: this.readIMessageChannelSnapshot(),
      teams: this.readTeamsChannelSnapshot(),
      email: this.readEmailChannelSnapshot(),
    };
  }

  public readDiscordBridgeSnapshot(): DiscordBridgeSnapshot {
    const fallback: DiscordBridgeSnapshot = {
      mode: (config.discordBotToken ? 'native' : config.discordBridgeEnabled ? 'bridge' : 'unknown') as ChannelMode,
      enabled: config.discordBridgeEnabled || Boolean(config.discordBotToken),
      started: false,
      allowDirectMessages: config.discordAllowDms,
      allowedGuildIds: [...config.discordAllowedGuildIds],
      pendingInbox: 0,
      pendingOutbox: 0,
      lastError: null,
      updatedAt: null,
    };

    try {
      if (!this.existsSync(this.discordBridgeStatusFile)) {
        return fallback;
      }

      const parsed = JSON.parse(this.readFileSync(this.discordBridgeStatusFile, 'utf8')) as Record<string, unknown>;
      const mode = (
        parsed.mode === 'native' || parsed.mode === 'bridge'
          ? parsed.mode
          : fallback.mode
      ) as ChannelMode;
      const expectedMode = (config.discordBotToken ? 'native' : config.discordBridgeEnabled ? 'bridge' : mode) as ChannelMode;
      const modeMismatch = expectedMode !== 'unknown' && mode !== expectedMode;
      return {
        mode: expectedMode,
        enabled: parsed.enabled === true,
        started: !modeMismatch && parsed.started === true,
        allowDirectMessages: parsed.allowDirectMessages === true,
        allowedGuildIds: Array.isArray(parsed.allowedGuildIds)
          ? parsed.allowedGuildIds.map((entry) => String(entry || '').trim()).filter(Boolean)
          : [...config.discordAllowedGuildIds],
        pendingInbox: Number(parsed.pendingInbox || 0) || 0,
        pendingOutbox: Number(parsed.pendingOutbox || 0) || 0,
        lastError: modeMismatch
          ? `Discord status snapshot belongs to ${mode} mode, but ${expectedMode} mode is configured.`
          : typeof parsed.lastError === 'string'
            ? parsed.lastError
            : null,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
      };
    } catch (error) { logger.warn('[Operations  Channel Snapshot] parsing failed', error); return fallback; }
  }

  public readWhatsAppChannelSnapshot(): WhatsAppChannelSnapshot {
    const fallbackProvider = (
      config.whatsappProvider === 'cloud-api'
      || config.whatsappProvider === 'baileys'
      || config.whatsappProvider === 'stub'
        ? config.whatsappProvider
        : 'stub'
    ) as WhatsAppChannelSnapshot['provider'];
    const fallbackMode = (
      fallbackProvider === 'cloud-api' || fallbackProvider === 'baileys'
        ? fallbackProvider
        : config.whatsappEnabled || Boolean(config.whatsappBotToken) || Boolean(config.whatsappSessionDir)
          ? 'stub'
          : 'unknown'
    ) as ChannelMode;
    const fallback: WhatsAppChannelSnapshot = {
      mode: fallbackMode,
      enabled: Boolean(
        config.whatsappEnabled
        || config.whatsappBotToken
        || config.whatsappSessionDir
        || fallbackProvider !== 'stub'
        || String(config.whatsappPhoneNumberId || '').trim()
        || String(config.whatsappAccessToken || '').trim(),
      ),
      started: false,
      recipientsConfigured: config.whatsappAllowedChatIds.length,
      allowedChatIds: [...config.whatsappAllowedChatIds],
      provider: fallbackProvider,
      providerConfigured:
        config.whatsappProvider === 'cloud-api'
          ? Boolean(
              String(config.whatsappPhoneNumberId || '').trim()
              && String(config.whatsappAccessToken || '').trim()
              && String(config.whatsappWebhookVerifyToken || '').trim(),
            )
          : config.whatsappProvider === 'baileys'
            ? Boolean(String(config.whatsappSessionDir || '').trim())
            : true,
      providerDecision:
        config.whatsappProvider === 'cloud-api'
          ? Boolean(
              String(config.whatsappPhoneNumberId || '').trim()
              && String(config.whatsappAccessToken || '').trim()
              && String(config.whatsappWebhookVerifyToken || '').trim(),
            )
            ? 'Cloud API conectada; webhook verification, inbound e outbound oficial estao ativos.'
            : 'Cloud API escolhida como provider-alvo, mas ainda faltam credenciais minimas para ativar o runtime.'
          : config.whatsappProvider === 'baileys'
            ? 'Baileys escolhido como provider-alvo; falta plugar sessao nativa persistente.'
            : 'Stub local mantido enquanto o provider oficial do WhatsApp nao e conectado.',
      sessionDir: String(config.whatsappSessionDir || '').trim() || null,
      sessionDirConfigured: Boolean(String(config.whatsappSessionDir || '').trim()),
      phoneNumberId: String(config.whatsappPhoneNumberId || '').trim() || null,
      webhookConfigured: Boolean(String(config.whatsappWebhookVerifyToken || '').trim()),
      lastInboundAt: null,
      lastOutboundAt: null,
      lastError: null,
      updatedAt: null,
    };

    try {
      if (!this.existsSync(this.whatsappStatusFile)) {
        return fallback;
      }

      const parsed = JSON.parse(this.readFileSync(this.whatsappStatusFile, 'utf8')) as Record<string, unknown>;
      return {
        mode: (
          parsed.mode === 'stub' || parsed.mode === 'cloud-api' || parsed.mode === 'baileys'
            ? parsed.mode
            : fallback.mode
        ) as ChannelMode,
        enabled: parsed.enabled === true,
        started: parsed.started === true,
        recipientsConfigured: Number(parsed.recipientsConfigured || 0) || 0,
        allowedChatIds: Array.isArray(parsed.allowedChatIds)
          ? parsed.allowedChatIds.map((entry) => String(entry || '').trim()).filter(Boolean)
          : [...config.whatsappAllowedChatIds],
        provider: (
          parsed.provider === 'cloud-api' || parsed.provider === 'baileys' || parsed.provider === 'stub'
            ? parsed.provider
            : fallback.provider
        ) as WhatsAppChannelSnapshot['provider'],
        providerConfigured: parsed.providerConfigured === true,
        providerDecision: typeof parsed.providerDecision === 'string' ? parsed.providerDecision : fallback.providerDecision,
        sessionDir: typeof parsed.sessionDir === 'string'
          ? String(parsed.sessionDir || '').trim() || null
          : fallback.sessionDir,
        sessionDirConfigured: parsed.sessionDirConfigured === true,
        phoneNumberId: typeof parsed.phoneNumberId === 'string'
          ? String(parsed.phoneNumberId || '').trim() || null
          : fallback.phoneNumberId,
        webhookConfigured: parsed.webhookConfigured === true,
        lastInboundAt: typeof parsed.lastInboundAt === 'string' ? parsed.lastInboundAt : null,
        lastOutboundAt: typeof parsed.lastOutboundAt === 'string' ? parsed.lastOutboundAt : null,
        lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
      };
    } catch (error) { logger.warn('[Operations  Channel Snapshot] parsing failed', error); return fallback; }
  }

  public readSlackChannelSnapshot(): SlackChannelSnapshot {
    const fallback: SlackChannelSnapshot = {
      mode: (
        String(config.slackBotToken || '').trim() && config.slackTransport !== 'stub'
          ? 'native'
          : config.slackEnabled || Boolean(config.slackWorkspaceId)
            ? 'stub'
            : 'unknown'
      ) as ChannelMode,
      enabled: Boolean(config.slackEnabled || config.slackBotToken || config.slackWorkspaceId),
      started: false,
      recipientsConfigured: config.slackAllowedChannelIds.length,
      allowedChannelIds: [...config.slackAllowedChannelIds],
      transport: (
        String(config.slackBotToken || '').trim() && config.slackTransport !== 'stub'
          ? 'native'
          : config.slackEnabled || Boolean(config.slackWorkspaceId)
            ? 'local'
            : 'unknown'
      ) as TransportMode,
      nativeConfigured: Boolean(String(config.slackBotToken || '').trim()),
      apiBaseUrl: String(config.slackApiBaseUrl || '').trim() || null,
      workspaceId: String(config.slackWorkspaceId || '').trim() || null,
      workspaceConfigured: Boolean(String(config.slackWorkspaceId || '').trim()),
      lastInboundAt: null,
      lastOutboundAt: null,
      lastError: null,
      updatedAt: null,
    };

    try {
      if (!this.existsSync(this.slackStatusFile)) {
        return fallback;
      }

      const parsed = JSON.parse(this.readFileSync(this.slackStatusFile, 'utf8')) as Record<string, unknown>;
      return {
        mode: (parsed.mode === 'native' || parsed.mode === 'stub' ? parsed.mode : fallback.mode) as ChannelMode,
        enabled: parsed.enabled === true,
        started: parsed.started === true,
        recipientsConfigured: Number(parsed.recipientsConfigured || 0) || 0,
        allowedChannelIds: Array.isArray(parsed.allowedChannelIds)
          ? parsed.allowedChannelIds.map((entry) => String(entry || '').trim()).filter(Boolean)
          : [...config.slackAllowedChannelIds],
        transport: (
          parsed.transport === 'native' || parsed.transport === 'local' || parsed.transport === 'stub'
            ? parsed.transport
            : fallback.transport
        ) as TransportMode,
        nativeConfigured: parsed.nativeConfigured === true,
        apiBaseUrl: typeof parsed.apiBaseUrl === 'string'
          ? String(parsed.apiBaseUrl || '').trim() || null
          : fallback.apiBaseUrl,
        workspaceId: typeof parsed.workspaceId === 'string'
          ? String(parsed.workspaceId || '').trim() || null
          : fallback.workspaceId,
        workspaceConfigured: parsed.workspaceConfigured === true,
        lastInboundAt: typeof parsed.lastInboundAt === 'string' ? parsed.lastInboundAt : null,
        lastOutboundAt: typeof parsed.lastOutboundAt === 'string' ? parsed.lastOutboundAt : null,
        lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
      };
    } catch (error) { logger.warn('[Operations  Channel Snapshot] parsing failed', error); return fallback; }
  }

  public readSignalChannelSnapshot(): PlannedChannelSnapshot {
    return this.readPlannedChannelHealthSnapshot({
      statusFile: config.signalStatusFile,
      fallback: {
        mode: 'signal-cli',
        enabled: Boolean(config.signalEnabled || config.signalCliPath || config.signalJsonRpcUrl),
        started: false,
        recipientsConfigured: config.signalAllowedRecipients.length,
        allowedRecipients: [...config.signalAllowedRecipients],
        providerConfigured: Boolean(config.signalCliPath || config.signalJsonRpcUrl),
        transport: config.signalCliPath || config.signalJsonRpcUrl ? 'bridge' : 'stub',
        accountNumber: String(config.signalAccountNumber || '').trim() || null,
        bridgeTarget: String(config.signalJsonRpcUrl || config.signalCliPath || '').trim() || null,
        lastInboundAt: null,
        lastOutboundAt: null,
        lastError: null,
        updatedAt: null,
      },
    });
  }

  public readIMessageChannelSnapshot(): PlannedChannelSnapshot {
    return this.readPlannedChannelHealthSnapshot({
      statusFile: config.imessageStatusFile,
      fallback: {
        mode: 'mac-bridge',
        enabled: Boolean(config.imessageEnabled || config.imessageNodeId || config.imessageBridgeScript),
        started: false,
        recipientsConfigured: config.imessageAllowedRecipients.length,
        allowedRecipients: [...config.imessageAllowedRecipients],
        providerConfigured: Boolean(config.imessageNodeId || config.imessageBridgeScript),
        transport: config.imessageNodeId || config.imessageBridgeScript ? 'bridge' : 'stub',
        platform: process.platform,
        readOnly: config.imessageReadOnly,
        lastInboundAt: null,
        lastOutboundAt: null,
        lastError: null,
        updatedAt: null,
      },
    });
  }

  public readTeamsChannelSnapshot(): PlannedChannelSnapshot {
    return this.readPlannedChannelHealthSnapshot({
      statusFile: config.teamsStatusFile,
      fallback: {
        mode: 'graph-bot',
        enabled: Boolean(config.teamsEnabled || config.teamsAppId),
        started: false,
        recipientsConfigured: config.teamsAllowedConversationIds.length,
        allowedRecipients: [...config.teamsAllowedConversationIds],
        providerConfigured: Boolean(
          config.teamsAppId
          && config.teamsTenantId
          && (config.teamsAppPassword || config.teamsClientSecret),
        ),
        transport: config.teamsAppId ? 'webhook' : 'stub',
        tenantId: String(config.teamsTenantId || '').trim() || null,
        appId: String(config.teamsAppId || '').trim() || null,
        webhookConfigured: false,
        lastInboundAt: null,
        lastOutboundAt: null,
        lastError: null,
        updatedAt: null,
      },
    });
  }

  public readEmailChannelSnapshot(): PlannedChannelSnapshot {
    return this.readPlannedChannelHealthSnapshot({
      statusFile: config.emailStatusFile,
      fallback: {
        mode: 'smtp-imap',
        enabled: Boolean(config.emailEnabled || config.emailSmtpHost),
        started: false,
        recipientsConfigured: config.emailAllowedRecipients.length,
        allowedRecipients: [...config.emailAllowedRecipients],
        providerConfigured: Boolean(config.emailSmtpHost),
        transport: config.emailSmtpHost ? 'native' : 'stub',
        smtpConfigured: Boolean(config.emailSmtpHost),
        imapConfigured: Boolean(config.emailImapHost),
        lastInboundAt: null,
        lastOutboundAt: null,
        lastError: null,
        updatedAt: null,
      },
    });
  }

  public readPlannedChannelHealthSnapshot(input: { statusFile: string; fallback: PlannedChannelSnapshot }): PlannedChannelSnapshot {
    const fallback = input.fallback;
    try {
      if (!input.statusFile || !this.existsSync(input.statusFile)) {
        return fallback;
      }

      const parsed = JSON.parse(this.readFileSync(input.statusFile, 'utf8')) as Record<string, unknown>;
      return {
        mode:
          parsed.mode === 'signal-cli'
          || parsed.mode === 'mac-bridge'
          || parsed.mode === 'graph-bot'
          || parsed.mode === 'smtp-imap'
          || parsed.mode === 'bridge'
          || parsed.mode === 'native'
          || parsed.mode === 'stub'
            ? parsed.mode
            : fallback.mode,
        enabled: parsed.enabled === true,
        started: parsed.started === true,
        recipientsConfigured: Number(parsed.recipientsConfigured || 0) || fallback.recipientsConfigured,
        allowedRecipients: Array.isArray(parsed.allowedRecipients)
          ? parsed.allowedRecipients.map((entry) => String(entry || '').trim()).filter(Boolean)
          : Array.isArray(parsed.allowedConversationIds)
            ? parsed.allowedConversationIds.map((entry) => String(entry || '').trim()).filter(Boolean)
            : [...fallback.allowedRecipients],
        providerConfigured: parsed.providerConfigured === true,
        transport:
          parsed.transport === 'bridge'
          || parsed.transport === 'webhook'
          || parsed.transport === 'native'
          || parsed.transport === 'local'
          || parsed.transport === 'stub'
            ? parsed.transport
            : fallback.transport,
        lastInboundAt: typeof parsed.lastInboundAt === 'string' ? parsed.lastInboundAt : null,
        lastOutboundAt: typeof parsed.lastOutboundAt === 'string' ? parsed.lastOutboundAt : null,
        lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
        platform: typeof parsed.platform === 'string' ? parsed.platform : fallback.platform || null,
        readOnly: typeof parsed.readOnly === 'boolean' ? parsed.readOnly : fallback.readOnly,
        accountNumber: typeof parsed.accountNumber === 'string' ? parsed.accountNumber : fallback.accountNumber || null,
        bridgeTarget: typeof parsed.bridgeTarget === 'string' ? parsed.bridgeTarget : fallback.bridgeTarget || null,
        tenantId: typeof parsed.tenantId === 'string' ? parsed.tenantId : fallback.tenantId || null,
        appId: typeof parsed.appId === 'string' ? parsed.appId : fallback.appId || null,
        smtpConfigured: typeof parsed.smtpConfigured === 'boolean' ? parsed.smtpConfigured : fallback.smtpConfigured,
        imapConfigured: typeof parsed.imapConfigured === 'boolean' ? parsed.imapConfigured : fallback.imapConfigured,
        webhookConfigured: typeof parsed.webhookConfigured === 'boolean' ? parsed.webhookConfigured : fallback.webhookConfigured,
      };
    } catch (error) { logger.warn('[Operations  Channel Snapshot] parsing failed', error); return fallback; }
  }

  public readZavorthBridgeMobileAccessSnapshot(): ZavorthBridgeMobileAccessSnapshot {
    const lease = this.zavorthBridgeAccessLease.readSnapshot();
    if (lease.status === 'missing') {
      return {
        available: false,
        status: 'missing',
        checkedAt: null,
        leaseId: null,
        mode: 'none',
        accessUrl: null,
        expiresAt: null,
        remainingMs: null,
        requiresPassword: false,
        startedSidecar: false,
        activatedRemoteMode: false,
        summary: 'Nenhum acesso movel do ZavorthBridge esta ativo neste host.',
        recommendedAction: '/agmobile start',
      };
    }

    return {
      available: lease.active,
      status: (lease.status === 'revoked' ? 'closed' : lease.status) as LeaseStatus,
      checkedAt: lease.updatedAt,
      leaseId: lease.leaseId,
      mode: lease.mode,
      accessUrl: lease.accessUrl,
      expiresAt: lease.expiresAt,
      remainingMs: lease.remainingMs,
      requiresPassword: lease.requiresPassword,
      startedSidecar: lease.startedSidecar,
      activatedRemoteMode: lease.activatedRemoteMode,
      summary:
        lease.status === 'active'
          ? `Acesso movel do ZavorthBridge ativo via ${lease.mode === 'public' ? 'URL publica' : 'LAN'}.`
          : lease.status === 'expired'
            ? 'O ultimo lease movel do ZavorthBridge expirou.'
            : 'O ultimo lease movel do ZavorthBridge foi encerrado manualmente.',
      recommendedAction: lease.status === 'active' ? '/agmobile stop' : '/agmobile start',
    };
  }
}
