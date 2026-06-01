import type {
  ChannelAdapterStatus,
  ChannelFeatureSet,
} from '../contracts/ChannelMeshContract.js';
import type {
  ChannelMeshAuthKind,
  ChannelMeshConnectorRoute,
  ChannelMeshParityEntry,
  ChannelMeshParitySimulation,
  ChannelMeshParitySnapshot,
  ChannelMeshParityStatus,
  ChannelMeshParityTransportStrategy,
} from '../contracts/ChannelMeshParityContract.js';
import { ZAVORTH_CHANNEL_MESH_PARITY_CONTRACT_VERSION } from '../contracts/ChannelMeshParityContract.js';
import { CapabilityNormalizationService, DEFAULT_PRIVATE_CAPABILITY_SOURCE_MODULES } from './CapabilityNormalizationService.js';
import { GatewayChannelAdapterRegistryService } from './GatewayChannelAdapterRegistryService.js';

type ChannelMeshParityRuntime = {
  now?: () => Date;
  sourceChannels?: string[];
  normalizationService?: CapabilityNormalizationService;
  adapterRegistry?: Pick<GatewayChannelAdapterRegistryService, 'listAdapters'>;
  adapterStatuses?: ChannelAdapterStatus[];
};

type ChannelPlan = {
  canonicalChannelId: string;
  label: string;
  authKind: ChannelMeshAuthKind;
  credentialRefs: string[];
  transportStrategy: ChannelMeshParityTransportStrategy;
  adapterTarget: string;
  webhookPath: string | null;
  features: ChannelFeatureSet;
};

const DEFAULT_FEATURES: ChannelFeatureSet = {
  inbound: true,
  outbound: true,
  sessionList: true,
  sessionHistory: true,
  sessionSend: true,
  sessionSpawn: false,
  attachments: false,
  threads: false,
  groupPolicy: true,
  identityHints: true,
  approvals: true,
  rateLimit: true,
  webhook: false,
  localBridge: false,
  doctor: true,
};

const CHANNEL_ALIASES: Record<string, string> = {
  bluebubbles: 'imessage',
  googlechat: 'google-chat',
  msteams: 'teams',
  'nextcloud-talk': 'nextcloud-talk',
  qqbot: 'qq',
  'synology-chat': 'synology-chat',
  webhooks: 'webhook',
  wechat: 'weixin',
  zalouser: 'zalo-user',
};

const BRIDGE_CHANNELS = new Set([
  'bluebubbles',
  'imessage',
  'signal',
  'matrix',
  'irc',
  'nostr',
  'tlon',
  'phone-control',
  'weixin',
  'wechat',
  'yuanbao',
]);

const WEBHOOK_CHANNELS = new Set([
  'googlechat',
  'mattermost',
  'nextcloud-talk',
  'synology-chat',
  'teams',
  'webhooks',
  'wecom',
  'home-assistant',
]);

const BOT_API_CHANNELS = new Set([
  'discord',
  'feishu',
  'line',
  'qqbot',
  'slack',
  'telegram',
  'twitch',
  'whatsapp',
  'zalo',
  'zalouser',
  'sms',
]);

export class ChannelMeshParityService {
  private readonly now: () => Date;
  private readonly normalization: CapabilityNormalizationService;
  private readonly sourceChannels: string[];
  private readonly adapterStatuses: ChannelAdapterStatus[];

  constructor(runtime: ChannelMeshParityRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.normalization = runtime.normalizationService || new CapabilityNormalizationService();
    this.sourceChannels = runtime.sourceChannels || DEFAULT_PRIVATE_CAPABILITY_SOURCE_MODULES
      .filter((sourceName) => this.normalization.resolveSourceModule(sourceName).primitiveId === 'channel.message');
    this.adapterStatuses = runtime.adapterStatuses || runtime.adapterRegistry?.listAdapters() || new GatewayChannelAdapterRegistryService({
      hasDispatcher: true,
      canSpawnWeb: true,
    }).listAdapters();
  }

  public buildSnapshot(input: { sourceChannels?: string[] } = {}): ChannelMeshParitySnapshot {
    const sourceChannels = input.sourceChannels || this.sourceChannels;
    const entries = sourceChannels
      .map((sourceName) => this.buildEntry(sourceName))
      .sort((left, right) => left.normalizedSourceName.localeCompare(right.normalizedSourceName));
    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_CHANNEL_MESH_PARITY_CONTRACT_VERSION,
      primitiveId: 'channel.message',
      summary: {
        sourceChannels: entries.length,
        native: entries.filter((entry) => entry.status === 'native').length,
        adapterBacked: entries.filter((entry) => entry.status === 'adapter-backed').length,
        webhookTemplates: entries.filter((entry) => entry.status === 'webhook-template').length,
        bridgeTemplates: entries.filter((entry) => entry.status === 'bridge-template').length,
        templateReady: entries.filter((entry) => entry.status === 'template-ready').length,
        unsupported: entries.filter((entry) => entry.status === 'unsupported').length,
        unmapped: entries.filter((entry) => entry.status === 'unmapped').length,
        generatedPluginManifests: entries.length,
        secretValuesSerialized: false,
      },
      entries,
      unsupported: entries.filter((entry) => entry.status === 'unsupported' || entry.status === 'unmapped'),
      generatedPluginManifests: entries.map((entry) => entry.generatedPluginManifest),
    };
  }

  public buildEntry(sourceName: string): ChannelMeshParityEntry {
    const mapping = this.normalization.resolveSourceModule(sourceName);
    const normalizedSourceName = mapping.normalizedSourceName;
    const canonicalChannelId = this.resolveCanonicalChannelId(normalizedSourceName);
    const gatewayStatus = this.findGatewayStatus(canonicalChannelId, normalizedSourceName);
    const plan = this.buildPlan(normalizedSourceName, canonicalChannelId, gatewayStatus);
    const status = this.resolveStatus(normalizedSourceName, gatewayStatus, plan.transportStrategy, mapping.primitiveId);
    const route = this.buildRoute(normalizedSourceName, plan);
    const simulation = this.buildSimulation(route);

    return {
      sourceName,
      normalizedSourceName,
      canonicalChannelId,
      status,
      mapping,
      route,
      gatewayStatus,
      generatedPluginManifest: mapping.primitiveId === 'channel.message'
        ? this.normalization.buildManifestTemplate(sourceName).manifest
        : this.normalization.buildManifestTemplate('telegram').manifest,
      credentialPolicy: {
        authKind: plan.authKind,
        credentialRefs: plan.credentialRefs,
        secretValuesSerialized: false,
        requiresOperatorConfiguration: plan.authKind !== 'none' && gatewayStatus?.configured !== true,
      },
      simulation,
      smokeGate: {
        id: `channel-mesh:${normalizedSourceName}`,
        command: `ChannelMeshParityService.buildEntry(${JSON.stringify(normalizedSourceName)})`,
        liveSendRequired: false,
        expected: 'inbound/outbound channel envelope normalizes without live send',
      },
      findings: this.buildFindings(status, normalizedSourceName, gatewayStatus, plan),
    };
  }

  private buildPlan(
    sourceName: string,
    canonicalChannelId: string,
    gatewayStatus: ChannelAdapterStatus | null,
  ): ChannelPlan {
    const existingFeatures = gatewayStatus?.features;
    const transportStrategy = gatewayStatus
      ? this.resolveGatewayStrategy(gatewayStatus)
      : BRIDGE_CHANNELS.has(sourceName)
        ? 'local-bridge'
        : WEBHOOK_CHANNELS.has(sourceName)
          ? sourceName === 'webhooks' ? 'generic-webhook-template' : 'webhook-runtime'
          : BOT_API_CHANNELS.has(sourceName)
            ? 'bot-api-template'
            : 'template-required';
    const authKind = this.resolveAuthKind(sourceName, transportStrategy);
    return {
      canonicalChannelId,
      label: gatewayStatus?.label || this.toLabel(canonicalChannelId),
      authKind,
      credentialRefs: this.resolveCredentialRefs(sourceName, canonicalChannelId, authKind),
      transportStrategy,
      adapterTarget: gatewayStatus
        ? `src/services/GatewayRuntimeChannelAdapters.ts#${gatewayStatus.label.replace(/\s+/g, '')}`
        : `src/channels/adapters/${this.toPascalCase(canonicalChannelId)}ChannelAdapter.ts`,
      webhookPath: gatewayStatus?.webhookPath || this.resolveWebhookPath(canonicalChannelId, transportStrategy),
      features: {
        ...DEFAULT_FEATURES,
        ...(existingFeatures || {}),
        webhook: existingFeatures?.webhook || transportStrategy === 'webhook-runtime' || transportStrategy === 'generic-webhook-template',
        localBridge: existingFeatures?.localBridge || transportStrategy === 'local-bridge',
        attachments: existingFeatures?.attachments || this.supportsAttachments(canonicalChannelId),
        threads: existingFeatures?.threads || this.supportsThreads(canonicalChannelId),
      },
    };
  }

  private buildRoute(sourceName: string, plan: ChannelPlan): ChannelMeshConnectorRoute {
    return {
      routeId: `channel.${plan.canonicalChannelId}`,
      sourceName,
      canonicalChannelId: plan.canonicalChannelId,
      label: plan.label,
      adapterTarget: plan.adapterTarget,
      transportStrategy: plan.transportStrategy,
      webhookPath: plan.webhookPath,
      doctorCommand: 'npm run channel-mesh-parity:check',
      features: plan.features,
    };
  }

  private buildSimulation(route: ChannelMeshConnectorRoute): ChannelMeshParitySimulation {
    const channelId = route.canonicalChannelId;
    return {
      inbound: {
        channelId,
        sessionId: `${channelId}:dry-session`,
        userId: `${channelId}:operator`,
        text: `dry inbound for ${channelId}`,
        normalized: true,
        metadata: {
          source: 'channel-mesh-parity',
          channelId,
          dryRun: true,
        },
      },
      outbound: {
        channelId,
        recipients: [`${channelId}:dry-recipient`],
        text: `dry outbound for ${channelId}`,
        dryRun: true,
        attachmentsSupported: route.features.attachments,
      },
      receipts: [
        {
          kind: 'channel.inbound.simulated',
          channelId,
          summary: `${channelId} inbound envelope normalized without external IO.`,
        },
        {
          kind: 'channel.outbound.simulated',
          channelId,
          summary: `${channelId} outbound envelope planned without live send.`,
        },
      ],
    };
  }

  private resolveStatus(
    sourceName: string,
    gatewayStatus: ChannelAdapterStatus | null,
    transportStrategy: ChannelMeshParityTransportStrategy,
    primitiveId: string | null,
  ): ChannelMeshParityStatus {
    if (primitiveId !== 'channel.message') {
      return 'unmapped';
    }
    if (gatewayStatus) {
      return gatewayStatus.readiness === 'ready' && gatewayStatus.implementationState === 'full'
        ? 'native'
        : 'adapter-backed';
    }
    if (
      transportStrategy === 'webhook-runtime'
      || transportStrategy === 'generic-webhook-template'
      || transportStrategy === 'bot-api-template'
      || transportStrategy === 'local-bridge'
    ) {
      return 'adapter-backed';
    }
    return 'template-ready';
  }

  private resolveGatewayStrategy(status: ChannelAdapterStatus): ChannelMeshParityTransportStrategy {
    if (status.transport === 'native') {
      return 'native-runtime';
    }
    if (status.transport === 'webhook') {
      return 'webhook-runtime';
    }
    if (status.transport === 'bridge' || status.transport === 'local') {
      return 'local-bridge';
    }
    return 'gateway-adapter';
  }

  private resolveAuthKind(
    sourceName: string,
    transportStrategy: ChannelMeshParityTransportStrategy,
  ): ChannelMeshAuthKind {
    if (transportStrategy === 'local-bridge') {
      return ['bluebubbles', 'imessage'].includes(sourceName) ? 'device_pairing' : 'local_pairing';
    }
    if (transportStrategy === 'webhook-runtime' || transportStrategy === 'generic-webhook-template') {
      return 'webhook_secret';
    }
    if (['teams', 'msteams', 'slack', 'googlechat'].includes(sourceName)) {
      return 'oauth';
    }
    if (sourceName === 'webhooks') {
      return 'webhook_secret';
    }
    return BOT_API_CHANNELS.has(sourceName) ? 'bot_token' : 'manual';
  }

  private resolveCredentialRefs(
    sourceName: string,
    canonicalChannelId: string,
    authKind: ChannelMeshAuthKind,
  ): string[] {
    if (authKind === 'none') {
      return [];
    }
    const prefix = this.toEnvPrefix(canonicalChannelId);
    if (authKind === 'oauth') {
      return [`${prefix}_CLIENT_ID`, `${prefix}_CLIENT_SECRET`, `${prefix}_OAUTH_TOKEN`];
    }
    if (authKind === 'webhook_secret') {
      return [`${prefix}_WEBHOOK_SECRET`, `${prefix}_WEBHOOK_URL`];
    }
    if (authKind === 'local_pairing' || authKind === 'device_pairing') {
      return [`${prefix}_PAIRING_REF`];
    }
    if (sourceName === 'whatsapp') {
      return ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_WEBHOOK_SECRET'];
    }
    return [`${prefix}_BOT_TOKEN`];
  }

  private buildFindings(
    status: ChannelMeshParityStatus,
    sourceName: string,
    gatewayStatus: ChannelAdapterStatus | null,
    plan: ChannelPlan,
  ): string[] {
    const findings: string[] = [];
    if (!gatewayStatus) {
      findings.push('channel route generated from Credential vault parity template');
    }
    if (status === 'unsupported') {
      findings.push('channel needs product decision before adapter implementation');
    }
    if (plan.credentialRefs.length === 0 && plan.authKind !== 'none') {
      findings.push('credential refs are missing');
    }
    if (plan.features.attachments && !plan.features.approvals) {
      findings.push('attachments require approval policy');
    }
    return findings.length > 0 ? findings : [`${sourceName} has a governed channel route`];
  }

  private findGatewayStatus(canonicalChannelId: string, sourceName: string): ChannelAdapterStatus | null {
    const candidates = new Set([
      canonicalChannelId,
      sourceName,
      this.resolveCanonicalChannelId(sourceName),
    ]);
    return this.adapterStatuses.find((entry) => candidates.has(this.normalizeId(String(entry.id)))) || null;
  }

  private resolveCanonicalChannelId(sourceName: string): string {
    return CHANNEL_ALIASES[this.normalizeId(sourceName)] || this.normalizeId(sourceName);
  }

  private resolveWebhookPath(
    canonicalChannelId: string,
    transportStrategy: ChannelMeshParityTransportStrategy,
  ): string | null {
    if (transportStrategy !== 'webhook-runtime' && transportStrategy !== 'generic-webhook-template') {
      return null;
    }
    return canonicalChannelId === 'webhook'
      ? '/api/webhooks/channel'
      : `/api/webhooks/${canonicalChannelId}`;
  }

  private supportsAttachments(channelId: string): boolean {
    return ['discord', 'slack', 'whatsapp', 'teams', 'signal', 'email', 'line'].includes(channelId);
  }

  private supportsThreads(channelId: string): boolean {
    return ['discord', 'slack', 'telegram', 'teams', 'email', 'mattermost'].includes(channelId);
  }

  private normalizeId(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private toEnvPrefix(value: string): string {
    return this.normalizeId(value).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  private toPascalCase(value: string): string {
    return this.normalizeId(value)
      .split(/[-_.:]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  private toLabel(value: string): string {
    return this.normalizeId(value)
      .split(/[-_.:]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
