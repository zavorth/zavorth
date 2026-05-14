import type {
  ChannelAdapterContract,
  ChannelAdapterStatus,
  ChannelConnectionSnapshot,
  ChannelStatusRow,
  ChannelStatusRowTone,
} from '../contracts/ChannelMeshContract.js';
import type { LiveChannelGatewayContract } from '../contracts/PlatformContract.js';
export type RuntimeAwareChannelGateway = LiveChannelGatewayContract;

export class WebRuntimeChannelAdapter implements ChannelAdapterContract {
  public readonly id = 'web';

  constructor(
    private readonly hasDispatcher: boolean,
    private readonly canSpawnWeb: boolean,
  ) {}

  public describe(): ChannelAdapterStatus {
    const notes = ['Canal web local do Zavorth sempre disponivel no dashboard e no app remoto.'];
    if (this.hasDispatcher && this.canSpawnWeb) {
      notes.push('Runtime web anexado ao gateway com session plane e approvals ativos.');
    }

    return {
      id: this.id,
      label: 'Web',
      readiness: 'ready',
      implementationState: 'full',
      configured: true,
      transport: 'virtual',
      notes,
      features: {
        inbound: true,
        outbound: true,
        sessionList: true,
        sessionHistory: true,
        sessionSend: this.hasDispatcher,
        sessionSpawn: this.canSpawnWeb,
        attachments: false,
        threads: false,
        groupPolicy: false,
        identityHints: true,
        approvals: true,
        rateLimit: false,
        webhook: false,
        localBridge: false,
        doctor: true,
        interactiveControls: true,
        slashCommands: false,
        richReplies: true,
        qrLogin: false,
      },
      interactiveSurface: {
        statusCard: true,
        inlineButtons: true,
        slashCommands: false,
        richReplies: true,
        modelMenus: true,
        qrLogin: false,
      },
    };
  }
}

export class TelegramRuntimeChannelAdapter implements ChannelAdapterContract {
  public readonly id = 'telegram';

  constructor(
    private readonly gateway: RuntimeAwareChannelGateway,
    private readonly hasDispatcher: boolean,
  ) {}

  public describe(): ChannelAdapterStatus {
    const identityHints = typeof this.gateway.getIdentityHints === 'function'
      ? this.gateway.getIdentityHints()
      : null;
    const started = typeof this.gateway.isStarted === 'function'
      ? this.gateway.isStarted()
      : true;
    const notes = ['Gateway do Telegram anexado ao mesh operacional do Zavorth.'];
    if (identityHints) {
      notes.push(`Identidade vinculada por ${identityHints.linkedBy} (${identityHints.verificationMethod}).`);
    }
    if (started) {
      notes.push('Surface do Telegram ativa no runtime atual.');
    }

    return {
      id: this.id,
      label: 'Telegram',
      readiness: started ? 'ready' : 'partial',
      implementationState: 'full',
      configured: true,
      transport: 'native',
      notes,
      features: {
        inbound: true,
        outbound: true,
        sessionList: true,
        sessionHistory: true,
        sessionSend: this.hasDispatcher,
        sessionSpawn: false,
        attachments: false,
        threads: true,
        groupPolicy: this.gateway.supportsRoleAwareBroadcast !== false,
        identityHints: Boolean(identityHints),
        approvals: true,
        rateLimit: true,
        webhook: false,
        localBridge: false,
        doctor: true,
        interactiveControls: true,
        slashCommands: true,
        richReplies: true,
        qrLogin: false,
      },
      interactiveSurface: {
        statusCard: true,
        inlineButtons: true,
        slashCommands: true,
        richReplies: true,
        modelMenus: true,
        qrLogin: false,
      },
    };
  }
}

export class DiscordRuntimeChannelAdapter implements ChannelAdapterContract {
  public readonly id = 'discord';

  constructor(
    private readonly gateway: RuntimeAwareChannelGateway,
    private readonly hasDispatcher: boolean,
  ) {}

  public describe(): ChannelAdapterStatus {
    const status = typeof this.gateway.readStatus === 'function'
      ? this.gateway.readStatus()
      : null;
    const identityHints = typeof this.gateway.getIdentityHints === 'function'
      ? this.gateway.getIdentityHints()
      : null;
    const mode = String(status?.mode || '').trim().toLowerCase();
    const enabled = status?.enabled === true;
    const started = status?.started === true
      || (typeof this.gateway.isStarted === 'function' && this.gateway.isStarted());
    const lastError = typeof status?.lastError === 'string' ? status.lastError : null;
    const readiness = enabled && started && !lastError ? 'ready' : 'partial';
    const notes = ['Gateway do Discord anexado ao mesh operacional do Zavorth.'];

    if (identityHints) {
      notes.push(`Identidade vinculada por ${identityHints.linkedBy} (${identityHints.verificationMethod}).`);
    }
    if (mode === 'native') {
      notes.push('Runtime do Discord operando em modo nativo.');
    } else if (mode === 'bridge') {
      notes.push('Runtime do Discord operando via bridge local supervisionada.');
    }
    if (lastError) {
      notes.push(`Ultimo erro do runtime do Discord: ${lastError}`);
    }

    return {
      id: this.id,
      label: 'Discord',
      readiness,
      implementationState: mode === 'native' ? 'full' : 'partial',
      configured: enabled || started,
      transport: mode === 'native' ? 'native' : mode === 'bridge' ? 'bridge' : 'local',
      notes,
      features: {
        inbound: true,
        outbound: true,
        sessionList: true,
        sessionHistory: true,
        sessionSend: this.hasDispatcher,
        sessionSpawn: false,
        attachments: true,
        threads: true,
        groupPolicy: true,
        identityHints: Boolean(identityHints),
        approvals: true,
        rateLimit: true,
        webhook: false,
        localBridge: mode === 'bridge',
        doctor: true,
        interactiveControls: true,
        slashCommands: mode === 'native',
        richReplies: true,
        qrLogin: false,
      },
      connection: buildConnection(status, {
        running: started,
        linked: enabled,
        connected: enabled && started && !lastError,
        mode,
        provider: mode || 'discord',
      }),
      statusRows: buildStatusRows([
        ['Modo', mode || 'local', 'neutral'],
        ['Runtime', started ? 'rodando' : 'parado', started ? 'success' : 'warning'],
        ['Configurado', enabled ? 'sim' : 'parcial', enabled ? 'success' : 'warning'],
        ['Ultimo erro', lastError || 'nenhum', lastError ? 'danger' : 'success'],
      ]),
      interactiveSurface: {
        statusCard: true,
        inlineButtons: true,
        slashCommands: mode === 'native',
        richReplies: true,
        modelMenus: true,
        qrLogin: false,
      },
    };
  }
}

export class SlackRuntimeChannelAdapter implements ChannelAdapterContract {
  public readonly id = 'slack';

  constructor(
    private readonly gateway: RuntimeAwareChannelGateway,
    private readonly hasDispatcher: boolean,
  ) {}

  public describe(): ChannelAdapterStatus {
    const status = typeof this.gateway.readStatus === 'function'
      ? this.gateway.readStatus()
      : null;
    const identityHints = typeof this.gateway.getIdentityHints === 'function'
      ? this.gateway.getIdentityHints()
      : null;
    const mode = String(status?.mode || '').trim().toLowerCase();
    const transport = String(status?.transport || '').trim().toLowerCase();
    const enabled = status?.enabled === true;
    const started = status?.started === true
      || (typeof this.gateway.isStarted === 'function' && this.gateway.isStarted());
    const recipientsConfigured = Number(status?.recipientsConfigured || 0) || 0;
    const lastError = typeof status?.lastError === 'string' ? status.lastError : null;
    const readiness = enabled && started && recipientsConfigured > 0 && !lastError
      ? 'ready'
      : enabled
        ? 'partial'
        : 'planned';
    const implementationState = mode === 'native' ? 'full' : enabled ? 'partial' : 'stub';
    const normalizedTransport = transport === 'native' ? 'native' : enabled ? 'local' : 'stub';
    const notes = ['Gateway do Slack anexado ao mesh operacional do Zavorth.'];

    if (identityHints) {
      notes.push(`Identidade vinculada por ${identityHints.linkedBy} (${identityHints.verificationMethod}).`);
    }
    if (mode === 'native') {
      notes.push('Runtime do Slack operando em modo nativo pela Web API.');
    } else if (enabled) {
      notes.push('Runtime do Slack operando via outbox local supervisionado.');
    }
    if (typeof status?.workspaceId === 'string' && status.workspaceId.trim()) {
      notes.push(`Workspace do Slack configurado em ${status.workspaceId.trim()}.`);
    }
    if (lastError) {
      notes.push(`Ultimo erro do runtime do Slack: ${lastError}`);
    }

    return {
      id: this.id,
      label: 'Slack',
      readiness,
      implementationState,
      configured: enabled || started,
      transport: normalizedTransport,
      notes,
      features: {
        inbound: true,
        outbound: true,
        sessionList: true,
        sessionHistory: true,
        sessionSend: this.hasDispatcher && readiness !== 'planned',
        sessionSpawn: false,
        attachments: true,
        threads: true,
        groupPolicy: true,
        identityHints: Boolean(identityHints),
        approvals: true,
        rateLimit: true,
        webhook: mode === 'native',
        localBridge: mode !== 'native',
        doctor: true,
        interactiveControls: true,
        slashCommands: true,
        richReplies: true,
        qrLogin: false,
      },
      connection: buildConnection(status, {
        running: started,
        linked: enabled,
        connected: enabled && started && recipientsConfigured > 0 && !lastError,
        mode,
        provider: mode === 'native' ? 'slack-web-api' : 'local-outbox',
      }),
      statusRows: buildStatusRows([
        ['Modo', mode || 'auto', 'neutral'],
        ['Runtime', started ? 'rodando' : 'parado', started ? 'success' : 'warning'],
        ['Recipients', String(recipientsConfigured), recipientsConfigured > 0 ? 'success' : 'warning'],
        ['Workspace', typeof status?.workspaceId === 'string' && status.workspaceId.trim() ? status.workspaceId.trim() : 'n/d', 'neutral'],
        ['Ultimo erro', lastError || 'nenhum', lastError ? 'danger' : 'success'],
      ]),
      interactiveSurface: {
        statusCard: true,
        inlineButtons: true,
        slashCommands: true,
        richReplies: true,
        modelMenus: true,
        qrLogin: false,
      },
    };
  }
}

export class WhatsAppRuntimeChannelAdapter implements ChannelAdapterContract {
  public readonly id = 'whatsapp';

  constructor(
    private readonly gateway: RuntimeAwareChannelGateway,
    private readonly hasDispatcher: boolean,
  ) {}

  public describe(): ChannelAdapterStatus {
    const status = typeof this.gateway.readStatus === 'function'
      ? this.gateway.readStatus()
      : null;
    const identityHints = typeof this.gateway.getIdentityHints === 'function'
      ? this.gateway.getIdentityHints()
      : null;
    const mode = String(status?.mode || '').trim().toLowerCase();
    const provider = String(status?.provider || '').trim().toLowerCase() || mode;
    const enabled = status?.enabled === true;
    const started = status?.started === true
      || (typeof this.gateway.isStarted === 'function' && this.gateway.isStarted());
    const recipientsConfigured = Number(status?.recipientsConfigured || 0) || 0;
    const providerConfigured = status?.providerConfigured === true;
    const webhookConfigured = status?.webhookConfigured === true;
    const sessionDirConfigured = status?.sessionDirConfigured === true;
    const lastError = typeof status?.lastError === 'string' ? status.lastError : null;
    const loginQr = status?.loginQr && typeof status.loginQr === 'object'
      ? status.loginQr as NonNullable<ChannelAdapterStatus['loginQr']>
      : null;
    const linked = status?.linked === true || providerConfigured || sessionDirConfigured;
    const connected = status?.connected === true
      || (provider === 'cloud-api'
        ? started && providerConfigured && webhookConfigured && !lastError
        : started && providerConfigured && !lastError);
    const lifecycleState = typeof status?.lifecycleState === 'string'
      ? status.lifecycleState
      : connected
        ? 'connected'
        : started
          ? 'running'
          : 'stopped';
    const webhookStatus = typeof status?.webhookStatus === 'string'
      ? status.webhookStatus
      : webhookConfigured
        ? 'configured'
        : provider === 'cloud-api'
          ? 'missing'
          : 'not_applicable';
    const recipientPolicy = status?.recipientPolicy && typeof status.recipientPolicy === 'object'
      ? status.recipientPolicy as { summary?: string; allowedCount?: number }
      : null;
    const localBridge = status?.localBridge && typeof status.localBridge === 'object'
      ? status.localBridge as { provider?: string; qrState?: string; sessionDirConfigured?: boolean }
      : null;

    const readiness =
      provider === 'cloud-api'
        ? enabled && started && recipientsConfigured > 0 && providerConfigured && webhookConfigured && !lastError
          ? 'ready'
          : enabled || providerConfigured
            ? 'partial'
            : 'planned'
        : provider === 'baileys'
          ? enabled || providerConfigured || sessionDirConfigured
            ? 'partial'
            : 'planned'
          : enabled && started && recipientsConfigured > 0 && !lastError
            ? 'ready'
            : enabled
              ? 'partial'
              : 'planned';

    const implementationState =
      provider === 'cloud-api'
        ? 'full'
        : provider === 'baileys'
          ? 'partial'
          : enabled
            ? 'partial'
            : 'stub';

    const transport =
      provider === 'cloud-api'
        ? 'webhook'
        : enabled || providerConfigured || sessionDirConfigured
          ? 'local'
          : 'stub';

    const notes = ['Gateway do WhatsApp anexado ao mesh operacional do Zavorth.'];
    if (identityHints) {
      notes.push(`Identidade vinculada por ${identityHints.linkedBy} (${identityHints.verificationMethod}).`);
    }
    if (provider === 'cloud-api') {
      notes.push('Runtime do WhatsApp operando pela Cloud API da Meta.');
    } else if (provider === 'baileys') {
      notes.push('Runtime do WhatsApp reservado para rollout futuro com Baileys.');
    } else if (enabled) {
      notes.push('Runtime do WhatsApp operando via outbox local supervisionado.');
    }
    if (typeof status?.providerDecision === 'string' && status.providerDecision.trim()) {
      notes.push(status.providerDecision.trim());
    }
    if (typeof status?.phoneNumberId === 'string' && status.phoneNumberId.trim()) {
      notes.push(`Phone number id configurado em ${status.phoneNumberId.trim()}.`);
    }
    if (lastError) {
      notes.push(`Ultimo erro do runtime do WhatsApp: ${lastError}`);
    }

    return {
      id: this.id,
      label: 'WhatsApp',
      readiness,
      implementationState,
      configured: enabled || started || providerConfigured || sessionDirConfigured,
      transport,
      notes,
      features: {
        inbound: provider === 'cloud-api',
        outbound: readiness !== 'planned',
        sessionList: true,
        sessionHistory: true,
        sessionSend: this.hasDispatcher && readiness !== 'planned',
        sessionSpawn: false,
        attachments: provider === 'cloud-api',
        threads: false,
        groupPolicy: true,
        identityHints: Boolean(identityHints),
        approvals: true,
        rateLimit: true,
        webhook: provider === 'cloud-api',
        localBridge: provider !== 'cloud-api',
        doctor: true,
        interactiveControls: true,
        slashCommands: false,
        richReplies: true,
        qrLogin: provider !== 'cloud-api',
      },
      connection: buildConnection(status, {
        running: started,
        linked,
        connected,
        mode,
        provider,
      }),
      statusRows: buildStatusRows([
        ['Provider', String(status?.providerModeLabel || provider || 'stub'), 'neutral'],
        ['Ciclo', lifecycleState, lifecycleState === 'connected' ? 'success' : lifecycleState === 'error' ? 'danger' : 'warning'],
        ['Runtime', started ? 'rodando' : 'parado', started ? 'success' : 'warning'],
        ['Conectado', connected ? 'sim' : 'nao', connected ? 'success' : 'warning'],
        ['Recipients', String(recipientsConfigured), recipientsConfigured > 0 ? 'success' : 'warning'],
        ['Allowlist', recipientPolicy?.summary || `${recipientsConfigured} chat(s) permitidos`, recipientsConfigured > 0 ? 'success' : 'warning'],
        ['Webhook', webhookStatus === 'configured' ? 'configurado' : provider === 'cloud-api' ? 'pendente' : 'n/a', webhookStatus === 'configured' ? 'success' : provider === 'cloud-api' ? 'warning' : 'neutral'],
        ['Bridge local', localBridge ? `${localBridge.provider || provider} (${localBridge.qrState || 'sem QR'})` : 'n/a', localBridge?.sessionDirConfigured ? 'success' : provider === 'cloud-api' ? 'neutral' : 'warning'],
        ['QR', loginQr?.state || (provider === 'cloud-api' ? 'n/a' : 'pendente'), loginQr?.state === 'ready' ? 'success' : provider === 'cloud-api' ? 'neutral' : 'warning'],
        ['Ultimo erro', lastError || 'nenhum', lastError ? 'danger' : 'success'],
      ]),
      loginQr,
      interactiveSurface: {
        statusCard: true,
        inlineButtons: true,
        slashCommands: false,
        richReplies: true,
        modelMenus: false,
        qrLogin: provider !== 'cloud-api',
      },
      setupMode: provider === 'cloud-api' ? 'cloud-api' : provider === 'baileys' ? 'baileys' : 'stub',
      provider: provider === 'cloud-api' ? 'meta-cloud-api' : provider,
      webhookPath: provider === 'cloud-api' ? '/api/webhooks/whatsapp' : null,
      doctorCommand: 'npm run test:channels:smoke',
      lastHealth: readiness === 'ready' ? 'passed' : lastError ? 'failed' : 'unknown',
      lastEventAt: typeof status?.lastInboundAt === 'string' ? status.lastInboundAt : typeof status?.lastOutboundAt === 'string' ? status.lastOutboundAt : null,
      operatorNextStep:
        provider === 'cloud-api'
          ? readiness === 'ready'
            ? 'Monitore webhook, delivery e policy antes de ampliar o rollout do WhatsApp.'
            : 'Complete credenciais Cloud API, callback /api/webhooks/whatsapp e chats permitidos.'
          : loginQr?.state === 'expired'
            ? 'Solicite /channels relink whatsapp para preparar novo QR da bridge local.'
            : loginQr?.state === 'ready'
              ? 'Exiba o QR do WhatsApp para parear a sessao local supervisionada.'
              : 'Solicite /channels login-qr whatsapp ou conecte a bridge que publica qr.txt na sessao local.',
    };
  }
}

export class InstagramRuntimeChannelAdapter implements ChannelAdapterContract {
  public readonly id = 'instagram';

  constructor(
    private readonly gateway: RuntimeAwareChannelGateway,
    private readonly hasDispatcher: boolean,
  ) {}

  public describe(): ChannelAdapterStatus {
    const status = typeof this.gateway.readStatus === 'function'
      ? this.gateway.readStatus()
      : null;
    const identityHints = typeof this.gateway.getIdentityHints === 'function'
      ? this.gateway.getIdentityHints()
      : null;
    const mode = String(status?.mode || '').trim().toLowerCase();
    const provider = String(status?.provider || '').trim().toLowerCase() || mode;
    const enabled = status?.enabled === true;
    const started = status?.started === true
      || (typeof this.gateway.isStarted === 'function' && this.gateway.isStarted());
    const recipientsConfigured = Number(status?.recipientsConfigured || 0) || 0;
    const providerConfigured = status?.providerConfigured === true;
    const webhookConfigured = status?.webhookConfigured === true;
    const lastError = typeof status?.lastError === 'string' ? status.lastError : null;
    const connected = status?.connected === true
      || (provider === 'meta-messaging' && started && providerConfigured && webhookConfigured && !lastError);
    const recipientPolicy = status?.recipientPolicy && typeof status.recipientPolicy === 'object'
      ? status.recipientPolicy as { summary?: string }
      : null;

    const readiness =
      provider === 'meta-messaging'
        ? enabled && started && recipientsConfigured > 0 && providerConfigured && webhookConfigured && !lastError
          ? 'ready'
          : enabled || providerConfigured || recipientsConfigured > 0
            ? 'partial'
            : 'planned'
        : enabled && started && recipientsConfigured > 0 && !lastError
          ? 'ready'
          : enabled || recipientsConfigured > 0
            ? 'partial'
            : 'planned';

    const notes = ['Gateway do Instagram anexado ao mesh operacional do Zavorth.'];
    if (identityHints) {
      notes.push(`Identidade vinculada por ${identityHints.linkedBy} (${identityHints.verificationMethod}).`);
    }
    if (provider === 'meta-messaging') {
      notes.push('Runtime do Instagram preparado para Meta Instagram Messaging API.');
    } else {
      notes.push('Instagram segue em outbox local supervisionado ate receber credenciais oficiais da Meta.');
    }
    if (typeof status?.providerDecision === 'string' && status.providerDecision.trim()) {
      notes.push(status.providerDecision.trim());
    }
    if (typeof status?.businessAccountId === 'string' && status.businessAccountId.trim()) {
      notes.push(`Instagram business account id configurado em ${status.businessAccountId.trim()}.`);
    }
    if (lastError) {
      notes.push(`Ultimo erro do runtime do Instagram: ${lastError}`);
    }

    return {
      id: this.id,
      label: 'Instagram',
      readiness,
      implementationState: provider === 'meta-messaging' ? 'full' : enabled ? 'partial' : 'stub',
      configured: enabled || started || providerConfigured || recipientsConfigured > 0,
      transport: provider === 'meta-messaging' ? 'webhook' : enabled || recipientsConfigured > 0 ? 'local' : 'stub',
      notes,
      features: {
        inbound: provider === 'meta-messaging',
        outbound: readiness !== 'planned',
        sessionList: true,
        sessionHistory: true,
        sessionSend: this.hasDispatcher && readiness !== 'planned',
        sessionSpawn: false,
        attachments: false,
        threads: false,
        groupPolicy: true,
        identityHints: Boolean(identityHints),
        approvals: true,
        rateLimit: true,
        webhook: provider === 'meta-messaging',
        localBridge: provider !== 'meta-messaging',
        doctor: true,
        interactiveControls: true,
        slashCommands: false,
        richReplies: true,
        qrLogin: false,
      },
      connection: buildConnection(status, {
        running: started,
        linked: providerConfigured || recipientsConfigured > 0,
        connected,
        mode: provider || 'stub',
        provider: provider === 'meta-messaging' ? 'instagram-messaging-api' : 'local-outbox',
      }),
      statusRows: buildStatusRows([
        ['Provider', provider === 'meta-messaging' ? 'Meta Instagram Messaging API' : 'outbox local', 'neutral'],
        ['Runtime', started ? 'rodando' : 'parado', started ? 'success' : 'warning'],
        ['Conectado', connected ? 'sim' : 'nao', connected ? 'success' : 'warning'],
        ['Business account', typeof status?.businessAccountId === 'string' && status.businessAccountId.trim() ? status.businessAccountId.trim() : 'n/d', providerConfigured ? 'success' : 'warning'],
        ['Webhook', webhookConfigured ? 'configurado' : provider === 'meta-messaging' ? 'pendente' : 'n/a', webhookConfigured ? 'success' : provider === 'meta-messaging' ? 'warning' : 'neutral'],
        ['Allowlist', recipientPolicy?.summary || `${recipientsConfigured} recipient(s) permitidos`, recipientsConfigured > 0 ? 'success' : 'warning'],
        ['Ultimo erro', lastError || 'nenhum', lastError ? 'danger' : 'success'],
      ]),
      interactiveSurface: {
        statusCard: true,
        inlineButtons: false,
        slashCommands: false,
        richReplies: true,
        modelMenus: false,
        qrLogin: false,
      },
      riskLevel: 'medium',
      setupMode: provider === 'meta-messaging' ? 'meta-messaging' : 'stub',
      provider: provider === 'meta-messaging' ? 'instagram-messaging-api' : 'local-outbox',
      webhookPath: provider === 'meta-messaging' ? '/api/webhooks/instagram' : null,
      doctorCommand: 'npm run test:channels:smoke',
      lastHealth: readiness === 'ready' ? 'passed' : lastError ? 'failed' : 'unknown',
      lastEventAt: typeof status?.lastInboundAt === 'string' ? status.lastInboundAt : typeof status?.lastOutboundAt === 'string' ? status.lastOutboundAt : null,
      operatorNextStep:
        provider === 'meta-messaging'
          ? readiness === 'ready'
            ? 'Monitore webhook, policy e janela de conversa antes de ampliar o rollout do Instagram.'
            : 'Complete business account id, access token, verify token, callback /api/webhooks/instagram e recipients permitidos.'
          : 'Use /channels prepare instagram para preparar Meta Instagram Messaging API ou valide o outbox local supervisionado.',
    };
  }
}

export class SignalRuntimeChannelAdapter implements ChannelAdapterContract {
  public readonly id = 'signal';

  constructor(
    private readonly gateway: RuntimeAwareChannelGateway,
    private readonly hasDispatcher: boolean,
  ) {}

  public describe(): ChannelAdapterStatus {
    const status = typeof this.gateway.readStatus === 'function'
      ? this.gateway.readStatus()
      : null;
    const identityHints = typeof this.gateway.getIdentityHints === 'function'
      ? this.gateway.getIdentityHints()
      : null;
    const enabled = status?.enabled === true;
    const started = status?.started === true
      || (typeof this.gateway.isStarted === 'function' && this.gateway.isStarted());
    const recipientsConfigured = Number(status?.recipientsConfigured || 0) || 0;
    const providerConfigured = status?.providerConfigured === true;
    const lastError = typeof status?.lastError === 'string' ? status.lastError : null;
    const readiness =
      enabled && started && recipientsConfigured > 0 && providerConfigured && !lastError
        ? 'ready'
        : enabled || providerConfigured || recipientsConfigured > 0
          ? 'partial'
          : 'planned';
    const notes = ['Gateway do Signal anexado ao mesh operacional do Zavorth.'];

    if (identityHints) {
      notes.push(`Identidade vinculada por ${identityHints.linkedBy} (${identityHints.verificationMethod}).`);
    }
    if (providerConfigured) {
      notes.push('Bridge signal-cli/JSON-RPC configurada para runtime supervisionado.');
    } else {
      notes.push('Signal ainda opera como bridge local honesta, exigindo bootstrap do signal-cli.');
    }
    if (lastError) {
      notes.push(`Ultimo erro do runtime do Signal: ${lastError}`);
    }

    return {
      id: this.id,
      label: 'Signal',
      readiness,
      implementationState: enabled || providerConfigured ? 'partial' : 'planned',
      configured: enabled || started || providerConfigured || recipientsConfigured > 0,
      transport: enabled || providerConfigured ? 'bridge' : 'stub',
      notes,
      features: {
        inbound: readiness !== 'planned',
        outbound: readiness !== 'planned',
        sessionList: true,
        sessionHistory: true,
        sessionSend: this.hasDispatcher && readiness !== 'planned',
        sessionSpawn: false,
        attachments: true,
        threads: false,
        groupPolicy: true,
        identityHints: Boolean(identityHints),
        approvals: true,
        rateLimit: true,
        webhook: false,
        localBridge: true,
        doctor: true,
        interactiveControls: true,
        slashCommands: false,
        richReplies: true,
        qrLogin: false,
      },
      connection: buildConnection(status, {
        running: started,
        linked: providerConfigured,
        connected: enabled && started && recipientsConfigured > 0 && providerConfigured && !lastError,
        mode: 'signal-cli',
        provider: 'signal-cli',
      }),
      statusRows: buildStatusRows([
        ['Runtime', started ? 'rodando' : 'parado', started ? 'success' : 'warning'],
        ['Bridge', providerConfigured ? 'configurada' : 'pendente', providerConfigured ? 'success' : 'warning'],
        ['Recipients', String(recipientsConfigured), recipientsConfigured > 0 ? 'success' : 'warning'],
        ['Ultimo erro', lastError || 'nenhum', lastError ? 'danger' : 'success'],
      ]),
      interactiveSurface: {
        statusCard: true,
        inlineButtons: false,
        slashCommands: false,
        richReplies: true,
        modelMenus: false,
        qrLogin: false,
      },
      riskLevel: 'high',
      setupMode: 'signal-cli',
      provider: 'signal-cli',
      doctorCommand: 'npm run test:channels:smoke',
      lastHealth: readiness === 'ready' ? 'passed' : lastError ? 'failed' : 'unknown',
      lastEventAt: typeof status?.lastInboundAt === 'string' ? status.lastInboundAt : null,
      operatorNextStep:
        readiness === 'ready'
          ? 'Use /channels broadcast-test signal para validar a bridge supervisionada.'
          : 'Configure signal-cli/JSON-RPC, conta dedicada e allowlist antes de ampliar o rollout.',
    };
  }
}

export class IMessageRuntimeChannelAdapter implements ChannelAdapterContract {
  public readonly id = 'imessage';

  constructor(
    private readonly gateway: RuntimeAwareChannelGateway,
    private readonly hasDispatcher: boolean,
  ) {}

  public describe(): ChannelAdapterStatus {
    const status = typeof this.gateway.readStatus === 'function'
      ? this.gateway.readStatus()
      : null;
    const identityHints = typeof this.gateway.getIdentityHints === 'function'
      ? this.gateway.getIdentityHints()
      : null;
    const enabled = status?.enabled === true;
    const started = status?.started === true
      || (typeof this.gateway.isStarted === 'function' && this.gateway.isStarted());
    const recipientsConfigured = Number(status?.recipientsConfigured || 0) || 0;
    const providerConfigured = status?.providerConfigured === true;
    const readOnly = status?.readOnly !== false;
    const lastError = typeof status?.lastError === 'string' ? status.lastError : null;
    const readiness =
      enabled && started && recipientsConfigured > 0 && providerConfigured && !lastError
        ? 'ready'
        : enabled || providerConfigured || recipientsConfigured > 0
          ? 'partial'
          : 'planned';
    const notes = ['Gateway do iMessage anexado ao mesh operacional do Zavorth.'];

    if (identityHints) {
      notes.push(`Identidade vinculada por ${identityHints.linkedBy} (${identityHints.verificationMethod}).`);
    }
    if (readOnly) {
      notes.push('Bridge do iMessage segue em modo read-only como padrao seguro.');
    }
    if (lastError) {
      notes.push(`Ultimo erro do runtime do iMessage: ${lastError}`);
    }

    return {
      id: this.id,
      label: 'iMessage',
      readiness,
      implementationState: enabled || providerConfigured ? 'partial' : 'planned',
      configured: enabled || started || providerConfigured || recipientsConfigured > 0,
      transport: enabled || providerConfigured ? 'bridge' : 'stub',
      notes,
      features: {
        inbound: readiness !== 'planned',
        outbound: readiness !== 'planned',
        sessionList: true,
        sessionHistory: true,
        sessionSend: this.hasDispatcher && readiness !== 'planned',
        sessionSpawn: false,
        attachments: false,
        threads: false,
        groupPolicy: true,
        identityHints: Boolean(identityHints),
        approvals: true,
        rateLimit: true,
        webhook: false,
        localBridge: true,
        doctor: true,
        interactiveControls: true,
        slashCommands: false,
        richReplies: true,
        qrLogin: false,
      },
      connection: buildConnection(status, {
        running: started,
        linked: providerConfigured,
        connected: enabled && started && recipientsConfigured > 0 && providerConfigured && !lastError,
        mode: 'mac-bridge',
        provider: 'macos-node-host',
      }),
      statusRows: buildStatusRows([
        ['Runtime', started ? 'rodando' : 'parado', started ? 'success' : 'warning'],
        ['Bridge', providerConfigured ? 'configurada' : 'pendente', providerConfigured ? 'success' : 'warning'],
        ['Read-only', readOnly ? 'sim' : 'nao', readOnly ? 'success' : 'warning'],
        ['Recipients', String(recipientsConfigured), recipientsConfigured > 0 ? 'success' : 'warning'],
        ['Ultimo erro', lastError || 'nenhum', lastError ? 'danger' : 'success'],
      ]),
      interactiveSurface: {
        statusCard: true,
        inlineButtons: false,
        slashCommands: false,
        richReplies: true,
        modelMenus: false,
        qrLogin: false,
      },
      riskLevel: 'experimental',
      setupMode: 'mac-bridge',
      provider: 'macos-node-host',
      doctorCommand: 'npm run test:channels:smoke',
      lastHealth: readiness === 'ready' ? 'passed' : lastError ? 'failed' : 'unknown',
      lastEventAt: typeof status?.lastInboundAt === 'string' ? status.lastInboundAt : null,
      operatorNextStep:
        readiness === 'ready'
          ? 'Valide approvals explicitas antes de permitir envio mais amplo via iMessage.'
          : 'Suba um Node Host macOS, mantenha read-only e configure allowlist por recipient.',
    };
  }
}

export class TeamsRuntimeChannelAdapter implements ChannelAdapterContract {
  public readonly id = 'teams';

  constructor(
    private readonly gateway: RuntimeAwareChannelGateway,
    private readonly hasDispatcher: boolean,
  ) {}

  public describe(): ChannelAdapterStatus {
    const status = typeof this.gateway.readStatus === 'function'
      ? this.gateway.readStatus()
      : null;
    const identityHints = typeof this.gateway.getIdentityHints === 'function'
      ? this.gateway.getIdentityHints()
      : null;
    const enabled = status?.enabled === true;
    const started = status?.started === true
      || (typeof this.gateway.isStarted === 'function' && this.gateway.isStarted());
    const recipientsConfigured = Number(status?.recipientsConfigured || 0) || 0;
    const providerConfigured = status?.providerConfigured === true;
    const webhookConfigured = status?.webhookConfigured === true || started;
    const lastError = typeof status?.lastError === 'string' ? status.lastError : null;
    const readiness =
      enabled && started && recipientsConfigured > 0 && providerConfigured && webhookConfigured && !lastError
        ? 'ready'
        : enabled || providerConfigured || recipientsConfigured > 0
          ? 'partial'
          : 'planned';
    const notes = ['Gateway do Microsoft Teams anexado ao mesh operacional do Zavorth.'];

    if (identityHints) {
      notes.push(`Identidade vinculada por ${identityHints.linkedBy} (${identityHints.verificationMethod}).`);
    }
    if (providerConfigured) {
      notes.push('Credenciais do app/tenant do Teams presentes para rollout supervisionado.');
    }
    if (lastError) {
      notes.push(`Ultimo erro do runtime do Teams: ${lastError}`);
    }

    return {
      id: this.id,
      label: 'Microsoft Teams',
      readiness,
      implementationState: enabled || providerConfigured ? 'partial' : 'planned',
      configured: enabled || started || providerConfigured || recipientsConfigured > 0,
      transport: enabled || providerConfigured ? 'webhook' : 'stub',
      notes,
      features: {
        inbound: readiness !== 'planned',
        outbound: readiness !== 'planned',
        sessionList: true,
        sessionHistory: true,
        sessionSend: this.hasDispatcher && readiness !== 'planned',
        sessionSpawn: false,
        attachments: true,
        threads: true,
        groupPolicy: true,
        identityHints: Boolean(identityHints),
        approvals: true,
        rateLimit: true,
        webhook: true,
        localBridge: false,
        doctor: true,
        interactiveControls: true,
        slashCommands: true,
        richReplies: true,
        qrLogin: false,
      },
      connection: buildConnection(status, {
        running: started,
        linked: providerConfigured,
        connected: enabled && started && recipientsConfigured > 0 && providerConfigured && webhookConfigured && !lastError,
        mode: 'graph-bot',
        provider: 'microsoft-graph-bot-framework',
      }),
      statusRows: buildStatusRows([
        ['Runtime', started ? 'rodando' : 'parado', started ? 'success' : 'warning'],
        ['Tenant/app', providerConfigured ? 'configurado' : 'pendente', providerConfigured ? 'success' : 'warning'],
        ['Webhook', webhookConfigured ? 'configurado' : 'pendente', webhookConfigured ? 'success' : 'warning'],
        ['Recipients', String(recipientsConfigured), recipientsConfigured > 0 ? 'success' : 'warning'],
        ['Ultimo erro', lastError || 'nenhum', lastError ? 'danger' : 'success'],
      ]),
      interactiveSurface: {
        statusCard: true,
        inlineButtons: true,
        slashCommands: true,
        richReplies: true,
        modelMenus: true,
        qrLogin: false,
      },
      riskLevel: 'medium',
      setupMode: 'graph-bot',
      provider: 'microsoft-graph-bot-framework',
      webhookPath: '/api/webhooks/teams',
      doctorCommand: 'npm run test:channels:smoke',
      lastHealth: readiness === 'ready' ? 'passed' : lastError ? 'failed' : 'unknown',
      lastEventAt: typeof status?.lastInboundAt === 'string' ? status.lastInboundAt : null,
      operatorNextStep:
        readiness === 'ready'
          ? 'Use /channels broadcast-test teams e valide o webhook corporativo antes do rollout.'
          : 'Configure app id, tenant, secret e allowlist de conversations antes de abrir o canal.',
    };
  }
}

export class EmailRuntimeChannelAdapter implements ChannelAdapterContract {
  public readonly id = 'email';

  constructor(
    private readonly gateway: RuntimeAwareChannelGateway,
    private readonly hasDispatcher: boolean,
  ) {}

  public describe(): ChannelAdapterStatus {
    const status = typeof this.gateway.readStatus === 'function'
      ? this.gateway.readStatus()
      : null;
    const identityHints = typeof this.gateway.getIdentityHints === 'function'
      ? this.gateway.getIdentityHints()
      : null;
    const enabled = status?.enabled === true;
    const started = status?.started === true
      || (typeof this.gateway.isStarted === 'function' && this.gateway.isStarted());
    const recipientsConfigured = Number(status?.recipientsConfigured || 0) || 0;
    const providerConfigured = status?.providerConfigured === true || status?.smtpConfigured === true;
    const imapConfigured = status?.imapConfigured === true;
    const lastError = typeof status?.lastError === 'string' ? status.lastError : null;
    const readiness =
      enabled && started && recipientsConfigured > 0 && providerConfigured && !lastError
        ? 'ready'
        : enabled || providerConfigured || recipientsConfigured > 0 || imapConfigured
          ? 'partial'
          : 'planned';
    const notes = ['Gateway de Email anexado ao mesh operacional do Zavorth.'];

    if (identityHints) {
      notes.push(`Identidade vinculada por ${identityHints.linkedBy} (${identityHints.verificationMethod}).`);
    }
    if (imapConfigured) {
      notes.push('IMAP esta disponivel para inbound/approval polling no proximo rollout.');
    }
    if (lastError) {
      notes.push(`Ultimo erro do runtime de Email: ${lastError}`);
    }

    return {
      id: this.id,
      label: 'Email',
      readiness,
      implementationState: enabled || providerConfigured ? 'partial' : 'planned',
      configured: enabled || started || providerConfigured || recipientsConfigured > 0 || imapConfigured,
      transport: enabled || providerConfigured ? 'native' : 'stub',
      notes,
      features: {
        inbound: readiness !== 'planned',
        outbound: readiness !== 'planned',
        sessionList: true,
        sessionHistory: true,
        sessionSend: this.hasDispatcher && readiness !== 'planned',
        sessionSpawn: false,
        attachments: true,
        threads: true,
        groupPolicy: true,
        identityHints: Boolean(identityHints),
        approvals: true,
        rateLimit: true,
        webhook: false,
        localBridge: false,
        doctor: true,
        interactiveControls: true,
        slashCommands: false,
        richReplies: true,
        qrLogin: false,
      },
      connection: buildConnection(status, {
        running: started,
        linked: providerConfigured,
        connected: enabled && started && recipientsConfigured > 0 && providerConfigured && !lastError,
        mode: 'smtp-imap',
        provider: 'smtp-imap',
      }),
      statusRows: buildStatusRows([
        ['Runtime', started ? 'rodando' : 'parado', started ? 'success' : 'warning'],
        ['SMTP', providerConfigured ? 'configurado' : 'pendente', providerConfigured ? 'success' : 'warning'],
        ['IMAP', imapConfigured ? 'configurado' : 'opcional', imapConfigured ? 'success' : 'neutral'],
        ['Recipients', String(recipientsConfigured), recipientsConfigured > 0 ? 'success' : 'warning'],
        ['Ultimo erro', lastError || 'nenhum', lastError ? 'danger' : 'success'],
      ]),
      interactiveSurface: {
        statusCard: true,
        inlineButtons: false,
        slashCommands: false,
        richReplies: true,
        modelMenus: false,
        qrLogin: false,
      },
      riskLevel: 'low',
      setupMode: 'smtp-imap',
      provider: 'smtp-imap',
      doctorCommand: 'npm run test:channels:smoke',
      lastHealth: readiness === 'ready' ? 'passed' : lastError ? 'failed' : 'unknown',
      lastEventAt: typeof status?.lastInboundAt === 'string' ? status.lastInboundAt : null,
      operatorNextStep:
        readiness === 'ready'
          ? 'Use /channels send-test email e amplie IMAP apenas quando quiser approvals por resposta.'
          : 'Configure SMTP, allowlist de recipients e depois avalie IMAP para inbound.',
    };
  }
}

function buildConnection(
  status: any,
  fallback: {
    running: boolean;
    linked: boolean;
    connected: boolean;
    mode: string | null;
    provider: string | null;
  },
): ChannelConnectionSnapshot {
  return {
    running: status?.running === true || fallback.running,
    linked: status?.linked === true || fallback.linked,
    connected: status?.connected === true || fallback.connected,
    mode: typeof status?.mode === 'string' && status.mode.trim() ? status.mode.trim() : fallback.mode,
    provider: typeof status?.provider === 'string' && status.provider.trim() ? status.provider.trim() : fallback.provider,
    lastStartAt: typeof status?.lastStartAt === 'string' ? status.lastStartAt : null,
    lastConnectedAt: typeof status?.lastConnectedAt === 'string' ? status.lastConnectedAt : null,
    lastInboundAt: typeof status?.lastInboundAt === 'string' ? status.lastInboundAt : null,
    lastOutboundAt: typeof status?.lastOutboundAt === 'string' ? status.lastOutboundAt : null,
    lastError: typeof status?.lastError === 'string' ? status.lastError : null,
    authAgeMs: typeof status?.authAgeMs === 'number' && Number.isFinite(status.authAgeMs) ? status.authAgeMs : null,
  };
}

function buildStatusRows(rows: Array<[string, string, ChannelStatusRowTone?]>): ChannelStatusRow[] {
  return rows
    .map(([label, value, tone]) => ({
      label,
      value: String(value || '').trim() || 'n/d',
      ...(tone ? { tone } : {}),
    }))
    .filter((row) => row.label.trim());
}
