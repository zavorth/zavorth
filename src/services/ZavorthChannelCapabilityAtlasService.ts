import type { ChannelAdapterStatus } from '../contracts/ChannelMeshContract.js';
import {
  ZAVORTH_CHANNEL_CAPABILITY_ATLAS_CONTRACT_VERSION,
  type ZavorthChannelCapabilityAtlasEntry,
  type ZavorthChannelCapabilityAtlasSnapshot,
  type ZavorthChannelCapabilityAtlasState,
  type ZavorthChannelCapabilityAtlasStatus,
} from '../contracts/ZavorthChannelCapabilityAtlasContract.js';
import type { ChannelLongTailActivationEntry } from '../contracts/ChannelLongTailActivationContract.js';
import { ChannelLongTailActivationService } from './ChannelLongTailActivationService.js';
import { GatewayChannelAdapterRegistryService } from './GatewayChannelAdapterRegistryService.js';

export type ZavorthChannelCapabilityAtlasRuntime = {
  now?: () => Date;
  registry?: Pick<GatewayChannelAdapterRegistryService, 'listAdapters'>;
  longTailActivationService?: Pick<ChannelLongTailActivationService, 'buildSnapshot' | 'runConfiguredDoctor'>;
};

export type ZavorthChannelCapabilityAtlasInput = {
  query?: string | null;
  limit?: number | null;
};

const CORE_NATIVE_CHANNELS = new Set([
  'discord',
  'email',
  'imessage',
  'instagram',
  'signal',
  'slack',
  'teams',
  'telegram',
  'web',
  'whatsapp',
]);

export class ZavorthChannelCapabilityAtlasService {
  private readonly now: () => Date;
  private readonly registry: Pick<GatewayChannelAdapterRegistryService, 'listAdapters'>;
  private readonly longTailActivation: Pick<ChannelLongTailActivationService, 'buildSnapshot' | 'runConfiguredDoctor'>;

  public constructor(runtime: ZavorthChannelCapabilityAtlasRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.longTailActivation = runtime.longTailActivationService || new ChannelLongTailActivationService();
    this.registry = runtime.registry || new GatewayChannelAdapterRegistryService({
      includeLongTailActivationAdapters: true,
      channelLongTailActivationService: this.longTailActivation,
    });
  }

  public buildSnapshot(input: ZavorthChannelCapabilityAtlasInput = {}): ZavorthChannelCapabilityAtlasSnapshot {
    const channels = this.filterChannels(this.buildChannels(), input);
    const summary = this.buildSummary(channels);
    const status: ZavorthChannelCapabilityAtlasStatus = channels.length > 0 ? 'ready' : 'blocked';
    return {
      contractVersion: ZAVORTH_CHANNEL_CAPABILITY_ATLAS_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      surface: 'channel-capability-atlas',
      status,
      summary,
      channels,
      llmContextBlock: this.buildLlmContextBlock(channels),
      commands: {
        status: 'zavorth channels atlas',
        json: 'npm run zavorth:channel-capability-atlas:json --silent',
        lookup: 'zavorth channels atlas --query "<channel>"',
        doctor: 'zavorth channels doctor <channel>',
        liveSmoke: 'zavorth channels canary <channel> --confirm-live-io',
      },
      safety: {
        readOnlyInventory: true,
        noSecretsSerialized: true,
        inboundBecomesIntentNotExecution: true,
        outboundRequiresPolicyOrApproval: true,
      },
    };
  }

  public renderText(snapshot = this.buildSnapshot()): string {
    return [
      'Channel Capability Atlas',
      '',
      `status=${snapshot.status}`,
      `channels=${snapshot.summary.total} core=${snapshot.summary.coreNative} native_configurable=${snapshot.summary.nativeConfigurable}`,
      '',
      ...snapshot.channels.map((channel) =>
        `${channel.id} | ${channel.level} | ${channel.state} | ${channel.adapterFamily} | ${channel.dashboardAction}`,
      ),
      '',
    ].join('\n');
  }

  public buildLlmContextBlock(channels = this.buildChannels()): string {
    const visible = channels.slice(0, 35);
    return [
      'Channel Capability Atlas (canonical Zavorth channel map; read-only inventory).',
      'Core and long-tail channels are Zavorth-native when listed as core-native or native-configurable.',
      ...visible.map((channel) =>
        `- ${channel.id}: ${channel.level}; state=${channel.state}; family=${channel.adapterFamily}; doctor=${channel.doctor.available}; liveSmoke=${channel.liveSmoke.available}; env=${channel.envRefs.join(',') || 'none'}.`,
      ),
      'Execution rule: inbound channel messages become governed intents; outbound sends require channel policy, preview or approval.',
    ].join('\n');
  }

  private buildChannels(): ZavorthChannelCapabilityAtlasEntry[] {
    const longTailSnapshot = this.longTailActivation.buildSnapshot();
    const longTailById = new Map(longTailSnapshot.entries.map((entry) => [entry.channelId, entry]));
    const channels = this.registry.listAdapters().map((status) => {
      const id = normalizeId(status.id);
      const longTail = longTailById.get(id as ChannelLongTailActivationEntry['channelId']) || null;
      return longTail ? this.fromLongTail(longTail, status) : this.fromCore(status);
    });
    return channels.sort((left, right) =>
      levelOrder(left.level) - levelOrder(right.level) || left.label.localeCompare(right.label),
    );
  }

  private fromCore(status: ChannelAdapterStatus): ZavorthChannelCapabilityAtlasEntry {
    const id = normalizeId(status.id);
    const state: ZavorthChannelCapabilityAtlasState = status.configured || status.readiness === 'ready'
      ? 'configured'
      : 'needs-config';
    return {
      id,
      label: status.label || humanize(id),
      level: CORE_NATIVE_CHANNELS.has(id) ? 'core-native' : 'native-configurable',
      state,
      adapterFamily: status.transport || 'native',
      transport: status.transport || 'native',
      envRefs: [],
      requiredEnv: [],
      optionalEnv: [],
      capabilities: {
        inbound: status.features.inbound,
        outbound: status.features.outbound,
        replies: Boolean(status.features.richReplies || status.features.sessionSend),
        attachments: status.features.attachments,
        threads: status.features.threads,
        webhookValidation: Boolean(status.features.webhook),
        localProcess: Boolean(status.features.localBridge),
      },
      doctor: {
        available: true,
        command: status.doctorCommand || `zavorth channels doctor ${id}`,
        liveIoUsedByDefault: false,
      },
      liveSmoke: {
        available: true,
        command: `zavorth channels canary ${id} --confirm-live-io`,
        liveIoUsedByDefault: false,
        requiresExplicitConfirmation: true,
      },
      dashboardAction: id === 'web' || state === 'configured' ? 'connect' : 'connect',
      statusReason: state === 'configured'
        ? 'Route is present locally; live sends still use channel policy.'
        : 'Waiting for channel token, bridge, webhook or account configuration.',
    };
  }

  private fromLongTail(
    entry: ChannelLongTailActivationEntry,
    status: ChannelAdapterStatus,
  ): ZavorthChannelCapabilityAtlasEntry {
    const requiredEnv = entry.configSchema.requiredEnv.slice();
    const optionalEnv = unique([...entry.configSchema.optionalEnv, ...entry.configSchema.secretEnv]);
    return {
      id: entry.channelId,
      label: status.label || humanize(entry.channelId),
      level: 'native-configurable',
      state: 'needs-config',
      adapterFamily: entry.family,
      transport: status.transport || entry.family,
      envRefs: unique([...requiredEnv, ...optionalEnv]),
      requiredEnv,
      optionalEnv,
      capabilities: { ...entry.capabilities },
      doctor: {
        available: true,
        command: entry.doctorCommand,
        liveIoUsedByDefault: false,
      },
      liveSmoke: {
        available: true,
        command: entry.stagingLiveSmokeCommand,
        liveIoUsedByDefault: false,
        requiresExplicitConfirmation: true,
      },
      dashboardAction: 'connect',
      statusReason: 'Native configurable channel route; connect credentials or bridge to use it live.',
    };
  }

  private filterChannels(
    channels: ZavorthChannelCapabilityAtlasEntry[],
    input: ZavorthChannelCapabilityAtlasInput,
  ): ZavorthChannelCapabilityAtlasEntry[] {
    const query = normalizeSearch(input.query || '');
    const limit = positive(input.limit) || 500;
    return channels
      .filter((channel) => !query || query.every((term) => searchable(channel).includes(term)))
      .slice(0, limit);
  }

  private buildSummary(channels: ZavorthChannelCapabilityAtlasEntry[]): ZavorthChannelCapabilityAtlasSnapshot['summary'] {
    return {
      total: channels.length,
      coreNative: channels.filter((channel) => channel.level === 'core-native').length,
      nativeConfigurable: channels.filter((channel) => channel.level === 'native-configurable').length,
      active: channels.filter((channel) => channel.state === 'active').length,
      configured: channels.filter((channel) => channel.state === 'configured').length,
      needsConfig: channels.filter((channel) => channel.state === 'needs-config').length,
      doctorAvailable: channels.filter((channel) => channel.doctor.available).length,
      liveSmokeAvailable: channels.filter((channel) => channel.liveSmoke.available).length,
    };
  }
}

function searchable(channel: ZavorthChannelCapabilityAtlasEntry): string {
  return [
    channel.id,
    channel.label,
    channel.level,
    channel.state,
    channel.adapterFamily,
    channel.transport,
    channel.envRefs.join(' '),
  ].join(' ').toLowerCase();
}

function levelOrder(value: ZavorthChannelCapabilityAtlasEntry['level']): number {
  if (value === 'core-native') return 0;
  return 1;
}

function normalizeSearch(value: string): string[] {
  return String(value || '').toLowerCase().split(/\s+/).map((term) => term.trim()).filter(Boolean);
}

function normalizeId(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function humanize(value: string): string {
  return String(value || '')
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Channel';
}

function positive(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean)));
}
