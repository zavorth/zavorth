import { ChannelMeshServiceAdapter } from '../infrastructure/ChannelMeshServiceAdapter.js';
import type {
  ChannelMeshPort,
  ChannelRegistryPort,
  ChannelsDomainReadModel,
} from '../domain/ChannelsDomainTypes.js';

type ChannelMeshUseCasesRuntime = {
  now?: () => Date;
  channelMesh?: ChannelMeshPort | null;
  channelRegistry?: ChannelRegistryPort | null;
  configuredChannels?: number | null;
  remoteReady?: number | null;
};

export class ChannelMeshUseCases {
  private readonly now: () => Date;
  private readonly adapter: ChannelMeshServiceAdapter;
  private readonly configuredChannels: number;
  private readonly remoteReady: number;

  constructor(runtime: ChannelMeshUseCasesRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.adapter = new ChannelMeshServiceAdapter(runtime.channelMesh || null, runtime.channelRegistry || null);
    this.configuredChannels = Number(runtime.configuredChannels || 0) || 0;
    this.remoteReady = Number(runtime.remoteReady || 0) || 0;
  }

  public buildReadModel(): ChannelsDomainReadModel {
    const meshSnapshot = this.adapter.buildMeshSnapshot();
    if (meshSnapshot) {
      return {
        generatedAt: meshSnapshot.generatedAt,
        total: meshSnapshot.summary.total,
        configuredChannels: meshSnapshot.summary.configured || 0,
        remoteReady: meshSnapshot.summary.ready,
        partial: meshSnapshot.summary.partial,
        planned: meshSnapshot.summary.planned,
        disabled: meshSnapshot.summary.disabled,
        sessionSendReady: meshSnapshot.summary.sessionSendReady || 0,
        headline: meshSnapshot.narrative.headline,
        operatorSummary: meshSnapshot.narrative.operatorSummary,
        source: 'channel-mesh',
      };
    }

    const channels = this.adapter.listRegistryChannels();
    if (channels.length > 0) {
      return {
        generatedAt: this.now().toISOString(),
        total: channels.length,
        configuredChannels: channels.filter((entry) => entry.configured).length,
        remoteReady: channels.filter((entry) => entry.readiness === 'ready').length,
        partial: channels.filter((entry) => entry.readiness === 'partial').length,
        planned: channels.filter((entry) => entry.readiness === 'planned').length,
        disabled: channels.filter((entry) => entry.readiness === 'disabled').length,
        sessionSendReady: 0,
        headline: `Channels domain sees ${channels.length} channel contract(s) in the registry.`,
        operatorSummary: 'Channel registry is available without the full channel mesh snapshot.',
        source: 'channel-registry',
      };
    }

    return {
      generatedAt: this.now().toISOString(),
      total: this.configuredChannels,
      configuredChannels: this.configuredChannels,
      remoteReady: this.remoteReady,
      partial: 0,
      planned: 0,
      disabled: 0,
      sessionSendReady: 0,
      headline: 'Channels domain waiting for channel mesh injection.',
      operatorSummary: this.configuredChannels > 0
        ? `Channels seeded with ${this.configuredChannels} configured channel(s).`
        : 'Channels domain is ready to own mesh, install and setup assistant use cases.',
      source: 'seed',
    };
  }
}
