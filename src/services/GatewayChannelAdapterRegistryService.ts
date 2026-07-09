import type {
  ChannelAdapterContract,
  ChannelAdapterStatus,
  ChannelFeatureSet,
  RuntimeChannelDescriptor,
  RuntimeChannelDescriptorContract,
} from '../contracts/ChannelMeshContract.js';
import type { PlatformCapability, PlatformKey, PlatformTransport } from '../contracts/PlatformContract.js';
import { PlatformCapabilityService } from './PlatformCapabilityService.js';
import { WebRuntimeChannelAdapter } from './GatewayRuntimeChannelAdapters.js';
import { ChannelLongTailActivationService } from './ChannelLongTailActivationService.js';
import { logger } from '../logger.js';
import type {
ChannelLongTailActivationEntry,
  ChannelLongTailConfiguredDoctorReceipt,
} from '../contracts/ChannelLongTailActivationContract.js';

type GatewayChannelAdapterRegistryRuntime = {
  hasDispatcher?: boolean;
  canSpawnWeb?: boolean;
  platformCapabilityService?: Pick<PlatformCapabilityService, 'getCapabilities'>;
  runtimeAdapters?: ChannelAdapterContract[];
  // Compatibilidade temporaria para overlays antigos; adapters explicitos sao o caminho canonico.
  runtimeDescriptors?: Array<RuntimeChannelDescriptor | RuntimeChannelDescriptorContract>;
  includeLongTailActivationAdapters?: boolean;
  channelLongTailActivationService?: Pick<ChannelLongTailActivationService, 'buildSnapshot' | 'runConfiguredDoctor'>;
};

class StaticChannelAdapter implements ChannelAdapterContract {
  public readonly id: string;

  constructor(private readonly status: ChannelAdapterStatus) {
    this.id = status.id;
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.status,
      notes: this.status.notes.slice(),
      features: { ...this.status.features },
    };
  }
}

export class GatewayChannelAdapterRegistryService {
  private readonly hasDispatcher: boolean;
  private readonly canSpawnWeb: boolean;
  private readonly platforms: Pick<PlatformCapabilityService, 'getCapabilities'>;
  private runtimeAdapters: ChannelAdapterContract[];
  private runtimeDescriptors: Array<RuntimeChannelDescriptor | RuntimeChannelDescriptorContract>;
  private readonly includeLongTailActivationAdapters: boolean;
  private readonly channelLongTailActivation: Pick<ChannelLongTailActivationService, 'buildSnapshot' | 'runConfiguredDoctor'> | null;

  constructor(runtime: GatewayChannelAdapterRegistryRuntime = {}) {
    this.hasDispatcher = runtime.hasDispatcher === true;
    this.canSpawnWeb = runtime.canSpawnWeb === true;
    this.platforms = runtime.platformCapabilityService || new PlatformCapabilityService();
    this.runtimeAdapters = Array.isArray(runtime.runtimeAdapters) ? runtime.runtimeAdapters : [];
    this.runtimeDescriptors = Array.isArray(runtime.runtimeDescriptors) ? runtime.runtimeDescriptors : [];
    this.includeLongTailActivationAdapters = runtime.includeLongTailActivationAdapters === true;
    this.channelLongTailActivation = this.includeLongTailActivationAdapters
      ? runtime.channelLongTailActivationService || new ChannelLongTailActivationService()
      : null;
  }

  public setRuntimeAdapters(runtimeAdapters: ChannelAdapterContract[]): void {
    this.runtimeAdapters = Array.isArray(runtimeAdapters) ? runtimeAdapters.slice() : [];
  }

  public setRuntimeDescriptors(
    runtimeDescriptors: Array<RuntimeChannelDescriptor | RuntimeChannelDescriptorContract>,
  ): void {
    this.runtimeDescriptors = Array.isArray(runtimeDescriptors) ? runtimeDescriptors.slice() : [];
  }

  public listAdapters(): ChannelAdapterStatus[] {
    const explicitAdapters = this.buildRuntimeAdapters();
    const explicitIds = new Set(explicitAdapters.map((entry) => this.normalizeId(entry.id)));
    const baseAdapters = [
      ...(!explicitIds.has('web') ? [this.buildWebAdapter().describe()] : []),
      ...this.platforms.getCapabilities()
        .filter((entry) => !explicitIds.has(this.normalizeId(entry.platform)))
        .map((entry) => this.fromPlatform(entry).describe()),
    ];
    const merged = new Map<string, ChannelAdapterStatus>();
    for (const entry of baseAdapters) {
      merged.set(this.normalizeId(entry.id), this.cloneStatus(entry));
    }
    for (const entry of explicitAdapters) {
      const described = entry.describe();
      merged.set(this.normalizeId(described.id), this.cloneStatus(described));
    }

    const overlays = this.runtimeDescriptors
      .map((entry) => this.normalizeRuntimeDescriptor(entry))
      .filter((entry): entry is RuntimeChannelDescriptor => Boolean(entry));
    for (const overlay of overlays) {
      const normalizedId = this.normalizeId(overlay.id);
      const current = merged.get(normalizedId) || this.buildRuntimeOnlyAdapter(overlay);
      merged.set(normalizedId, this.mergeRuntimeDescriptor(current, overlay));
    }

    if (this.includeLongTailActivationAdapters) {
      for (const status of this.buildLongTailActivationStatuses()) {
        const normalizedId = this.normalizeId(status.id);
        const current = merged.get(normalizedId);
        merged.set(
          normalizedId,
          current ? this.mergeLongTailStatus(current, status) : this.cloneStatus(status),
        );
      }
    }

    return Array.from(merged.values());
  }

  public getAdapter(id: string): ChannelAdapterStatus | null {
    const normalizedId = this.resolveAlias(String(id || '').trim().toLowerCase());
    return this.listAdapters().find((entry) => this.normalizeId(entry.id) === normalizedId) || null;
  }

  private buildWebAdapter(): ChannelAdapterContract {
    return new WebRuntimeChannelAdapter(this.hasDispatcher, this.canSpawnWeb);
  }

  private fromPlatform(entry: PlatformCapability): ChannelAdapterContract {
    const id = String(entry.platform || '').trim().toLowerCase();
    const metadata = this.buildChannelMetadata(id, entry);
    return new StaticChannelAdapter({
      id,
      label: this.labelFor(id),
      readiness: entry.readiness,
      implementationState: entry.implementationState,
      configured: entry.configured,
      transport: entry.transport,
      notes: Array.isArray(entry.notes) ? entry.notes : [],
      features: this.buildFeatureSet(id, entry),
      ...metadata,
    });
  }

  private buildFeatureSet(id: string, entry: PlatformCapability): ChannelFeatureSet {
    const canTalk = entry.readiness !== 'planned' && entry.readiness !== 'disabled';
    const isBridge = entry.transport === 'bridge' || entry.transport === 'local';
    const isWebhook = entry.transport === 'webhook';
    const isGroupChannel = ['discord', 'telegram', 'whatsapp', 'instagram', 'slack', 'signal', 'imessage', 'teams', 'email'].includes(id);
    const supportsAttachments = ['discord', 'whatsapp', 'slack', 'signal', 'teams', 'email'].includes(id);
    const supportsThreads = ['discord', 'slack', 'telegram', 'teams', 'email'].includes(id);
    return {
      inbound: canTalk,
      outbound: canTalk,
      sessionList: true,
      sessionHistory: true,
      sessionSend: this.hasDispatcher && canTalk,
      sessionSpawn: false,
      attachments: supportsAttachments,
      threads: supportsThreads,
      groupPolicy: isGroupChannel,
      identityHints: true,
      approvals: ['signal', 'imessage', 'teams', 'email'].includes(id) || entry.readiness !== 'ready',
      rateLimit: ['discord', 'slack', 'whatsapp', 'instagram', 'teams', 'email'].includes(id),
      webhook: isWebhook,
      localBridge: isBridge || ['signal', 'imessage'].includes(id),
      doctor: true,
      interactiveControls: ['telegram', 'discord', 'slack', 'whatsapp', 'instagram', 'teams'].includes(id),
      slashCommands: ['telegram', 'discord', 'slack', 'teams'].includes(id),
      richReplies: ['telegram', 'discord', 'slack', 'whatsapp', 'instagram', 'teams', 'email'].includes(id),
      qrLogin: id === 'whatsapp' && !isWebhook,
    };
  }

  private labelFor(id: string): string {
    switch (id) {
      case 'telegram':
        return 'Telegram';
      case 'discord':
        return 'Discord';
      case 'whatsapp':
        return 'WhatsApp';
      case 'instagram':
        return 'Instagram';
      case 'slack':
        return 'Slack';
      case 'signal':
        return 'Signal';
      case 'imessage':
        return 'iMessage';
      case 'teams':
        return 'Microsoft Teams';
      case 'email':
        return 'Email';
      default:
        return id;
    }
  }

  private buildChannelMetadata(id: string, entry: PlatformCapability): Partial<ChannelAdapterStatus> {
    return {
      riskLevel: this.riskLevelFor(id),
      setupMode: this.setupModeFor(id, entry),
      provider: this.providerFor(id, entry),
      webhookPath: this.webhookPathFor(id, entry),
      doctorCommand: 'npm run test:channels:smoke',
      lastHealth: entry.readiness === 'ready' ? 'passed' : entry.readiness === 'disabled' ? 'skipped' : 'unknown',
      lastEventAt: null,
      operatorNextStep: this.operatorNextStepFor(id, entry),
    };
  }

  private riskLevelFor(id: string): ChannelAdapterStatus['riskLevel'] {
    if (id === 'imessage') {
      return 'experimental';
    }
    if (id === 'signal') {
      return 'high';
    }
    if (id === 'whatsapp' || id === 'instagram' || id === 'discord' || id === 'teams') {
      return 'medium';
    }
    return 'low';
  }

  private setupModeFor(id: string, entry: PlatformCapability): string {
    if (id === 'whatsapp') {
      return entry.transport === 'webhook' ? 'cloud-api' : entry.transport === 'local' ? 'baileys/stub' : 'stub';
    }
    if (id === 'instagram') {
      return entry.transport === 'webhook' ? 'meta-messaging' : 'stub';
    }
    if (id === 'signal') {
      return 'signal-cli';
    }
    if (id === 'imessage') {
      return 'mac-bridge';
    }
    if (id === 'teams') {
      return 'graph-bot';
    }
    if (id === 'email') {
      return 'smtp-imap';
    }
    return entry.transport === 'native' ? 'native' : entry.transport;
  }

  private providerFor(id: string, entry: PlatformCapability): string {
    if (id === 'whatsapp') {
      return entry.transport === 'webhook' ? 'meta-cloud-api' : 'local-provider';
    }
    if (id === 'instagram') {
      return entry.transport === 'webhook' ? 'instagram-messaging-api' : 'local-outbox';
    }
    if (id === 'slack') {
      return entry.transport === 'native' ? 'slack-web-api' : 'local-outbox';
    }
    if (id === 'signal') {
      return 'signal-cli';
    }
    if (id === 'imessage') {
      return 'macos-node-host';
    }
    if (id === 'teams') {
      return 'microsoft-graph-bot-framework';
    }
    if (id === 'email') {
      return 'smtp-imap';
    }
    return id;
  }

  private webhookPathFor(id: string, entry: PlatformCapability): string | null {
    if (id === 'slack' && entry.transport === 'native') {
      return '/api/webhooks/slack';
    }
    if (id === 'whatsapp' && entry.transport === 'webhook') {
      return '/api/webhooks/whatsapp';
    }
    if (id === 'instagram' && entry.transport === 'webhook') {
      return '/api/webhooks/instagram';
    }
    if (id === 'teams' && entry.configured) {
      return '/api/webhooks/teams';
    }
    return null;
  }

  private operatorNextStepFor(id: string, entry: PlatformCapability): string {
    if (entry.readiness === 'ready') {
      return `Rodar /channels broadcast-test ${id} e monitorar doctor antes de ampliar o rollout.`;
    }
    if (id === 'signal') {
      return 'Preparar signal-cli em daemon/JSON-RPC, conta dedicada e allowlist de recipients.';
    }
    if (id === 'imessage') {
      return 'Subir um Node Host macOS e iniciar a bridge em modo read-only antes de permitir envio.';
    }
    if (id === 'teams') {
      return 'Preparar Microsoft Graph/Bot Framework com tenant, app id e conversas permitidas.';
    }
    if (id === 'instagram') {
      return 'Preparar Meta Instagram Messaging API com business account, webhook e recipients permitidos.';
    }
    if (id === 'email') {
      return 'Configurar SMTP/IMAP e allowlist de destinatarios para aprovacoes por email.';
    }
    return `Executar npm run channels:install -- --channel ${id} --apply e validar o doctor.`;
  }

  private buildRuntimeAdapters(): ChannelAdapterContract[] {
    return this.runtimeAdapters.filter((entry): entry is ChannelAdapterContract => Boolean(entry && typeof entry.describe === 'function'));
  }

  private buildLongTailActivationStatuses(): ChannelAdapterStatus[] {
    try {
      if (!this.channelLongTailActivation) {
        return [];
      }
      const channelLongTailActivation = this.channelLongTailActivation;
      return channelLongTailActivation.buildSnapshot().entries.map((entry) => {
        let doctor: ChannelLongTailConfiguredDoctorReceipt | null = null;
        try {
          doctor = channelLongTailActivation.runConfiguredDoctor({ channelId: entry.channelId });
        } catch (error: unknown) {logger.warn('[way Channel Adapter Registry] creation failed', error);
    doctor = null;
  }
        return this.fromLongTailActivationEntry(entry, doctor);
      });
    } catch (error: unknown) {logger.warn('[way Channel Adapter Registry] creation failed', error); return []; }
  }

  private fromLongTailActivationEntry(
    entry: ChannelLongTailActivationEntry,
    doctor: ChannelLongTailConfiguredDoctorReceipt | null,
  ): ChannelAdapterStatus {
    const id = this.normalizeId(entry.channelId);
    const configured = doctor?.configured === true;
    const transport = this.transportForLongTail(entry);
    const lastHealth = configured ? 'unknown' : 'unknown';
    const missing = doctor
      ? doctor.missingRequiredEnv.concat(doctor.missingRuntimeConfig)
      : entry.configSchema.requiredEnv;
    return {
      id,
      label: this.labelForLongTail(id, entry.runtimeTarget),
      readiness: 'partial',
      implementationState: 'partial',
      configured,
      transport,
      notes: [
        `Zavorth-native long-tail channel via ${entry.family} adapter.`,
        `Runtime target: ${entry.runtimeTarget}.`,
        'No external gateway or runtime adapter bridge is required for this channel surface.',
        configured
          ? 'Configured doctor passed locally; run staging-live proof with explicit confirmation before default routing.'
          : `Missing config: ${missing.join(', ') || 'channel credentials/allowlist'}.`,
      ],
      features: {
        inbound: entry.capabilities.inbound,
        outbound: entry.capabilities.outbound,
        sessionList: true,
        sessionHistory: true,
        sessionSend: this.hasDispatcher && entry.capabilities.outbound && configured,
        sessionSpawn: false,
        attachments: entry.capabilities.attachments,
        threads: entry.capabilities.threads,
        groupPolicy: true,
        identityHints: true,
        approvals: true,
        rateLimit: true,
        webhook: entry.capabilities.webhookValidation,
        localBridge: entry.capabilities.localProcess || transport === 'bridge' || transport === 'local',
        doctor: true,
        interactiveControls: this.hasInteractiveLongTailControls(id),
        slashCommands: false,
        richReplies: entry.capabilities.replies,
        qrLogin: id === 'weixin' || id === 'zalouser' || id === 'bluebubbles',
      },
      riskLevel: this.riskLevelForLongTail(id),
      setupMode: entry.family,
      provider: entry.runtimeTarget,
      webhookPath: entry.capabilities.webhookValidation ? `/api/webhooks/${id}` : null,
      doctorCommand: entry.doctorCommand,
      lastHealth,
      lastEventAt: null,
      operatorNextStep: configured
        ? entry.stagingLiveSmokeCommand
        : `Configure ${missing.join(', ') || entry.configSchema.requiredEnv.join(', ')} and run ${entry.doctorCommand}.`,
      statusRows: [
        { label: 'Adapter', value: entry.family, tone: 'neutral' },
        { label: 'Doctor', value: configured ? 'configured' : 'missing-config', tone: configured ? 'success' : 'warning' },
        { label: 'Allowlist', value: doctor?.allowlistConfigured ? 'configured' : 'required', tone: doctor?.allowlistConfigured ? 'success' : 'warning' },
        { label: 'Live proof', value: 'requires explicit confirmation', tone: 'neutral' },
      ],
      interactiveSurface: {
        statusCard: true,
        inlineButtons: this.hasInteractiveLongTailControls(id),
        slashCommands: false,
        richReplies: entry.capabilities.replies,
        modelMenus: false,
        qrLogin: id === 'weixin' || id === 'zalouser' || id === 'bluebubbles',
      },
    };
  }

  private mergeLongTailStatus(current: ChannelAdapterStatus, longTail: ChannelAdapterStatus): ChannelAdapterStatus {
    const shouldPromoteFromPlaceholder =
      current.readiness === 'planned'
      || current.implementationState === 'planned'
      || current.implementationState === 'stub'
      || current.transport === 'stub'
      || current.transport === 'planned';
    return {
      ...current,
      readiness: shouldPromoteFromPlaceholder ? longTail.readiness : current.readiness,
      implementationState: shouldPromoteFromPlaceholder ? longTail.implementationState : current.implementationState,
      configured: current.configured || longTail.configured,
      transport: shouldPromoteFromPlaceholder ? longTail.transport : current.transport,
      notes: this.mergeNotes(current.notes, longTail.notes),
      features: this.mergeFeatureSet(longTail.features, current.features),
      riskLevel: current.riskLevel || longTail.riskLevel,
      setupMode: current.setupMode ?? longTail.setupMode ?? null,
      provider: current.provider ?? longTail.provider ?? null,
      webhookPath: current.webhookPath ?? longTail.webhookPath ?? null,
      doctorCommand: current.doctorCommand ?? longTail.doctorCommand ?? null,
      lastHealth: current.lastHealth ?? longTail.lastHealth ?? null,
      lastEventAt: current.lastEventAt ?? longTail.lastEventAt ?? null,
      operatorNextStep: current.operatorNextStep ?? longTail.operatorNextStep ?? null,
      statusRows: current.statusRows || longTail.statusRows,
      interactiveSurface: current.interactiveSurface || longTail.interactiveSurface,
    };
  }

  private transportForLongTail(entry: ChannelLongTailActivationEntry): ChannelAdapterStatus['transport'] {
    if (entry.family === 'webhook' || entry.capabilities.webhookValidation) {
      return 'webhook';
    }
    if (entry.family === 'local-bridge' || entry.family === 'apple-bridge') {
      return 'bridge';
    }
    if (entry.family === 'relay-http') {
      return 'local';
    }
    return 'native';
  }

  private labelForLongTail(id: string, runtimeTarget: string): string {
    const labels: Record<string, string> = {
      bluebubbles: 'BlueBubbles',
      clickclack: 'ClickClack',
      feishu: 'Feishu / Lark',
      googlechat: 'Google Chat',
      'google-meet': 'Google Meet',
      'home-assistant': 'Home Assistant',
      irc: 'IRC',
      line: 'LINE',
      matrix: 'Matrix',
      mattermost: 'Mattermost',
      'nextcloud-talk': 'Nextcloud Talk',
      nostr: 'Nostr',
      qqbot: 'QQ Bot',
      sms: 'SMS',
      'synology-chat': 'Synology Chat',
      tlon: 'Tlon',
      twitch: 'Twitch',
      webhooks: 'Generic Webhooks',
      wecom: 'WeCom',
      weixin: 'Weixin / WeChat',
      zalo: 'Zalo',
      zalouser: 'Zalo Personal',
      yuanbao: 'Yuanbao',
      'voice-call': 'Voice Call',
    };
    return labels[id] || runtimeTarget || id;
  }

  private hasInteractiveLongTailControls(id: string): boolean {
    return ['feishu', 'line', 'matrix', 'mattermost', 'qqbot', 'twitch', 'wecom', 'weixin', 'zalo', 'zalouser'].includes(id);
  }

  private riskLevelForLongTail(id: string): ChannelAdapterStatus['riskLevel'] {
    if (['weixin', 'zalouser', 'bluebubbles', 'imessage', 'voice-call', 'google-meet'].includes(id)) {
      return 'experimental';
    }
    if (['sms', 'nostr', 'tlon', 'yuanbao'].includes(id)) {
      return 'medium';
    }
    return 'low';
  }

  private normalizeRuntimeDescriptor(
    entry: RuntimeChannelDescriptor | RuntimeChannelDescriptorContract | null | undefined,
  ): RuntimeChannelDescriptor | null {
    if (!entry) {
      return null;
    }
    if (typeof (entry as RuntimeChannelDescriptorContract).describeRuntimeChannel === 'function') {
      return (entry as RuntimeChannelDescriptorContract).describeRuntimeChannel();
    }
    return entry as RuntimeChannelDescriptor;
  }

  private buildRuntimeOnlyAdapter(overlay: RuntimeChannelDescriptor): ChannelAdapterStatus {
    const id = this.normalizeId(overlay.id);
    return {
      id,
      label: overlay.label || this.labelFor(id) || id,
      readiness: overlay.readiness || 'partial',
      implementationState: overlay.implementationState || 'partial',
      configured: overlay.configured !== false,
      transport: overlay.transport || 'virtual',
      notes: Array.isArray(overlay.notes) ? overlay.notes.slice() : [],
      features: this.mergeFeatureSet(this.emptyFeatureSet(), overlay.features),
      riskLevel: overlay.riskLevel || this.riskLevelFor(id),
      setupMode: overlay.setupMode ?? this.setupModeFor(id, {
        platform: id as PlatformKey,
        readiness: overlay.readiness || 'partial',
        implementationState: overlay.implementationState || 'partial',
        configured: overlay.configured !== false,
        transport: (overlay.transport || 'virtual') as PlatformTransport,
        envKeys: [],
        notes: Array.isArray(overlay.notes) ? overlay.notes.slice() : [],
      }),
      provider: overlay.provider ?? this.providerFor(id, {
        platform: id as PlatformKey,
        readiness: overlay.readiness || 'partial',
        implementationState: overlay.implementationState || 'partial',
        configured: overlay.configured !== false,
        transport: (overlay.transport || 'virtual') as PlatformTransport,
        envKeys: [],
        notes: Array.isArray(overlay.notes) ? overlay.notes.slice() : [],
      }),
      webhookPath: overlay.webhookPath ?? null,
      doctorCommand: overlay.doctorCommand ?? 'npm run test:channels:smoke',
      lastHealth: overlay.lastHealth ?? 'unknown',
      lastEventAt: overlay.lastEventAt ?? null,
      operatorNextStep: overlay.operatorNextStep ?? null,
    };
  }

  private mergeRuntimeDescriptor(
    current: ChannelAdapterStatus,
    overlay: RuntimeChannelDescriptor,
  ): ChannelAdapterStatus {
    return {
      ...current,
      id: this.normalizeId(overlay.id || current.id),
      label: overlay.label || current.label,
      readiness: overlay.readiness || current.readiness,
      implementationState: overlay.implementationState || current.implementationState,
      configured: typeof overlay.configured === 'boolean' ? overlay.configured : current.configured,
      transport: overlay.transport || current.transport,
      notes: this.mergeNotes(current.notes, overlay.notes),
      features: this.mergeFeatureSet(current.features, overlay.features),
      riskLevel: overlay.riskLevel || current.riskLevel,
      setupMode: overlay.setupMode ?? current.setupMode ?? null,
      provider: overlay.provider ?? current.provider ?? null,
      webhookPath: overlay.webhookPath ?? current.webhookPath ?? null,
      doctorCommand: overlay.doctorCommand ?? current.doctorCommand ?? null,
      lastHealth: overlay.lastHealth ?? current.lastHealth ?? null,
      lastEventAt: overlay.lastEventAt ?? current.lastEventAt ?? null,
      operatorNextStep: overlay.operatorNextStep ?? current.operatorNextStep ?? null,
    };
  }

  private mergeFeatureSet(
    current: ChannelFeatureSet,
    overlay: Partial<ChannelFeatureSet> | null | undefined,
  ): ChannelFeatureSet {
    return {
      ...current,
      ...(overlay || {}),
    };
  }

  private mergeNotes(current: string[], overlay: string[] | null | undefined): string[] {
    const merged = new Set<string>();
    for (const note of current || []) {
      const normalized = String(note || '').trim();
      if (normalized) {
        merged.add(normalized);
      }
    }
    for (const note of overlay || []) {
      const normalized = String(note || '').trim();
      if (normalized) {
        merged.add(normalized);
      }
    }
    return Array.from(merged);
  }

  private emptyFeatureSet(): ChannelFeatureSet {
    return {
      inbound: false,
      outbound: false,
      sessionList: false,
      sessionHistory: false,
      sessionSend: false,
      sessionSpawn: false,
      attachments: false,
      threads: false,
      groupPolicy: false,
      identityHints: false,
      approvals: false,
      rateLimit: false,
      webhook: false,
      localBridge: false,
      doctor: false,
      interactiveControls: false,
      slashCommands: false,
      richReplies: false,
      qrLogin: false,
    };
  }

  private cloneStatus(status: ChannelAdapterStatus): ChannelAdapterStatus {
    return {
      ...status,
      notes: Array.isArray(status.notes) ? status.notes.slice() : [],
      features: { ...status.features },
    };
  }

  private normalizeId(value: string | null | undefined): string {
    return String(value || '').trim().toLowerCase();
  }

  private resolveAlias(value: string): string {
    const normalized = this.normalizeId(value);
    const aliases: Record<string, string> = {
      lark: 'feishu',
      gchat: 'googlechat',
      'google-chat': 'googlechat',
      'microsoft-teams': 'teams',
      msteams: 'teams',
      'nc-talk': 'nextcloud-talk',
      nc: 'nextcloud-talk',
      qq: 'qqbot',
      'twitch-chat': 'twitch',
      qywx: 'wecom',
      wework: 'wecom',
      'enterprise-wechat': 'wecom',
      'weixin-compat': 'weixin',
      wechat: 'weixin',
      zl: 'zalo',
      zlu: 'zalouser',
      'zalo-user': 'zalouser',
      yb: 'yuanbao',
      'tencent-yuanbao': 'yuanbao',
    };
    return aliases[normalized] || normalized;
  }
}
