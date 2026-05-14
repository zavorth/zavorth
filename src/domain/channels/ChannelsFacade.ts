import { DomainFacadeBase, type DomainSnapshot } from '../DomainFacadeBase.js';
import { ChannelMeshUseCases } from './application/ChannelMeshUseCases.js';
import type { ChannelMeshPort, ChannelRegistryPort } from './domain/ChannelsDomainTypes.js';
import { ChannelsDomainPresenter } from './presentation/ChannelsDomainPresenter.js';

type ChannelsFacadeRuntime = {
  now?: () => Date;
  channelMeshService?: ChannelMeshPort | null;
  channelRegistryService?: ChannelRegistryPort | null;
  configuredChannels?: number | null;
  remoteReady?: number | null;
};

export type ChannelsDomainSnapshot = DomainSnapshot & {
  metrics: {
    configuredChannels: number;
    remoteReady: number;
  };
};

export class ChannelsFacade extends DomainFacadeBase<ChannelsDomainSnapshot> {
  private readonly useCases: ChannelMeshUseCases;
  private readonly presenter = new ChannelsDomainPresenter();

  constructor(runtime: ChannelsFacadeRuntime = {}) {
    super('channels', 'Channels', runtime.now);
    this.useCases = new ChannelMeshUseCases({
      now: runtime.now,
      channelMesh: runtime.channelMeshService || null,
      channelRegistry: runtime.channelRegistryService || null,
      configuredChannels: runtime.configuredChannels,
      remoteReady: runtime.remoteReady,
    });
  }

  public buildSnapshot(): ChannelsDomainSnapshot {
    return this.composeSnapshot(this.presenter.present(this.useCases.buildReadModel())) as ChannelsDomainSnapshot;
  }
}
