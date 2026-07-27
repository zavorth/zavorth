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
    const notes = ['Local Zavorth web channel is always available in ZavorthControl and the remote app.'];
    if (this.hasDispatcher && this.canSpawnWeb) {
      notes.push('Web runtime attached to the gateway with session plane and active approvals.');
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
    const notes = ['Telegram gateway attached to the Zavorth operational mesh.'];
    if (identityHints) {
      notes.push(`Identity linked by ${identityHints.linkedBy} (${identityHints.verificationMethod}).`);
    }
    if (started) {
      notes.push('Telegram surface active in the current runtime.');
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
    const notes = ['Discord gateway attached to the Zavorth operational mesh.'];

    if (identityHints) {
      notes.push(`Identity linked by ${identityHints.linkedBy} (${identityHints.verificationMethod}).`);
    }
    if (mode === 'native') {
      notes.push('Discord runtime operating in native mode.');
    } else if (mode === 'bridge') {
      notes.push('Discord runtime operating through supervised local bridge.');
    }
    if (lastError) {
      notes.push(`Latest Discord runtime error: ${lastError}`);
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
        ['Runtime', started ? 'running' : 'stopped', started ? 'success' : 'warning'],
        ['configured', enabled ? 'yes' : 'partial', enabled ? 'success' : 'warning'],
        ['Latest error', lastError || 'none', lastError ? 'danger' : 'success'],
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
    const readiness = enabled && started && recipientsConfigured > 0 && !lastError ? 'ready'
      : enabled ? 'partial'
        : 'planned';
    const implementationState = mode === 'native' ? 'full' : enabled ? 'partial' : 'planned';
    const normalizedTransport = transport === 'native' ? 'native' : enabled ? 'local' : 'planned';
    const notes = ['Slack gateway attached to the Zavorth operational mesh.'];

    if (identityHints) {
      notes.push(`Identity linked by ${identityHints.linkedBy} (${identityHints.verificationMethod}).`);
    }
    if (mode === 'native') {
      notes.push('Slack runtime operating in native Web API mode.');
    } else if (enabled) {
      notes.push('Slack runtime operating through supervised local outbox.');
    }
    if (typeof status?.workspaceId === 'string' && status.workspaceId.trim()) {
      notes.push(`Slack workspace configured at ${status.workspaceId.trim()}.`);
    }
    if (lastError) {
      notes.push(`Latest Slack runtime error: ${lastError}`);
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
        ['Runtime', started ? 'running' : 'stopped', started ? 'success' : 'warning'],
        ['Recipients', String(recipientsConfigured), recipientsConfigured > 0 ? 'success' : 'warning'],
        ['Workspace', typeof status?.workspaceId === 'string' && status.workspaceId.trim() ? status.workspaceId.trim() : 'n/d', 'neutral'],
        ['Latest error', lastError || 'none', lastError ? 'danger' : 'success'],
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
      : connected ? 'connected'
        : started ? 'running'
          : 'stopped';
    const webhookStatus = typeof status?.webhookStatus === 'string'
      ? status.webhookStatus
      : webhookConfigured ? 'configured'
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
        ? enabled && started && recipientsConfigured > 0 && providerConfigured && webhookConfigured && !lastError ? 'ready'
          : enabled || providerConfigured ? 'partial'
            : 'planned'
        : provider === 'baileys'
          ? enabled || providerConfigured || sessionDirConfigured ? 'partial'
            : 'planned'
          : enabled && started && recipientsConfigured > 0 && !lastError ? 'ready'
            : enabled ? 'partial'
              : 'planned';

    const implementationState =
      provider === 'cloud-api'
        ? 'full'
        : provider === 'baileys'
          ? 'partial'
          : enabled ? 'partial'
            : 'planned';

    const transport =
      provider === 'cloud-api'
        ? 'webhook'
        : enabled || providerConfigured || sessionDirConfigured ? 'local'
          : 'planned';

    const notes = ['WhatsApp gateway attached to the Zavorth operational mesh.'];
    if (identityHints) {
      notes.push(`Identity linked by ${identityHints.linkedBy} (${identityHints.verificationMethod}).`);
    }
    if (provider === 'cloud-api') {
      notes.push('WhatsApp runtime operating through Meta Cloud API.');
    } else if (provider === 'baileys') {
      notes.push('WhatsApp runtime reserved for future Baileys rollout.');
    } else if (enabled) {
      notes.push('WhatsApp runtime operating through supervised local outbox.');
    }
    if (typeof status?.providerDecision === 'string' && status.providerDecision.trim()) {
      notes.push(status.providerDecision.trim());
    }
    if (typeof status?.phoneNumberId === 'string' && status.phoneNumberId.trim()) {
      notes.push(`Phone number id configured at ${status.phoneNumberId.trim()}.`);
    }
    if (lastError) {
      notes.push(`Latest WhatsApp runtime error: ${lastError}`);
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
        ['Provider', String(status?.providerModeLabel || provider || 'local'), 'neutral'],
        ['Ciclo', lifecycleState, lifecycleState === 'connected' ? 'success' : lifecycleState === 'error' ? 'danger' : 'warning'],
        ['Runtime', started ? 'running' : 'stopped', started ? 'success' : 'warning'],
        ['Connected', connected ? 'yes' : 'no', connected ? 'success' : 'warning'],
        ['Recipients', String(recipientsConfigured), recipientsConfigured > 0 ? 'success' : 'warning'],
        ['Allowlist', recipientPolicy?.summary || `${recipientsConfigured} allowed chat(s)`, recipientsConfigured > 0 ? 'success' : 'warning'],
        ['Webhook', webhookStatus === 'configured' ? 'configured' : provider === 'cloud-api' ? 'pending' : 'n/a', webhookStatus === 'configured' ? 'success' : provider === 'cloud-api' ? 'warning' : 'neutral'],
        ['Bridge local', localBridge ? `${localBridge.provider || provider} (${localBridge.qrState || 'without QR'})` : 'n/a', localBridge?.sessionDirConfigured ? 'success' : provider === 'cloud-api' ? 'neutral' : 'warning'],
        ['QR', loginQr?.state || (provider === 'cloud-api' ? 'n/a' : 'pending'), loginQr?.state === 'ready' ? 'success' : provider === 'cloud-api' ? 'neutral' : 'warning'],
        ['Latest error', lastError || 'none', lastError ? 'danger' : 'success'],
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
      setupMode: provider === 'cloud-api' ? 'cloud-api' : provider === 'baileys' ? 'baileys' : 'local',
      provider: provider === 'cloud-api' ? 'meta-cloud-api' : provider,
      webhookPath: provider === 'cloud-api' ? '/api/webhooks/whatsapp' : null,
      doctorCommand: 'npm run test:channels:smoke',
      lastHealth: readiness === 'ready' ? 'passed' : lastError ? 'failed' : 'unknown',
      lastEventAt: typeof status?.lastInboundAt === 'string' ? status.lastInboundAt : typeof status?.lastOutboundAt === 'string' ? status.lastOutboundAt : null,
      operatorNextStep:
        provider === 'cloud-api'
          ? readiness === 'ready'
            ? 'Monitor webhook, delivery, and policy before expanding WhatsApp rollout.'
            : 'Complete Cloud API credentials, /api/webhooks/whatsapp callback, and allowed chats.'
          : loginQr?.state === 'expired'
            ? 'Solicite /channels relink whatsapp para preparar novo QR da bridge local.'
            : loginQr?.state === 'ready'
              ? 'Show the WhatsApp QR to pair the supervised local session.'
              : 'Solicite /channels login-qr whatsapp ou conecte a bridge que public qr.txt na session local.',
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
        ? enabled && started && recipientsConfigured > 0 && providerConfigured && webhookConfigured && !lastError ? 'ready'
          : enabled || providerConfigured || recipientsConfigured > 0
            ? 'partial'
            : 'planned'
        : enabled && started && recipientsConfigured > 0 && !lastError ? 'ready'
          : enabled || recipientsConfigured > 0
            ? 'partial'
            : 'planned';

    const notes = ['Instagram gateway attached to the Zavorth operational mesh.'];
    if (identityHints) {
      notes.push(`Identity linked by ${identityHints.linkedBy} (${identityHints.verificationMethod}).`);
    }
    if (provider === 'meta-messaging') {
      notes.push('Instagram runtime prepared for Meta Instagram Messaging API.');
    } else {
      notes.push('Instagram remains in supervised local outbox until official Meta credentials are connected.');
    }
    if (typeof status?.providerDecision === 'string' && status.providerDecision.trim()) {
      notes.push(status.providerDecision.trim());
    }
    if (typeof status?.businessAccountId === 'string' && status.businessAccountId.trim()) {
      notes.push(`Instagram business account id configured at ${status.businessAccountId.trim()}.`);
    }
    if (lastError) {
      notes.push(`Latest Instagram runtime error: ${lastError}`);
    }

    return {
      id: this.id,
      label: 'Instagram',
      readiness,
      implementationState: provider === 'meta-messaging' ? 'full' : enabled ? 'partial' : 'planned',
      configured: enabled || started || providerConfigured || recipientsConfigured > 0,
      transport: provider === 'meta-messaging' ? 'webhook' : enabled || recipientsConfigured > 0 ? 'local' : 'planned',
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
        mode: provider || 'local',
        provider: provider === 'meta-messaging' ? 'instagram-messaging-api' : 'local-outbox',
      }),
      statusRows: buildStatusRows([
        ['Provider', provider === 'meta-messaging' ? 'Meta Instagram Messaging API' : 'outbox local', 'neutral'],
        ['Runtime', started ? 'running' : 'stopped', started ? 'success' : 'warning'],
        ['Connected', connected ? 'yes' : 'no', connected ? 'success' : 'warning'],
        ['Business account', typeof status?.businessAccountId === 'string' && status.businessAccountId.trim() ? status.businessAccountId.trim() : 'n/d', providerConfigured ? 'success' : 'warning'],
        ['Webhook', webhookConfigured ? 'configured' : provider === 'meta-messaging' ? 'pending' : 'n/a', webhookConfigured ? 'success' : provider === 'meta-messaging' ? 'warning' : 'neutral'],
        ['Allowlist', recipientPolicy?.summary || `${recipientsConfigured} recipient(s) permitidos`, recipientsConfigured > 0 ? 'success' : 'warning'],
        ['Latest error', lastError || 'none', lastError ? 'danger' : 'success'],
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
      setupMode: provider === 'meta-messaging' ? 'meta-messaging' : 'local',
      provider: provider === 'meta-messaging' ? 'instagram-messaging-api' : 'local-outbox',
      webhookPath: provider === 'meta-messaging' ? '/api/webhooks/instagram' : null,
      doctorCommand: 'npm run test:channels:smoke',
      lastHealth: readiness === 'ready' ? 'passed' : lastError ? 'failed' : 'unknown',
      lastEventAt: typeof status?.lastInboundAt === 'string' ? status.lastInboundAt : typeof status?.lastOutboundAt === 'string' ? status.lastOutboundAt : null,
      operatorNextStep:
        provider === 'meta-messaging'
          ? readiness === 'ready'
            ? 'Monitor webhook, policy, and conversation window before expanding Instagram rollout.'
            : 'Complete business account id, access token, verify token, callback /api/webhooks/instagram e recipients allowed.'
          : 'Use /channels prepare instagram para preparar Meta Instagram Messaging API ou valide o outbox local supervised.',
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
      enabled && started && recipientsConfigured > 0 && providerConfigured && !lastError ? 'ready'
        : enabled || providerConfigured || recipientsConfigured > 0
          ? 'partial'
          : 'planned';
    const notes = ['Signal gateway attached to the Zavorth operational mesh.'];

    if (identityHints) {
      notes.push(`Identity linked by ${identityHints.linkedBy} (${identityHints.verificationMethod}).`);
    }
    if (providerConfigured) {
      notes.push('Bridge signal-cli/JSON-RPC configurada para runtime supervised.');
    } else {
      notes.push('Signal still operates as an honest local bridge that requires signal-cli bootstrap.');
    }
    if (lastError) {
      notes.push(`Latest Signal runtime error: ${lastError}`);
    }

    return {
      id: this.id,
      label: 'Signal',
      readiness,
      implementationState: enabled || providerConfigured ? 'partial' : 'planned',
      configured: enabled || started || providerConfigured || recipientsConfigured > 0,
      transport: enabled || providerConfigured ? 'bridge' : 'planned',
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
        ['Runtime', started ? 'running' : 'stopped', started ? 'success' : 'warning'],
        ['Bridge', providerConfigured ? 'configurada' : 'pending', providerConfigured ? 'success' : 'warning'],
        ['Recipients', String(recipientsConfigured), recipientsConfigured > 0 ? 'success' : 'warning'],
        ['Latest error', lastError || 'none', lastError ? 'danger' : 'success'],
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
          ? 'Use /channels broadcast-test signal para validate a bridge supervised.'
          : 'Configure signal-cli/JSON-RPC, conta dedicada e allowlist before ampliar o rollout.',
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
      enabled && started && recipientsConfigured > 0 && providerConfigured && !lastError ? 'ready'
        : enabled || providerConfigured || recipientsConfigured > 0
          ? 'partial'
          : 'planned';
    const notes = ['iMessage gateway attached to the Zavorth operational mesh.'];

    if (identityHints) {
      notes.push(`Identity linked by ${identityHints.linkedBy} (${identityHints.verificationMethod}).`);
    }
    if (readOnly) {
      notes.push('iMessage bridge remains in read-only mode as the safe default.');
    }
    if (lastError) {
      notes.push(`Latest iMessage runtime error: ${lastError}`);
    }

    return {
      id: this.id,
      label: 'iMessage',
      readiness,
      implementationState: enabled || providerConfigured ? 'partial' : 'planned',
      configured: enabled || started || providerConfigured || recipientsConfigured > 0,
      transport: enabled || providerConfigured ? 'bridge' : 'planned',
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
        ['Runtime', started ? 'running' : 'stopped', started ? 'success' : 'warning'],
        ['Bridge', providerConfigured ? 'configurada' : 'pending', providerConfigured ? 'success' : 'warning'],
        ['Read-only', readOnly ? 'yes' : 'no', readOnly ? 'success' : 'warning'],
        ['Recipients', String(recipientsConfigured), recipientsConfigured > 0 ? 'success' : 'warning'],
        ['Latest error', lastError || 'none', lastError ? 'danger' : 'success'],
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
          ? 'Validate explicit approvals before allowing broader iMessage send.'
          : 'Start a macOS Node Host, keep read-only, and configure recipient allowlist.',
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
      enabled && started && recipientsConfigured > 0 && providerConfigured && webhookConfigured && !lastError ? 'ready'
        : enabled || providerConfigured || recipientsConfigured > 0
          ? 'partial'
          : 'planned';
    const notes = ['Microsoft Teams gateway attached to the Zavorth operational mesh.'];

    if (identityHints) {
      notes.push(`Identity linked by ${identityHints.linkedBy} (${identityHints.verificationMethod}).`);
    }
    if (providerConfigured) {
      notes.push('Teams app/tenant credentials present for supervised rollout.');
    }
    if (lastError) {
      notes.push(`Latest Teams runtime error: ${lastError}`);
    }

    return {
      id: this.id,
      label: 'Microsoft Teams',
      readiness,
      implementationState: enabled || providerConfigured ? 'partial' : 'planned',
      configured: enabled || started || providerConfigured || recipientsConfigured > 0,
      transport: enabled || providerConfigured ? 'webhook' : 'planned',
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
        ['Runtime', started ? 'running' : 'stopped', started ? 'success' : 'warning'],
        ['Tenant/app', providerConfigured ? 'configured' : 'pending', providerConfigured ? 'success' : 'warning'],
        ['Webhook', webhookConfigured ? 'configured' : 'pending', webhookConfigured ? 'success' : 'warning'],
        ['Recipients', String(recipientsConfigured), recipientsConfigured > 0 ? 'success' : 'warning'],
        ['Latest error', lastError || 'none', lastError ? 'danger' : 'success'],
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
          ? 'Use /channels broadcast-test teams and validate the corporate webhook before rollout.'
          : 'Configure app id, tenant, secret e allowlist de conversations before abrir o canal.',
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
      enabled && started && recipientsConfigured > 0 && providerConfigured && !lastError ? 'ready'
        : enabled || providerConfigured || recipientsConfigured > 0 || imapConfigured ? 'partial'
          : 'planned';
    const notes = ['Email gateway attached to the Zavorth operational mesh.'];

    if (identityHints) {
      notes.push(`Identity linked by ${identityHints.linkedBy} (${identityHints.verificationMethod}).`);
    }
    if (imapConfigured) {
      notes.push('IMAP is available para inbound/approval polling no next rollout.');
    }
    if (lastError) {
      notes.push(`Latest Email runtime error: ${lastError}`);
    }

    return {
      id: this.id,
      label: 'Email',
      readiness,
      implementationState: enabled || providerConfigured ? 'partial' : 'planned',
      configured: enabled || started || providerConfigured || recipientsConfigured > 0 || imapConfigured,
      transport: enabled || providerConfigured ? 'native' : 'planned',
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
        ['Runtime', started ? 'running' : 'stopped', started ? 'success' : 'warning'],
        ['SMTP', providerConfigured ? 'configured' : 'pending', providerConfigured ? 'success' : 'warning'],
        ['IMAP', imapConfigured ? 'configured' : 'optional', imapConfigured ? 'success' : 'neutral'],
        ['Recipients', String(recipientsConfigured), recipientsConfigured > 0 ? 'success' : 'warning'],
        ['Latest error', lastError || 'none', lastError ? 'danger' : 'success'],
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
          ? 'Use /channels send-test email and expand IMAP only when you want approvals by reply.'
          : 'Configure SMTP, allowlist de recipients e after avalie IMAP para inbound.',
    };
  }
}

function buildConnection(
  status: Record<string, unknown> | null,
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
